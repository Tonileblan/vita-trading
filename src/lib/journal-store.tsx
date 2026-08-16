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
import type { Account, Strategy, Trade, Withdrawal } from "./types";

const STORAGE_KEY = "tj:active-journal";

/* ---------------------------------- mappers --------------------------------- */

type Row = Record<string, unknown>;

function toAccount(r: Row): Account {
  return {
    id: String(r["id"]),
    name: String(r["name"] ?? ""),
    type: (r["type"] === "funded" ? "funded" : "personal") as Account["type"],
    firm: (r["firm"] as string | null) ?? undefined,
    broker: (r["broker"] as string | null) ?? undefined,
    phase: (r["phase"] === "live" ? "live" : "eval") as Account["phase"],
    profitTarget: r["profit_target"] == null ? undefined : Number(r["profit_target"]),
    initialBalance: Number(r["initial_balance"] ?? 0),
    currentBalance: Number(r["current_balance"] ?? 0),
    drawdownLimit: r["drawdown_limit"] == null ? undefined : Number(r["drawdown_limit"]),
    drawdownType: (["static", "trailing", "eod"].includes(String(r["drawdown_type"]))
      ? String(r["drawdown_type"])
      : "static") as Account["drawdownType"],
    currency: String(r["currency"] ?? "USD"),
  };
}

function fromAccount(a: Partial<Omit<Account, "id">>): Row {
  const out: Row = {};
  if (a.name !== undefined) out["name"] = a.name;
  if (a.type !== undefined) out["type"] = a.type;
  if (a.firm !== undefined) out["firm"] = a.firm ?? null;
  if (a.broker !== undefined) out["broker"] = a.broker ?? null;
  if (a.phase !== undefined) out["phase"] = a.phase ?? "eval";
  if (a.profitTarget !== undefined) out["profit_target"] = a.profitTarget ?? null;
  if (a.initialBalance !== undefined) out["initial_balance"] = a.initialBalance;
  if (a.currentBalance !== undefined) out["current_balance"] = a.currentBalance;
  if (a.drawdownLimit !== undefined) out["drawdown_limit"] = a.drawdownLimit ?? null;
  if (a.drawdownType !== undefined) out["drawdown_type"] = a.drawdownType ?? "static";
  if (a.currency !== undefined) out["currency"] = a.currency;
  return out;
}

