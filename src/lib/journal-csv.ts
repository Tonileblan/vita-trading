import { supabase } from "@/integrations/supabase/client";
import { fetchJournalData } from "./journal-store";
import type { Journal } from "./journals";
import type { Trade } from "./types";

/**
 * Columnas del CSV completo: diarios, cuentas, estrategias (ficha completa),
 * operaciones (incl. gestión emocional), retiros (con estado), gastos,
 * check-ins de ánimo, reglas de riesgo y tramos de estrategia por fechas.
 */
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
  "mercado",
  "grafico",
  "dias",
  "horario",
  "ejecucion",
  "setup",
  "gestion",
  "contratos",
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
  "origen",
  "lote_importacion",
  "emocion_antes",
  "emocion_despues",
  "siguio_plan",
  "errores",
  "nota_emocional",
  "fecha",
  "importe",
  "motivo",
  "estado",
  "fecha_solicitud",
  "fecha_aprobacion",
  "categoria",
  "concepto",
  "recurrencia",
  "fin_recurrencia",
  "pagado",
  "animo",
  "energia",
  "estres",
  "foco",
  "horas_sueno",
  "intencion",
  "revision",
  "fecha_inicio",
  "fecha_fin",
  "activo",
  "max_racha_perdidas",
  "max_ops_dia",
  "max_perdida_dia",
  "exige_checkin",
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

function bool(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "si" || s === "sí" || s === "true" || s === "1" || s === "yes";
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

/** Fecha en formato YYYY-MM-DD (columnas de tipo `date`). */
function toDay(v: string | undefined): string {
  return toIso(v).slice(0, 10);
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

function expenseKey(e: { date: string; amount: number; concept: string }) {
  return [e.date.slice(0, 10), e.amount.toFixed(2), e.concept.toLowerCase().trim()].join("|");
}

/* --------------------------------- export --------------------------------- */

interface ExpenseRow {
  journal_id: string | null;
  account_id: string | null;
  category: string;
  concept: string;
  amount: number;
  currency: string;
  date: string;
  recurrence: string;
  recurrence_end: string | null;
  paid: boolean;
  notes: string | null;
}

interface CheckinRow {
  date: string;
  mood: number;
  energy: number;
  stress: number;
  focus: number;
  sleep_hours: number | null;
  intention: string | null;
  review_note: string | null;
}

interface RulesRow {
  enabled: boolean;
  max_loss_streak: number | null;
  max_trades_day: number | null;
  max_daily_loss: number | null;
  require_checkin: boolean;
}

async function journalRows(j: Journal): Promise<CsvRow[]> {
  const data = await fetchJournalData(j.id);
  const [expensesRes, checkinsRes, rulesRes] = await Promise.all([
    supabase.from("expenses").select("*").eq("journal_id", j.id),
    supabase.from("mood_checkins").select("*").eq("journal_id", j.id),
    supabase.from("journal_rules").select("*").eq("journal_id", j.id).maybeSingle(),
  ]);
  const expenses = (expensesRes.data ?? []) as unknown as ExpenseRow[];
  const checkins = (checkinsRes.data ?? []) as unknown as CheckinRow[];
  const rules = (rulesRes.data ?? null) as unknown as RulesRow | null;

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
      limite_total_perdida: a.maxLossLimit ?? a.drawdownLimit ?? "",
      limite_diario: a.dailyLossLimit ?? "",
      high_watermark: a.highWatermark ?? "",
      balance_inicio_dia: a.startOfDayBalance ?? "",
      limite_drawdown: a.maxLossLimit ?? a.drawdownLimit ?? "",
      tipo_drawdown: a.drawdownType ?? "static",
      fase: a.phase ?? "eval",
      objetivo: a.profitTarget ?? "",
      estrategia: a.strategyId ? (strategyName.get(a.strategyId) ?? "") : "",
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
      mercado: s.market ?? "",
      grafico: s.chart ?? "",
      dias: s.days ?? "",
      horario: s.schedule ?? "",
      ejecucion: s.execution ?? "",
      setup: s.setup ?? "",
      gestion: s.management ?? "",
      contratos: s.contracts ?? "",
      descripcion: s.setup ?? "",
    });
  }
  for (const p of data.strategyPeriods) {
    rows.push({
      tipo: "tramo",
      diario: j.name,
      cuenta: accountName.get(p.accountId) ?? "",
      estrategia: strategyName.get(p.strategyId) ?? "",
      fecha_inicio: p.startDate,
      fecha_fin: p.endDate ?? "",
      notas: p.note ?? "",
    });
  }
  for (const t of data.trades) {
    rows.push({
      tipo: "operacion",
      diario: j.name,
      cuenta: accountName.get(t.accountId) ?? "",
      estrategia: (t.strategyId ? strategyName.get(t.strategyId) : "") ?? "",
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
      origen: t.source,
      lote_importacion: t.importBatchId ?? "",
      emocion_antes: t.emotionBefore ?? "",
      emocion_despues: t.emotionAfter ?? "",
      siguio_plan: t.followedPlan ?? "",
      errores: (t.mistakes ?? []).join("; "),
      nota_emocional: t.emotionNote ?? "",
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
      estado: w.status,
      fecha_solicitud: w.requestedAt ?? "",
      fecha_aprobacion: w.approvedAt ?? "",
    });
  }
  for (const e of expenses) {
    rows.push({
      tipo: "gasto",
      diario: j.name,
      cuenta: e.account_id ? (accountName.get(e.account_id) ?? "") : "",
      categoria: e.category,
      concepto: e.concept,
      importe: e.amount,
      moneda: e.currency,
      fecha: e.date,
      recurrencia: e.recurrence,
      fin_recurrencia: e.recurrence_end ?? "",
      pagado: e.paid ? "si" : "no",
      notas: e.notes ?? "",
    });
  }
  for (const c of checkins) {
    rows.push({
      tipo: "checkin",
      diario: j.name,
      fecha: c.date,
      animo: c.mood,
      energia: c.energy,
      estres: c.stress,
      foco: c.focus,
      horas_sueno: c.sleep_hours ?? "",
      intencion: c.intention ?? "",
      revision: c.review_note ?? "",
    });
  }
  if (rules) {
    rows.push({
      tipo: "reglas",
      diario: j.name,
      activo: rules.enabled ? "si" : "no",
      max_racha_perdidas: rules.max_loss_streak ?? "",
      max_ops_dia: rules.max_trades_day ?? "",
      max_perdida_dia: rules.max_daily_loss ?? "",
      exige_checkin: rules.require_checkin ? "si" : "no",
    });
  }
  return rows;
}

