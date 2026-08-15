import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { mockAccounts, mockTrades } from "./mock-data";
import type { Account, Trade } from "./types";

interface JournalState {
  accounts: Account[];
  trades: Trade[];
  selectedAccountIds: string[];
  toggleAccount: (id: string) => void;
  selectAll: () => void;
  addAccount: (account: Omit<Account, "id">) => void;
  addTrade: (trade: Omit<Trade, "id">) => void;
  visibleTrades: Trade[];
}

const JournalContext = createContext<JournalState | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>(mockAccounts);
  const [trades, setTrades] = useState<Trade[]>(mockTrades);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    mockAccounts.map((a) => a.id),
  );

  const value = useMemo<JournalState>(() => {
    const visibleTrades = trades.filter((t) => selectedAccountIds.includes(t.accountId));
    return {
      accounts,
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
    };
  }, [accounts, trades, selectedAccountIds]);

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used within JournalProvider");
  return ctx;
}
