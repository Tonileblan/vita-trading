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

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const key = todayKey(new Date(year, month, day));
          const c = moodByDay.get(key);
          const pnl = byDay.get(key)?.pnl;
          return (
            <div
              key={key}
              title={
                c
                  ? `Ánimo ${c.mood}/5 · Energía ${c.energy}/5 · Estrés ${c.stress}/5`
                  : "Sin check-in"
              }
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-md border p-1 text-[10px]",
                key === todayKey() ? "border-brand" : "border-border",
              )}
            >
              <span className="text-muted-foreground">{day}</span>
              <span className="text-sm leading-none">{c ? MOOD_FACES[c.mood - 1] : "·"}</span>
              {pnl != null && (
                <span
                  className={cn(
                    "num font-semibold",
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
