import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { mockAccounts, mockStrategies, mockTrades, mockWithdrawals } from "./mock-data";
import type { Account, Strategy, Trade, Withdrawal } from "./types";

interface JournalState {
  accounts: Account[];
  strategies: Strategy[];
  withdrawals: Withdrawal[];
  trades: Trade[];
  selectedAccountIds: string[];
  toggleAccount: (id: string) => void;
  selectAll: () => void;
  addAccount: (account: Omit<Account, "id">) => void;
  addTrade: (trade: Omit<Trade, "id">) => void;
  addWithdrawal: (withdrawal: Omit<Withdrawal, "id">) => void;
  updateStrategy: (id: string, patch: Partial<Strategy>) => void;
  visibleTrades: Trade[];
}

const JournalContext = createContext<JournalState | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>(mockAccounts);
  const [strategies, setStrategies] = useState<Strategy[]>(mockStrategies);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>(mockWithdrawals);
  const [trades, setTrades] = useState<Trade[]>(mockTrades);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    mockAccounts.map((a) => a.id),
  );

  const value = useMemo<JournalState>(() => {
    const visibleTrades = trades.filter((t) => selectedAccountIds.includes(t.accountId));
    return {
      accounts,
      strategies,
      withdrawals,
      trades,
      selectedAccountIds,
      visibleTrades,
      toggleAccount: (id) =>
        setSelectedAccountIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        ),
      selectAll: () => setSelectedAccountIds(accounts.map((a) => a.id)),
      addAccount: (account) => {
        const id = `acc-${Math.random().toString(36).slice(2, 8)}`;
        setAccounts((prev) => [...prev, { ...account, id }]);
        setSelectedAccountIds((prev) => [...prev, id]);
      },
      addTrade: (trade) => {
        const id = `trd-${Math.random().toString(36).slice(2, 8)}`;
        setTrades((prev) => [{ ...trade, id }, ...prev]);
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === trade.accountId
              ? { ...a, currentBalance: a.currentBalance + trade.pnl }
              : a,
          ),
        );
      },
      addWithdrawal: (withdrawal) => {
        const id = `wd-${Math.random().toString(36).slice(2, 8)}`;
        setWithdrawals((prev) => [{ ...withdrawal, id }, ...prev]);
      },
      updateStrategy: (id, patch) =>
        setStrategies((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    };
  }, [accounts, strategies, withdrawals, trades, selectedAccountIds]);

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used within JournalProvider");
  return ctx;
}
