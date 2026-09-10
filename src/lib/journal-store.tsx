import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { mockStrategies } from "./mock-data";
import { useJournals } from "./journals";
import { tradeDayKey } from "./emotions";
import { isTradeOfAccount } from "./metrics";
import type { Account, AccountStrategyPeriod, Strategy, Trade, Withdrawal } from "./types";

const STORAGE_KEY = "tj:active-journal";
const ACCOUNT_STATUS_STORAGE_KEY = "vita-trading:account-status-v1";

export interface StoredAccountStatus {
  status: Account["status"];
  burnedAt?: string;
  burnedReason?: string;
  updatedAt?: number;
}

export function getStoredAccountStatuses(): Record<string, StoredAccountStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ACCOUNT_STATUS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function hydrateAccountStatusesFromUser(user: any) {
  if (typeof window === "undefined" || !user) return;
  try {
    const cloudStatuses = user.user_metadata?.account_statuses;
    if (cloudStatuses && typeof cloudStatuses === "object") {
      const local = getStoredAccountStatuses();
      const merged: Record<string, StoredAccountStatus> = { ...cloudStatuses, ...local };
      for (const [k, v] of Object.entries(cloudStatuses as Record<string, StoredAccountStatus>)) {
        if (!local[k] || (v?.updatedAt && local[k]?.updatedAt && v.updatedAt >= local[k]!.updatedAt!)) {
          merged[k] = v;
        }
      }
      window.localStorage.setItem(ACCOUNT_STATUS_STORAGE_KEY, JSON.stringify(merged));
    }
  } catch {
    // ignore
  }
}

export function saveStoredAccountStatus(id: string, data: StoredAccountStatus) {
  if (typeof window === "undefined" || !id) return;
  const payload: StoredAccountStatus = {
    ...data,
    updatedAt: data.updatedAt || Date.now(),
  };

  // 1. Guardar localmente
  try {
    const map = getStoredAccountStatuses();
    map[id] = payload;
    window.localStorage.setItem(ACCOUNT_STATUS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }

  // 2. Persistir en la base de datos de Supabase Cloud (auth.users metadata)
  try {
    supabase.auth.getUser().then(({ data: userData }) => {
      if (userData?.user) {
        const currentStatuses =
          (userData.user.user_metadata?.account_statuses as Record<string, StoredAccountStatus>) || {};
        const updatedStatuses = {
          ...currentStatuses,
          [id]: payload,
        };
        supabase.auth
          .updateUser({
            data: {
              account_statuses: updatedStatuses,
            },
          })
          .then();
      }
    });
  } catch {
    // ignore
  }

  // 3. Sincronizar directamente con la tabla public.accounts
  try {
    supabase
      .from("accounts")
      .update({
        status: payload.status,
        burned_at: payload.burnedAt ?? null,
        burned_reason: payload.burnedReason ?? null,
      } as never)
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          supabase
            .from("accounts")
            .update({ status: payload.status } as never)
            .eq("id", id)
            .then();
        }
      });
  } catch {
    // ignore
  }
}

