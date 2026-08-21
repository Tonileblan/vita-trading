import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  FileText,
  Image as ImageIcon,
  Layers,
  Pencil,
  Smile,
  Trash2,
  Zap,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { effectiveStrategyId, formatCurrency, formatDateTime, formatTradeDate } from "@/lib/metrics";
import type { Account, AccountStrategyPeriod, Strategy, Trade } from "@/lib/types";
import { useJournal } from "@/lib/journal-store";
import { TradeFormDialog } from "@/components/trade-form-dialog";
import { cn } from "@/lib/utils";

export type TradeSortField = "date" | "strategy" | "account" | "pnl" | "symbol";
export type SortDirection = "asc" | "desc";

export function TradesTable({
  trades,
  accounts,
  strategies: propStrategies,
  strategyPeriods: propStrategyPeriods,
  limit,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
  sortField,
  sortDirection,
  onSortChange,
  readOnly = false,
}: {
  trades: Trade[];
  accounts: Account[];
  strategies?: Strategy[] | undefined;
  strategyPeriods?: AccountStrategyPeriod[] | undefined;
  limit?: number | undefined;
  selectedIds?: string[] | undefined;
  onToggleSelect?: ((id: string) => void) | undefined;
  onEdit?: ((trade: Trade) => void) | undefined;
  onDelete?: ((trade: Trade) => void) | undefined;
  sortField?: TradeSortField | null;
  sortDirection?: SortDirection;
  onSortChange?: (field: TradeSortField, direction: SortDirection) => void;
  readOnly?: boolean;
}) {
  const store = useJournal();
  const strategies = propStrategies ?? store.strategies;
  const strategyPeriods = propStrategyPeriods ?? store.strategyPeriods;
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  const [internalSortField, setInternalSortField] = useState<TradeSortField | null>("date");
  const [internalSortDir, setInternalSortDir] = useState<SortDirection>("desc");

  const currentSortField = sortField !== undefined ? sortField : internalSortField;
  const currentSortDir = sortDirection !== undefined ? sortDirection : internalSortDir;

  const handleSort = (field: TradeSortField) => {
    let nextDir: SortDirection = "asc";
    if (currentSortField === field) {
      nextDir = currentSortDir === "asc" ? "desc" : "asc";
    } else {
      nextDir = field === "date" || field === "pnl" ? "desc" : "asc";
    }

    if (onSortChange) {
      onSortChange(field, nextDir);
    } else {
      setInternalSortField(field);
      setInternalSortDir(nextDir);
    }
  };

  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";
  /** Treats empty or "N/D" (legacy) symbols as unavailable. */
  const symbolOf = (s: string) => (s && s !== "N/D" ? s : "—");
  const selectable = !!onToggleSelect && !readOnly;
  const isSelected = (id: string) => (selectedIds ?? []).includes(id);
  const colCount = 10 + (selectable ? 1 : 0);

  const handleEdit = (trade: Trade) => {
    if (onEdit) {
      onEdit(trade);
    } else {
      setEditingTrade(trade);
    }
  };

  const strategyOf = (trade: Trade) => {
    const stratId = effectiveStrategyId(trade, accounts, strategyPeriods);
    if (stratId) {
      const found = strategies.find((s) => s.id === stratId);
      if (found) return found;
    }
    if (trade.strategyId) {
      const direct = strategies.find((s) => s.id === trade.strategyId);
      if (direct) return direct;
    }
    const acc = accounts.find((a) => a.id === trade.accountId);
    if (acc?.strategyId) {
      return strategies.find((s) => s.id === acc.strategyId) ?? null;
    }
    return null;
  };

  const sortedTrades = useMemo(() => {
    if (onSortChange) {
      return trades;
    }
    if (!currentSortField) return trades;

    return [...trades].sort((a, b) => {
      let cmp = 0;
      if (currentSortField === "date") {
        const aTime = new Date(a.openedAt || a.closedAt || a.createdAt || "").getTime() || 0;
        const bTime = new Date(b.openedAt || b.closedAt || b.createdAt || "").getTime() || 0;
        cmp = aTime - bTime;
      } else if (currentSortField === "strategy") {
        const aStrat = strategyOf(a)?.name || "";
        const bStrat = strategyOf(b)?.name || "";
        if (!aStrat && bStrat) return 1;
        if (aStrat && !bStrat) return -1;
        cmp = aStrat.localeCompare(bStrat, "es", { sensitivity: "base" });
      } else if (currentSortField === "pnl") {
        cmp = (a.pnl ?? 0) - (b.pnl ?? 0);
      } else if (currentSortField === "account") {
        const aName = nameOf(a.accountId);
        const bName = nameOf(b.accountId);
        cmp = aName.localeCompare(bName, "es", { sensitivity: "base" });
      } else if (currentSortField === "symbol") {
        cmp = (a.symbol || "").localeCompare(b.symbol || "", "es", { sensitivity: "base" });
      }
      return currentSortDir === "asc" ? cmp : -cmp;
    });
  }, [trades, currentSortField, currentSortDir, onSortChange, strategies, accounts, strategyPeriods]);

  const rows = limit ? sortedTrades.slice(0, limit) : sortedTrades;

  return (
    <>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs md:min-w-[950px] md:text-sm">
          <thead>
            <tr className="border-b border-border text-left uppercase tracking-wider text-muted-foreground">
              {selectable && <th className="w-8 px-2 py-2 md:px-3 md:py-3" />}
              <th className="w-16 whitespace-nowrap px-2 py-2 font-semibold md:px-3 md:py-3">Acciones</th>
              
              {/* Columna Fecha */}
              <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">
                <button
                  type="button"
                  onClick={() => handleSort("date")}
                  className={cn(
                    "inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none group/th",
                    currentSortField === "date" ? "text-foreground font-bold" : "text-muted-foreground",
                  )}
                  title="Clic para ordenar por fecha"
                  aria-label="Ordenar por fecha"
                >
                  <span>Fecha</span>
                  {currentSortField === "date" ? (
                    currentSortDir === "asc" ? (
                      <ArrowUp className="size-3.5 text-brand" />
                    ) : (
                      <ArrowDown className="size-3.5 text-brand" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3.5 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                  )}
                </button>
              </th>

              {/* Columna Cuenta */}
              <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">
                <button
                  type="button"
                  onClick={() => handleSort("account")}
                  className={cn(
                    "inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none group/th",
                    currentSortField === "account" ? "text-foreground font-bold" : "text-muted-foreground",
                  )}
                  title="Clic para ordenar por cuenta"
                  aria-label="Ordenar por cuenta"
                >
                  <span>Cuenta</span>
                  {currentSortField === "account" ? (
                    currentSortDir === "asc" ? (
                      <ArrowUp className="size-3.5 text-brand" />
                    ) : (
                      <ArrowDown className="size-3.5 text-brand" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3.5 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                  )}
                </button>
              </th>

              {/* Columna PnL (Antes de la estrategia) */}
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold md:px-4 md:py-3">
                <button
                  type="button"
                  onClick={() => handleSort("pnl")}
                  className={cn(
                    "inline-flex items-center justify-end gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none group/th w-full",
                    currentSortField === "pnl" ? "text-foreground font-bold" : "text-muted-foreground",
                  )}
                  title="Clic para ordenar por PnL"
                  aria-label="Ordenar por PnL"
                >
                  <span>PnL</span>
                  {currentSortField === "pnl" ? (
                    currentSortDir === "asc" ? (
                      <ArrowUp className="size-3.5 text-brand" />
                    ) : (
                      <ArrowDown className="size-3.5 text-brand" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3.5 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                  )}
                </button>
              </th>

              {/* Columna Estrategia */}
              <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">
                <button
                  type="button"
                  onClick={() => handleSort("strategy")}
                  className={cn(
                    "inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none group/th",
                    currentSortField === "strategy" ? "text-foreground font-bold" : "text-muted-foreground",
                  )}
                  title="Clic para ordenar por estrategia"
                  aria-label="Ordenar por estrategia"
                >
                  <span>Estrategia</span>
                  {currentSortField === "strategy" ? (
                    currentSortDir === "asc" ? (
                      <ArrowUp className="size-3.5 text-brand" />
                    ) : (
                      <ArrowDown className="size-3.5 text-brand" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3.5 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                  )}
                </button>
              </th>

              <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">Dir.</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold md:px-4 md:py-3">Tamaño</th>

              {/* Columna Activo */}
              <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">
                <button
                  type="button"
                  onClick={() => handleSort("symbol")}
                  className={cn(
                    "inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none group/th",
                    currentSortField === "symbol" ? "text-foreground font-bold" : "text-muted-foreground",
                  )}
                  title="Clic para ordenar por símbolo / activo"
                  aria-label="Ordenar por activo"
                >
                  <span>Activo</span>
                  {currentSortField === "symbol" ? (
                    currentSortDir === "asc" ? (
                      <ArrowUp className="size-3.5 text-brand" />
                    ) : (
                      <ArrowDown className="size-3.5 text-brand" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3.5 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                  )}
                </button>
              </th>

              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold md:px-4 md:py-3">Entrada</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold md:px-4 md:py-3">Salida</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const hasNotes = Boolean(t.notes && t.notes.trim());
              const hasScreenshots = Boolean(t.screenshots && t.screenshots.length > 0);
              const hasEmotion = Boolean(
                t.emotionBefore ||
                t.emotionAfter ||
                t.followedPlan ||
                (t.mistakes && t.mistakes.length > 0) ||
                (t.emotionNote && t.emotionNote.trim())
              );
              const strat = strategyOf(t);

              return (
                <tr
                  key={t.id}
                  className="group border-b border-border/60 last:border-0 hover:bg-accent/40 transition-colors"
                >
                  {/* 1. Cuadro selector */}
                  {selectable && (
                    <td className="w-8 px-2 py-2 md:px-3 md:py-3">
                      <Checkbox
                        checked={isSelected(t.id)}
                        onCheckedChange={() => onToggleSelect?.(t.id)}
                        aria-label="Seleccionar operación"
                      />
                    </td>
                  )}

                  {/* 2. Acciones */}
                  <td className="w-16 whitespace-nowrap px-2 py-2 md:px-3 md:py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(t)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title={readOnly ? "Ver detalle de la operación" : "Editar / completar información"}
                        aria-label={readOnly ? "Ver operación" : "Editar operación"}
                      >
                        {readOnly ? <Eye className="size-4" /> : <Pencil className="size-4" />}
                      </button>
                      {!readOnly && onDelete && (
                        <button
                          onClick={() => onDelete(t)}
                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-loss/20 hover:text-loss"
                          title="Eliminar operación"
                          aria-label="Eliminar operación"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* 3. Fecha (Solo día y mes) */}
                  <td
                    className="whitespace-nowrap px-2 py-2 font-mono text-xs text-muted-foreground md:px-4 md:py-3"
                    title={formatDateTime(t.openedAt || t.closedAt)}
                  >
                    {formatTradeDate(t.openedAt || t.closedAt)}
                  </td>

                  {/* 4. Cuenta */}
                  <td className="whitespace-nowrap px-2 py-2 font-medium md:px-4 md:py-3">
                    {nameOf(t.accountId)}
                  </td>

                  {/* 5. PnL (Antes de la estrategia) */}
                  <td
                    className={cn(
                      "num whitespace-nowrap px-2 py-2 text-right font-bold md:px-4 md:py-3",
                      t.pnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {formatCurrency(t.pnl, true)}
                  </td>

                  {/* 6. Estrategia */}
                  <td className="whitespace-nowrap px-2 py-2 font-medium text-foreground md:px-4 md:py-3">
                    {strat ? strat.name : "—"}
                  </td>

                  {/* 7. Dirección */}
                  <td className="whitespace-nowrap px-2 py-2 md:px-4 md:py-3">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-semibold uppercase",
                        t.direction === "long"
                          ? "bg-profit/15 text-profit"
                          : "bg-loss/15 text-loss",
                      )}
                    >
                      {t.direction}
                    </span>
                  </td>

                  {/* 8. Tamaño */}
                  <td className="num whitespace-nowrap px-2 py-2 text-right md:px-4 md:py-3">
                    {t.size}
                  </td>

                  {/* 9. Activo + Badges */}
                  <td className="whitespace-nowrap px-2 py-2 md:px-4 md:py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">{symbolOf(t.symbol)}</span>
                      {t.source === "webhook" && (
                        <span
                          title="Registrada vía webhook automático"
                          className="inline-flex items-center text-primary"
                        >
                          <Zap className="size-3" />
                        </span>
                      )}
                      {(hasNotes || hasScreenshots || hasEmotion) && (
                        <div className="flex items-center gap-1 ml-1">
                          {hasNotes && (
                            <span title={`Nota: ${t.notes}`}>
                              <FileText className="size-3 text-muted-foreground" />
                            </span>
                          )}
                          {hasScreenshots && (
                            <span title={`${t.screenshots?.length} captura(s)`}>
                              <ImageIcon className="size-3 text-brand" />
                            </span>
                          )}
                          {hasEmotion && (
                            <span title="Registro emocional completado">
                              <Smile className="size-3 text-amber-400" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 10. Entrada */}
                  <td className="num whitespace-nowrap px-2 py-2 text-right md:px-4 md:py-3">
                    {t.entryPrice > 0 ? t.entryPrice : "—"}
                  </td>

                  {/* 11. Salida */}
                  <td className="num whitespace-nowrap px-2 py-2 text-right md:px-4 md:py-3">
                    {t.exitPrice > 0 ? t.exitPrice : "—"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-muted-foreground">
                  No hay operaciones para los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TradeFormDialog
        trade={editingTrade}
        open={Boolean(editingTrade)}
        trigger={null}
        readOnly={readOnly}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingTrade(null);
        }}
      />
    </>
  );
}