function slug(s: string) {
  return s.replace(/[^\w-]+/g, "_").toLowerCase();
}

/** Exporta un diario completo (cuentas, estrategias, operaciones, retiros, gastos y mente). */
export async function exportJournalCsv(journalId: string, journalName: string) {
  const journal: Journal = {
    id: journalId,
    owner_id: "",
    name: journalName,
    description: null,
    base_currency: "EUR",
    is_archived: false,
    is_template: false,
    created_at: "",
  };
  const rows = await journalRows(journal);
  download(serialize(rows), `${slug(journalName)}-completo.csv`);
  return rows.length - 1;
}

/** Exporta todos los diarios del usuario en un único CSV, incluidos los gastos generales. */
export async function exportAllJournalsCsv(journals: Journal[]) {
  const rows: CsvRow[] = [];
  for (const j of journals) rows.push(...(await journalRows(j)));
  const { data: globals } = await supabase.from("expenses").select("*").is("journal_id", null);
  for (const e of (globals ?? []) as unknown as ExpenseRow[]) {
    rows.push({
      tipo: "gasto",
      categoria: e.category,
      concepto: e.concept,
      importe: e.amount,
      moneda: e.currency,
      fecha: e.date,
      recurrencia: e.recurrence,
      fin_recurrencia: e.recurrence_end ?? "",
      pagado: e.paid ? "si" : "no",
      notas: e.notes ?? "",
    });
  }
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
  expenses: number;
  checkins: number;
  periods: number;
  duplicates: number;
}

