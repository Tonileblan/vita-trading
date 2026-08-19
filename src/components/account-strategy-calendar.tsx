import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useJournal } from "@/lib/journal-store";
import { effectiveStrategyId, formatCurrency } from "@/lib/metrics";
import { tradeDayKey } from "@/lib/emotions";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function key(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface AccountStrategyCalendarProps {
  accountIds?: string[];
  selectedStrategyId?: string | null;
  onClearSelection?: () => void;
}

/**
 * Calendario de rendimiento diario por cuentas y estrategias.
 */
export function AccountStrategyCalendar({
  accountIds = [],
  selectedStrategyId = null,
  onClearSelection,
}: AccountStrategyCalendarProps) {
  const { trades, accounts, strategies, strategyPeriods } = useJournal();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Si accountIds está vacío, usamos todas las cuentas
  const effectiveAccountIds = useMemo(
    () => (accountIds.length > 0 ? accountIds : accounts.map((a) => a.id)),
    [accountIds, accounts],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; strategyIds: Set<string> }>();
    for (const t of trades) {
      if (effectiveAccountIds.length > 0 && !effectiveAccountIds.includes(t.accountId)) continue;
      const sid = effectiveStrategyId(t, accounts, strategyPeriods);
      if (selectedStrategyId && sid !== selectedStrategyId) continue;
      const day = tradeDayKey(t);
      if (!day) continue;
      const entry = map.get(day) ?? { pnl: 0, count: 0, strategyIds: new Set<string>() };
      entry.pnl += t.pnl;
      entry.count += 1;
      if (sid) entry.strategyIds.add(sid);
      map.set(day, entry);
    }
    return map;
  }, [trades, effectiveAccountIds, accounts, strategyPeriods, selectedStrategyId]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // lunes primero
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Resumen del mes actual
  const monthSummary = useMemo(() => {
    let net = 0;
    let ops = 0;
    let winDays = 0;
    let lossDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = key(year, month, d);
      const entry = byDay.get(iso);
      if (!entry) continue;
      net += entry.pnl;
      ops += entry.count;
      if (entry.pnl > 0) winDays++;
      else if (entry.pnl < 0) lossDays++;
    }
    return { net, ops, winDays, lossDays };
  }, [byDay, year, month, daysInMonth]);

  const strategyName = (id: string) => strategies.find((s) => s.id === id)?.name ?? "Sin estrategia";
  const strategyColor = (id: string) => strategies.find((s) => s.id === id)?.color ?? "var(--color-brand)";

  const selectedStrat = strategies.find((s) => s.id === selectedStrategyId);

  return (
    <div className="space-y-4">
      {/* Header del Calendario */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="size-4 text-brand" />
            <h3 className="text-xl font-display uppercase tracking-wide capitalize leading-none">
              {cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
            </h3>
          </div>

          {selectedStrat && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border"
              style={{
                borderColor: `${selectedStrat.color}60`,
                backgroundColor: `${selectedStrat.color}15`,
                color: selectedStrat.color,
              }}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: selectedStrat.color }}
              />
              Estrategia: {selectedStrat.name}
            </span>
          )}

          {accountIds.length > 0 && accountIds.length < accounts.length && (
            <span className="rounded-full bg-muted border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {accountIds.length === 1
                ? accounts.find((a) => a.id === accountIds[0])?.name
                : `${accountIds.length} cuentas`}
            </span>
          )}

          {(selectedStrategyId || (accountIds.length > 0 && accountIds.length < accounts.length)) && (
            <button
              type="button"
              onClick={onClearSelection}
              className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline cursor-pointer ml-1"
              title="Quitar filtros y ver todas las estrategias y cuentas"
            >
              <RotateCcw className="size-3" /> Ver todas
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "num text-xs font-bold px-2.5 py-1 rounded-md border tabular-nums",
              monthSummary.net > 0
                ? "text-profit bg-profit/10 border-profit/30"
                : monthSummary.net < 0
                  ? "text-loss bg-loss/10 border-loss/30"
                  : "text-muted-foreground bg-muted/40 border-border",
            )}
          >
            {monthSummary.net > 0 ? "+" : ""}
            {formatCurrency(monthSummary.net, true)} · {monthSummary.ops} op.
          </span>
          <div className="flex items-center rounded-md border border-border bg-card">
            <button
              type="button"
              aria-label="Mes anterior"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="p-1.5 hover:bg-accent rounded-l text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Mes siguiente"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="p-1.5 hover:bg-accent rounded-r text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
          const iso = key(year, month, day);
          const entry = byDay.get(iso);
          const isDaySelected = selectedDay === iso;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedDay(isDaySelected ? null : iso)}
              className={cn(
                "min-h-13 flex flex-col justify-between rounded border p-1 text-left transition-all relative cursor-pointer",
                isWeekend && !entry && !isDaySelected && "bg-muted/15 border-dashed border-border/35 opacity-40 hover:opacity-85",
                isDaySelected
                  ? "border-brand ring-2 ring-brand bg-brand/15 shadow-sm font-bold scale-[1.02] z-10 opacity-100"
                  : entry
                    ? entry.pnl >= 0
                      ? "border-profit/30 bg-profit/10 hover:bg-profit/15 opacity-100"
                      : "border-loss/30 bg-loss/10 hover:bg-loss/15 opacity-100"
                    : "border-border/70 hover:border-foreground/40",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    isWeekend ? "text-muted-foreground/60" : "text-muted-foreground",
                    isDaySelected && "font-bold text-foreground",
                  )}
                >
                  {day}
                </span>
                <div className="flex items-center gap-0.5">
                  {entry?.strategyIds &&
                    Array.from(entry.strategyIds).map((sid) => (
                      <span
                        key={sid}
                        className="size-1.5 rounded-full ring-1 ring-background"
                        style={{ backgroundColor: strategyColor(sid) }}
                        title={`Estrategia: ${strategyName(sid)}`}
                      />
                    ))}
                </div>
              </div>

              {entry ? (
                <div className="mt-0.5">
                  <p
                    className={cn(
                      "num font-black leading-none",
                      isWeekend ? "text-[9px]" : "text-[11px]",
                      entry.pnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {entry.pnl > 0 ? "+" : ""}
                    {Math.round(entry.pnl)}
                  </p>
                  <p className="text-[8px] md:text-[9px] text-muted-foreground font-medium mt-0.5">
                    {entry.count} op.
                  </p>
                </div>
              ) : isWeekend ? (
                <span className="text-[8px] text-muted-foreground opacity-30">—</span>
              ) : (
                <span className="text-muted-foreground opacity-20 text-[10px]">·</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
