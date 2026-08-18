import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { pnlByDay } from "@/lib/emotion-metrics";
import { todayKey } from "@/lib/emotions";
import { formatCurrency } from "@/lib/metrics";
import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

export function PnlCalendar({
  trades,
  selectedDate,
  onSelectDate,
}: {
  trades: Trade[];
  selectedDate?: string | null;
  onSelectDate?: (dateKey: string | null) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    if (selectedDate) {
      const parts = selectedDate.split("-").map(Number);
      if (parts.length === 3 && parts[0] && parts[1]) {
        return new Date(parts[0], parts[1] - 1, 1);
      }
    }
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDay = useMemo(() => pnlByDay(trades), [trades]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // lunes primero
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const summary = useMemo(() => {
    let net = 0;
    let ops = 0;
    let winDays = 0;
    let lossDays = 0;
    let best = 0;
    let worst = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const entry = byDay.get(todayKey(new Date(year, month, d)));
      if (!entry) continue;
      net += entry.pnl;
      ops += entry.trades;
      if (entry.pnl > 0) winDays++;
      else if (entry.pnl < 0) lossDays++;
      if (entry.pnl > best) best = entry.pnl;
      if (entry.pnl < worst) worst = entry.pnl;
    }
    return { net, ops, winDays, lossDays, best, worst };
  }, [byDay, year, month, daysInMonth]);

  return (
    <section className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl leading-none capitalize">
            {cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
          </h2>
          {selectedDate && (
            <div className="flex items-center gap-1.5 rounded-full bg-brand/15 border border-brand/40 px-2.5 py-0.5 text-xs text-brand font-semibold">
              <span>Día: {selectedDate.split("-").reverse().join("/")}</span>
              <button
                type="button"
                onClick={() => onSelectDate?.(null)}
                className="ml-0.5 hover:text-foreground inline-flex items-center"
                title="Quitar filtro de día y ver todo el periodo"
                aria-label="Quitar filtro de día"
              >
                <X className="size-3" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "num text-sm font-semibold",
              summary.net > 0
                ? "text-profit"
                : summary.net < 0
                  ? "text-loss"
                  : "text-muted-foreground",
            )}
          >
            {formatCurrency(summary.net, true)}
          </span>
          <button
            type="button"
            aria-label="Mes anterior"
            className="rounded border border-border p-1"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            className="rounded border border-border p-1"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const key = todayKey(new Date(year, month, day));
          const entry = byDay.get(key);
          const pnl = entry?.pnl ?? 0;
          const isSelected = selectedDate === key;
          const isToday = key === todayKey();

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (onSelectDate) {
                  onSelectDate(isSelected ? null : key);
                }
              }}
              title={
                entry
                  ? `${formatCurrency(pnl, true)} · ${entry.trades} operación(es) (Click para filtrar este día)`
                  : "Sin operaciones (Click para filtrar este día)"
              }
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-md border p-1 text-[10px] transition-all relative text-left w-full",
                onSelectDate ? "cursor-pointer hover:border-foreground/40 hover:shadow-xs" : "",
                isSelected
                  ? "border-brand ring-2 ring-brand bg-brand/15 shadow-sm scale-[1.03] z-10 font-bold"
                  : isToday
                    ? "border-brand/70"
                    : "border-border",
                entry && pnl > 0 && !isSelected && "bg-profit/10",
                entry && pnl < 0 && !isSelected && "bg-loss/10",
              )}
            >
              <div className="flex w-full items-center justify-between px-0.5">
                <span className={cn("text-muted-foreground", isSelected && "font-bold text-foreground")}>
                  {day}
                </span>
                {isSelected && (
                  <span className="size-1.5 rounded-full bg-brand" />
                )}
              </div>
              {entry ? (
                <>
                  <span
                    className={cn(
                      "num text-sm font-semibold leading-none mt-0.5",
                      pnl > 0 ? "text-profit" : pnl < 0 ? "text-loss" : "text-muted-foreground",
                    )}
                  >
                    {pnl > 0 ? "+" : ""}
                    {Math.round(pnl)}
                  </span>
                  <span className="text-muted-foreground text-[9px] mt-0.5">{entry.trades} op.</span>
                </>
              ) : (
                <span className="text-muted-foreground mt-1">·</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs sm:grid-cols-5">
        <div>
          <p className="text-muted-foreground">Neto</p>
          <p
            className={cn(
              "num font-semibold",
              summary.net > 0 ? "text-profit" : summary.net < 0 ? "text-loss" : "",
            )}
          >
            {formatCurrency(summary.net, true)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Operaciones</p>
          <p className="num font-semibold">{summary.ops}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Días +/−</p>
          <p className="num font-semibold">
            <span className="text-profit">{summary.winDays}</span>
            {" / "}
            <span className="text-loss">{summary.lossDays}</span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Mejor día</p>
          <p className="num font-semibold text-profit">{formatCurrency(summary.best, true)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Peor día</p>
          <p className="num font-semibold text-loss">{formatCurrency(summary.worst, true)}</p>
        </div>
      </div>
    </section>
  );
}
