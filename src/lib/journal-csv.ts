import { supabase } from "@/integrations/supabase/client";
import { fetchJournalData } from "./journal-store";
import type { Trade } from "./types";

export const CSV_COLUMNS = [
  "fecha_apertura",
  "fecha_cierre",
  "cuenta",
  "estrategia",
  "simbolo",
  "direccion",
  "entrada",
  "salida",
  "tamano",
  "pnl",
  "etiquetas",
  "notas",
] as const;

function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Parser CSV tolerante (coma o punto y coma, comillas dobles). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const delimiter = (clean.split("\n")[0]?.split(";").length ?? 1) > (clean.split("\n")[0]?.split(",").length ?? 1) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function num(v: string | undefined): number {
  if (!v) return 0;
  const s = v.trim().replace(/\s/g, "").replace(/[€$]/g, "");
  const normalized = s.includes(",") && !s.includes(".") ? s.replace(",", ".") : s.replace(/,(?=\d{3}\b)/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function toIso(v: string | undefined): string {
  if (!v?.trim()) return new Date().toISOString();
  const s = v.trim();
  const m = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})(?:[ T](\d{2}):(\d{2}))?/);
  if (m) {
    return new Date(
      Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0)),
    ).toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function tradeKey(t: {
  symbol: string;
  closedAt: string;
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
}) {
  return [
    t.symbol.toUpperCase().trim(),
    t.closedAt.slice(0, 16),
    t.entryPrice.toFixed(4),
    t.exitPrice.toFixed(4),
    t.size,
    t.pnl.toFixed(2),
  ].join("|");
}

export async function exportJournalCsv(journalId: string, journalName: string) {
  const data = await fetchJournalData(journalId);
  const accountName = new Map(data.accounts.map((a) => [a.id, a.name]));
  const strategyName = new Map(data.strategies.map((s) => [s.id, s.name]));
  const lines = [CSV_COLUMNS.join(",")];
  for (const t of data.trades) {
    lines.push(
      [
        t.openedAt,
        t.closedAt,
        accountName.get(t.accountId) ?? "",
        strategyName.get(t.strategyId) ?? "",
        t.symbol,
        t.direction,
        t.entryPrice,
        t.exitPrice,
        t.size,
        t.pnl,
        t.tags.join(" "),
        t.notes ?? "",
      ]
        .map(esc)
        .join(","),
    );
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${journalName.replace(/[^\w\-]+/g, "_").toLowerCase()}-operaciones.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return data.trades.length;
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  createdAccounts: number;
  createdStrategies: number;
}

export async function importJournalCsv(journalId: string, text: string): Promise<ImportResult> {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("El archivo no contiene operaciones");
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const col = {
    open: idx("fecha_apertura"),
    close: idx("fecha_cierre"),
    account: idx("cuenta"),
    strategy: idx("estrategia"),
    symbol: idx("simbolo"),
    direction: idx("direccion"),
    entry: idx("entrada"),
    exit: idx("salida"),
    size: idx("tamano"),
    pnl: idx("pnl"),
    tags: idx("etiquetas"),
    notes: idx("notas"),
  };
  if (col.symbol < 0 || col.pnl < 0) {
    throw new Error("Faltan columnas obligatorias: simbolo y pnl");
  }

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sesión no válida");

  const data = await fetchJournalData(journalId);
  const accounts = new Map(data.accounts.map((a) => [a.name.toLowerCase(), a.id]));
  const strategies = new Map(data.strategies.map((s) => [s.name.toLowerCase(), s.id]));
  const existing = new Set(data.trades.map(tradeKey));

  let createdAccounts = 0;
  let createdStrategies = 0;
  let duplicates = 0;
  const payload: Record<string, unknown>[] = [];

  for (const r of rows.slice(1)) {
    const symbol = (r[col.symbol] ?? "").trim().toUpperCase();
    if (!symbol) continue;
    const closedAt = toIso(r[col.close] ?? r[col.open]);
    const openedAt = col.open >= 0 ? toIso(r[col.open]) : closedAt;
    const trade = {
      symbol,
      closedAt,
      entryPrice: num(r[col.entry]),
      exitPrice: num(r[col.exit]),
      size: num(r[col.size]) || 1,
      pnl: num(r[col.pnl]),
    };
    const key = tradeKey(trade);
    if (existing.has(key)) {
      duplicates++;
      continue;
    }
    existing.add(key);

    const accName = (r[col.account] ?? "").trim();
    let accountId: string | null = accName ? (accounts.get(accName.toLowerCase()) ?? null) : null;
    if (accName && !accountId) {
      const { data: created, error } = await supabase
        .from("accounts")
        .insert({
          journal_id: journalId,
          user_id: userId,
          name: accName,
          type: "personal",
          initial_balance: 0,
          current_balance: 0,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      accountId = (created as { id: string }).id;
      accounts.set(accName.toLowerCase(), accountId);
      createdAccounts++;
    }

    const stName = (r[col.strategy] ?? "").trim();
    let strategyId: string | null = stName ? (strategies.get(stName.toLowerCase()) ?? null) : null;
    if (stName && !strategyId) {
      const { data: created, error } = await supabase
        .from("strategies")
        .insert({
          journal_id: journalId,
          user_id: userId,
          name: stName,
          main_symbol: symbol,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      strategyId = (created as { id: string }).id;
      strategies.set(stName.toLowerCase(), strategyId);
      createdStrategies++;
    }

    const direction: Trade["direction"] =
      (r[col.direction] ?? "").trim().toLowerCase().startsWith("s") ? "short" : "long";

    payload.push({
      journal_id: journalId,
      user_id: userId,
      account_id: accountId,
      strategy_id: strategyId,
      symbol,
      direction,
      opened_at: openedAt,
      closed_at: closedAt,
      entry_price: trade.entryPrice,
      exit_price: trade.exitPrice,
      size: trade.size,
      pnl: trade.pnl,
      tags: (r[col.tags] ?? "").split(/[\s,;]+/).filter(Boolean),
      notes: (r[col.notes] ?? "").trim() || null,
      source: "manual",
    });
  }

  if (payload.length) {
    const { error } = await supabase.from("trades").insert(payload as never);
    if (error) throw error;
  }

  return { imported: payload.length, duplicates, createdAccounts, createdStrategies };
}
