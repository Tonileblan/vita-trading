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
  const selectable = !!onToggleSelect;
  const isSelected = (id: string) => (selectedIds ?? []).includes(id);
  const colCount = 9 + (selectable ? 1 : 0) + (onDelete ? 1 : 0);

  return (
    <>
      {/* Móvil: lista de tarjetas */}
      <div className="space-y-2 md:hidden">
        {rows.map((t) => (
          <div key={t.id} className="panel space-y-2 p-3">
            <div className="flex items-start justify-between gap-3">
              {selectable && (
                <Checkbox
                  className="mt-1"
                  checked={isSelected(t.id)}
                  onCheckedChange={() => onToggleSelect?.(t.id)}
                  aria-label="Seleccionar operación"
                />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{t.symbol}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                      t.direction === "long" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
                    )}
                  >
                    {t.direction}
                  </span>
                  {t.source === "webhook" && <Zap className="size-3 text-brand-soft" />}
                </div>
                <p className="num mt-0.5 truncate text-xs text-muted-foreground">
                  {formatDateTime(t.closedAt)} · {nameOf(t.accountId)}
                </p>
              </div>
              <span
                className={cn(
                  "num shrink-0 font-semibold",
                  t.pnl >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {formatCurrency(t.pnl, true)}
              </span>
              {onDelete && (
                <button
                  onClick={() => onDelete(t)}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-loss"
                  aria-label="Eliminar operación"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            <div className="num flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Entrada {t.entryPrice}</span>
              <span>Salida {t.exitPrice}</span>
              <span>Tam. {t.size}</span>
            </div>
            {t.tags.length > 0 && (
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
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="panel px-4 py-10 text-center text-muted-foreground">
            No hay operaciones para los filtros seleccionados.
          </div>
        )}
      </div>

      {/* Escritorio: tabla */}
      <div className="panel hidden overflow-x-auto md:block">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            {selectable && <th className="w-10 px-3 py-3" />}
            <th className="px-4 py-3 font-semibold">Cierre</th>
            <th className="px-4 py-3 font-semibold">Activo</th>
            <th className="px-4 py-3 font-semibold">Dir.</th>
            <th className="px-4 py-3 font-semibold">Cuenta</th>
            <th className="px-4 py-3 text-right font-semibold">Entrada</th>
            <th className="px-4 py-3 text-right font-semibold">Salida</th>
            <th className="px-4 py-3 text-right font-semibold">Tam.</th>
            <th className="px-4 py-3 font-semibold">Estrategia</th>
            <th className="px-4 py-3 text-right font-semibold">PnL</th>
            {onDelete && <th className="w-10 px-3 py-3" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
              {selectable && (
                <td className="px-3 py-3">
                  <Checkbox
                    checked={isSelected(t.id)}
                    onCheckedChange={() => onToggleSelect?.(t.id)}
                    aria-label="Seleccionar operación"
                  />
                </td>
              )}
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                <span className="num">{formatDateTime(t.closedAt)}</span>
                {t.source === "webhook" && (
                  <Zap className="ml-1 inline size-3 text-brand-soft" aria-label="Vía webhook" />
                )}
              </td>
              <td className="px-4 py-3 font-semibold">{t.symbol}</td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-semibold uppercase",
                    t.direction === "long"
                      ? "bg-profit/15 text-profit"
                      : "bg-loss/15 text-loss",
                  )}
                >
                  {t.direction}
                </span>
              </td>
              <td className="max-w-[160px] truncate px-4 py-3 text-muted-foreground">
                {nameOf(t.accountId)}
              </td>
              <td className="num px-4 py-3 text-right">{t.entryPrice}</td>
              <td className="num px-4 py-3 text-right">{t.exitPrice}</td>
              <td className="num px-4 py-3 text-right">{t.size}</td>
              <td className="px-4 py-3">
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
                  "num px-4 py-3 text-right font-semibold",
                  t.pnl >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {formatCurrency(t.pnl, true)}
              </td>
              {onDelete && (
                <td className="px-3 py-3 text-right">
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
    </>
  );
}