export function removeStoredAccountStatus(id: string) {
  if (typeof window === "undefined" || !id) return;
  try {
    const map = getStoredAccountStatuses();
    delete map[id];
    window.localStorage.setItem(ACCOUNT_STATUS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }

  try {
    supabase.auth.getUser().then(({ data: userData }) => {
      if (userData?.user) {
        const currentStatuses =
          (userData.user.user_metadata?.account_statuses as Record<string, StoredAccountStatus>) || {};
        const updatedStatuses = { ...currentStatuses };
        delete updatedStatuses[id];
        supabase.auth
          .updateUser({
            data: {
              account_statuses: updatedStatuses,
            },
          })
          .then();
      }
    });
  } catch {
    // ignore
  }
}

/* ---------------------------------- mappers --------------------------------- */

type Row = Record<string, unknown>;

export function toAccount(r: Row): Account {
  const initialBalance = Number(r["initial_balance"] ?? 0);
  const currentBalance = Number(r["current_balance"] ?? 0);
  const maxLossLimit =
    r["max_loss_limit"] != null
      ? Number(r["max_loss_limit"])
      : r["drawdown_limit"] != null
        ? Number(r["drawdown_limit"])
        : undefined;
  const dailyLossLimit =
    r["daily_loss_limit"] != null ? Number(r["daily_loss_limit"]) : undefined;
  const highWatermark =
    r["high_watermark"] != null
      ? Number(r["high_watermark"])
      : Math.max(initialBalance, currentBalance);
  const startOfDayBalance =
    r["start_of_day_balance"] != null
      ? Number(r["start_of_day_balance"])
      : initialBalance;

  const id = String(r["id"]);
  const storedStatuses = getStoredAccountStatuses();
  const stored = storedStatuses[id];

  const dbStatus = r["status"] != null ? String(r["status"]).toLowerCase().trim() : undefined;

  // Prioridad de estado:
  // 1. Si existe estado en almacenamiento sincronizado (cloud/local)
  // 2. Si existe estado en columna de BD
  // 3. 'active' por defecto
  let finalStatus: Account["status"] = "active";
  if (stored?.status && ["active", "burned", "passed", "archived"].includes(stored.status)) {
    finalStatus = stored.status;
  } else if (dbStatus && ["active", "burned", "passed", "archived"].includes(dbStatus)) {
    finalStatus = dbStatus as Account["status"];
  }

  const burnedAt =
    finalStatus === "burned"
      ? (stored?.burnedAt || (r["burned_at"] as string | null) || new Date().toISOString())
      : undefined;

  const burnedReason =
    finalStatus === "burned"
      ? (stored?.burnedReason ||
          (r["burned_reason"] as string | null) ||
          "Límite total de pérdida superado (Max Loss)")
      : undefined;

  // Si está quemada y no estaba en almacenamiento sincronizado, guardarlo
  if (finalStatus === "burned" && (!stored || stored.status !== "burned")) {
    saveStoredAccountStatus(id, {
      status: "burned",
      burnedAt,
      burnedReason,
      updatedAt: Date.now(),
    });
  }

  return {
    id,
    name: String(r["name"] ?? ""),
    type: (r["type"] === "funded" ? "funded" : "personal") as Account["type"],
    status: finalStatus,
    burnedAt,
    burnedReason,
    firm: (r["firm"] as string | null) ?? undefined,
    broker: (r["broker"] as string | null) ?? undefined,
    strategyId: (r["strategy_id"] as string | null) ?? undefined,
    phase: (r["phase"] === "live" ? "live" : "eval") as Account["phase"],
    profitTarget: r["profit_target"] == null ? undefined : Number(r["profit_target"]),
    initialBalance,
    currentBalance,
    maxLossLimit,
    dailyLossLimit,
    highWatermark,
    startOfDayBalance,
    drawdownLimit: maxLossLimit,
    drawdownType: (["trailing", "eod", "static"].includes(String(r["drawdown_type"]))
      ? String(r["drawdown_type"])
      : "static") as Account["drawdownType"],
    currency: String(r["currency"] ?? "USD"),
  };
}

function fromAccount(a: Partial<Omit<Account, "id">>): Row {
  const out: Row = {};
  if (a.name !== undefined) out["name"] = a.name;
  if (a.type !== undefined) out["type"] = a.type;
  if (a.status !== undefined) out["status"] = a.status ?? "active";
  if (a.burnedAt !== undefined) out["burned_at"] = a.burnedAt ?? null;
  if (a.burnedReason !== undefined) out["burned_reason"] = a.burnedReason ?? null;
  if (a.firm !== undefined) out["firm"] = a.firm ?? null;
  if (a.broker !== undefined) out["broker"] = a.broker ?? null;
  if (a.strategyId !== undefined) out["strategy_id"] = a.strategyId || null;
  if (a.phase !== undefined) out["phase"] = a.phase ?? "eval";
  if (a.profitTarget !== undefined) out["profit_target"] = a.profitTarget ?? null;
  if (a.initialBalance !== undefined) out["initial_balance"] = a.initialBalance;
  if (a.currentBalance !== undefined) out["current_balance"] = a.currentBalance;
  if (a.maxLossLimit !== undefined) {
    out["max_loss_limit"] = a.maxLossLimit ?? null;
    out["drawdown_limit"] = a.maxLossLimit ?? null;
  } else if (a.drawdownLimit !== undefined) {
    out["max_loss_limit"] = a.drawdownLimit ?? null;
    out["drawdown_limit"] = a.drawdownLimit ?? null;
  }
  if (a.dailyLossLimit !== undefined) out["daily_loss_limit"] = a.dailyLossLimit ?? null;
  if (a.highWatermark !== undefined) out["high_watermark"] = a.highWatermark ?? null;
  if (a.startOfDayBalance !== undefined) out["start_of_day_balance"] = a.startOfDayBalance ?? null;
  if (a.drawdownType !== undefined) out["drawdown_type"] = a.drawdownType ?? "static";
  if (a.currency !== undefined) out["currency"] = a.currency;
  return out;
}

export function updateAccountBalanceAndHwm(a: Account, newBalance: number): Account {
  const isTrailingOrEod = a.drawdownType === "trailing" || a.drawdownType === "eod";
  const prevHwm = a.highWatermark ?? Math.max(a.initialBalance, a.currentBalance);
  const newHwm = isTrailingOrEod ? Math.max(prevHwm, newBalance) : a.initialBalance;
  return {
    ...a,
    currentBalance: newBalance,
    highWatermark: newHwm,
  };
}

export function toStrategy(r: Row): Strategy {
  return {
    id: String(r["id"]),
    name: String(r["name"] ?? ""),
    initialCapital: Number(r["initial_capital"] ?? 0),
    riskPct: Number(r["risk_pct"] ?? 0),
    mainSymbol: String(r["main_symbol"] ?? ""),
    color: String(r["color"] ?? "var(--brand)"),
    isShared: Boolean(r["is_shared"] ?? false),
    userId: (r["user_id"] as string | null) ?? undefined,
    market: (r["market"] as string | null) ?? undefined,
    chart: (r["chart"] as string | null) ?? undefined,
    days: (r["days"] as string | null) ?? undefined,
    schedule: (r["schedule"] as string | null) ?? undefined,
    execution: (r["execution"] as string | null) ?? undefined,
    setup: (r["setup"] as string | null) ?? undefined,
    management: (r["management"] as string | null) ?? undefined,
    contracts: (r["contracts"] as string | null) ?? undefined,
  };
}

function fromStrategy(s: Partial<Strategy>): Row {
  const out: Row = {};
  if (s.name !== undefined) out["name"] = s.name;
  if (s.initialCapital !== undefined) out["initial_capital"] = s.initialCapital;
  if (s.riskPct !== undefined) out["risk_pct"] = s.riskPct;
  if (s.mainSymbol !== undefined) out["main_symbol"] = s.mainSymbol;
  if (s.color !== undefined) out["color"] = s.color;
  if (s.isShared !== undefined) out["is_shared"] = s.isShared;
  for (const k of [
    "market",
    "chart",
    "days",
    "schedule",
    "execution",
    "setup",
    "management",
    "contracts",
  ] as const) {
    if (s[k] !== undefined) out[k] = s[k] ?? null;
  }
  return out;
}

export function toTrade(r: Row): Trade {
  const rawSym = String(r["symbol"] ?? "");
  const symUpper = rawSym.toUpperCase().trim();
  const normalizedSymbol =
    symUpper === "GCM" ||
    symUpper.startsWith("GCM") ||
    symUpper === "GC" ||
    symUpper === "XAUUSD" ||
    symUpper.includes("GOLD") ||
    symUpper.includes("ORO")
      ? "MGC"
      : rawSym;

  return {
    id: String(r["id"]),
    accountId: String(r["account_id"] ?? ""),
    strategyId: String(r["strategy_id"] ?? ""),
    symbol: normalizedSymbol,
    direction: (r["direction"] === "short" ? "short" : "long") as Trade["direction"],
    openedAt: String(r["opened_at"] ?? r["closed_at"] ?? new Date().toISOString()),
    closedAt: String(r["closed_at"] ?? r["opened_at"] ?? new Date().toISOString()),
    entryPrice: Number(r["entry_price"] ?? 0),
    exitPrice: Number(r["exit_price"] ?? 0),
    size: Number(r["size"] ?? 0),
    pnl: Number(r["pnl"] ?? 0),
    tags: (r["tags"] as string[] | null) ?? [],
    notes: (r["notes"] as string | null) ?? undefined,
    screenshots: (r["screenshots"] as string[] | null) ?? [],
    source: (r["source"] === "webhook" ? "webhook" : "manual") as Trade["source"],
    importBatchId: (r["import_batch_id"] as string | null) ?? undefined,
    createdAt: (r["created_at"] as string | null) ?? undefined,
    emotionBefore: (r["emotion_before"] as string | null) ?? undefined,
    emotionAfter: (r["emotion_after"] as string | null) ?? undefined,
    followedPlan: (r["followed_plan"] as Trade["followedPlan"]) ?? undefined,
    mistakes: (r["mistakes"] as string[] | null) ?? [],
    emotionNote: (r["emotion_note"] as string | null) ?? undefined,
  };
}

function fromTrade(t: Partial<Omit<Trade, "id">>): Row {
  const out: Row = {};
  if (t.accountId !== undefined) out["account_id"] = t.accountId || null;
  if (t.strategyId !== undefined) out["strategy_id"] = t.strategyId || null;
  if (t.symbol !== undefined) {
    const s = t.symbol.toUpperCase().trim();
    out["symbol"] = s === "GCM" || s.startsWith("GCM") || s === "GC" ? "MGC" : t.symbol;
  }
  if (t.direction !== undefined) out["direction"] = t.direction;
  if (t.openedAt !== undefined) out["opened_at"] = t.openedAt;
  if (t.closedAt !== undefined) out["closed_at"] = t.closedAt;
  if (t.entryPrice !== undefined) out["entry_price"] = t.entryPrice;
  if (t.exitPrice !== undefined) out["exit_price"] = t.exitPrice;
  if (t.size !== undefined) out["size"] = t.size;
  if (t.pnl !== undefined) out["pnl"] = t.pnl;
  if (t.tags !== undefined) out["tags"] = t.tags;
  if (t.notes !== undefined) out["notes"] = t.notes ?? null;
  if (t.screenshots !== undefined) out["screenshots"] = t.screenshots;
  if (t.source !== undefined) out["source"] = t.source;
  if (t.emotionBefore !== undefined) out["emotion_before"] = t.emotionBefore ?? null;
  if (t.emotionAfter !== undefined) out["emotion_after"] = t.emotionAfter ?? null;
  if (t.followedPlan !== undefined) out["followed_plan"] = t.followedPlan ?? null;
  if (t.mistakes !== undefined) out["mistakes"] = t.mistakes ?? [];
  if (t.emotionNote !== undefined) out["emotion_note"] = t.emotionNote ?? null;
  return out;
}

export function toWithdrawal(r: Row): Withdrawal {
  return {
    id: String(r["id"]),
    strategyId: String(r["strategy_id"] ?? ""),
    accountId: (r["account_id"] as string | null) ?? undefined,
    date: String(r["date"] ?? new Date().toISOString()),
    amount: Number(r["amount"] ?? 0),
    reason: (r["reason"] as string | null) ?? undefined,
    status: ((r["status"] as string | null) ?? "approved") as Withdrawal["status"],
    requestedAt: (r["requested_at"] as string | null) ?? undefined,
    approvedAt: (r["approved_at"] as string | null) ?? undefined,
  };
}

export function toPeriod(r: Row): AccountStrategyPeriod {
  return {
    id: String(r["id"]),
    accountId: String(r["account_id"] ?? ""),
    strategyId: String(r["strategy_id"] ?? ""),
    startDate: String(r["start_date"] ?? ""),
    endDate: (r["end_date"] as string | null) ?? undefined,
    note: (r["note"] as string | null) ?? undefined,
  };
}

/* ----------------------------------- data ----------------------------------- */

export interface JournalData {
  accounts: Account[];
  strategies: Strategy[];
  trades: Trade[];
  withdrawals: Withdrawal[];
  strategyPeriods: AccountStrategyPeriod[];
}

/** Agrupación de operaciones creadas juntas (captura) o por separado (manual). */
export interface ImportBatch {
  id: string;
  createdAt: string;
  count: number;
  pnl: number;
  source: "captura" | "manual";
  symbols: string[];
  tradeIds: string[];
}

/** Agrupa por lote de importación; las operaciones sueltas se agrupan por minuto de creación. */
function groupImportBatches(trades: Trade[]): ImportBatch[] {
  const map = new Map<string, ImportBatch>();
  for (const t of trades) {
    const created = t.createdAt ?? t.closedAt;
    const key = t.importBatchId ?? `manual:${created.slice(0, 16)}`;
    const source: ImportBatch["source"] = t.importBatchId ? "captura" : "manual";
    const current = map.get(key);
    if (current) {
      current.count += 1;
      current.pnl += t.pnl;
      current.tradeIds.push(t.id);
      if (!current.symbols.includes(t.symbol)) current.symbols.push(t.symbol);
      if (created < current.createdAt) current.createdAt = created;
    } else {
      map.set(key, {
        id: key,
        createdAt: created,
        count: 1,
        pnl: t.pnl,
        source,
        symbols: [t.symbol],
        tradeIds: [t.id],
      });
    }
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
}

/** Aplica un delta de PnL al balance almacenado de cada cuenta. */
async function applyBalanceDeltas(accounts: Account[], deltas: Map<string, number>) {
  await Promise.all(
    [...deltas].map(([id, delta]) => {
      const account = accounts.find((a) => a.id === id);
      if (!account || delta === 0) return Promise.resolve();
      const newBalance = account.currentBalance + delta;
      const isTrailingOrEod = account.drawdownType === "trailing" || account.drawdownType === "eod";
      const hwm = isTrailingOrEod
        ? Math.max(account.highWatermark ?? account.initialBalance, newBalance)
        : account.initialBalance;

      return supabase
        .from("accounts")
        .update({
          current_balance: newBalance,
          high_watermark: hwm,
        } as never)
        .eq("id", id)
        .then(() => undefined);
    }),
  );
}

const EMPTY: JournalData = {
  accounts: [],
  strategies: [],
  trades: [],
  withdrawals: [],
  strategyPeriods: [],
};

const JOURNAL_DATA_CACHE_PREFIX = "vita-trading:cache:journal-data:";

export function sanitizeJournalData(d?: Partial<JournalData> | null): JournalData {
  return {
    accounts: Array.isArray(d?.accounts) ? d.accounts : [],
    strategies: Array.isArray(d?.strategies) ? d.strategies : [],
    trades: Array.isArray(d?.trades) ? d.trades : [],
    withdrawals: Array.isArray(d?.withdrawals) ? d.withdrawals : [],
    strategyPeriods: Array.isArray(d?.strategyPeriods) ? d.strategyPeriods : [],
  };
}

export function getLocalJournalDataCache(journalId: string): JournalData | null {
  if (typeof window === "undefined" || !journalId) return null;
  try {
    const raw = window.localStorage.getItem(JOURNAL_DATA_CACHE_PREFIX + journalId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return sanitizeJournalData(parsed);
    }
    return null;
  } catch {
    return null;
  }
}

export function setLocalJournalDataCache(journalId: string, data: JournalData) {
  if (typeof window === "undefined" || !journalId) return;
  try {
    window.localStorage.setItem(JOURNAL_DATA_CACHE_PREFIX + journalId, JSON.stringify(sanitizeJournalData(data)));
  } catch {
    // Ignore storage quota
  }
}

const tradeScreenshotsCache = new Map<string, string[]>();

/** Carga las capturas completas de una operación bajo demanda (Lazy Loading) */
export async function fetchTradeScreenshots(tradeId: string): Promise<string[]> {
  if (!tradeId) return [];
  const cached = tradeScreenshotsCache.get(tradeId);
  if (cached && cached.length > 0 && cached[0] !== "__has_screenshots__") {
    return cached;
  }

  try {
    const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)("get_trade_screenshots", {
      p_trade_id: tradeId,
    });
    if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
      const clean = rpcData.filter((s) => s !== "__has_screenshots__");
      tradeScreenshotsCache.set(tradeId, clean);
      return clean;
    }
  } catch {
    // Fallback a select directo
  }

  try {
    const { data, error } = await supabase
      .from("trades")
      .select("screenshots")
      .eq("id", tradeId)
      .maybeSingle();

    if (!error && data && Array.isArray((data as any).screenshots)) {
      const list = ((data as any).screenshots as string[]).filter(
        (s) => s !== "__has_screenshots__",
      );
      tradeScreenshotsCache.set(tradeId, list);
      return list;
    }
  } catch {
    // ignore
  }

  return [];
}

