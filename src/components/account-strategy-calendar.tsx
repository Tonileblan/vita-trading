import { useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useJournal } from "@/lib/journal-store";
import { effectiveStrategyId, formatCurrency } from "@/lib/metrics";
import { tradeDayKey } from "@/lib/emotions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function key(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateDisplay(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface AccountStrategyCalendarProps {
  accountIds?: string[];
  selectedStrategyId?: string | null;
  onClearSelection?: () => void;
}

/**
 * Calendario de rendimiento diario por cuentas y estrategias con selector interactivo
 * de tramos de fechas y asignación de estrategias.
 */
export function AccountStrategyCalendar({
  accountIds = [],
  selectedStrategyId = null,
  onClearSelection,
}: AccountStrategyCalendarProps) {
  const { trades, accounts, strategies, strategyPeriods, addStrategyPeriod } =
    useJournal();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Estado de selección de tramos de fechas
  const [rangeFrom, setRangeFrom] = useState<string | null>(null);
  const [rangeTo, setRangeTo] = useState<string | null>(null);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Formulario de asignación
  const [selectedStrategyToAssign, setSelectedStrategyToAssign] = useState<string>("");
  const [selectedAccountToAssign, setSelectedAccountToAssign] = useState<string>("all");
  const [periodNote, setPeriodNote] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Actualizar estrategia por defecto seleccionada si cambia el filtro global
  useEffect(() => {
    if (selectedStrategyId) {
      setSelectedStrategyToAssign(selectedStrategyId);
    } else if (strategies.length > 0 && !selectedStrategyToAssign) {
      setSelectedStrategyToAssign(strategies[0].id);
    }
  }, [selectedStrategyId, strategies, selectedStrategyToAssign]);

  // Actualizar cuenta por defecto seleccionada si cambia el filtro
  useEffect(() => {
    if (accountIds.length === 1) {
      setSelectedAccountToAssign(accountIds[0]);
    }
  }, [accountIds]);

  // Cuentas efectivas para la vista del calendario
  const effectiveAccountIds = useMemo(
    () => (accountIds.length > 0 ? accountIds : accounts.map((a) => a.id)),
    [accountIds, accounts],
  );

  // Datos agrupados por día para el calendario
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
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // Lunes primero
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Resumen del mes en vista
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

  // Rango normalizado (ordenado cronológicamente y considerando hover interactivo)
  const normalizedRange = useMemo(() => {
    if (!rangeFrom) return null;
    const candidateEnd = isSelectingRange ? hoverDate || rangeFrom : rangeTo || rangeFrom;
    const start = rangeFrom <= candidateEnd ? rangeFrom : candidateEnd;
    const end = rangeFrom <= candidateEnd ? candidateEnd : rangeFrom;
    return { start, end };
  }, [rangeFrom, rangeTo, isSelectingRange, hoverDate]);

  // Métricas del tramo seleccionado
  const rangeStats = useMemo(() => {
    if (!normalizedRange) return null;
    const { start, end } = normalizedRange;
    const dStart = new Date(start);
    const dEnd = new Date(end);
    const diffTime = Math.abs(dEnd.getTime() - dStart.getTime());
    const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const matchingTrades = trades.filter((t) => {
      if (selectedAccountToAssign !== "all" && t.accountId !== selectedAccountToAssign) {
        return false;
      }
      if (
        selectedAccountToAssign === "all" &&
        effectiveAccountIds.length > 0 &&
        !effectiveAccountIds.includes(t.accountId)
      ) {
        return false;
      }
      const day = tradeDayKey(t);
      if (!day) return false;
      return day >= start && day <= end;
    });

    const pnl = matchingTrades.reduce((acc, t) => acc + t.pnl, 0);
    const wins = matchingTrades.filter((t) => t.pnl > 0).length;
    const winRate = matchingTrades.length > 0 ? (wins / matchingTrades.length) * 100 : 0;

    return {
      days,
      tradesCount: matchingTrades.length,
      pnl,
      winRate,
      start,
      end,
    };
  }, [normalizedRange, trades, selectedAccountToAssign, effectiveAccountIds]);

  const strategyName = (id: string) =>
    strategies.find((s) => s.id === id)?.name ?? "Sin estrategia";
  const strategyColor = (id: string) =>
    strategies.find((s) => s.id === id)?.color ?? "var(--color-brand)";

  // Manejo de clics en días del calendario
  const handleDayClick = (iso: string) => {
    if (!rangeFrom || (!isSelectingRange && rangeFrom && rangeTo)) {
      // Primer clic: definir inicio del tramo
      setRangeFrom(iso);
      setRangeTo(iso);
      setIsSelectingRange(true);
      setHoverDate(null);
    } else {
      // Segundo clic: completar tramo
      if (iso < rangeFrom) {
        setRangeTo(rangeFrom);
        setRangeFrom(iso);
      } else {
        setRangeTo(iso);
      }
      setIsSelectingRange(false);
      setHoverDate(null);
    }
  };

  const handleClearRange = () => {
    setRangeFrom(null);
    setRangeTo(null);
    setIsSelectingRange(false);
    setHoverDate(null);
  };

  // Presets rápidos
  const setPresetToday = () => {
    const today = todayIso();
    setRangeFrom(today);
    setRangeTo(today);
    setIsSelectingRange(false);
    setHoverDate(null);
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const setPresetThisWeek = () => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Lun, 6 = Dom
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fromIso = key(monday.getFullYear(), monday.getMonth(), monday.getDate());
    const toIso = key(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());

    setRangeFrom(fromIso);
    setRangeTo(toIso);
    setIsSelectingRange(false);
    setHoverDate(null);
    setCursor(new Date(monday.getFullYear(), monday.getMonth(), 1));
  };

  const setPresetCurrentMonth = () => {
    const fromIso = key(year, month, 1);
    const toIso = key(year, month, daysInMonth);
    setRangeFrom(fromIso);
    setRangeTo(toIso);
    setIsSelectingRange(false);
    setHoverDate(null);
  };

  const setPresetPrevMonth = () => {
    const prevMonthDate = new Date(year, month - 1, 1);
    const pYear = prevMonthDate.getFullYear();
    const pMonth = prevMonthDate.getMonth();
    const pDays = new Date(pYear, pMonth + 1, 0).getDate();

    const fromIso = key(pYear, pMonth, 1);
    const toIso = key(pYear, pMonth, pDays);

    setCursor(prevMonthDate);
    setRangeFrom(fromIso);
    setRangeTo(toIso);
    setIsSelectingRange(false);
    setHoverDate(null);
  };

  // Guardar asignación de estrategia a tramo
  const handleAssignPeriod = async () => {
    if (!rangeFrom || !selectedStrategyToAssign) {
      toast.error("Por favor selecciona un tramo de fechas y una estrategia");
      return;
    }

    const start = normalizedRange?.start ?? rangeFrom;
    const end = normalizedRange?.end ?? rangeTo ?? rangeFrom;

    setIsSaving(true);
    try {
      const targetAccounts =
        selectedAccountToAssign === "all"
          ? accounts
          : accounts.filter((a) => a.id === selectedAccountToAssign);

      if (targetAccounts.length === 0) {
        toast.error("No hay cuentas seleccionadas para asignar");
        return;
      }

      for (const acc of targetAccounts) {
        await addStrategyPeriod({
          accountId: acc.id,
          strategyId: selectedStrategyToAssign,
          startDate: start,
          endDate: end,
          note: periodNote.trim() || undefined,
        });
      }

      const strat = strategies.find((s) => s.id === selectedStrategyToAssign);
      toast.success(
        `Estrategia "${strat?.name ?? "Estrategia"}" asignada al tramo ${formatDateDisplay(start)} → ${formatDateDisplay(end)}`,
      );
      setPeriodNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al asignar la estrategia al tramo");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedStrat = strategies.find((s) => s.id === selectedStrategyId);

  return (
    <div className="space-y-5">
      {/* ========================================================================= */}
      {/* HEADER DEL CALENDARIO                                                    */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="size-4 text-brand" />
            <h3 className="text-xl font-display uppercase tracking-wide capitalize leading-none font-bold">
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
              Filtro: {selectedStrat.name}
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

      {/* ========================================================================= */}
      {/* CUADRÍCULA DEL CALENDARIO CON SELECCIÓN DE TRAMOS INTERACTIVA            */}
      {/* ========================================================================= */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pb-1">
          <span className="flex items-center gap-1.5 font-medium text-[11px]">
            <CalendarRange className="size-3.5 text-brand" />
            Haz clic en un día (o en dos para definir un tramo) para seleccionarlo
          </span>
          {normalizedRange && (
            <span className="text-[11px] font-bold text-brand">
              {isSelectingRange
                ? "Elige la fecha fin en el calendario…"
                : `${formatDateDisplay(normalizedRange.start)} → ${formatDateDisplay(normalizedRange.end)}`}
            </span>
          )}
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

        {/* Celdas de Días */}
        <div
          className="grid gap-1 select-none"
          style={{ gridTemplateColumns: "1.35fr 1.35fr 1.35fr 1.35fr 1.35fr 0.65fr 0.65fr" }}
        >
          {cells.map((day, i) => {
            const isWeekend = i % 7 >= 5;
            if (day === null) {
              return (
                <span
                  key={`e${i}`}
                  className={cn(
                    "rounded min-h-14",
                    isWeekend && "bg-muted/10 border border-dashed border-border/20 opacity-20",
                  )}
                />
              );
            }

            const iso = key(year, month, day);
            const entry = byDay.get(iso);

            // Comprobar si el día cae dentro del tramo seleccionado
            const isInRange =
              Boolean(normalizedRange) &&
              iso >= normalizedRange!.start &&
              iso <= normalizedRange!.end;
            const isRangeStart = Boolean(normalizedRange) && iso === normalizedRange!.start;
            const isRangeEnd = Boolean(normalizedRange) && iso === normalizedRange!.end;

            return (
              <button
                key={iso}
                type="button"
                onClick={() => handleDayClick(iso)}
                onMouseEnter={() => {
                  if (isSelectingRange) setHoverDate(iso);
                }}
                className={cn(
                  "min-h-14 flex flex-col justify-between rounded border p-1 text-left transition-all relative cursor-pointer group",
                  isWeekend &&
                    !entry &&
                    !isInRange &&
                    "bg-muted/15 border-dashed border-border/35 opacity-45 hover:opacity-85",
                  isInRange
                    ? isRangeStart || isRangeEnd
                      ? "border-brand ring-2 ring-brand bg-brand/20 shadow-xs z-10 opacity-100 font-bold"
                      : "border-brand/60 bg-brand/10 z-5 opacity-100"
                    : entry
                      ? entry.pnl >= 0
                        ? "border-profit/30 bg-profit/10 hover:bg-profit/20 hover:border-profit/60 opacity-100"
                        : "border-loss/30 bg-loss/10 hover:bg-loss/20 hover:border-loss/60 opacity-100"
                      : "border-border/70 hover:border-foreground/40 hover:bg-accent/25",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "font-mono text-[10px]",
                        isWeekend ? "text-muted-foreground/60" : "text-muted-foreground",
                        isInRange && "font-bold text-foreground",
                      )}
                    >
                      {day}
                    </span>
                    {isRangeStart && (
                      <span className="rounded bg-brand text-primary-foreground text-[8px] font-black px-1 leading-tight">
                        INICIO
                      </span>
                    )}
                    {isRangeEnd && !isRangeStart && (
                      <span className="rounded bg-brand text-primary-foreground text-[8px] font-black px-1 leading-tight">
                        FIN
                      </span>
                    )}
                  </div>

                  {/* Puntos de estrategias operadas */}
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

      {/* ========================================================================= */}
      {/* PANEL DE ASIGNACIÓN DE ESTRATEGIA AL TRAMO SELECCIONADO                  */}
      {/* ========================================================================= */}
      <div className="rounded-xl border border-brand/40 bg-card p-4 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" />
            <h4 className="text-sm font-bold font-display uppercase tracking-wide text-foreground">
              Asignar Estrategia a Tramo de Fechas
            </h4>
          </div>

          {/* Presets Rápidos */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
              Atajos:
            </span>
            <button
              type="button"
              onClick={setPresetToday}
              className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={setPresetThisWeek}
              className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            >
              Esta semana
            </button>
            <button
              type="button"
              onClick={setPresetCurrentMonth}
              className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            >
              Este mes
            </button>
            <button
              type="button"
              onClick={setPresetPrevMonth}
              className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            >
              Mes anterior
            </button>
            {(rangeFrom || rangeTo) && (
              <button
                type="button"
                onClick={handleClearRange}
                className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/60 px-2 py-0.5 text-[11px] font-bold text-muted-foreground hover:text-foreground transition cursor-pointer ml-1"
                title="Limpiar selección de fechas"
              >
                <X className="size-3" /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Resumen del Tramo Seleccionado */}
        {rangeStats ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/30 bg-brand/[0.06] p-2.5 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-foreground">
                Tramo: {formatDateDisplay(rangeStats.start)} → {formatDateDisplay(rangeStats.end)}
              </span>
              <span className="rounded bg-brand/20 px-2 py-0.5 text-[10px] font-bold text-brand">
                {rangeStats.days} {rangeStats.days === 1 ? "día" : "días"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs num">
              <span>
                <strong>{rangeStats.tradesCount}</strong> operaciones encontradas
              </span>
              <span
                className={cn(
                  "font-bold",
                  rangeStats.pnl >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {rangeStats.pnl >= 0 ? "+" : ""}
                {formatCurrency(rangeStats.pnl, true)}
              </span>
              {rangeStats.tradesCount > 0 && (
                <span className="text-muted-foreground">
                  ({rangeStats.winRate.toFixed(0)}% WR)
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground flex items-center gap-2">
            <CalendarRange className="size-4 text-muted-foreground/60 shrink-0" />
            <span>
              Selecciona una fecha de inicio y una fecha de fin en el calendario o introduce las fechas abajo para configurar el tramo.
            </span>
          </div>
        )}

        {/* Formulario con campos */}
        <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 items-end">
          {/* Fecha Desde */}
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-bold text-muted-foreground">Fecha Inicio (Desde)</span>
            <input
              type="date"
              value={rangeFrom || ""}
              onChange={(e) => {
                setRangeFrom(e.target.value);
                setIsSelectingRange(false);
              }}
              className="h-9 rounded-md border border-border bg-card px-2.5 text-xs focus:ring-1 focus:ring-brand"
            />
          </label>

          {/* Fecha Hasta */}
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-bold text-muted-foreground">Fecha Fin (Hasta)</span>
            <input
              type="date"
              value={rangeTo || ""}
              onChange={(e) => {
                setRangeTo(e.target.value);
                setIsSelectingRange(false);
              }}
              className="h-9 rounded-md border border-border bg-card px-2.5 text-xs focus:ring-1 focus:ring-brand"
            />
          </label>

          {/* Estrategia */}
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-bold text-muted-foreground">Estrategia a Asignar</span>
            <select
              value={selectedStrategyToAssign}
              onChange={(e) => setSelectedStrategyToAssign(e.target.value)}
              className="h-9 rounded-md border border-border bg-card px-2.5 text-xs focus:ring-1 focus:ring-brand"
            >
              <option value="">Seleccionar estrategia…</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.mainSymbol})
                </option>
              ))}
            </select>
          </label>

          {/* Cuentas */}
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-bold text-muted-foreground">Cuenta Objetivo</span>
            <select
              value={selectedAccountToAssign}
              onChange={(e) => setSelectedAccountToAssign(e.target.value)}
              className="h-9 rounded-md border border-border bg-card px-2.5 text-xs focus:ring-1 focus:ring-brand"
            >
              <option value="all">Todas las cuentas ({accounts.length})</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          {/* Botón Asignar */}
          <Button
            type="button"
            onClick={handleAssignPeriod}
            disabled={isSaving || !rangeFrom || !selectedStrategyToAssign}
            className="h-9 w-full font-bold shadow-xs cursor-pointer gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {isSaving ? "Guardando…" : "Asignar tramo"}
          </Button>
        </div>

        {/* Nota opcional */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={periodNote}
            onChange={(e) => setPeriodNote(e.target.value)}
            placeholder="Nota o descripción del tramo (opcional, ej: Test de Scalping apertura o Fase Apex)"
            className="h-8 w-full rounded-md border border-border bg-muted/20 px-3 text-xs placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-brand"
          />
        </div>
      </div>
    </div>
  );
}
