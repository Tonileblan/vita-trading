import { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { pnlByDay } from "@/lib/emotion-metrics";
import { todayKey } from "@/lib/emotions";
import { formatCurrency } from "@/lib/metrics";
import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const MONTH_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export type CalendarViewMode = "month" | "quarter" | "year";

interface PnlCalendarProps {
  trades: Trade[];
  selectedDate?: string | null;
  onSelectDate?: (dateKey: string | null) => void;
  defaultView?: CalendarViewMode;
}

export function PnlCalendar({
  trades,
  selectedDate,
  onSelectDate,
  defaultView = "month",
}: PnlCalendarProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(defaultView);

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
  const quarter = Math.floor(month / 3); // 0 = Q1, 1 = Q2, 2 = Q3, 3 = Q4

  // Navegación adaptable según el modo de vista
  const handlePrev = () => {
    if (viewMode === "month") {
      setCursor(new Date(year, month - 1, 1));
    } else if (viewMode === "quarter") {
      setCursor(new Date(year, (quarter - 1) * 3, 1));
    } else {
      setCursor(new Date(year - 1, month, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCursor(new Date(year, month + 1, 1));
    } else if (viewMode === "quarter") {
      setCursor(new Date(year, (quarter + 1) * 3, 1));
    } else {
      setCursor(new Date(year + 1, month, 1));
    }
  };

  // Resumen Mensual (Vista Mes)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthCells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthSummary = useMemo(() => {
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

  // Resumen Trimestral (Vista Trimestre)
  const quarterMonths = useMemo(() => {
    const startM = quarter * 3;
    return [startM, startM + 1, startM + 2];
  }, [quarter]);

  const quarterSummary = useMemo(() => {
    let net = 0;
    let ops = 0;
    let winDays = 0;
    let lossDays = 0;
    let best = 0;
    let worst = 0;

    quarterMonths.forEach((m) => {
      const daysCount = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= daysCount; d++) {
        const entry = byDay.get(todayKey(new Date(year, m, d)));
        if (!entry) continue;
        net += entry.pnl;
        ops += entry.trades;
        if (entry.pnl > 0) winDays++;
        else if (entry.pnl < 0) lossDays++;
        if (entry.pnl > best) best = entry.pnl;
        if (entry.pnl < worst) worst = entry.pnl;
      }
    });

    const winRate = winDays + lossDays > 0 ? (winDays / (winDays + lossDays)) * 100 : 0;
    return { net, ops, winDays, lossDays, best, worst, winRate };
  }, [byDay, year, quarterMonths]);

  // Resumen Anual (Vista Año)
  const yearSummary = useMemo(() => {
    let net = 0;
    let ops = 0;
    let winDays = 0;
    let lossDays = 0;
    let bestMonthNet = -Infinity;
    let worstMonthNet = Infinity;
    let bestMonthIdx = 0;
    let worstMonthIdx = 0;

    const monthlyBreakdown = Array.from({ length: 12 }, (_, m) => {
      let mNet = 0;
      let mOps = 0;
      let mWin = 0;
      let mLoss = 0;
      const daysCount = new Date(year, m + 1, 0).getDate();

      for (let d = 1; d <= daysCount; d++) {
        const entry = byDay.get(todayKey(new Date(year, m, d)));
        if (!entry) continue;
        mNet += entry.pnl;
        mOps += entry.trades;
        if (entry.pnl > 0) mWin++;
        else if (entry.pnl < 0) mLoss++;
      }

      net += mNet;
      ops += mOps;
      winDays += mWin;
      lossDays += mLoss;

      if (mOps > 0) {
        if (mNet > bestMonthNet) {
          bestMonthNet = mNet;
          bestMonthIdx = m;
        }
        if (mNet < worstMonthNet) {
          worstMonthNet = mNet;
          worstMonthIdx = m;
        }
      }

      return {
        month: m,
        name: MONTH_NAMES[m]!,
        shortName: MONTH_SHORT[m]!,
        net: mNet,
        ops: mOps,
        winDays: mWin,
        lossDays: mLoss,
      };
    });

    const winRate = winDays + lossDays > 0 ? (winDays / (winDays + lossDays)) * 100 : 0;
    return {
      net,
      ops,
      winDays,
      lossDays,
      winRate,
      bestMonth: isFinite(bestMonthNet) ? { name: MONTH_NAMES[bestMonthIdx], net: bestMonthNet } : null,
      worstMonth: isFinite(worstMonthNet) ? { name: MONTH_NAMES[worstMonthIdx], net: worstMonthNet } : null,
      monthlyBreakdown,
    };
  }, [byDay, year]);

  // Renderizador de un mes individual (usado en Vista Mensual y en cada tarjeta de Trimestre)
  const renderMonthGrid = (targetYear: number, targetMonth: number, isCompact = false) => {
    const daysInTarget = new Date(targetYear, targetMonth + 1, 0).getDate();
    const targetOffset = (new Date(targetYear, targetMonth, 1).getDay() + 6) % 7;
    const cells: (number | null)[] = [
      ...Array.from({ length: targetOffset }, () => null),
      ...Array.from({ length: daysInTarget }, (_, i) => i + 1),
    ];

    return (
      <div className="space-y-1.5">
        {/* Días de la semana */}
        <div
          className={cn(
            "grid gap-1 text-center font-bold uppercase tracking-wider text-muted-foreground",
            isCompact ? "text-[8px] px-0.5" : "text-[10px] pl-2.5 sm:pl-5 pr-0.5",
          )}
          style={{ gridTemplateColumns: isCompact ? "repeat(7, 1fr)" : "1.45fr 1.45fr 1.45fr 1.45fr 1.45fr 0.325fr 0.325fr" }}
        >
          {WEEKDAYS.map((d, idx) => (
            <span
              key={d}
              className={cn(
                idx >= 5 ? "opacity-40 font-normal" : "text-foreground/75",
                isCompact ? "text-[7px]" : "",
              )}
            >
              {isCompact ? d.charAt(0) : d}
            </span>
          ))}
        </div>

        {/* Cuadrícula de días */}
        <div
          className={cn(
            "grid gap-1",
            isCompact ? "px-0.5" : "pl-2.5 sm:pl-5 pr-0.5",
          )}
          style={{ gridTemplateColumns: isCompact ? "repeat(7, 1fr)" : "1.45fr 1.45fr 1.45fr 1.45fr 1.45fr 0.325fr 0.325fr" }}
        >
          {cells.map((day, i) => {
            const isWeekend = i % 7 >= 5;
            if (day === null) {
              return (
                <span
                  key={`e${i}`}
                  className={cn(
                    "rounded",
                    isCompact ? "min-h-7.5" : "min-h-13",
                    isWeekend && "bg-muted/10 border border-dashed border-border/20 opacity-20",
                  )}
                />
              );
            }
            const key = todayKey(new Date(targetYear, targetMonth, day));
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
                  "flex flex-col items-center justify-center rounded border text-left w-full transition-all relative",
                  isCompact ? "min-h-8 p-0.5 text-[9px]" : "min-h-13 p-1 text-[10px]",
                  onSelectDate ? "cursor-pointer hover:border-foreground/50 hover:shadow-xs" : "",
                  isWeekend &&
                    !entry &&
                    !isSelected &&
                    "bg-muted/15 border-dashed border-border/35 opacity-35 hover:opacity-85",
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
                      "font-mono",
                      isCompact ? "text-[8px]" : isWeekend ? "text-[8px] text-muted-foreground/60" : "text-[10px] text-muted-foreground",
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
                        "num font-black leading-none",
                        isCompact ? "text-[8.5px] mt-0.5" : isWeekend ? "text-[10px] mt-0.5" : "text-sm mt-0.5",
                        pnl > 0 ? "text-profit" : pnl < 0 ? "text-loss" : "text-muted-foreground",
                      )}
                    >
                      {pnl > 0 ? "+" : ""}
                      {Math.round(pnl)}
                    </span>
                    {!isCompact && !isWeekend && (
                      <span className="text-muted-foreground text-[8px] md:text-[9px] mt-0.5 font-medium">
                        {entry.trades} op.
                      </span>
                    )}
                  </>
                ) : (
                  <span
                    className={cn(
                      "text-muted-foreground",
                      isCompact ? "text-[6px] opacity-20" : isWeekend ? "text-[7px] opacity-25" : "mt-0.5",
                    )}
                  >
                    {isWeekend ? "—" : "·"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Título de la cabecera según la vista activa
  const headerTitle = useMemo(() => {
    if (viewMode === "month") {
      return cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    }
    if (viewMode === "quarter") {
      const qNum = quarter + 1;
      const startM = MONTH_SHORT[quarter * 3];
      const endM = MONTH_SHORT[quarter * 3 + 2];
      return `T${qNum} ${year} · (${startM} - ${endM})`;
    }
    return `Año ${year}`;
  }, [viewMode, cursor, quarter, year]);

  // Badge de neto según la vista activa
  const activeNet =
    viewMode === "month"
      ? monthSummary.net
      : viewMode === "quarter"
        ? quarterSummary.net
        : yearSummary.net;

  return (
    <section className="panel space-y-3.5 p-4 bg-card shadow-xs border border-border/80 rounded-2xl">
      {/* Header del Calendario con Selector de Vista (Mes / Trimestral / Anual) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4.5 text-brand" />
            <h2 className="text-xl font-display uppercase tracking-wide capitalize leading-none font-bold">
              {headerTitle}
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

        {/* Controles: Selector de modo de vista + Badge de Neto + Botones < > */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Selector de Vistas: Mes | Trimestral | Anual */}
          <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all",
                viewMode === "month"
                  ? "bg-card text-foreground shadow-xs font-bold border border-border/60"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Mes
            </button>
            <button
              type="button"
              onClick={() => setViewMode("quarter")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all",
                viewMode === "quarter"
                  ? "bg-card text-foreground shadow-xs font-bold border border-border/60"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Trimestral
            </button>
            <button
              type="button"
              onClick={() => setViewMode("year")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all",
                viewMode === "year"
                  ? "bg-card text-foreground shadow-xs font-bold border border-border/60"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Anual
            </button>
          </div>

          {/* Badge de Neto del Periodo Actual */}
          <span
            className={cn(
              "num text-xs sm:text-sm font-bold px-2.5 py-1 rounded-lg border",
              activeNet > 0
                ? "text-profit bg-profit/10 border-profit/30"
                : activeNet < 0
                  ? "text-loss bg-loss/10 border-loss/30"
                  : "text-muted-foreground bg-muted/40 border-border",
            )}
          >
            {activeNet > 0 ? "+" : ""}
            {formatCurrency(activeNet, true)}
          </span>

          {/* Botones de navegación Anterior / Siguiente */}
          <div className="flex items-center rounded-lg border border-border/80 bg-card shadow-2xs">
            <button
              type="button"
              aria-label="Periodo anterior"
              className="p-1.5 hover:bg-accent rounded-l-lg text-muted-foreground hover:text-foreground transition-colors"
              onClick={handlePrev}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Periodo siguiente"
              className="p-1.5 hover:bg-accent rounded-r-lg text-muted-foreground hover:text-foreground transition-colors"
              onClick={handleNext}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODO 1: VISTA MENSUAL DETALLADA                                           */}
      {/* ========================================================================= */}
      {viewMode === "month" && (
        <div className="space-y-3.5">
          {renderMonthGrid(year, month, false)}

          {/* Resumen del mes inferior */}
          <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs sm:grid-cols-5">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Neto Mes
              </p>
              <p
                className={cn(
                  "num text-sm font-bold",
                  monthSummary.net > 0
                    ? "text-profit"
                    : monthSummary.net < 0
                      ? "text-loss"
                      : "",
                )}
              >
                {formatCurrency(monthSummary.net, true)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Operaciones
              </p>
              <p className="num text-sm font-bold">{monthSummary.ops}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Días +/−
              </p>
              <p className="num text-sm font-bold">
                <span className="text-profit">{monthSummary.winDays}</span>
                {" / "}
                <span className="text-loss">{monthSummary.lossDays}</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Mejor día
              </p>
              <p className="num text-sm font-bold text-profit">
                {formatCurrency(monthSummary.best, true)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Peor día
              </p>
              <p className="num text-sm font-bold text-loss">
                {formatCurrency(monthSummary.worst, true)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODO 2: VISTA TRIMESTRAL (3 MESES)                                        */}
      {/* ========================================================================= */}
      {viewMode === "quarter" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quarterMonths.map((m) => {
              const mName = MONTH_NAMES[m]!;
              const daysCount = new Date(year, m + 1, 0).getDate();
              let mNet = 0;
              let mOps = 0;
              for (let d = 1; d <= daysCount; d++) {
                const entry = byDay.get(todayKey(new Date(year, m, d)));
                if (!entry) continue;
                mNet += entry.pnl;
                mOps += entry.trades;
              }

              return (
                <div
                  key={m}
                  className="rounded-xl border border-border/80 bg-muted/15 p-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCursor(new Date(year, m, 1));
                        setViewMode("month");
                      }}
                      className="font-bold text-sm hover:text-brand transition-colors text-left flex items-center gap-1 group"
                      title={`Ver detalle completo de ${mName}`}
                    >
                      <span>{mName}</span>
                      <span className="text-[10px] text-muted-foreground group-hover:text-brand font-normal">
                        ({mOps} ops)
                      </span>
                    </button>
                    <span
                      className={cn(
                        "num text-xs font-bold px-2 py-0.5 rounded border",
                        mNet > 0
                          ? "text-profit bg-profit/10 border-profit/30"
                          : mNet < 0
                            ? "text-loss bg-loss/10 border-loss/30"
                            : "text-muted-foreground bg-muted/40 border-border",
                      )}
                    >
                      {mNet > 0 ? "+" : ""}
                      {formatCurrency(mNet, true)}
                    </span>
                  </div>

                  {renderMonthGrid(year, m, true)}
                </div>
              );
            })}
          </div>

          {/* Resumen del Trimestre inferior */}
          <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs sm:grid-cols-5">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Neto Trimestre
              </p>
              <p
                className={cn(
                  "num text-sm font-bold",
                  quarterSummary.net > 0
                    ? "text-profit"
                    : quarterSummary.net < 0
                      ? "text-loss"
                      : "",
                )}
              >
                {formatCurrency(quarterSummary.net, true)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Operaciones
              </p>
              <p className="num text-sm font-bold">{quarterSummary.ops}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Días Ganadores / Perdedores
              </p>
              <p className="num text-sm font-bold">
                <span className="text-profit">{quarterSummary.winDays}W</span>
                {" / "}
                <span className="text-loss">{quarterSummary.lossDays}L</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Efectividad Días
              </p>
              <p className="num text-sm font-bold text-foreground">
                {quarterSummary.winRate.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Mejor / Peor Día
              </p>
              <p className="num text-xs font-bold mt-0.5">
                <span className="text-profit">{formatCurrency(quarterSummary.best, true)}</span>
                {" · "}
                <span className="text-loss">{formatCurrency(quarterSummary.worst, true)}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODO 3: VISTA ANUAL (12 MESES)                                            */}
      {/* ========================================================================= */}
      {viewMode === "year" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {yearSummary.monthlyBreakdown.map((m) => {
              const hasTrades = m.ops > 0;
              const isProfit = m.net > 0;
              const isLoss = m.net < 0;

              return (
                <div
                  key={m.month}
                  onClick={() => {
                    setCursor(new Date(year, m.month, 1));
                    setViewMode("month");
                  }}
                  className={cn(
                    "rounded-xl border p-3 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-xs group space-y-2",
                    hasTrades
                      ? isProfit
                        ? "bg-profit/5 border-profit/30 hover:border-profit/60"
                        : isLoss
                          ? "bg-loss/5 border-loss/30 hover:border-loss/60"
                          : "bg-muted/15 border-border hover:border-foreground/30"
                      : "bg-muted/10 border-border/40 opacity-60 hover:opacity-100",
                  )}
                  title={`Clic para abrir el mes de ${m.name}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm group-hover:text-brand transition-colors">
                      {m.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {m.ops} ops
                    </span>
                  </div>

                  <div>
                    <p
                      className={cn(
                        "num text-lg font-black tracking-tight",
                        isProfit
                          ? "text-profit"
                          : isLoss
                            ? "text-loss"
                            : "text-muted-foreground",
                      )}
                    >
                      {hasTrades
                        ? `${isProfit ? "+" : ""}${formatCurrency(m.net, false)}`
                        : "—"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
                    <span>
                      {hasTrades ? (
                        <>
                          <span className="text-profit font-semibold">{m.winDays}W</span>
                          {" / "}
                          <span className="text-loss font-semibold">{m.lossDays}L</span>
                        </>
                      ) : (
                        "Sin datos"
                      )}
                    </span>
                    <span className="text-[9px] group-hover:underline text-brand">
                      Ver mes →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resumen Anual inferior */}
          <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs sm:grid-cols-5">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Neto Anual {year}
              </p>
              <p
                className={cn(
                  "num text-sm font-bold",
                  yearSummary.net > 0
                    ? "text-profit"
                    : yearSummary.net < 0
                      ? "text-loss"
                      : "",
                )}
              >
                {formatCurrency(yearSummary.net, true)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Operaciones Totales
              </p>
              <p className="num text-sm font-bold">{yearSummary.ops}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Días Operados
              </p>
              <p className="num text-sm font-bold">
                <span className="text-profit">{yearSummary.winDays}W</span>
                {" / "}
                <span className="text-loss">{yearSummary.lossDays}L</span>
                <span className="text-muted-foreground font-normal ml-1">
                  ({yearSummary.winRate.toFixed(0)}%)
                </span>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Mejor Mes
              </p>
              <p className="num text-xs font-bold text-profit mt-0.5">
                {yearSummary.bestMonth
                  ? `${yearSummary.bestMonth.name} (${formatCurrency(yearSummary.bestMonth.net, true)})`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Peor Mes
              </p>
              <p className="num text-xs font-bold text-loss mt-0.5">
                {yearSummary.worstMonth
                  ? `${yearSummary.worstMonth.name} (${formatCurrency(yearSummary.worstMonth.net, true)})`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