interface JournalCtx {
  id: string;
  accounts: Map<string, string>;
  strategies: Map<string, string>;
  trades: Set<string>;
  withdrawals: Set<string>;
  expenses: Set<string>;
  periods: Set<string>;
  checkins: Set<string>;
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
    expenses: 0,
    checkins: 0,
    periods: 0,
    duplicates: 0,
  };
  const contexts = new Map<string, JournalCtx>();
  /** Asignaciones cuenta→estrategia aplicadas al final (la estrategia puede llegar después). */
  const accountStrategy: { journalId: string; account: string; strategy: string }[] = [];
  const periodRows: {
    journalId: string;
    account: string;
    strategy: string;
    start: string;
    end: string;
    note: string;
  }[] = [];

  async function ctxFor(id: string): Promise<JournalCtx> {
    const cached = contexts.get(id);
    if (cached) return cached;
    const data = await fetchJournalData(id);
    const [expensesRes, checkinsRes] = await Promise.all([
      supabase.from("expenses").select("date, amount, concept").eq("journal_id", id),
      supabase.from("mood_checkins").select("date").eq("journal_id", id),
    ]);
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
            strategy: data.strategies.find((s) => s.id === w.strategyId)?.name ?? "",
          }),
        ),
      ),
      expenses: new Set(
        ((expensesRes.data ?? []) as unknown as ExpenseRow[]).map((e) =>
          expenseKey({ date: e.date, amount: Number(e.amount), concept: e.concept }),
        ),
      ),
      periods: new Set(
        data.strategyPeriods.map((p) => `${p.accountId}|${p.strategyId}|${p.startDate}`),
      ),
      checkins: new Set(
        ((checkinsRes.data ?? []) as unknown as { date: string }[]).map((c) => c.date.slice(0, 10)),
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
      if (at(r, "estrategia")) {
        accountStrategy.push({ journalId, account: name, strategy: at(r, "estrategia") });
      }
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
          market: at(r, "mercado") || null,
          chart: at(r, "grafico") || null,
          days: at(r, "dias") || null,
          schedule: at(r, "horario") || null,
          execution: at(r, "ejecucion") || null,
          setup: at(r, "setup") || at(r, "descripcion") || null,
          management: at(r, "gestion") || null,
          contracts: at(r, "contratos") || null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      ctx.strategies.set(name.toLowerCase(), (data as { id: string }).id);
      result.strategies++;
      continue;
    }

    if (type === "tramo") {
      periodRows.push({
        journalId,
        account: at(r, "cuenta"),
        strategy: at(r, "estrategia"),
        start: at(r, "fecha_inicio"),
        end: at(r, "fecha_fin"),
        note: at(r, "notas"),
      });
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
      const status = ["pending", "approved", "rejected"].includes(at(r, "estado"))
        ? at(r, "estado")
        : "approved";
      const { error } = await supabase.from("withdrawals").insert({
        journal_id: ctx.id,
        user_id: userId,
        strategy_id: strategyId,
        account_id: accountId,
        date,
        amount,
        reason: at(r, "motivo") || null,
        status,
        requested_at: at(r, "fecha_solicitud") ? toIso(at(r, "fecha_solicitud")) : date,
        approved_at:
          status === "approved"
            ? at(r, "fecha_aprobacion")
              ? toIso(at(r, "fecha_aprobacion"))
              : date
            : null,
      } as never);
      if (error) throw error;
      ctx.withdrawals.add(key);
      result.withdrawals++;
      continue;
    }

    if (type === "gasto") {
      const concept = at(r, "concepto") || at(r, "nombre");
      const amount = num(at(r, "importe"));
      if (!concept && !amount) continue;
      const date = toDay(at(r, "fecha"));
      const key = expenseKey({ date, amount, concept });
      if (ctx.expenses.has(key)) {
        result.duplicates++;
        continue;
      }
      const accountId = at(r, "cuenta") ? await ensureAccount(ctx, at(r, "cuenta")) : null;
      const category = ["propfirm", "subscription", "hardware", "tax", "other"].includes(
        at(r, "categoria"),
      )
        ? at(r, "categoria")
        : "other";
      const recurrence = ["none", "monthly", "yearly"].includes(at(r, "recurrencia"))
        ? at(r, "recurrencia")
        : "none";
      const { error } = await supabase.from("expenses").insert({
        journal_id: ctx.id,
        user_id: userId,
        account_id: accountId,
        category,
        concept,
        amount,
        currency: at(r, "moneda") || "EUR",
        date,
        recurrence,
        recurrence_end: at(r, "fin_recurrencia") ? toDay(at(r, "fin_recurrencia")) : null,
        paid: at(r, "pagado") ? bool(at(r, "pagado")) : true,
        notes: at(r, "notas") || null,
      } as never);
      if (error) throw error;
      ctx.expenses.add(key);
      result.expenses++;
      continue;
    }

    if (type === "checkin") {
      const date = toDay(at(r, "fecha"));
      if (ctx.checkins.has(date)) {
        result.duplicates++;
        continue;
      }
      const { error } = await supabase.from("mood_checkins").upsert(
        {
          journal_id: ctx.id,
          user_id: userId,
          date,
          mood: num(at(r, "animo")) || 3,
          energy: num(at(r, "energia")) || 3,
          stress: num(at(r, "estres")) || 3,
          focus: num(at(r, "foco")) || 3,
          sleep_hours: at(r, "horas_sueno") ? num(at(r, "horas_sueno")) : null,
          intention: at(r, "intencion") || null,
          review_note: at(r, "revision") || null,
        } as never,
        { onConflict: "journal_id,user_id,date" },
      );
      if (error) throw error;
      ctx.checkins.add(date);
      result.checkins++;
      continue;
    }

    if (type === "reglas") {
      const { error } = await supabase.from("journal_rules").upsert(
        {
          journal_id: ctx.id,
          user_id: userId,
          enabled: at(r, "activo") ? bool(at(r, "activo")) : true,
          max_loss_streak: at(r, "max_racha_perdidas") ? num(at(r, "max_racha_perdidas")) : null,
          max_trades_day: at(r, "max_ops_dia") ? num(at(r, "max_ops_dia")) : null,
          max_daily_loss: at(r, "max_perdida_dia") ? num(at(r, "max_perdida_dia")) : null,
          require_checkin: bool(at(r, "exige_checkin")),
        } as never,
        { onConflict: "journal_id,user_id" },
      );
      if (error) throw error;
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
    const followed = at(r, "siguio_plan").toLowerCase();
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
      source: at(r, "origen") === "webhook" ? "webhook" : "manual",
      import_batch_id: at(r, "lote_importacion") || null,
      emotion_before: at(r, "emocion_antes") || null,
      emotion_after: at(r, "emocion_despues") || null,
      followed_plan: ["yes", "partial", "no"].includes(followed) ? followed : null,
      mistakes: at(r, "errores").split(/[;,]+/).map((s) => s.trim()).filter(Boolean),
      emotion_note: at(r, "nota_emocional") || null,
    } as never);
    if (error) throw error;
    ctx.trades.add(key);
    result.trades++;
  }

  // Asignación de estrategia por cuenta (una vez existen ambas).
  for (const a of accountStrategy) {
    const ctx = await ctxFor(a.journalId);
    const accountId = ctx.accounts.get(a.account.toLowerCase());
    const strategyId = await ensureStrategy(ctx, a.strategy);
    if (!accountId || !strategyId) continue;
    await supabase.from("accounts").update({ strategy_id: strategyId } as never).eq("id", accountId);
  }

  // Tramos de estrategia por fechas.
  for (const p of periodRows) {
    const ctx = await ctxFor(p.journalId);
    const accountId = await ensureAccount(ctx, p.account);
    const strategyId = await ensureStrategy(ctx, p.strategy);
    if (!accountId || !strategyId || !p.start) continue;
    const start = toDay(p.start);
    const key = `${accountId}|${strategyId}|${start}`;
    if (ctx.periods.has(key)) {
      result.duplicates++;
      continue;
    }
    const { error } = await supabase.from("account_strategy_periods").insert({
      journal_id: ctx.id,
      user_id: userId,
      account_id: accountId,
      strategy_id: strategyId,
      start_date: start,
      end_date: p.end ? toDay(p.end) : null,
      note: p.note || null,
    } as never);
    if (error) throw error;
    ctx.periods.add(key);
    result.periods++;
  }

  return result;
}
