import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useJournal } from "@/lib/journal-store";
import { effectiveStrategyId, formatCurrency } from "@/lib/metrics";
import { tradeDayKey } from "@/lib/emotions";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function key(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface AccountStrategyCalendarProps {
  accountIds?: string[];
  selectedStrategyId?: string | null;
  onClearSelection?: () => void;
}

/**
 * Calendario de operaciones de cuentas y estrategias.
 * Permite visualizar el PnL diario y asignar estrategias a tramos de fechas.
 */
export function AccountStrategyCalendar({
  accountIds = [],
  selectedStrategyId = null,
  onClearSelection,
}: AccountStrategyCalendarProps) {
  const { trades, accounts, strategies, strategyPeriods, addStrategyPeriod, removeStrategyPeriod } =
    useJournal();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [strategyId, setStrategyId] = useState(selectedStrategyId ?? "");
  const [targetAccountId, setTargetAccountId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Si accountIds está vacío, usamos todas las cuentas
  const effectiveAccountIds = useMemo(
    () => (accountIds.length > 0 ? accountIds : accounts.map((a) => a.id)),
    [accountIds, accounts],
  );

  const periods = useMemo(
    () =>
      strategyPeriods
        .filter((p) => effectiveAccountIds.includes(p.accountId))
        .filter((p) => !selectedStrategyId || p.strategyId === selectedStrategyId)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [strategyPeriods, effectiveAccountIds, selectedStrategyId],
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

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "";
  const strategyName = (id: string) => strategies.find((s) => s.id === id)?.name ?? "Sin estrategia";
  const strategyColor = (id: string) => strategies.find((s) => s.id === id)?.color ?? "var(--color-brand)";

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
    const assignAccounts = targetAccountId
      ? [targetAccountId]
      : effectiveAccountIds.length > 0
        ? effectiveAccountIds
        : accounts.map((a) => a.id);

    if (assignAccounts.length === 0) {
      toast.error("Selecciona al menos una cuenta para asignar el tramo");
      return;
    }
    setSaving(true);
    try {
      const startDate = from;
      const endDate = to || from;
      let countUpdated = 0;

      for (const accId of assignAccounts) {
        await addStrategyPeriod({
          accountId: accId,
          strategyId,
          startDate,
          endDate,
        });

        const affected = trades.filter((t) => {
          if (t.accountId !== accId) return false;
          const day = tradeDayKey(t);
          return day && day >= startDate && day <= endDate;
        }).length;
        countUpdated += affected;
      }

      if (countUpdated > 0) {
        toast.success(
          `Tramo asignado: ${countUpdated} ${countUpdated === 1 ? "operación actualizada" : "operaciones actualizadas"} con la nueva estrategia`,
        );
      } else {
        toast.success("Tramo de estrategia asignado correctamente");
      }
      setFrom("");
      setTo("");
    } catch {
      toast.error("No se pudo guardar el tramo");
    } finally {
      setSaving(false);
    }
  };

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
              className="p-1.5 hover:bg-accent rounded-l text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Mes siguiente"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="p-1.5 hover:bg-accent rounded-r text-muted-foreground hover:text-foreground transition-colors"
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
          const period = periodFor(iso);
          const selected = inSelection(iso);
          const color = period ? strategyColor(period.strategyId) : undefined;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => pickDay(iso)}
              className={cn(
                "min-h-13 flex flex-col justify-between rounded border p-1 text-left transition-all relative cursor-pointer",
                isWeekend && !entry && !selected && "bg-muted/15 border-dashed border-border/35 opacity-40 hover:opacity-85",
                selected
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
                    selected && "font-bold text-foreground",
                  )}
                >
                  {day}
                </span>
                <div className="flex items-center gap-0.5">
                  {color && (
                    <span
                      className="size-2 rounded-full ring-1 ring-background"
                      style={{ backgroundColor: color }}
                      title={`Estrategia: ${strategyName(period!.strategyId)}`}
                    />
                  )}
                  {entry?.strategyIds &&
                    Array.from(entry.strategyIds).map((sid) => {
                      if (period?.strategyId === sid) return null;
                      return (
                        <span
                          key={sid}
                          className="size-1.5 rounded-full ring-1 ring-background"
                          style={{ backgroundColor: strategyColor(sid) }}
                          title={`Estrategia: ${strategyName(sid)}`}
                        />
                      );
                    })}
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

      {/* Formulario de asignación de tramos de estrategia */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Asignar estrategia a fechas
          </p>
          {(from || to) && (
            <button
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium"
            >
              <X className="size-3" /> Limpiar selección
            </button>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 items-end">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-muted-foreground">Desde</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8.5 rounded-md border border-border bg-card px-2.5 text-xs focus:ring-1 focus:ring-brand"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-muted-foreground">Hasta</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8.5 rounded-md border border-border bg-card px-2.5 text-xs focus:ring-1 focus:ring-brand"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-muted-foreground">Estrategia</span>
            <select
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
              className="h-8.5 rounded-md border border-border bg-card px-2.5 text-xs focus:ring-1 focus:ring-brand"
            >
              <option value="">Seleccionar estrategia…</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.mainSymbol})
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-1.5">
            {accounts.length > 1 && (
              <select
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                className="h-8.5 rounded-md border border-border bg-card px-2 text-xs flex-1 min-w-0"
              >
                <option value="">Todas las cuentas</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={assign}
              disabled={saving || !from || !strategyId}
              className="h-8.5 rounded-md bg-brand px-3.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all shrink-0 cursor-pointer shadow-xs"
            >
              {saving ? "Guardando…" : "Asignar"}
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Tramos Asignados */}
      {periods.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Tramos asignados ({periods.length})
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {periods.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-card p-2.5 text-xs shadow-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: strategyColor(p.strategyId) }}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-foreground">
                      {strategyName(p.strategyId)}
                    </p>
                    <p className="num text-[11px] text-muted-foreground">
                      {formatDay(p.startDate)} → {p.endDate ? formatDay(p.endDate) : "actual"}
                      {accounts.length > 1 && (
                        <span className="font-normal"> · {accountName(p.accountId)}</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Eliminar tramo"
                  onClick={() => removeStrategyPeriod(p.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-loss/10 hover:text-loss transition-colors shrink-0"
                  title="Eliminar este tramo"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