function toStrategy(r: Row): Strategy {
  return {
    id: String(r["id"]),
    name: String(r["name"] ?? ""),
    initialCapital: Number(r["initial_capital"] ?? 0),
    riskPct: Number(r["risk_pct"] ?? 0),
    mainSymbol: String(r["main_symbol"] ?? ""),
    color: String(r["color"] ?? "var(--brand)"),
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
  for (const k of ["market", "chart", "days", "schedule", "execution", "setup", "management", "contracts"] as const) {
    if (s[k] !== undefined) out[k] = s[k] ?? null;
  }
  return out;
}

export function toTrade(r: Row): Trade {
  return {
    id: String(r["id"]),
    accountId: String(r["account_id"] ?? ""),
    strategyId: String(r["strategy_id"] ?? ""),
    symbol: String(r["symbol"] ?? ""),
    direction: (r["direction"] === "short" ? "short" : "long") as Trade["direction"],
    openedAt: String(r["opened_at"] ?? new Date().toISOString()),
    closedAt: String(r["closed_at"] ?? new Date().toISOString()),
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

function fromTrade(t: Omit<Trade, "id">): Row {
  return {
    account_id: t.accountId || null,
    strategy_id: t.strategyId || null,
    symbol: t.symbol,
    direction: t.direction,
    opened_at: t.openedAt,
    closed_at: t.closedAt,
    entry_price: t.entryPrice,
    exit_price: t.exitPrice,
    size: t.size,
    pnl: t.pnl,
    tags: t.tags,
    notes: t.notes ?? null,
    screenshots: t.screenshots,
    source: t.source,
    emotion_before: t.emotionBefore ?? null,
    emotion_after: t.emotionAfter ?? null,
    followed_plan: t.followedPlan ?? null,
    mistakes: t.mistakes ?? [],
    emotion_note: t.emotionNote ?? null,
  };
}


function toWithdrawal(r: Row): Withdrawal {
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

/* ----------------------------------- data ----------------------------------- */

export interface JournalData {
  accounts: Account[];
  strategies: Strategy[];
  trades: Trade[];
  withdrawals: Withdrawal[];
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
      return supabase
        .from("accounts")
        .update({ current_balance: account.currentBalance + delta } as never)
        .eq("id", id)
        .then(() => undefined);
    }),
  );
}

const EMPTY: JournalData = { accounts: [], strategies: [], trades: [], withdrawals: [] };

/** Lee todos los datos de un diario (usado también por la vista de supervisión). */
export async function fetchJournalData(journalId: string): Promise<JournalData> {
  const [accounts, strategies, trades, withdrawals] = await Promise.all([
    supabase.from("accounts").select("*").eq("journal_id", journalId),
    supabase.from("strategies").select("*").eq("journal_id", journalId),
    supabase.from("trades").select("*").eq("journal_id", journalId).order("closed_at", { ascending: false }),
    supabase.from("withdrawals").select("*").eq("journal_id", journalId).order("date", { ascending: false }),
  ]);
  const err = accounts.error || strategies.error || trades.error || withdrawals.error;
  if (err) throw err;
  return {
    accounts: (accounts.data ?? []).map((r) => toAccount(r as Row)),
    strategies: (strategies.data ?? []).map((r) => toStrategy(r as Row)),
    trades: (trades.data ?? []).map((r) => toTrade(r as Row)),
    withdrawals: (withdrawals.data ?? []).map((r) => toWithdrawal(r as Row)),
  };
}

async function seedDefaultStrategies(journalId: string, userId: string) {
  const rows = mockStrategies.map((s) => ({
    ...fromStrategy(s),
    journal_id: journalId,
    user_id: userId,
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
  removeAccount: (id: string) => Promise<void>;
  addTrade: (trade: Omit<Trade, "id">) => Promise<void>;
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
  visibleTrades: Trade[];
}

const JournalContext = createContext<JournalState | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data: journals = [] } = useJournals();
  const [activeJournalId, setActive] = useState<string>("");
  const [manualSelection, setManualSelection] = useState<string[] | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored) setActive(stored);
  }, []);

  // Si no hay diario activo válido, usa el primero disponible.
  useEffect(() => {
    if (journals.length === 0) return;
    if (!journals.some((j) => j.id === activeJournalId)) {
      setActive(journals[0]!.id);
    }
  }, [journals, activeJournalId]);

  const setActiveJournalId = useCallback((id: string) => {
    setActive(id);
    setManualSelection(null);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const { data = EMPTY, isLoading } = useQuery({
    queryKey: ["journal-data", activeJournalId],
    enabled: !!activeJournalId,
    queryFn: async () => {
      const result = await fetchJournalData(activeJournalId);
      if (result.strategies.length === 0) {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        // Comprueba la propiedad directamente en la base para evitar carreras con la lista de diarios.
        const { data: journal } = await supabase
          .from("journals")
          .select("owner_id")
          .eq("id", activeJournalId)
          .maybeSingle();
        if (uid && journal?.owner_id === uid) {
          await seedDefaultStrategies(activeJournalId, uid);
          return fetchJournalData(activeJournalId);
        }
      }
      return result;
    },
  });

  const refresh = useCallback(
    () => qc.invalidateQueries({ queryKey: ["journal-data", activeJournalId] }),
    [qc, activeJournalId],
  );

  const ownerFields = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    return { journal_id: activeJournalId, user_id: userData.user?.id };
  }, [activeJournalId]);

  const selectedAccountIds = manualSelection ?? data.accounts.map((a) => a.id);

  const value = useMemo<JournalState>(() => {
    const visibleTrades = data.trades.filter((t) => selectedAccountIds.includes(t.accountId));
    const importBatches = groupImportBatches(data.trades);
    /** Borra operaciones y devuelve a cada cuenta el PnL correspondiente. */
    const deleteTradeIds = async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from("trades").delete().in("id", ids);
      if (error) throw error;
      const deltas = new Map<string, number>();
      for (const t of data.trades) {
        if (!ids.includes(t.id) || !t.accountId) continue;
        deltas.set(t.accountId, (deltas.get(t.accountId) ?? 0) - t.pnl);
      }
      await applyBalanceDeltas(data.accounts, deltas);
      await refresh();
    };
    return {
      ...data,
      // Solo los retiros aprobados afectan al capital y a las métricas.
      withdrawals: data.withdrawals.filter((w) => w.status === "approved"),
      allWithdrawals: data.withdrawals,
      loading: isLoading,
      visibleTrades,
      selectedAccountIds,
      activeJournalId,
      setActiveJournalId,
      toggleAccount: (id) =>
        setManualSelection((prev) => {
          const current = prev ?? data.accounts.map((a) => a.id);
          return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
        }),
      selectAll: () => setManualSelection(null),
      addAccount: async (account) => {
        const base = await ownerFields();
        const { error } = await supabase
          .from("accounts")
          .insert({ ...fromAccount(account), ...base } as never);
        if (error) throw error;
        setManualSelection(null);
        await refresh();
      },
      updateAccount: async (id, patch) => {
        const { error } = await supabase
          .from("accounts")
          .update(fromAccount(patch) as never)
          .eq("id", id);
        if (error) throw error;
        await refresh();
      },
      removeAccount: async (id) => {
        const { error } = await supabase.from("accounts").delete().eq("id", id);
        if (error) throw error;
        setManualSelection(null);
        await refresh();
      },
      addTrade: async (trade) => {
        const base = await ownerFields();
        const { error } = await supabase
          .from("trades")
          .insert({ ...fromTrade(trade), ...base } as never);
        if (error) throw error;
        const account = data.accounts.find((a) => a.id === trade.accountId);
        if (account) {
          await supabase
            .from("accounts")
            .update({ current_balance: account.currentBalance + trade.pnl } as never)
            .eq("id", account.id);
        }
        await refresh();
      },
      addTrades: async (list) => {
        if (list.length === 0) return;
        const base = await ownerFields();
        const batchId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : String(Date.now());
        const { error } = await supabase
          .from("trades")
          .insert(
            list.map((t) => ({ ...fromTrade(t), ...base, import_batch_id: batchId })) as never,
          );
        if (error) throw error;
        // Suma del PnL por cuenta para actualizar cada balance una única vez.
        const deltas = new Map<string, number>();
        for (const t of list) {
          if (!t.accountId) continue;
          deltas.set(t.accountId, (deltas.get(t.accountId) ?? 0) + t.pnl);
        }
        await applyBalanceDeltas(data.accounts, deltas);
        await refresh();
      },
      removeTrade: async (id) => {
        await deleteTradeIds([id]);
      },
      removeTrades: async (ids) => {
        await deleteTradeIds(ids);
      },
      removeImportBatch: async (batchId) => {
        const ids = data.trades.filter((t) => t.importBatchId === batchId).map((t) => t.id);
        await deleteTradeIds(ids);
      },
      importBatches,





      addWithdrawal: async (withdrawal) => {
        const base = await ownerFields();
        const { error } = await supabase.from("withdrawals").insert({
          strategy_id: withdrawal.strategyId || null,
          account_id: withdrawal.accountId || null,
          date: withdrawal.date,
          amount: withdrawal.amount,
          reason: withdrawal.reason ?? null,
          status: withdrawal.status ?? "approved",
          ...base,
        } as never);
        if (error) throw error;
        await refresh();
      },
      updateWithdrawal: async (id, patch) => {
        const row: Record<string, unknown> = {};
        if (patch.accountId !== undefined) row["account_id"] = patch.accountId || null;
        if (patch.date !== undefined) row["date"] = patch.date;
        if (patch.amount !== undefined) row["amount"] = patch.amount;
        if (patch.reason !== undefined) row["reason"] = patch.reason ?? null;
        if (patch.status !== undefined) row["status"] = patch.status;
        const { error } = await supabase.from("withdrawals").update(row as never).eq("id", id);
        if (error) throw error;
        await refresh();
      },
      removeWithdrawal: async (id) => {
        const { error } = await supabase.from("withdrawals").delete().eq("id", id);
        if (error) throw error;
        await refresh();
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
      restoreDefaultStrategies: async () => {
        const base = await ownerFields();
        if (!base.user_id) return;
        // Omite las estrategias por defecto que ya existan (por nombre) para no duplicar.
        const existing = new Set(data.strategies.map((s) => s.name));
        const rows = mockStrategies
          .filter((s) => !existing.has(s.name))
          .map((s) => ({ ...fromStrategy(s), ...base } as never));
        if (rows.length > 0) {
          const { error } = await supabase.from("strategies").insert(rows);
          if (error) throw error;
        }
        await refresh();
      },
    };
  }, [data, isLoading, selectedAccountIds, activeJournalId, setActiveJournalId, ownerFields, refresh]);

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used within JournalProvider");
  return ctx;
}
