import { Trash2, Zap } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, formatDateTime } from "@/lib/metrics";
import type { Account, Trade } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TradesTable({
  trades,
  accounts,
  limit,
  selectedIds,
  onToggleSelect,
  onDelete,
}: {
  trades: Trade[];
  accounts: Account[];
  limit?: number;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onDelete?: (trade: Trade) => void;
}) {
  const rows = limit ? trades.slice(0, limit) : trades;
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";
  /** Treats empty or "N/D" (legacy) symbols as unavailable. */
  const symbolOf = (s: string) => (s && s !== "N/D" ? s : "—");
  const selectable = !!onToggleSelect;
  const isSelected = (id: string) => (selectedIds ?? []).includes(id);
  const colCount = 9 + (selectable ? 1 : 0) + (onDelete ? 1 : 0);

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[640px] text-xs md:min-w-[820px] md:text-sm">
        <thead>
          <tr className="border-b border-border text-left uppercase tracking-wider text-muted-foreground">
            {selectable && <th className="w-10 px-2 py-2 md:px-3 md:py-3" />}
            <th className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">Cierre</th>
            <th className="px-2 py-2 font-semibold md:px-4 md:py-3">Activo</th>
            <th className="px-2 py-2 font-semibold md:px-4 md:py-3">Dir.</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Cuenta</th>
            <th className="px-2 py-2 text-right font-semibold md:px-4 md:py-3">Entrada</th>
            <th className="px-2 py-2 text-right font-semibold md:px-4 md:py-3">Salida</th>
            <th className="px-2 py-2 text-right font-semibold md:px-4 md:py-3">Tam.</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Estrategia</th>
            <th className="px-2 py-2 text-right font-semibold md:px-4 md:py-3">PnL</th>
            {onDelete && <th className="w-10 px-2 py-2 md:px-3 md:py-3" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
              {selectable && (
                <td className="px-2 py-2 md:px-3 md:py-3">
                  <Checkbox
                    checked={isSelected(t.id)}
                    onCheckedChange={() => onToggleSelect?.(t.id)}
                    aria-label="Seleccionar operación"
                  />
                </td>
              )}
              <td className="whitespace-nowrap px-2 py-2 text-muted-foreground md:px-4 md:py-3">
                <span className="num">{formatDateTime(t.closedAt)}</span>
                {t.source === "webhook" && (
                  <Zap className="ml-1 inline size-3 text-brand-soft" aria-label="Vía webhook" />
                )}
              </td>
              <td className="whitespace-nowrap px-2 py-2 font-semibold md:px-4 md:py-3">
                {symbolOf(t.symbol)}
              </td>
              <td className="px-2 py-2 md:px-4 md:py-3">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase md:text-xs",
                    t.direction === "long" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
                  )}
                >
                  {t.direction}
                </span>
              </td>
              <td className="hidden max-w-[160px] truncate px-4 py-3 text-muted-foreground md:table-cell">
                {nameOf(t.accountId)}
              </td>
              <td className="num whitespace-nowrap px-2 py-2 text-right md:px-4 md:py-3">
                {t.entryPrice > 0 ? t.entryPrice : "—"}
              </td>
              <td className="num whitespace-nowrap px-2 py-2 text-right md:px-4 md:py-3">
                {t.exitPrice > 0 ? t.exitPrice : "—"}
              </td>
              <td className="num whitespace-nowrap px-2 py-2 text-right md:px-4 md:py-3">
                {t.size > 0 ? t.size : "—"}
              </td>
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
              <td
                className={cn(
                  "num whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums md:px-4 md:py-3",
                  t.pnl >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {formatCurrency(t.pnl, true)}
              </td>
              {onDelete && (
                <td className="px-2 py-2 text-right md:px-3 md:py-3">
                  <button
                    onClick={() => onDelete(t)}
                    className="text-muted-foreground transition-colors hover:text-loss"
                    aria-label="Eliminar operación"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
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
  );
}