/** Lee todos los datos de un diario (usado también por la vista de supervisión). */
export async function fetchJournalData(journalId: string): Promise<JournalData> {
  if (!journalId) return EMPTY;

  try {
    const { data: bundle, error: rpcErr } = await (supabase.rpc as any)("get_journal_bundle", {
      p_journal_id: journalId,
    });

    if (
      !rpcErr &&
      bundle &&
      typeof bundle === "object" &&
      Array.isArray((bundle as any).accounts)
    ) {
      const parsed: JournalData = {
        accounts: ((bundle as any).accounts ?? []).map((r: Row) => toAccount(r)),
        strategies: ((bundle as any).strategies ?? []).map((r: Row) => toStrategy(r)),
        trades: ((bundle as any).trades ?? []).map((r: Row) => toTrade(r)),
        withdrawals: ((bundle as any).withdrawals ?? []).map((r: Row) => toWithdrawal(r)),
        strategyPeriods: ((bundle as any).strategyPeriods ?? []).map((r: Row) => toPeriod(r)),
      };
      setLocalJournalDataCache(journalId, parsed);
      return parsed;
    }
  } catch {
    // Fallback a consultas individuales
  }

  try {
    const LIGHTWEIGHT_TRADE_SELECT =
      "id, user_id, journal_id, account_id, strategy_id, symbol, direction, opened_at, closed_at, entry_price, exit_price, size, pnl, tags, notes, source, import_batch_id, created_at, emotion_before, emotion_after, followed_plan, mistakes, emotion_note";

    const [accounts, strategies, trades, withdrawals, periods] = await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .eq("journal_id", journalId)
        .order("created_at", { ascending: true }),
      supabase.from("strategies").select("*").eq("journal_id", journalId),
      supabase
        .from("trades")
        .select(LIGHTWEIGHT_TRADE_SELECT)
        .or(`journal_id.eq.${journalId},journal_id.is.null`)
        .order("closed_at", { ascending: false }),
      supabase
        .from("withdrawals")
        .select("*")
        .eq("journal_id", journalId)
        .order("date", { ascending: false }),
      supabase
        .from("account_strategy_periods")
        .select("*")
        .eq("journal_id", journalId)
        .order("start_date", { ascending: true }),
    ]);

    let tradeRows = (trades.data ?? []) as Row[];
    if (tradeRows.length === 0) {
      const { data: fallbackTrades } = await supabase
        .from("trades")
        .select(LIGHTWEIGHT_TRADE_SELECT)
        .order("closed_at", { ascending: false });
      if (fallbackTrades && fallbackTrades.length > 0) {
        tradeRows = fallbackTrades as Row[];
      }
    }

    const parsed: JournalData = {
      accounts: (accounts.data ?? []).map((r) => toAccount(r as Row)),
      strategies: (strategies.data ?? []).map((r) => toStrategy(r as Row)),
      trades: tradeRows.map((r) => toTrade(r)),
      withdrawals: (withdrawals.data ?? []).map((r) => toWithdrawal(r as Row)),
      strategyPeriods: (periods.data ?? []).map((r) => toPeriod(r as Row)),
    };

    // Auto-sanar en Supabase cualquier cuenta quemada que aún no tenga el estado 'burned' en la DB
    if (parsed.accounts.some((a) => a.status === "burned")) {
      for (const acc of parsed.accounts) {
        if (acc.status === "burned") {
          supabase
            .from("accounts")
            .update({
              status: "burned",
              burned_at: acc.burnedAt || new Date().toISOString(),
              burned_reason: acc.burnedReason || "Límite total de pérdida superado (Max Loss)",
            } as never)
            .eq("id", acc.id)
            .then(({ error }) => {
              if (error) {
                supabase.from("accounts").update({ status: "burned" } as never).eq("id", acc.id).then();
              }
            });
        }
      }
    }

    // Auto-migrar en la base de datos cualquier operación que tuviera el símbolo GCM
    const legacyGcmTrades = tradeRows.filter((r) => {
      const s = String(r["symbol"] || "").toUpperCase().trim();
      return s === "GCM" || s.startsWith("GCM") || s === "GC" || s === "XAUUSD";
    });
    if (legacyGcmTrades.length > 0) {
      const gcmIds = legacyGcmTrades.map((t) => String(t["id"] ?? "")).filter(Boolean);
      if (gcmIds.length > 0) {
        supabase.from("trades").update({ symbol: "MGC" } as never).in("id", gcmIds).then();
      }
    }

    // Si no hay estrategias creadas en este diario, sembrarlas automáticamente con las 6 del admin
    if (parsed.strategies.length === 0 && journalId) {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (u.user?.id) {
          await seedDefaultStrategies(journalId, u.user.id);
          const { data: newStrats } = await supabase
            .from("strategies")
            .select("*")
            .eq("journal_id", journalId);
          if (newStrats && newStrats.length > 0) {
            parsed.strategies = newStrats.map((r) => toStrategy(r as Row));
          } else {
            parsed.strategies = mockStrategies.map((s) => ({ ...s, isShared: true }));
          }
        }
      } catch {
        parsed.strategies = mockStrategies.map((s) => ({ ...s, isShared: true }));
      }
    }

    setLocalJournalDataCache(journalId, parsed);
    return parsed;
  } catch (err) {
    console.error("Error al cargar datos del diario:", err);
    return getLocalJournalDataCache(journalId) ?? EMPTY;
  }
}

