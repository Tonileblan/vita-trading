import { useState, useMemo, useCallback } from "react";
import type { Trade } from "@/lib/types";

export type DateRangePreset = "7d" | "30d" | "90d" | "month" | "all" | "custom";

export interface TradeFilterState {
  accountId: string; // "all" o id
  strategyId: string; // "all" o id
  direction: "all" | "long" | "short";
  tag: string; // "all" o tag específico
  searchQuery: string;
  preset: DateRangePreset;
  customStartDate?: string;
  customEndDate?: string;
}

const DEFAULT_FILTERS: TradeFilterState = {
  accountId: "all",
  strategyId: "all",
  direction: "all",
  tag: "all",
  searchQuery: "",
  preset: "all",
};

/**
 * Hook para gestionar y aplicar filtros multidimensionales sobre un array de operaciones
 */
export function useTradeFilters(trades: Trade[] = []) {
  const [filters, setFilters] = useState<TradeFilterState>(DEFAULT_FILTERS);

  const setFilter = useCallback(
    <K extends keyof TradeFilterState>(key: K, value: TradeFilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // Filtrado optimizado con useMemo
  const filteredTrades = useMemo(() => {
    const now = new Date();
    let minDate: Date | null = null;

    if (filters.preset === "7d") {
      minDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (filters.preset === "30d") {
      minDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (filters.preset === "90d") {
      minDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (filters.preset === "month") {
      minDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const query = filters.searchQuery.toLowerCase().trim();

    return trades.filter((trade) => {
      // 1. Filtro de cuenta
      if (filters.accountId !== "all" && trade.accountId !== filters.accountId) {
        return false;
      }

      // 2. Filtro de estrategia
      if (filters.strategyId !== "all" && trade.strategyId !== filters.strategyId) {
        return false;
      }

      // 3. Filtro de dirección
      if (filters.direction !== "all" && trade.direction !== filters.direction) {
        return false;
      }

      // 4. Filtro de tags
      if (filters.tag !== "all" && !trade.tags?.includes(filters.tag)) {
        return false;
      }

      // 5. Filtro de fechas preset
      if (minDate) {
        const tradeDate = new Date(trade.openedAt || trade.closedAt);
        if (tradeDate < minDate) return false;
      }

      // 6. Búsqueda por texto (símbolo, notas, tags)
      if (query) {
        const symbolMatch = trade.symbol.toLowerCase().includes(query);
        const notesMatch = trade.notes?.toLowerCase().includes(query);
        const tagsMatch = trade.tags?.some((t) => t.toLowerCase().includes(query));
        if (!symbolMatch && !notesMatch && !tagsMatch) return false;
      }

      return true;
    });
  }, [trades, filters]);

  return {
    filters,
    setFilters,
    setFilter,
    resetFilters,
    filteredTrades,
    totalCount: trades.length,
    filteredCount: filteredTrades.length,
  };
}
