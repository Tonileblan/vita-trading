import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { mockAccounts, mockStrategies, mockTrades, mockWithdrawals } from "./mock-data";
import type { Account, Strategy, Trade, Withdrawal } from "./types";

interface Bucket {
  accounts: Account[];
  strategies: Strategy[];
  withdrawals: Withdrawal[];
  trades: Trade[];
  selectedAccountIds: string[];
}

const DEFAULT_KEY = "__default__";
const STORAGE_KEY = "tj:active-journal";

function seedBucket(): Bucket {
  return {
    accounts: mockAccounts,
    strategies: mockStrategies,
    withdrawals: mockWithdrawals,
    trades: mockTrades,
    selectedAccountIds: mockAccounts.map((a) => a.id),
  };
}

function emptyBucket(): Bucket {
  return {
    accounts: [],
    // Todo diario nuevo arranca con las estrategias por defecto.
    strategies: mockStrategies.map((s) => ({ ...s })),
    withdrawals: [],
    trades: [],
    selectedAccountIds: [],
  };
}

interface JournalState extends Bucket {
  activeJournalId: string;
  setActiveJournalId: (id: string) => void;
  toggleAccount: (id: string) => void;
  selectAll: () => void;
  addAccount: (account: Omit<Account, "id">) => void;
  updateAccount: (id: string, patch: Partial<Omit<Account, "id">>) => void;
  removeAccount: (id: string) => void;
  addTrade: (trade: Omit<Trade, "id">) => void;
  addWithdrawal: (withdrawal: Omit<Withdrawal, "id">) => void;
  updateStrategy: (id: string, patch: Partial<Strategy>) => void;
  addStrategy: (strategy: Omit<Strategy, "id">) => void;
  removeStrategy: (id: string) => void;
  visibleTrades: Trade[];
}

const JournalContext = createContext<JournalState | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const [activeJournalId, setActive] = useState<string>(DEFAULT_KEY);
  const [buckets, setBuckets] = useState<Record<string, Bucket>>({
    [DEFAULT_KEY]: seedBucket(),
  });

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored) setActive(stored);
  }, []);

  const setActiveJournalId = useCallback((id: string) => {
    setBuckets((prev) => (prev[id] ? prev : { ...prev, [id]: emptyBucket() }));
    setActive(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const bucket = buckets[activeJournalId] ?? buckets[DEFAULT_KEY] ?? emptyBucket();

  const patchBucket = useCallback(
    (fn: (b: Bucket) => Bucket) =>
      setBuckets((prev) => {
        const current = prev[activeJournalId] ?? emptyBucket();
        return { ...prev, [activeJournalId]: fn(current) };
      }),
    [activeJournalId],
  );

  const value = useMemo<JournalState>(() => {
    const visibleTrades = bucket.trades.filter((t) =>
      bucket.selectedAccountIds.includes(t.accountId),
    );
    return {
      ...bucket,
      visibleTrades,
      activeJournalId,
      setActiveJournalId,
      toggleAccount: (id) =>
        patchBucket((b) => ({
          ...b,
          selectedAccountIds: b.selectedAccountIds.includes(id)
            ? b.selectedAccountIds.filter((x) => x !== id)
            : [...b.selectedAccountIds, id],
        })),
      selectAll: () =>
        patchBucket((b) => ({ ...b, selectedAccountIds: b.accounts.map((a) => a.id) })),
      addAccount: (account) => {
        const id = `acc-${Math.random().toString(36).slice(2, 8)}`;
        patchBucket((b) => ({
          ...b,
          accounts: [...b.accounts, { ...account, id }],
          selectedAccountIds: [...b.selectedAccountIds, id],
        }));
      },
      updateAccount: (id, patch) =>
        patchBucket((b) => ({
          ...b,
          accounts: b.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      removeAccount: (id) =>
        patchBucket((b) => ({
          ...b,
          accounts: b.accounts.filter((a) => a.id !== id),
          selectedAccountIds: b.selectedAccountIds.filter((x) => x !== id),
          trades: b.trades.filter((t) => t.accountId !== id),
        })),
      addTrade: (trade) => {
        const id = `trd-${Math.random().toString(36).slice(2, 8)}`;
        patchBucket((b) => ({
          ...b,
          trades: [{ ...trade, id }, ...b.trades],
          accounts: b.accounts.map((a) =>
            a.id === trade.accountId ? { ...a, currentBalance: a.currentBalance + trade.pnl } : a,
          ),
        }));
      },
      addWithdrawal: (withdrawal) => {
        const id = `wd-${Math.random().toString(36).slice(2, 8)}`;
        patchBucket((b) => ({ ...b, withdrawals: [{ ...withdrawal, id }, ...b.withdrawals] }));
      },
      addStrategy: (strategy) => {
        const id = `str-${Math.random().toString(36).slice(2, 8)}`;
        patchBucket((b) => ({ ...b, strategies: [...b.strategies, { ...strategy, id }] }));
      },
      removeStrategy: (id) =>
        patchBucket((b) => ({
          ...b,
          strategies: b.strategies.filter((s) => s.id !== id),
          withdrawals: b.withdrawals.filter((w) => w.strategyId !== id),
        })),
      updateStrategy: (id, patch) =>
        patchBucket((b) => ({
          ...b,
          strategies: b.strategies.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),
    };
  }, [bucket, activeJournalId, setActiveJournalId, patchBucket]);

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used within JournalProvider");
  return ctx;
}