async function seedDefaultStrategies(journalId: string, userId: string) {
  try {
    const { error: rpcErr } = await (supabase.rpc as any)("seed_user_strategies", {
      p_journal_id: journalId,
      p_user_id: userId,
    });
    if (!rpcErr) return;
  } catch {
    // Fallback manual
  }

  const rows = mockStrategies.map((s) => ({
    ...fromStrategy(s),
    journal_id: journalId,
    user_id: userId,
    is_shared: true,
  }));
  await supabase.from("strategies").insert(rows as never);
}

/* ---------------------------------- context --------------------------------- */

interface JournalState extends JournalData {
  activeJournalId: string;
  loading: boolean;
  selectedAccountIds: string[];
  setActiveJournalId: (id: string) => void;
  toggleAccount: (id: string) => void;
  selectAll: () => void;
  addAccount: (account: Omit<Account, "id">) => Promise<void>;
  updateAccount: (id: string, patch: Partial<Omit<Account, "id">>) => Promise<void>;
  markAccountBurned: (id: string, reason?: string, date?: string) => Promise<void>;
  reactivateAccount: (id: string, resetBalance?: boolean) => Promise<void>;
  restoreFundedNextAccount: (custom?: Partial<Account>) => Promise<Account>;
  removeAccount: (id: string) => Promise<void>;
  addTrade: (trade: Omit<Trade, "id">) => Promise<void>;
  /** Modifica una operación y ajusta la diferencia de PnL en las cuentas correspondientes. */
  updateTrade: (id: string, patch: Partial<Omit<Trade, "id">>) => Promise<void>;
  /** Inserta varias operaciones a la vez y ajusta el balance de cada cuenta una sola vez. */
  addTrades: (trades: Omit<Trade, "id">[]) => Promise<void>;
  removeTrade: (id: string) => Promise<void>;
  removeTrades: (ids: string[]) => Promise<void>;
  removeImportBatch: (batchId: string) => Promise<void>;
  /** Lotes de importación recientes (capturas/fotos), del más nuevo al más antiguo. */
  importBatches: ImportBatch[];
  addWithdrawal: (withdrawal: Omit<Withdrawal, "id">) => Promise<void>;
  updateWithdrawal: (id: string, patch: Partial<Omit<Withdrawal, "id">>) => Promise<void>;
  removeWithdrawal: (id: string) => Promise<void>;
  /** Todos los retiros, incluidos los pendientes (los pendientes no se contabilizan). */
  allWithdrawals: Withdrawal[];
  updateStrategy: (id: string, patch: Partial<Strategy>) => Promise<void>;
  addStrategy: (strategy: Omit<Strategy, "id">) => Promise<void>;
  removeStrategy: (id: string) => Promise<void>;
  restoreDefaultStrategies: () => Promise<void>;
  addStrategyPeriod: (period: Omit<AccountStrategyPeriod, "id">) => Promise<void>;
  removeStrategyPeriod: (id: string) => Promise<void>;
  visibleTrades: Trade[];
}

