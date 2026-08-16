import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useJournal } from "@/lib/journal-store";
import { effectiveStrategyId, formatCurrency } from "@/lib/metrics";
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
export function AccountStrategyCalendar({ accountId }: { accountId: string }) {
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
        .filter((p) => p.accountId === accountId)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [strategyPeriods, accountId],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; strategyIds: Set<string> }>();
    for (const t of trades) {
      if (t.accountId !== accountId) continue;
      const day = t.closedAt.slice(0, 10);
      const entry = map.get(day) ?? { pnl: 0, count: 0, strategyIds: new Set<string>() };
      entry.pnl += t.pnl;
      entry.count += 1;
      const sid = effectiveStrategyId(t, accounts, strategyPeriods);
      if (sid) entry.strategyIds.add(sid);
      map.set(day, entry);
    }
    return map;
  }, [trades, accountId, accounts, strategyPeriods]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // lunes primero
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

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
    setSaving(true);
    try {
      await addStrategyPeriod({
        accountId,
        strategyId,
        startDate: from,
        endDate: to || from,
      });
      toast.success("Tramo asignado");
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

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
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
                selected
                  ? "border-brand bg-brand/15"
                  : entry
                    ? entry.pnl >= 0
                      ? "border-profit/30 bg-profit/10"
                      : "border-loss/30 bg-loss/10"
                    : "border-border/60 hover:border-foreground/30",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground">{day}</span>
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
                      "num text-[11px] font-semibold tabular-nums",
                      entry.pnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {formatCurrency(entry.pnl, true)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{entry.count} op.</p>
                </>
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
