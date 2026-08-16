import { supabase } from "@/integrations/supabase/client";
import { fetchJournalData } from "./journal-store";
import type { Journal } from "./journals";
import type { Trade } from "./types";

/** Columnas del CSV completo (diarios + cuentas + estrategias + operaciones + retiros). */
export const FULL_COLUMNS = [
  "tipo",
  "diario",
  "nombre",
  "descripcion",
  "moneda",
  "tipo_cuenta",
  "firma",
  "broker",
  "balance_inicial",
  "balance_actual",
  "limite_drawdown",
  "tipo_drawdown",
  "fase",
  "objetivo",
  "capital_inicial",
  "riesgo_pct",
  "simbolo_principal",
  "color",
  "cuenta",
  "estrategia",
  "simbolo",
  "direccion",
  "fecha_apertura",
  "fecha_cierre",
  "entrada",
  "salida",
  "tamano",
  "pnl",
  "etiquetas",
  "notas",
  "fecha",
  "importe",
  "motivo",
] as const;

type Col = (typeof FULL_COLUMNS)[number];
type CsvRow = Partial<Record<Col, string | number>>;

function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function serialize(rows: CsvRow[]): string {
  const lines = [FULL_COLUMNS.join(",")];
  for (const r of rows) lines.push(FULL_COLUMNS.map((c) => esc(r[c] ?? "")).join(","));
  return "\uFEFF" + lines.join("\n");
}

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parser CSV tolerante (coma o punto y coma, comillas dobles). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const first = clean.split("\n")[0] ?? "";
  const delimiter = first.split(";").length > first.split(",").length ? ";" : ",";
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
  const normalized =
    s.includes(",") && !s.includes(".") ? s.replace(",", ".") : s.replace(/,(?=\d{3}\b)/g, "");
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

function withdrawalKey(w: { date: string; amount: number; strategy: string }) {
  return [w.date.slice(0, 10), w.amount.toFixed(2), w.strategy.toLowerCase()].join("|");
}

/* --------------------------------- export --------------------------------- */

async function journalRows(j: Journal): Promise<CsvRow[]> {
  const data = await fetchJournalData(j.id);
  const accountName = new Map(data.accounts.map((a) => [a.id, a.name]));
  const strategyName = new Map(data.strategies.map((s) => [s.id, s.name]));
  const rows: CsvRow[] = [
    {
      tipo: "diario",
      diario: j.name,
      nombre: j.name,
      descripcion: j.description ?? "",
      moneda: j.base_currency,
    },
  ];
  for (const a of data.accounts) {
    rows.push({
      tipo: "cuenta",
      diario: j.name,
      nombre: a.name,
      moneda: a.currency,
      tipo_cuenta: a.type,
      firma: a.firm ?? "",
      broker: a.broker ?? "",
      balance_inicial: a.initialBalance,
      balance_actual: a.currentBalance,
      limite_drawdown: a.drawdownLimit ?? "",
      tipo_drawdown: a.drawdownType ?? "static",
      fase: a.phase ?? "eval",
      objetivo: a.profitTarget ?? "",
    });
  }
  for (const s of data.strategies) {
    rows.push({
      tipo: "estrategia",
      diario: j.name,
      nombre: s.name,
      capital_inicial: s.initialCapital,
      riesgo_pct: s.riskPct,
      simbolo_principal: s.mainSymbol,
      color: s.color,
      descripcion: s.setup ?? "",
    });
  }
  for (const t of data.trades) {
    rows.push({
      tipo: "operacion",
      diario: j.name,
      cuenta: accountName.get(t.accountId) ?? "",
      estrategia: strategyName.get(t.strategyId) ?? "",
      simbolo: t.symbol,
      direccion: t.direction,
      fecha_apertura: t.openedAt,
      fecha_cierre: t.closedAt,
      entrada: t.entryPrice,
      salida: t.exitPrice,
      tamano: t.size,
      pnl: t.pnl,
      etiquetas: t.tags.join(" "),
      notas: t.notes ?? "",
    });
  }
  for (const w of data.withdrawals) {
    rows.push({
      tipo: "retiro",
      diario: j.name,
      cuenta: w.accountId ? (accountName.get(w.accountId) ?? "") : "",
      estrategia: w.strategyId ? (strategyName.get(w.strategyId) ?? "") : "",
      fecha: w.date,
      importe: w.amount,
      motivo: w.reason ?? "",
    });
  }
  return rows;
}

function slug(s: string) {
  return s.replace(/[^\w-]+/g, "_").toLowerCase();
}

/** Exporta un diario completo (cuentas, estrategias, operaciones y retiros). */
export async function exportJournalCsv(journalId: string, journalName: string) {
  const journal: Journal = {
    id: journalId,
    owner_id: "",
    name: journalName,
    description: null,
    base_currency: "EUR",
    is_archived: false,
    created_at: "",
  };
  const rows = await journalRows(journal);
  download(serialize(rows), `${slug(journalName)}-completo.csv`);
  return rows.length - 1;
}

