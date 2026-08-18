import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useJournal } from "@/lib/journal-store";
import { effectiveStrategyId, formatCurrency } from "@/lib/metrics";
import { tradeDayKey } from "@/lib/emotions";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

function key(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Calendario de operaciones de una cuenta que permite asignar una estrategia
 * a un tramo de fechas (por ejemplo: del 1 al 15 fue la estrategia A).
 */
export function AccountStrategyCalendar({ accountIds }: { accountIds: string[] }) {
  const { trades, accounts, strategies, strategyPeriods, addStrategyPeriod, removeStrategyPeriod } =
    useJournal();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [strategyId, setStrategyId] = useState("");
  const [saving, setSaving] = useState(false);

  const periods = useMemo(
    () =>
      strategyPeriods
        .filter((p) => accountIds.includes(p.accountId))
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [strategyPeriods, accountIds],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; strategyIds: Set<string> }>();
    for (const t of trades) {
      if (!accountIds.includes(t.accountId)) continue;
      const day = tradeDayKey(t);
      if (!day) continue;
      const entry = map.get(day) ?? { pnl: 0, count: 0, strategyIds: new Set<string>() };
      entry.pnl += t.pnl;
      entry.count += 1;
      const sid = effectiveStrategyId(t, accounts, strategyPeriods);
      if (sid) entry.strategyIds.add(sid);
      map.set(day, entry);
    }
    return map;
  }, [trades, accountIds, accounts, strategyPeriods]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // lunes primero
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "";
  const strategyName = (id: string) => strategies.find((s) => s.id === id)?.name ?? "Sin estrategia";
  const strategyColor = (id: string) => strategies.find((s) => s.id === id)?.color;

  const pickDay = (iso: string) => {
    if (!from || (from && to)) {
      setFrom(iso);
      setTo("");
      return;
    }
    if (iso < from) {
      setTo(from);
      setFrom(iso);
    } else {
      setTo(iso);
    }
  };

  const inSelection = (iso: string) =>
    !!from && (to ? iso >= from && iso <= to : iso === from);

  const periodFor = (iso: string) =>
    periods.find((p) => iso >= p.startDate && (!p.endDate || iso <= p.endDate));

  const assign = async () => {
    if (!from || !strategyId) {
      toast.error("Elige un tramo de fechas y una estrategia");
      return;
    }
    if (accountIds.length === 0) {
      toast.error("Elige al menos una cuenta");
      return;
    }
    setSaving(true);
    try {
      const startDate = from;
      const endDate = to || from;
      let countUpdated = 0;

      for (const accountId of accountIds) {
        await addStrategyPeriod({
          accountId,
          strategyId,
          startDate,
          endDate,
        });

        const affected = trades.filter((t) => {
          if (t.accountId !== accountId) return false;
          const day = tradeDayKey(t);
          return day && day >= startDate && day <= endDate;
        }).length;
        countUpdated += affected;
      }

      if (countUpdated > 0) {
        toast.success(
          `Tramo asignado y ${countUpdated} ${countUpdated === 1 ? "operación actualizada" : "operaciones actualizadas"} con la nueva estrategia`,
        );
      } else {
        toast.success("Tramo asignado correctamente");
      }
      setFrom("");
      setTo("");
    } catch {
      toast.error("No se pudo guardar el tramo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl leading-none capitalize">
            {cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
          </h2>
          <p className="text-xs text-muted-foreground">
            Pulsa un día (o dos, para un rango) y asígnale una estrategia
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Mes anterior"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="rounded-md border border-border p-1 hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            aria-label="Mes siguiente"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="rounded-md border border-border p-1 hover:bg-muted"
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
          const iso = key(year, month, day);
          const entry = byDay.get(iso);
          const period = periodFor(iso);
          const selected = inSelection(iso);
          const color = period ? strategyColor(period.strategyId) : undefined;
          return (
            <button
              key={iso}
              onClick={() => pickDay(iso)}
              className={cn(
                "min-h-14 rounded-md border p-1 text-left transition-colors",
                isWeekend && !entry && !selected && "bg-muted/20 border-dashed border-border/40 opacity-50",
                selected
                  ? "border-brand bg-brand/15 opacity-100"
                  : entry
                    ? entry.pnl >= 0
                      ? "border-profit/30 bg-profit/10 opacity-100"
                      : "border-loss/30 bg-loss/10 opacity-100"
                    : "border-border/60 hover:border-foreground/30",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    isWeekend ? "text-[9px] text-muted-foreground/60" : "text-muted-foreground",
                  )}
                >
                  {day}
                </span>
                {color ? (
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: color }}
                    title={strategyName(period!.strategyId)}
                  />
                ) : null}
              </div>
              {entry ? (
                <>
                  <p
                    className={cn(
                      "num font-semibold tabular-nums leading-none mt-0.5",
                      isWeekend ? "text-[9px]" : "text-[11px]",
                      entry.pnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {formatCurrency(entry.pnl, true)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">{entry.count} op.</p>
                </>
              ) : isWeekend ? (
                <span className="text-[9px] text-muted-foreground opacity-35">—</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-muted-foreground">Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-muted-foreground">Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs"
          />
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
          <span className="font-semibold text-muted-foreground">Estrategia</span>
          <select
            value={strategyId}
            onChange={(e) => setStrategyId(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs"
          >
            <option value="">Elegir…</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={assign}
          disabled={saving}
          className="h-8 rounded-md bg-brand px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          Asignar tramo
        </button>
        {(from || to) && (
          <button
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            className="h-8 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tramos asignados
        </p>
        {periods.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin tramos: las operaciones usan la estrategia de la cuenta.
          </p>
        ) : (
          periods.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: strategyColor(p.strategyId) }}
                />
                <span className="truncate font-semibold">{strategyName(p.strategyId)}</span>
                {accountIds.length > 1 ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{accountName(p.accountId)}</span>
                ) : null}
                <span className="num shrink-0 text-xs text-muted-foreground">
                  {formatDay(p.startDate)} → {p.endDate ? formatDay(p.endDate) : "hoy"}
                </span>
              </span>
              <button
                aria-label="Eliminar tramo"
                onClick={() => removeStrategyPeriod(p.id)}
                className="text-muted-foreground hover:text-loss"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
