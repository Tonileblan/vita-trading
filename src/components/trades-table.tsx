import { useState } from "react";
import { FileText, Image as ImageIcon, Pencil, Smile, Trash2, Zap } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, formatDateTime } from "@/lib/metrics";
import type { Account, Trade } from "@/lib/types";
import { TradeFormDialog } from "@/components/trade-form-dialog";
import { cn } from "@/lib/utils";

export function TradesTable({
  trades,
  accounts,
  limit,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  trades: Trade[];
  accounts: Account[];
  limit?: number | undefined;
  selectedIds?: string[] | undefined;
  onToggleSelect?: ((id: string) => void) | undefined;
  onEdit?: ((trade: Trade) => void) | undefined;
  onDelete?: ((trade: Trade) => void) | undefined;
}) {
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

  return (
    <>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[720px] text-xs md:min-w-[900px] md:text-sm">
          <thead>
            <tr className="border-b border-border text-left uppercase tracking-wider text-muted-foreground">
              {selectable && <th className="w-8 px-2 py-2 md:px-3 md:py-3" />}
              <th className="w-16 whitespace-nowrap px-2 py-2 font-semibold md:px-3 md:py-3">Acciones</th>
              <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">Fecha</th>
              <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">Cuenta</th>
              <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">Dir.</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold md:px-4 md:py-3">Tamaño</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold md:px-4 md:py-3">PnL</th>
              <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">Activo</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold md:px-4 md:py-3">Entrada</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold md:px-4 md:py-3">Salida</th>
              <th className="hidden px-4 py-3 font-semibold md:table-cell">Estrategia</th>
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
                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-loss"
                          title="Eliminar operación"
                          aria-label="Eliminar operación"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* 3. Fecha */}
                  <td className="whitespace-nowrap px-2 py-2 text-muted-foreground md:px-4 md:py-3">
                    <span className="num">{formatDateTime(t.closedAt)}</span>
                    {t.source === "webhook" && (
                      <Zap className="ml-1 inline size-3 text-brand-soft" aria-label="Vía webhook" />
                    )}
                  </td>

                  {/* 4. Cuenta */}
                  <td className="max-w-[160px] truncate px-2 py-2 text-muted-foreground md:px-4 md:py-3 font-medium">
                    {nameOf(t.accountId)}
                  </td>

                  {/* 5. Dir */}
                  <td className="whitespace-nowrap px-2 py-2 md:px-4 md:py-3">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase md:text-xs",
                        t.direction === "long" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
                      )}
                    >
                      {t.direction}
                    </span>
                  </td>

                  {/* 6. Tamaño */}
                  <td className="num whitespace-nowrap px-2 py-2 text-right md:px-4 md:py-3">
                    {t.size > 0 ? t.size : "—"}
                  </td>

                  {/* 7. PnL */}
                  <td
                    className={cn(
                      "num whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums md:px-4 md:py-3",
                      t.pnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {formatCurrency(t.pnl, true)}
                  </td>

                  {/* 8. Resto: Activo */}
                  <td className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">
                    <div className="flex items-center gap-1.5">
                      <span>{symbolOf(t.symbol)}</span>
                      {(hasNotes || hasScreenshots || hasEmotion) && (
                        <div className="flex items-center gap-0.5 text-muted-foreground">
                          {hasScreenshots && (
                            <span title={`${t.screenshots.length} captura(s)`}>
                              <ImageIcon className="size-3 text-brand-soft" />
                            </span>
                          )}
                          {hasNotes && (
                            <span title="Tiene notas">
                              <FileText className="size-3 text-sky-400" />
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

                  {/* Entrada */}
                  <td className="num whitespace-nowrap px-2 py-2 text-right md:px-4 md:py-3">
                    {t.entryPrice > 0 ? t.entryPrice : "—"}
                  </td>

                  {/* Salida */}
                  <td className="num whitespace-nowrap px-2 py-2 text-right md:px-4 md:py-3">
                    {t.exitPrice > 0 ? t.exitPrice : "—"}
                  </td>

                  {/* Estrategia / Tags */}
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {t.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
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
