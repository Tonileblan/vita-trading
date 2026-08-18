import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pnlByDay } from "@/lib/emotion-metrics";
import { MOOD_FACES, todayKey } from "@/lib/emotions";
import { formatCurrency } from "@/lib/metrics";
import type { MoodCheckin } from "@/lib/mood";
import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

export function MoodCalendar({
  checkins,
  trades,
}: {
  checkins: MoodCheckin[];
  trades: Trade[];
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDay = useMemo(() => pnlByDay(trades), [trades]);
  const moodByDay = useMemo(
    () => new Map(checkins.map((c) => [c.date, c])),
    [checkins],
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // lunes primero
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthPnl = Array.from({ length: daysInMonth }, (_, i) =>
    byDay.get(todayKey(new Date(year, month, i + 1)))?.pnl ?? 0,
  ).reduce((s, v) => s + v, 0);

  return (
    <section className="panel space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl leading-none">
          {cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "num text-sm font-semibold",
              monthPnl > 0 ? "text-profit" : monthPnl < 0 ? "text-loss" : "text-muted-foreground",
            )}
          >
            {formatCurrency(monthPnl, true)}
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

      <div
        className="grid gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground"
        style={{ gridTemplateColumns: "1.35fr 1.35fr 1.35fr 1.35fr 1.35fr 0.65fr 0.65fr" }}
      >
        {WEEKDAYS.map((d, idx) => (
          <span
            key={d}
            className={cn(
              idx >= 5
                ? "text-[9px] text-muted-foreground/45 tracking-tight font-normal"
                : "font-bold text-foreground/80",
            )}
          >
            {d}
          </span>
        ))}
      </div>
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
                  "rounded-md min-h-14",
                  isWeekend && "bg-muted/10 border border-dashed border-border/20 opacity-30",
                )}
              />
            );
          }
          const key = todayKey(new Date(year, month, day));
          const c = moodByDay.get(key);
          const pnl = byDay.get(key)?.pnl;
          return (
            <div
              key={key}
              title={
                c
                  ? `Ánimo ${c.mood}/5 · Energía ${c.energy}/5 · Estrés ${c.stress}/5`
                  : isWeekend
                    ? `Fin de semana (${day}) · Sin check-in`
                    : "Sin check-in"
              }
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-md border p-1 text-[10px] transition-all",
                isWeekend && !c && "bg-muted/20 border-dashed border-border/40 opacity-50",
                key === todayKey() ? "border-brand" : "border-border",
              )}
            >
              <span
                className={cn(
                  isWeekend ? "text-[9px] text-muted-foreground/60" : "text-muted-foreground",
                  key === todayKey() && "font-bold text-foreground",
                )}
              >
                {day}
              </span>
              <span className={cn("leading-none mt-0.5", isWeekend ? "text-xs" : "text-sm")}>
                {c ? MOOD_FACES[c.mood - 1] : isWeekend ? "—" : "·"}
              </span>
              {pnl != null && (
                <span
                  className={cn(
                    "num font-semibold text-[9px] mt-0.5",
                    pnl > 0 ? "text-profit" : pnl < 0 ? "text-loss" : "text-muted-foreground",
                  )}
                >
                  {pnl > 0 ? "+" : ""}
                  {Math.round(pnl)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
