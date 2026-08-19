import { useMemo, useState } from "react";
import {
  Brain,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  HeartHandshake,
  Moon,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { pnlByDay } from "@/lib/emotion-metrics";
import {
  calculateReadinessScore,
  emotionAfterLabel,
  emotionBeforeLabel,
  followedPlanLabel,
  mistakeLabel,
  MOOD_FACES,
  SCALE_DESCRIPTIONS,
  todayKey,
  tradeDayKey,
} from "@/lib/emotions";
import { formatCurrency } from "@/lib/metrics";
import type { MoodCheckin } from "@/lib/mood";
import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

interface MoodCalendarProps {
  checkins: MoodCheckin[];
  trades: Trade[];
}

export function MoodCalendar({ checkins, trades }: MoodCalendarProps) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const byDay = useMemo(() => pnlByDay(trades), [trades]);
  const moodByDay = useMemo(
    () => new Map(checkins.map((c) => [c.date, c])),
    [checkins],
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Lunes primero
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Resumen del mes
  const monthStats = useMemo(() => {
    let pnl = 0;
    let ops = 0;
    let checkedDays = 0;
    let optimalDays = 0;
    let stressDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const k = todayKey(new Date(year, month, d));
      const entry = byDay.get(k);
      if (entry) {
        pnl += entry.pnl;
        ops += entry.trades;
      }
      const c = moodByDay.get(k);
      if (c) {
        checkedDays++;
        if (c.mood >= 4 && c.stress <= 2) optimalDays++;
        if (c.stress >= 4 || c.mood <= 2) stressDays++;
      }
    }

    return { pnl, ops, checkedDays, optimalDays, stressDays };
  }, [byDay, moodByDay, year, month, daysInMonth]);

  // Datos del día seleccionado para el modal de inspección
  const selectedDayData = useMemo(() => {
    if (!selectedDayKey) return null;
    const checkin = moodByDay.get(selectedDayKey);
    const dayTrades = trades.filter((t) => tradeDayKey(t) === selectedDayKey);
    const dayPnl = dayTrades.reduce((s, t) => s + t.pnl, 0);

    const readiness = checkin
      ? calculateReadinessScore({
          mood: checkin.mood,
          energy: checkin.energy,
          stress: checkin.stress,
          focus: checkin.focus,
          sleepHours: checkin.sleep_hours,
        })
      : null;

    const [y, m, d] = selectedDayKey.split("-");
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));

    return {
      dateKey: selectedDayKey,
      dateFormatted: dateObj.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      checkin,
      trades: dayTrades,
      pnl: dayPnl,
      readiness,
    };
  }, [selectedDayKey, moodByDay, trades]);

  return (
    <section className="panel p-5 space-y-4 flex flex-col justify-between">
      {/* Header del Calendario Emocional */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-4 text-brand" />
          <h3 className="text-xl font-display uppercase tracking-wide capitalize leading-none font-bold">
            {cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "num text-xs font-bold px-2.5 py-1 rounded-md border tabular-nums",
              monthStats.pnl > 0
                ? "text-profit bg-profit/10 border-profit/30"
                : monthStats.pnl < 0
                  ? "text-loss bg-loss/10 border-loss/30"
                  : "text-muted-foreground bg-muted/40 border-border",
            )}
          >
            {monthStats.pnl > 0 ? "+" : ""}
            {formatCurrency(monthStats.pnl, true)} · {monthStats.checkedDays} check-ins
          </span>

          <div className="flex items-center rounded-md border border-border bg-card">
            <button
              type="button"
              aria-label="Mes anterior"
              className="p-1.5 hover:bg-accent rounded-l text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Mes siguiente"
              className="p-1.5 hover:bg-accent rounded-r text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
                  "rounded min-h-14",
                  isWeekend && "bg-muted/10 border border-dashed border-border/20 opacity-20",
                )}
              />
            );
          }

          const k = todayKey(new Date(year, month, day));
          const c = moodByDay.get(k);
          const dayEntry = byDay.get(k);
          const pnl = dayEntry?.pnl;
          const isToday = k === todayKey();

          return (
            <button
              key={k}
              type="button"
              onClick={() => setSelectedDayKey(k)}
              title={
                c
                  ? `Ánimo ${c.mood}/5 · Energía ${c.energy}/5 · Estrés ${c.stress}/5 · Clic para ver detalles`
                  : isWeekend
                    ? `Fin de semana (${day}) · Clic para ver`
                    : `Día ${day} · Clic para ver detalles`
              }
              className={cn(
                "flex min-h-14 flex-col justify-between rounded-lg border p-1 text-left transition-all relative cursor-pointer group",
                isWeekend && !c && !pnl && "bg-muted/15 border-dashed border-border/35 opacity-40 hover:opacity-85",
                isToday && "ring-2 ring-brand border-brand bg-brand/[0.04]",
                c
                  ? c.mood >= 4
                    ? "border-emerald-500/40 bg-emerald-500/[0.04] hover:bg-emerald-500/10"
                    : c.mood <= 2 || c.stress >= 4
                      ? "border-amber-500/40 bg-amber-500/[0.04] hover:bg-amber-500/10"
                      : "border-blue-500/30 bg-blue-500/[0.04] hover:bg-blue-500/10"
                  : "border-border/70 hover:border-foreground/40 hover:bg-accent/25",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    isWeekend ? "text-muted-foreground/60" : "text-muted-foreground",
                    isToday && "font-bold text-brand",
                  )}
                >
                  {day}
                </span>

                {/* Indicadores de Intención / Cierre */}
                <div className="flex items-center gap-0.5">
                  {c?.intention && (
                    <span
                      className="size-1.5 rounded-full bg-brand"
                      title="Intención registrada"
                    />
                  )}
                  {c?.review_note && (
                    <span
                      className="size-1.5 rounded-full bg-purple-500"
                      title="Cierre registrado"
                    />
                  )}
                </div>
              </div>

              {/* Emoji central con animación sutil al hover */}
              <div className="flex items-center justify-center my-0.5">
                <span
                  className={cn(
                    "leading-none transition-transform group-hover:scale-125",
                    isWeekend ? "text-xs" : "text-base",
                  )}
                >
                  {c ? MOOD_FACES[c.mood - 1] : isWeekend ? "—" : "·"}
                </span>
              </div>

              {/* PnL del día */}
              {pnl != null ? (
                <div className="flex items-center justify-between w-full">
                  <span
                    className={cn(
                      "num font-black leading-none",
                      isWeekend ? "text-[8px]" : "text-[10px]",
                      pnl > 0 ? "text-profit" : pnl < 0 ? "text-loss" : "text-muted-foreground",
                    )}
                  >
                    {pnl > 0 ? "+" : ""}
                    {Math.round(pnl)}
                  </span>
                  {dayEntry && dayEntry.trades > 1 && (
                    <span className="text-[8px] text-muted-foreground">
                      {dayEntry.trades} op.
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[8px] text-muted-foreground/40 text-center block">
                  {c ? "Sin ops" : isWeekend ? "" : "—"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer con Resumen de Psicología del Mes */}
      <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>{monthStats.optimalDays} días en la zona</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-500" />
            <span>{monthStats.stressDays} días en tensión</span>
          </span>
        </div>

        <span className="text-[11px]">
          💡 Haz clic en cualquier día para ver la auditoría completa
        </span>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE INSPECCIÓN DETALLADA DEL DÍA                                    */}
      {/* ========================================================================= */}
      <Dialog open={Boolean(selectedDayKey)} onOpenChange={(open) => !open && setSelectedDayKey(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {selectedDayData && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <DialogTitle className="text-lg font-bold font-display capitalize">
                      {selectedDayData.dateFormatted}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Auditoría emocional, intenciones y operaciones de esta jornada
                    </p>
                  </div>

                  {selectedDayData.pnl !== 0 && (
                    <span
                      className={cn(
                        "num text-sm font-black px-3 py-1 rounded-lg border",
                        selectedDayData.pnl > 0
                          ? "text-profit bg-profit/10 border-profit/30"
                          : "text-loss bg-loss/10 border-loss/30",
                      )}
                    >
                      {selectedDayData.pnl > 0 ? "+" : ""}
                      {formatCurrency(selectedDayData.pnl, true)}
                    </span>
                  )}
                </div>
              </DialogHeader>

              {/* Sección 1: Estado Mental y Escalas */}
              {selectedDayData.checkin ? (
                <div className="space-y-3.5">
                  {/* Readiness Banner */}
                  {selectedDayData.readiness && (
                    <div
                      className={cn(
                        "rounded-xl border p-3 flex items-center justify-between gap-3",
                        selectedDayData.readiness.level === "optimal"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                          : selectedDayData.readiness.level === "good"
                            ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                            : selectedDayData.readiness.level === "caution"
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                              : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">
                          {MOOD_FACES[selectedDayData.checkin.mood - 1]}
                        </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                            Preparación Mental: {selectedDayData.readiness.score}%
                          </p>
                          <p className="text-xs opacity-90 leading-tight">
                            {selectedDayData.readiness.advice}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Grid de 4 Métricas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-xl border border-border/80 bg-muted/20 p-2.5 text-center">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                        Ánimo
                      </span>
                      <p className="text-sm font-bold text-foreground mt-0.5">
                        {SCALE_DESCRIPTIONS.mood[selectedDayData.checkin.mood - 1]?.label.split("/")[0]}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-muted/20 p-2.5 text-center">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                        Energía
                      </span>
                      <p className="text-sm font-bold text-foreground mt-0.5">
                        {selectedDayData.checkin.energy}/5
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-muted/20 p-2.5 text-center">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                        Estrés
                      </span>
                      <p className="text-sm font-bold text-foreground mt-0.5">
                        {selectedDayData.checkin.stress}/5
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-muted/20 p-2.5 text-center">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                        Sueño
                      </span>
                      <p className="text-sm font-bold text-foreground mt-0.5">
                        {selectedDayData.checkin.sleep_hours
                          ? `${selectedDayData.checkin.sleep_hours}h`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Intención del Día */}
                  {selectedDayData.checkin.intention && (
                    <div className="rounded-xl border border-brand/30 bg-brand/[0.04] p-3 text-xs space-y-1">
                      <span className="font-bold text-brand flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                        <Target className="size-3.5" /> Intención & Compromiso del Día
                      </span>
                      <p className="text-foreground leading-relaxed italic">
                        "{selectedDayData.checkin.intention}"
                      </p>
                    </div>
                  )}

                  {/* Cierre / Review */}
                  {selectedDayData.checkin.review_note && (
                    <div className="rounded-xl border border-purple-500/30 bg-purple-500/[0.04] p-3 text-xs space-y-1">
                      <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                        <Brain className="size-3.5" /> Reflexión Post-Sesión
                      </span>
                      <p className="text-foreground leading-relaxed italic">
                        "{selectedDayData.checkin.review_note}"
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground/80">Sin check-in registrado para esta jornada</p>
                  <p className="text-[11px] mt-0.5">
                    No registraste tu estado emocional ni tus intenciones este día.
                  </p>
                </div>
              )}

              {/* Sección 2: Operaciones Ejecutadas */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-brand" />
                  Operaciones Registradas ({selectedDayData.trades.length})
                </h4>

                {selectedDayData.trades.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay operaciones en este día.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayData.trades.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-lg border border-border bg-card p-2.5 text-xs flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground uppercase">{t.symbol}</span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.2 text-[10px] font-bold uppercase",
                              t.side === "long" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
                            )}
                          >
                            {t.side}
                          </span>
                          {t.emotionBefore && (
                            <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              Antes: {emotionBeforeLabel(t.emotionBefore)}
                            </span>
                          )}
                          {t.followedPlan && (
                            <span className="text-[10px] text-muted-foreground">
                              Plan: {followedPlanLabel(t.followedPlan)}
                            </span>
                          )}
                        </div>

                        <span
                          className={cn(
                            "num font-bold",
                            t.pnl >= 0 ? "text-profit" : "text-loss",
                          )}
                        >
                          {t.pnl >= 0 ? "+" : ""}
                          {formatCurrency(t.pnl, true)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
