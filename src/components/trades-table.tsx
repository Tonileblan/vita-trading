import { useState } from "react";
import { FileText, Image as ImageIcon, Layers, Pencil, Smile, Trash2, Zap } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, formatDateTime } from "@/lib/metrics";
import type { Account, Strategy, Trade } from "@/lib/types";
import { useJournal } from "@/lib/journal-store";
import { TradeFormDialog } from "@/components/trade-form-dialog";
import { cn } from "@/lib/utils";

export function TradesTable({
  trades,
  accounts,
  strategies: propStrategies,
  limit,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  trades: Trade[];
  accounts: Account[];
  strategies?: Strategy[] | undefined;
  limit?: number | undefined;
  selectedIds?: string[] | undefined;
  onToggleSelect?: ((id: string) => void) | undefined;
  onEdit?: ((trade: Trade) => void) | undefined;
  onDelete?: ((trade: Trade) => void) | undefined;
}) {
  const store = useJournal();
  const strategies = propStrategies ?? store.strategies;
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  const rows = limit ? trades.slice(0, limit) : trades;
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";
  /** Treats empty or "N/D" (legacy) symbols as unavailable. */
  const symbolOf = (s: string) => (s && s !== "N/D" ? s : "—");
  const selectable = !!onToggleSelect;
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

  return (
    <>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs md:min-w-[950px] md:text-sm">
          <thead>
            <tr className="border-b border-border text-left uppercase tracking-wider text-muted-foreground">
              {selectable && <th className="w-8 px-2 py-2 md:px-3 md:py-3" />}
              <th className="w-16 whitespace-nowrap px-2 py-2 font-semibold md:px-3 md:py-3">Acciones</th>
              <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">Fecha</th>
              <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">Cuenta</th>
              <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">Estrategia</th>
              <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">Dir.</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold md:px-4 md:py-3">Tamaño</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold md:px-4 md:py-3">PnL</th>
              <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">Activo</th>
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
                        title="Editar / completar información"
                        aria-label="Editar operación"
                      >
                        <Pencil className="size-4" />
                      </button>
                      {onDelete && (
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

                  {/* 3. Fecha */}
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-muted-foreground md:px-4 md:py-3">
                    {formatDateTime(t.openedAt || t.closedAt)}
                  </td>

                  {/* 4. Cuenta */}
                  <td className="whitespace-nowrap px-2 py-2 font-medium md:px-4 md:py-3">
                    {nameOf(t.accountId)}
                  </td>

                  {/* 5. Estrategia */}
                  <td className="whitespace-nowrap px-2 py-2 md:px-4 md:py-3">
                    {strat ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold"
                        style={{
                          borderColor: strat.color ? `${strat.color}50` : "var(--border)",
                          backgroundColor: strat.color ? `${strat.color}15` : "var(--muted)",
                          color: strat.color || "inherit",
                        }}
                      >
                        {strat.color && (
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: strat.color }}
                          />
                        )}
                        <span className="max-w-[130px] truncate">{strat.name}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-border/50 bg-muted/30 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Sin estrategia
                      </span>
                    )}
                  </td>

                  {/* 6. Dirección */}
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

                  {/* 7. Tamaño */}
                  <td className="num whitespace-nowrap px-2 py-2 text-right md:px-4 md:py-3">
                    {t.size}
                  </td>

                  {/* 8. PnL */}
                  <td
                    className={cn(
                      "num whitespace-nowrap px-2 py-2 text-right font-semibold md:px-4 md:py-3",
                      t.pnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {formatCurrency(t.pnl, true)}
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
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingTrade(null);
        }}
      />
    </>
  );
}
