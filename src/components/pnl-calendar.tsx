import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { pnlByDay } from "@/lib/emotion-metrics";
import { todayKey } from "@/lib/emotions";
import { formatCurrency } from "@/lib/metrics";
import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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
      {/* Header del Calendario */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="size-4 text-brand" />
            <h2 className="text-xl font-display uppercase tracking-wide capitalize leading-none">
              {cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
            </h2>
          </div>
          {selectedDate && (
            <div className="flex items-center gap-1.5 rounded-full bg-brand/15 border border-brand/40 px-2.5 py-0.5 text-xs text-brand font-semibold animate-pulse">
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
              "num text-sm font-bold px-2 py-0.5 rounded-md border",
              summary.net > 0
                ? "text-profit bg-profit/10 border-profit/30"
                : summary.net < 0
                  ? "text-loss bg-loss/10 border-loss/30"
                  : "text-muted-foreground bg-muted/40 border-border",
            )}
          >
            {summary.net > 0 ? "+" : ""}
            {formatCurrency(summary.net, true)}
          </span>
          <div className="flex items-center rounded-md border border-border bg-card">
            <button
              type="button"
              aria-label="Mes anterior"
              className="p-1 hover:bg-accent rounded-l text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Mes siguiente"
              className="p-1 hover:bg-accent rounded-r text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Días de la semana */}
      <div
        className="grid gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
        style={{ gridTemplateColumns: "1.35fr 1.35fr 1.35fr 1.35fr 1.35fr 0.65fr 0.65fr" }}
      >
        {WEEKDAYS.map((d, idx) => (
          <span
            key={d}
            className={cn(
              idx >= 5 ? "text-[9px] text-muted-foreground/40 font-normal" : "text-foreground/75",
            )}
          >
            {d}
          </span>
        ))}
      </div>

      {/* Cuadrícula de Días */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: "1.35fr 1.35fr 1.35fr 1.35fr 1.35fr 0.65fr 0.65fr" }}
      >
        {cells.map((day, i) => {
          const isWeekend = i % 7 >= 5;
          if (day === null) {
            return (
              <span
                key={`e${i}`}
                className={cn(
                  "rounded min-h-13",
                  isWeekend && "bg-muted/10 border border-dashed border-border/20 opacity-20",
                )}
              />
            );
          }
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
                  ? `${formatCurrency(pnl, true)} · ${entry.trades} operación(es) (Clic para filtrar este día)`
                  : isWeekend
                    ? `Fin de semana (${day}) · Sin operaciones`
                    : "Sin operaciones (Clic para filtrar este día)"
              }
              className={cn(
                "flex min-h-13 flex-col items-center justify-center rounded border p-1 text-[10px] transition-all relative text-left w-full",
                onSelectDate ? "cursor-pointer hover:border-foreground/50 hover:shadow-xs" : "",
                isWeekend &&
                  !entry &&
                  !isSelected &&
                  "bg-muted/15 border-dashed border-border/35 opacity-40 hover:opacity-85",
                isSelected
                  ? "border-brand ring-2 ring-brand bg-brand/15 shadow-sm scale-[1.02] z-10 font-bold opacity-100"
                  : isToday
                    ? "border-brand/70"
                    : "border-border/80",
                entry && pnl > 0 && !isSelected && "bg-profit/10 hover:bg-profit/15 opacity-100",
                entry && pnl < 0 && !isSelected && "bg-loss/10 hover:bg-loss/15 opacity-100",
              )}
            >
              <div className="flex w-full items-center justify-between px-0.5">
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    isWeekend ? "text-muted-foreground/60" : "text-muted-foreground",
                    isSelected && "font-bold text-foreground",
                  )}
                >
                  {day}
                </span>
                {isSelected && <span className="size-1.5 rounded-full bg-brand" />}
              </div>
              {entry ? (
                <>
                  <span
                    className={cn(
                      "num font-black leading-none mt-0.5",
                      isWeekend ? "text-xs" : "text-sm",
                      pnl > 0 ? "text-profit" : pnl < 0 ? "text-loss" : "text-muted-foreground",
                    )}
                  >
                    {pnl > 0 ? "+" : ""}
                    {Math.round(pnl)}
                  </span>
                  <span className="text-muted-foreground text-[8px] md:text-[9px] mt-0.5 font-medium">
                    {entry.trades} op.
                  </span>
                </>
              ) : (
                <span
                  className={cn(
                    "text-muted-foreground",
                    isWeekend ? "text-[8px] opacity-30" : "mt-0.5",
                  )}
                >
                  {isWeekend ? "—" : "·"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Resumen del mes inferior */}
      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs sm:grid-cols-5">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Neto Mes
          </p>
          <p
            className={cn(
              "num text-sm font-bold",
              summary.net > 0 ? "text-profit" : summary.net < 0 ? "text-loss" : "",
            )}
          >
            {formatCurrency(summary.net, true)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Operaciones
          </p>
          <p className="num text-sm font-bold">{summary.ops}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Días +/−
          </p>
          <p className="num text-sm font-bold">
            <span className="text-profit">{summary.winDays}</span>
            {" / "}
            <span className="text-loss">{summary.lossDays}</span>
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Mejor día
          </p>
          <p className="num text-sm font-bold text-profit">{formatCurrency(summary.best, true)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Peor día
          </p>
          <p className="num text-sm font-bold text-loss">{formatCurrency(summary.worst, true)}</p>
        </div>
      </div>
    </section>
  );
}
