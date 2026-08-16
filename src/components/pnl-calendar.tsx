import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pnlByDay } from "@/lib/emotion-metrics";
import { todayKey } from "@/lib/emotions";
import { formatCurrency } from "@/lib/metrics";
import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

export function PnlCalendar({ trades }: { trades: Trade[] }) {
  const [cursor, setCursor] = useState(() => {
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
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl leading-none capitalize">
          {cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
        </h2>
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
          return (
            <div
              key={key}
              title={
                entry
                  ? `${formatCurrency(pnl, true)} · ${entry.trades} operación(es)`
                  : "Sin operaciones"
              }
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-md border p-1 text-[10px]",
                key === todayKey() ? "border-brand" : "border-border",
                entry && pnl > 0 && "bg-profit/10",
                entry && pnl < 0 && "bg-loss/10",
              )}
            >
              <span className="text-muted-foreground">{day}</span>
              {entry ? (
                <>
                  <span
                    className={cn(
                      "num text-sm font-semibold leading-none",
                      pnl > 0 ? "text-profit" : pnl < 0 ? "text-loss" : "text-muted-foreground",
                    )}
                  >
                    {pnl > 0 ? "+" : ""}
                    {Math.round(pnl)}
                  </span>
                  <span className="text-muted-foreground">{entry.trades} op.</span>
                </>
              ) : (
                <span className="text-muted-foreground">·</span>
              )}
            </div>
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