const JournalContext = createContext<JournalState | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data: journals = [] } = useJournals();
  const [activeJournalId, setActive] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(STORAGE_KEY) || "";
    }
    return "";
  });
  const [manualSelection, setManualSelection] = useState<string[] | null>(null);

  // Si no hay diario activo válido o se desincroniza, usa el primero disponible.
  useEffect(() => {
    if (journals.length === 0) return;
    if (!activeJournalId || !journals.some((j) => j.id === activeJournalId)) {
      setActive(journals[0]!.id);
    }
  }, [journals, activeJournalId]);

  const setActiveJournalId = useCallback((id: string) => {
    setActive(id);
    setManualSelection(null);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const { data = getLocalJournalDataCache(activeJournalId) ?? EMPTY, isLoading } = useQuery({
    queryKey: ["journal-data", activeJournalId],
    enabled: !!activeJournalId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: (prev) => prev ?? getLocalJournalDataCache(activeJournalId) ?? EMPTY,
    queryFn: async () => {
      const result = await fetchJournalData(activeJournalId);
      if (result.strategies.length === 0) {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user?.id;
        const { data: journal } = await supabase
          .from("journals")
          .select("owner_id")
          .eq("id", activeJournalId)
          .maybeSingle();
        if (uid && journal?.owner_id === uid) {
          await seedDefaultStrategies(activeJournalId, uid);
          const seeded = await fetchJournalData(activeJournalId);
          setLocalJournalDataCache(activeJournalId, seeded);
          return seeded;
        }
      }
      setLocalJournalDataCache(activeJournalId, result);
      return result;
    },
  });

  const refresh = useCallback(
    () => qc.invalidateQueries({ queryKey: ["journal-data", activeJournalId] }),
    [qc, activeJournalId],
  );

  const updateCache = useCallback(
    (updater: (old: JournalData) => JournalData) => {
      qc.setQueryData<JournalData>(["journal-data", activeJournalId], (old) => {
        const base = old ?? getLocalJournalDataCache(activeJournalId) ?? EMPTY;
        const next = updater(base);
        setLocalJournalDataCache(activeJournalId, next);
        return next;
      });
    },
    [qc, activeJournalId],
  );

  // Suscripción a cambios en tiempo real (Realtime) para sincronización inmediata multi-pestaña/dispositivo
  useEffect(() => {
    if (!activeJournalId) return;

    const channel = supabase
      .channel(`rt-journal-${activeJournalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trades",
          filter: `journal_id=eq.${activeJournalId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["journal-data", activeJournalId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "accounts",
          filter: `journal_id=eq.${activeJournalId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["journal-data", activeJournalId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawals",
          filter: `journal_id=eq.${activeJournalId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["journal-data", activeJournalId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeJournalId, qc]);

  const ownerFields = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    return { journal_id: activeJournalId, user_id: userData.user?.id };
  }, [activeJournalId]);

  const rawData = data ?? getLocalJournalDataCache(activeJournalId) ?? EMPTY;
  const safeData = useMemo(() => sanitizeJournalData(rawData), [rawData]);

  const validAccountIds = useMemo(
    () => new Set(safeData.accounts.map((a) => a.id)),
    [safeData.accounts],
  );

  const selectedAccountIds = useMemo(() => {
    if (!manualSelection) return safeData.accounts.map((a) => a.id);
    const valid = manualSelection.filter((id) => validAccountIds.has(id));
    return valid.length > 0 ? valid : safeData.accounts.map((a) => a.id);
  }, [manualSelection, safeData.accounts, validAccountIds]);

  const value = useMemo<JournalState>(() => {
    const selected = new Set(selectedAccountIds);
    const visibleTrades =
      safeData.accounts.length === 0 ||
      selectedAccountIds.length === 0 ||
      selectedAccountIds.length === safeData.accounts.length
        ? safeData.trades
        : safeData.trades.filter((t) => {
            if (!t.accountId) return true;
            return safeData.accounts.some(
              (a) => selected.has(a.id) && isTradeOfAccount(t, a),
            );
          });
    const importBatches = groupImportBatches(safeData.trades);

    /** Borra operaciones de inmediato en caché y persiste en Supabase. */
    const deleteTradeIds = async (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const deltas = new Map<string, number>();
      for (const t of safeData.trades) {
        if (!idSet.has(t.id)) continue;
        const matchingAcc = safeData.accounts.find((a) => isTradeOfAccount(t, a));
        if (matchingAcc) {
          deltas.set(matchingAcc.id, (deltas.get(matchingAcc.id) ?? 0) - t.pnl);
        }
      }

      // 1. Actualización optimista inmediata (0ms)
      updateCache((old) => {
        const safeOld = sanitizeJournalData(old);
        return {
          ...safeOld,
          trades: safeOld.trades.filter((t) => !idSet.has(t.id)),
          accounts: safeOld.accounts.map((a) => {
            const delta = deltas.get(a.id);
            return delta ? updateAccountBalanceAndHwm(a, a.currentBalance + delta) : a;
          }),
        };
      });

      // 2. Persistencia en base de datos
      try {
        const deletePromise = supabase.from("trades").delete().in("id", ids);
        const balancePromise =
          deltas.size > 0 ? applyBalanceDeltas(safeData.accounts, deltas) : Promise.resolve();

        const [{ error }] = await Promise.all([deletePromise, balancePromise]);
        if (error) throw error;
      } catch (err) {
        await refresh();
        throw err;
      }
    };

    return {
      ...safeData,
      // Solo los retiros aprobados afectan al capital y a las métricas.
      withdrawals: (safeData.withdrawals || []).filter((w) => w && w.status === "approved"),
      allWithdrawals: safeData.withdrawals || [],
      loading: isLoading,
      visibleTrades,
      selectedAccountIds,
      activeJournalId,
      setActiveJournalId,
      toggleAccount: (id) =>
        setManualSelection((prev) => {
          const current = prev ?? safeData.accounts.map((a) => a.id);
          return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
        }),
      selectAll: () => setManualSelection(null),
      addAccount: async (account) => {
        const base = await ownerFields();
        const tempId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `temp-acc-${Date.now()}`;
        const optimisticAccount: Account = {
          id: tempId,
          ...account,
        };

        if (account.status) {
          saveStoredAccountStatus(tempId, {
            status: account.status,
            burnedAt: account.burnedAt,
            burnedReason: account.burnedReason,
            updatedAt: Date.now(),
          });
        }

        updateCache((old) => ({
          ...old,
          accounts: [...old.accounts, optimisticAccount],
        }));

        setManualSelection(null);

        try {
          const { data: inserted, error } = await supabase
            .from("accounts")
            .insert({ ...fromAccount(account), ...base } as never)
            .select()
            .single();
          if (error) {
            console.warn("Reintentando inserción de cuenta con campos estándar:", error.message);
            const fallbackRow: Row = {
              ...base,
              name: account.name,
              type: account.type,
              status: account.status ?? "active",
              firm: account.firm ?? null,
              broker: account.broker ?? null,
              strategy_id: account.strategyId || null,
              phase: account.phase ?? "eval",
              profit_target: account.profitTarget ?? null,
              initial_balance: account.initialBalance,
              current_balance: account.currentBalance,
              drawdown_limit: account.maxLossLimit ?? account.drawdownLimit ?? null,
              currency: account.currency ?? "USD",
            };
            const { data: insertedFallback, error: fallbackErr } = await supabase
              .from("accounts")
              .insert(fallbackRow as never)
              .select()
              .single();
            if (fallbackErr) {
              const minimalRow: Row = {
                ...base,
                name: account.name,
                type: account.type,
                firm: account.firm ?? null,
                broker: account.broker ?? null,
                strategy_id: account.strategyId || null,
                phase: account.phase ?? "eval",
                profit_target: account.profitTarget ?? null,
                initial_balance: account.initialBalance,
                current_balance: account.currentBalance,
                drawdown_limit: account.maxLossLimit ?? account.drawdownLimit ?? null,
                currency: account.currency ?? "USD",
              };
              const { data: insertedMin, error: minErr } = await supabase
                .from("accounts")
                .insert(minimalRow as never)
                .select()
                .single();
              if (minErr) throw minErr;
              if (insertedMin) {
                const realAcc = toAccount(insertedMin as Row);
                if (account.status) {
                  saveStoredAccountStatus(realAcc.id, {
                    status: account.status,
                    burnedAt: account.burnedAt,
                    burnedReason: account.burnedReason,
                    updatedAt: Date.now(),
                  });
                  removeStoredAccountStatus(tempId);
                }
                updateCache((old) => ({
                  ...old,
                  accounts: old.accounts.map((a) => (a.id === tempId ? { ...realAcc, status: account.status ?? realAcc.status } : a)),
                }));
              }
            } else if (insertedFallback) {
              const realAcc = toAccount(insertedFallback as Row);
              if (account.status) {
                saveStoredAccountStatus(realAcc.id, {
                  status: account.status,
                  burnedAt: account.burnedAt,
                  burnedReason: account.burnedReason,
                  updatedAt: Date.now(),
                });
                removeStoredAccountStatus(tempId);
              }
              updateCache((old) => ({
                ...old,
                accounts: old.accounts.map((a) => (a.id === tempId ? { ...realAcc, status: account.status ?? realAcc.status } : a)),
              }));
            }
          } else if (inserted) {
            const realAcc = toAccount(inserted as Row);
            if (account.status) {
              saveStoredAccountStatus(realAcc.id, {
                status: account.status,
                burnedAt: account.burnedAt,
                burnedReason: account.burnedReason,
                updatedAt: Date.now(),
              });
              removeStoredAccountStatus(tempId);
            }
            updateCache((old) => ({
              ...old,
              accounts: old.accounts.map((a) => (a.id === tempId ? { ...realAcc, status: account.status ?? realAcc.status } : a)),
            }));
          }
        } catch (err) {
          console.error("Error al crear cuenta:", err);
          await refresh();
          throw err;
        }
      },
      updateAccount: async (id, patch) => {
        if (patch.status) {
          saveStoredAccountStatus(id, {
            status: patch.status,
            burnedAt: patch.status === "burned" ? (patch.burnedAt || new Date().toISOString()) : undefined,
            burnedReason: patch.status === "burned" ? patch.burnedReason : undefined,
            updatedAt: Date.now(),
          });
        }

        updateCache((old) => ({
          ...old,
          accounts: old.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }));

        try {
          const fullRow = fromAccount(patch);
          const { error } = await supabase
            .from("accounts")
            .update(fullRow as never)
            .eq("id", id);
          if (error) {
            console.warn("Reintentando actualización de cuenta con campos estándar:", error.message);
            const fallbackRow: Row = {
              name: patch.name,
              type: patch.type,
              status: patch.status ?? "active",
              firm: patch.firm ?? null,
              broker: patch.broker ?? null,
              strategy_id: patch.strategyId || null,
              phase: patch.phase ?? "eval",
              profit_target: patch.profitTarget ?? null,
              initial_balance: patch.initialBalance,
              current_balance: patch.currentBalance,
              drawdown_limit: patch.maxLossLimit ?? patch.drawdownLimit ?? null,
              currency: patch.currency ?? "USD",
            };
            const { error: fallbackErr } = await supabase
              .from("accounts")
              .update(fallbackRow as never)
              .eq("id", id);
            if (fallbackErr) {
              const minimalRow: Row = {
                name: patch.name,
                type: patch.type,
                firm: patch.firm ?? null,
                broker: patch.broker ?? null,
                strategy_id: patch.strategyId || null,
                phase: patch.phase ?? "eval",
                profit_target: patch.profitTarget ?? null,
                initial_balance: patch.initialBalance,
                current_balance: patch.currentBalance,
                drawdown_limit: patch.maxLossLimit ?? patch.drawdownLimit ?? null,
                currency: patch.currency ?? "USD",
              };
              await supabase.from("accounts").update(minimalRow as never).eq("id", id);
            }
          }
        } catch (err) {
          console.error("Error al actualizar la cuenta:", err);
          await refresh();
          throw err;
        }
      },
      markAccountBurned: async (id, reason, date) => {
        const burnedAt = date || new Date().toISOString();
        const burnedReason = reason || "Límite total de pérdida superado (Max Loss)";

        // 1. Guardar en almacenamiento persistente inmediato (permanece siempre incluso tras recargar o si falla la red)
        saveStoredAccountStatus(id, {
          status: "burned",
          burnedAt,
          burnedReason,
          updatedAt: Date.now(),
        });

        // 2. Actualizar caché en memoria
        updateCache((old) => ({
          ...old,
          accounts: old.accounts.map((a) =>
            a.id === id ? { ...a, status: "burned", burnedAt, burnedReason } : a,
          ),
        }));

        // 3. Sincronizar con Supabase con reintentos progresivos
        try {
          const payload = {
            status: "burned",
            burned_at: burnedAt,
            burned_reason: burnedReason,
          };
          const { error: err1 } = await supabase.from("accounts").update(payload as never).eq("id", id);
          if (err1) {
            console.warn("Reintentando marcar cuenta quemada solo con columna status:", err1.message);
            await supabase.from("accounts").update({ status: "burned" } as never).eq("id", id);
          }
        } catch (err) {
          console.error("Error al marcar cuenta como quemada en Supabase:", err);
        }
      },
      reactivateAccount: async (id, resetBalance = false) => {
        // 1. Actualizar estado persistente a activa
        saveStoredAccountStatus(id, {
          status: "active",
          burnedAt: undefined,
          burnedReason: undefined,
          updatedAt: Date.now(),
        });

        // 2. Actualizar caché en memoria
        updateCache((old) => ({
          ...old,
          accounts: old.accounts.map((a) => {
            if (a.id !== id) return a;
            return {
              ...a,
              status: "active",
              burnedAt: undefined,
              burnedReason: undefined,
              currentBalance: resetBalance ? a.initialBalance : a.currentBalance,
              highWatermark: resetBalance ? a.initialBalance : a.highWatermark,
              startOfDayBalance: resetBalance ? a.initialBalance : a.startOfDayBalance,
            };
          }),
        }));

        // 3. Sincronizar con Supabase con reintentos progresivos
        try {
          const targetAcc = safeData.accounts.find((a) => a.id === id);
          const fullPayload = {
            status: "active",
            burned_at: null,
            burned_reason: null,
            ...(resetBalance && targetAcc
              ? {
                  current_balance: targetAcc.initialBalance,
                  high_watermark: targetAcc.initialBalance,
                  start_of_day_balance: targetAcc.initialBalance,
                }
              : {}),
          };
          const { error: err1 } = await supabase.from("accounts").update(fullPayload as never).eq("id", id);
          if (err1) {
            console.warn("Reintentando reactivación solo con status y balance:", err1.message);
            const fallbackPayload = {
              status: "active",
              ...(resetBalance && targetAcc
                ? {
                    current_balance: targetAcc.initialBalance,
                    high_watermark: targetAcc.initialBalance,
                    start_of_day_balance: targetAcc.initialBalance,
                  }
                : {}),
            };
            await supabase.from("accounts").update(fallbackPayload as never).eq("id", id);
          }
        } catch (err) {
          console.error("Error al reactivar cuenta:", err);
        }
      },
      restoreFundedNextAccount: async (custom) => {
        const base = await ownerFields();
        const tempId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `temp-fn-${Date.now()}`;

        const initialBalance = custom?.initialBalance ?? 100000;
        const currentBalance = custom?.currentBalance ?? initialBalance;
        const maxLoss = custom?.maxLossLimit ?? (initialBalance * 0.05);
        const dailyLoss = custom?.dailyLossLimit ?? (initialBalance * 0.03);
        const profitTarget = custom?.profitTarget ?? (initialBalance * 1.06);

        let newFnAccount: Account = {
          id: tempId,
          name: custom?.name || "FundedNext 100K — Futures",
          type: "funded",
          status: "active",
          firm: custom?.firm || "FundedNext Futures",
          phase: custom?.phase || "eval",
          profitTarget,
          initialBalance,
          currentBalance,
          maxLossLimit: maxLoss,
          dailyLossLimit: dailyLoss,
          highWatermark: custom?.highWatermark ?? Math.max(initialBalance, currentBalance),
          startOfDayBalance: custom?.startOfDayBalance ?? initialBalance,
          drawdownLimit: maxLoss,
          drawdownType: custom?.drawdownType || "eod",
          currency: custom?.currency || "USD",
          ...custom,
        };

        updateCache((old) => ({
          ...old,
          accounts: [...old.accounts.filter((a) => a.id !== tempId), newFnAccount],
        }));
        setManualSelection(null);

        try {
          const { data: inserted, error } = await supabase
            .from("accounts")
            .insert({ ...fromAccount(newFnAccount), ...base } as never)
            .select()
            .single();
          if (!error && inserted) {
            const realAcc = toAccount(inserted as Row);
            newFnAccount = realAcc;
            updateCache((old) => ({
              ...old,
              accounts: old.accounts.map((a) => (a.id === tempId ? realAcc : a)),
            }));
          }
        } catch (err) {
          console.error("Error al persistir FundedNext recuperada:", err);
        }

        return newFnAccount;
      },
      removeAccount: async (id) => {
        removeStoredAccountStatus(id);
        updateCache((old) => ({
          ...old,
          accounts: old.accounts.filter((a) => a.id !== id),
        }));
        setManualSelection(null);

        try {
          const { error } = await supabase.from("accounts").delete().eq("id", id);
          if (error) throw error;
        } catch (err) {
          await refresh();
          throw err;
        }
      },
      addTrade: async (trade) => {
        const base = await ownerFields();
        const tempId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `temp-${Date.now()}`;
        const optimisticTrade: Trade = {
          id: tempId,
          journalId: activeJournalId,
          createdAt: new Date().toISOString(),
          ...trade,
        };

        // Si la cuenta estaba excluida por el filtro manual lateral, resetearlo para que la operación se vea de inmediato
        if (trade.accountId && manualSelection && !manualSelection.includes(trade.accountId)) {
          setManualSelection(null);
        }

        const matchingAccount = data.accounts.find((a) => isTradeOfAccount(trade, a));

        // 1. Inserción optimista inmediata en caché (0ms)
        updateCache((old) => ({
          ...old,
          trades: [optimisticTrade, ...old.trades],
          accounts: old.accounts.map((a) =>
            matchingAccount && a.id === matchingAccount.id
              ? updateAccountBalanceAndHwm(a, a.currentBalance + trade.pnl)
              : a,
          ),
        }));

        // 2. Persistencia en Supabase en paralelo
        try {
          const insertPromise = supabase
            .from("trades")
            .insert({ ...fromTrade(trade), ...base } as never)
            .select()
            .single();

          const account = matchingAccount;
          const accountPromise = account
            ? supabase
                .from("accounts")
                .update({
                  current_balance: account.currentBalance + trade.pnl,
                  high_watermark: updateAccountBalanceAndHwm(account, account.currentBalance + trade.pnl).highWatermark,
                } as never)
                .eq("id", account.id)
            : Promise.resolve();

          const [{ data: insertedRow, error: insertErr }] = await Promise.all([
            insertPromise,
            accountPromise,
          ]);

          if (insertErr) throw insertErr;

          // 3. Reemplazar ID temporal por el ID definitivo
          if (insertedRow) {
            const realTrade = toTrade(insertedRow as Row);
            updateCache((old) => ({
              ...old,
              trades: old.trades.map((t) => (t.id === tempId ? realTrade : t)),
            }));
          }
        } catch (err) {
          await refresh();
          throw err;
        }
      },
      updateTrade: async (id, patch) => {
        const oldTrade = data.trades.find((t) => t.id === id);
        const oldAcc = oldTrade ? data.accounts.find((a) => isTradeOfAccount(oldTrade, a)) : undefined;
        const newAcc = data.accounts.find((a) =>
          isTradeOfAccount({ ...(oldTrade ?? {}), ...patch }, a),
        );
        const oldAccountId = oldAcc?.id;
        const newAccountId = newAcc?.id;
        const oldPnl = oldTrade?.pnl ?? 0;
        const newPnl = patch.pnl !== undefined ? patch.pnl : oldPnl;

        const deltas = new Map<string, number>();
        if (oldAccountId === newAccountId) {
          const delta = newPnl - oldPnl;
          if (delta !== 0 && newAccountId) {
            deltas.set(newAccountId, delta);
          }
        } else {
          if (oldAccountId) deltas.set(oldAccountId, -oldPnl);
          if (newAccountId) deltas.set(newAccountId, (deltas.get(newAccountId) ?? 0) + newPnl);
        }

        // 1. Actualización optimista inmediata en memoria (0ms)
        updateCache((old) => ({
          ...old,
          trades: old.trades.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          accounts: old.accounts.map((a) => {
            const delta = deltas.get(a.id);
            return delta ? updateAccountBalanceAndHwm(a, a.currentBalance + delta) : a;
          }),
        }));

        // 2. Persistencia en Supabase
        try {
          const row = fromTrade(patch);
          const updateTradePromise = supabase
            .from("trades")
            .update(row as never)
            .eq("id", id);
          const updateBalancePromise =
            deltas.size > 0 ? applyBalanceDeltas(data.accounts, deltas) : Promise.resolve();

          const [{ error }] = await Promise.all([updateTradePromise, updateBalancePromise]);
          if (error) throw error;
        } catch (err) {
          await refresh();
          throw err;
        }
      },
      addTrades: async (list) => {
        if (list.length === 0) return;
        const base = await ownerFields();
        const batchId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : String(Date.now());

        const deltas = new Map<string, number>();
        const optimisticTrades: Trade[] = list.map((t, idx) => {
          const tempId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `temp-${Date.now()}-${idx}`;
          const matchingAcc = data.accounts.find((a) => isTradeOfAccount(t, a));
          if (matchingAcc) {
            deltas.set(matchingAcc.id, (deltas.get(matchingAcc.id) ?? 0) + t.pnl);
          }
          return {
            id: tempId,
            journalId: activeJournalId,
            createdAt: new Date().toISOString(),
            importBatchId: batchId,
            ...t,
          };
        });

        if (manualSelection) {
          setManualSelection(null);
        }

        // 1. Actualización optimista de lote (0ms)
        updateCache((old) => ({
          ...old,
          trades: [...optimisticTrades, ...old.trades],
          accounts: old.accounts.map((a) => {
            const delta = deltas.get(a.id);
            return delta ? updateAccountBalanceAndHwm(a, a.currentBalance + delta) : a;
          }),
        }));

        // 2. Persistencia en Supabase
        try {
          const rows = list.map((t) => ({
            ...fromTrade(t),
            ...base,
            import_batch_id: batchId,
          }));
          const insertPromise = supabase.from("trades").insert(rows as never);
          const balancePromise =
            deltas.size > 0 ? applyBalanceDeltas(data.accounts, deltas) : Promise.resolve();

          const [{ error }] = await Promise.all([insertPromise, balancePromise]);
          if (error) throw error;

          // Sincronizar IDs reales en segundo plano
          refresh();
        } catch (err) {
          await refresh();
          throw err;
        }
      },
      removeTrade: async (id) => {
        await deleteTradeIds([id]);
      },
      removeTrades: async (ids) => {
        await deleteTradeIds(ids);
      },
      removeImportBatch: async (batchId) => {
        const group = importBatches.find((b) => b.id === batchId);
        const ids =
          group?.tradeIds ??
          data.trades.filter((t) => t.importBatchId === batchId).map((t) => t.id);
        await deleteTradeIds(ids);
      },
      importBatches,

      addWithdrawal: async (withdrawal) => {
        const base = await ownerFields();
        const tempId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `temp-wd-${Date.now()}`;
        const optimisticWd: Withdrawal = {
          id: tempId,
          journalId: activeJournalId,
          ...withdrawal,
          status: withdrawal.status ?? "approved",
        };

        updateCache((old) => ({
          ...old,
          withdrawals: [optimisticWd, ...old.withdrawals],
        }));

        try {
          const { data: inserted, error } = await supabase
            .from("withdrawals")
            .insert({
              strategy_id: withdrawal.strategyId || null,
              account_id: withdrawal.accountId || null,
              date: withdrawal.date,
              amount: withdrawal.amount,
              reason: withdrawal.reason ?? null,
              status: withdrawal.status ?? "approved",
              ...base,
            } as never)
            .select()
            .single();
          if (error) throw error;
          if (inserted) {
            const realWd = toWithdrawal(inserted as Row);
            updateCache((old) => ({
              ...old,
              withdrawals: old.withdrawals.map((w) => (w.id === tempId ? realWd : w)),
            }));
          }
        } catch (err) {
          await refresh();
          throw err;
        }
      },
      updateWithdrawal: async (id, patch) => {
        updateCache((old) => ({
          ...old,
          withdrawals: old.withdrawals.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        }));

        try {
          const row: Record<string, unknown> = {};
          if (patch.accountId !== undefined) row["account_id"] = patch.accountId || null;
          if (patch.date !== undefined) row["date"] = patch.date;
          if (patch.amount !== undefined) row["amount"] = patch.amount;
          if (patch.reason !== undefined) row["reason"] = patch.reason ?? null;
          if (patch.status !== undefined) row["status"] = patch.status;
          const { error } = await supabase
            .from("withdrawals")
            .update(row as never)
            .eq("id", id);
          if (error) throw error;
        } catch (err) {
          await refresh();
          throw err;
        }
      },
      removeWithdrawal: async (id) => {
        updateCache((old) => ({
          ...old,
          withdrawals: old.withdrawals.filter((w) => w.id !== id),
        }));

        try {
          const { error } = await supabase.from("withdrawals").delete().eq("id", id);
          if (error) throw error;
        } catch (err) {
          await refresh();
          throw err;
        }
      },
      addStrategy: async (strategy) => {
        const base = await ownerFields();
        const { error } = await supabase
          .from("strategies")
          .insert({ ...fromStrategy(strategy), ...base } as never);
        if (error) throw error;
        await refresh();
      },
      updateStrategy: async (id, patch) => {
        const { error } = await supabase
          .from("strategies")
          .update(fromStrategy(patch) as never)
          .eq("id", id);
        if (error) throw error;
        await refresh();
      },
      removeStrategy: async (id) => {
        const { error } = await supabase.from("strategies").delete().eq("id", id);
        if (error) throw error;
        await refresh();
      },
      addStrategyPeriod: async (period) => {
        const base = await ownerFields();
        const start = period.startDate;
        const end = period.endDate;
        const tempId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `temp-period-${Date.now()}`;

        // 1. Actualización optimista inmediata
        updateCache((old) => ({
          ...old,
          strategyPeriods: [...old.strategyPeriods, { id: tempId, ...period }],
          trades: old.trades.map((t) => {
            if (t.accountId !== period.accountId) return t;
            const day = tradeDayKey(t);
            if (!day || day < start || (end && day > end)) return t;
            return { ...t, strategyId: period.strategyId };
          }),
        }));

        try {
          const { error } = await supabase.from("account_strategy_periods").insert({
            account_id: period.accountId,
            strategy_id: period.strategyId,
            start_date: period.startDate,
            end_date: period.endDate || null,
            note: period.note ?? null,
            ...base,
          } as never);
          if (error) throw error;

          // Actualizar directamente todas las operaciones de esta cuenta dentro del tramo de fechas
          const matchingTradeIds = safeData.trades
            .filter((t) => {
              if (t.accountId !== period.accountId) return false;
              const day = tradeDayKey(t);
              if (!day) return false;
              return day >= start && (!end || day <= end);
            })
            .map((t) => t.id);

          if (matchingTradeIds.length > 0) {
            await supabase
              .from("trades")
              .update({ strategy_id: period.strategyId })
              .in("id", matchingTradeIds);
          }
        } finally {
          await refresh();
        }
      },
      removeStrategyPeriod: async (id) => {
        const targetPeriod = safeData.strategyPeriods.find((p) => p.id === id);

        if (targetPeriod) {
          const start = targetPeriod.startDate;
          const end = targetPeriod.endDate;
          const defaultStratId =
            safeData.accounts.find((a) => a.id === targetPeriod.accountId)?.strategyId ?? "";

          // Actualización optimista inmediata
          updateCache((old) => ({
            ...old,
            strategyPeriods: (old.strategyPeriods || []).filter((p) => p.id !== id),
            trades: (old.trades || []).map((t) => {
              if (t.accountId !== targetPeriod.accountId) return t;
              const day = tradeDayKey(t);
              if (!day || day < start || (end && day > end)) return t;
              if (t.strategyId === targetPeriod.strategyId) {
                return { ...t, strategyId: defaultStratId };
              }
              return t;
            }),
          }));

          try {
            const { error } = await supabase.from("account_strategy_periods").delete().eq("id", id);
            if (error) throw error;

            const matchingTradeIds = safeData.trades
              .filter((t) => {
                if (t.accountId !== targetPeriod.accountId) return false;
                const day = tradeDayKey(t);
                if (!day) return false;
                return (
                  day >= start &&
                  (!end || day <= end) &&
                  t.strategyId === targetPeriod.strategyId
                );
              })
              .map((t) => t.id);

            if (matchingTradeIds.length > 0) {
              await supabase
                .from("trades")
                .update({ strategy_id: defaultStratId || null })
                .in("id", matchingTradeIds);
            }
          } finally {
            await refresh();
          }
        } else {
          const { error } = await supabase.from("account_strategy_periods").delete().eq("id", id);
          if (error) throw error;
          await refresh();
        }
      },
      restoreDefaultStrategies: async () => {
        const base = await ownerFields();
        if (!base.user_id || !base.journal_id) return;

        // 1. Intentar sembrado mediante RPC
        try {
          const { error: rpcErr } = await (supabase.rpc as any)("seed_user_strategies", {
            p_journal_id: base.journal_id,
            p_user_id: base.user_id,
          });
          if (!rpcErr) {
            await refresh();
            return;
          }
        } catch {
          // Fallback manual
        }

        // 2. Fallback manual: buscar estrategias del admin o compartidas
        const existing = new Set(safeData.strategies.map((s) => s.name));
        let sourceStrategies: Strategy[] = [];

        try {
          const { data: adminRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin")
            .limit(1);

          const adminId = adminRoles?.[0]?.user_id;
          if (adminId) {
            const { data: adminStrats } = await supabase
              .from("strategies")
              .select("*")
              .eq("user_id", adminId);
            if (adminStrats && adminStrats.length > 0) {
              sourceStrategies = adminStrats.map(toStrategy);
            }
          }

          if (sourceStrategies.length === 0) {
            const { data: sharedStrats } = await supabase
              .from("strategies")
              .select("*")
              .eq("is_shared" as any, true);
            if (sharedStrats && sharedStrats.length > 0) {
              sourceStrategies = sharedStrats.map(toStrategy);
            }
          }
        } catch {
          // Ignorar y usar mock
        }

        if (sourceStrategies.length === 0) {
          sourceStrategies = mockStrategies.map((s) => ({ ...s, isShared: true }));
        }

        const rows = sourceStrategies
          .filter((s) => !existing.has(s.name))
          .map((s) => ({ ...fromStrategy(s), ...base }) as never);

        if (rows.length > 0) {
          const { error } = await supabase.from("strategies").insert(rows);
          if (error) throw error;
        }
        await refresh();
      },
    };
  }, [
    data,
    isLoading,
    selectedAccountIds,
    activeJournalId,
    setActiveJournalId,
    ownerFields,
    refresh,
    updateCache,
  ]);

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used within JournalProvider");
  return ctx;
}