/** Exporta todos los diarios del usuario en un único CSV. */
export async function exportAllJournalsCsv(journals: Journal[]) {
  const rows: CsvRow[] = [];
  for (const j of journals) rows.push(...(await journalRows(j)));
  download(serialize(rows), `bitacora-completa-${new Date().toISOString().slice(0, 10)}.csv`);
  return rows.length;
}

/* --------------------------------- import --------------------------------- */

export interface ImportResult {
  journals: number;
  accounts: number;
  strategies: number;
  trades: number;
  withdrawals: number;
  duplicates: number;
}

interface JournalCtx {
  id: string;
  accounts: Map<string, string>;
  strategies: Map<string, string>;
  trades: Set<string>;
  withdrawals: Set<string>;
}

/**
 * Importa un CSV completo (con columna `tipo`) o un CSV simple de operaciones.
 * `fallbackJournalId` se usa cuando la fila no indica diario.
 */
export async function importJournalCsv(
  fallbackJournalId: string,
  text: string,
): Promise<ImportResult> {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("El archivo no contiene datos");
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const at = (r: string[], name: string) => {
    const i = header.indexOf(name);
    return i < 0 ? "" : (r[i] ?? "").trim();
  };
  const hasType = header.includes("tipo");
  if (!hasType && !header.includes("simbolo")) {
    throw new Error("Formato no reconocido: falta la columna 'tipo' o 'simbolo'");
  }

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sesión no válida");

  const { data: existingJournals, error: jErr } = await supabase
    .from("journals")
    .select("id, name");
  if (jErr) throw jErr;
  const journalIds = new Map(
    ((existingJournals ?? []) as { id: string; name: string }[]).map((j) => [
      j.name.toLowerCase(),
      j.id,
    ]),
  );

  const result: ImportResult = {
    journals: 0,
    accounts: 0,
    strategies: 0,
    trades: 0,
    withdrawals: 0,
    duplicates: 0,
  };
  const contexts = new Map<string, JournalCtx>();

  async function ctxFor(id: string): Promise<JournalCtx> {
    const cached = contexts.get(id);
    if (cached) return cached;
    const data = await fetchJournalData(id);
    const ctx: JournalCtx = {
      id,
      accounts: new Map(data.accounts.map((a) => [a.name.toLowerCase(), a.id])),
      strategies: new Map(data.strategies.map((s) => [s.name.toLowerCase(), s.id])),
      trades: new Set(data.trades.map(tradeKey)),
      withdrawals: new Set(
        data.withdrawals.map((w) =>
          withdrawalKey({
            date: w.date,
            amount: w.amount,
            strategy:
              data.strategies.find((s) => s.id === w.strategyId)?.name ?? "",
          }),
        ),
      ),
    };
    contexts.set(id, ctx);
    return ctx;
  }

  async function resolveJournal(name: string): Promise<string> {
    if (!name) return fallbackJournalId;
    const found = journalIds.get(name.toLowerCase());
    if (found) return found;
    const { data, error } = await supabase
      .from("journals")
      .insert({ owner_id: userId, name, base_currency: "EUR" } as never)
      .select("id")
      .single();
    if (error) throw error;
    const id = (data as { id: string }).id;
    journalIds.set(name.toLowerCase(), id);
    result.journals++;
    return id;
  }

  async function ensureAccount(ctx: JournalCtx, name: string): Promise<string | null> {
    if (!name) return null;
    const found = ctx.accounts.get(name.toLowerCase());
    if (found) return found;
    const { data, error } = await supabase
      .from("accounts")
      .insert({
        journal_id: ctx.id,
        user_id: userId,
        name,
        type: "personal",
        initial_balance: 0,
        current_balance: 0,
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    const id = (data as { id: string }).id;
    ctx.accounts.set(name.toLowerCase(), id);
    result.accounts++;
    return id;
  }

  async function ensureStrategy(ctx: JournalCtx, name: string, symbol = ""): Promise<string | null> {
    if (!name) return null;
    const found = ctx.strategies.get(name.toLowerCase());
    if (found) return found;
    const { data, error } = await supabase
      .from("strategies")
      .insert({ journal_id: ctx.id, user_id: userId, name, main_symbol: symbol } as never)
      .select("id")
      .single();
    if (error) throw error;
    const id = (data as { id: string }).id;
    ctx.strategies.set(name.toLowerCase(), id);
    result.strategies++;
    return id;
  }

  for (const r of rows.slice(1)) {
    const type = hasType ? at(r, "tipo").toLowerCase() : "operacion";
    const journalId = await resolveJournal(hasType ? at(r, "diario") : "");
    const ctx = await ctxFor(journalId);

    if (type === "diario") {
      const desc = at(r, "descripcion");
      const currency = at(r, "moneda");
      if (desc || currency) {
        await supabase
          .from("journals")
          .update({
            ...(desc ? { description: desc } : {}),
            ...(currency ? { base_currency: currency } : {}),
          } as never)
          .eq("id", journalId);
      }
      continue;
    }

    if (type === "cuenta") {
      const name = at(r, "nombre") || at(r, "cuenta");
      if (!name) continue;
      if (ctx.accounts.has(name.toLowerCase())) {
        result.duplicates++;
        continue;
      }
      const { data, error } = await supabase
        .from("accounts")
        .insert({
          journal_id: ctx.id,
          user_id: userId,
          name,
          type: at(r, "tipo_cuenta") === "funded" ? "funded" : "personal",
          firm: at(r, "firma") || null,
          broker: at(r, "broker") || null,
          initial_balance: num(at(r, "balance_inicial")),
          current_balance: num(at(r, "balance_actual")) || num(at(r, "balance_inicial")),
          drawdown_limit: at(r, "limite_drawdown") ? num(at(r, "limite_drawdown")) : null,
          drawdown_type: ["static", "trailing", "eod"].includes(at(r, "tipo_drawdown"))
            ? at(r, "tipo_drawdown")
            : "static",
          phase: at(r, "fase") === "live" ? "live" : "eval",
          profit_target: at(r, "objetivo") ? num(at(r, "objetivo")) : null,
          currency: at(r, "moneda") || "USD",
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      ctx.accounts.set(name.toLowerCase(), (data as { id: string }).id);
      result.accounts++;
      continue;
    }

    if (type === "estrategia") {
      const name = at(r, "nombre") || at(r, "estrategia");
      if (!name) continue;
      if (ctx.strategies.has(name.toLowerCase())) {
        result.duplicates++;
        continue;
      }
      const { data, error } = await supabase
        .from("strategies")
        .insert({
          journal_id: ctx.id,
          user_id: userId,
          name,
          initial_capital: num(at(r, "capital_inicial")),
          risk_pct: num(at(r, "riesgo_pct")) || 0.01,
          main_symbol: at(r, "simbolo_principal"),
          ...(at(r, "color") ? { color: at(r, "color") } : {}),
          ...(at(r, "descripcion") ? { setup: at(r, "descripcion") } : {}),
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      ctx.strategies.set(name.toLowerCase(), (data as { id: string }).id);
      result.strategies++;
      continue;
    }

    if (type === "retiro") {
      const stName = at(r, "estrategia");
      const date = toIso(at(r, "fecha"));
      const amount = num(at(r, "importe"));
      const key = withdrawalKey({ date, amount, strategy: stName });
      if (ctx.withdrawals.has(key)) {
        result.duplicates++;
        continue;
      }
      const strategyId = await ensureStrategy(ctx, stName);
      const accountId = await ensureAccount(ctx, at(r, "cuenta"));
      const { error } = await supabase.from("withdrawals").insert({
        journal_id: ctx.id,
        user_id: userId,
        strategy_id: strategyId,
        account_id: accountId,
        date,
        amount,
        reason: at(r, "motivo") || null,
      } as never);
      if (error) throw error;
      ctx.withdrawals.add(key);
      result.withdrawals++;
      continue;
    }

    // operación
    const symbol = at(r, "simbolo").toUpperCase();
    if (!symbol) continue;
    const closedAt = toIso(at(r, "fecha_cierre") || at(r, "fecha_apertura"));
    const openedAt = at(r, "fecha_apertura") ? toIso(at(r, "fecha_apertura")) : closedAt;
    const trade = {
      symbol,
      closedAt,
      entryPrice: num(at(r, "entrada")),
      exitPrice: num(at(r, "salida")),
      size: num(at(r, "tamano")) || 1,
      pnl: num(at(r, "pnl")),
    };
    const key = tradeKey(trade);
    if (ctx.trades.has(key)) {
      result.duplicates++;
      continue;
    }
    const accountId = await ensureAccount(ctx, at(r, "cuenta"));
    const strategyId = await ensureStrategy(ctx, at(r, "estrategia"), symbol);
    const direction: Trade["direction"] = at(r, "direccion").toLowerCase().startsWith("s")
      ? "short"
      : "long";
    const { error } = await supabase.from("trades").insert({
      journal_id: ctx.id,
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
      tags: at(r, "etiquetas").split(/[\s,;]+/).filter(Boolean),
      notes: at(r, "notas") || null,
      source: "manual",
    } as never);
    if (error) throw error;
    ctx.trades.add(key);
    result.trades++;
  }

  return result;
}
