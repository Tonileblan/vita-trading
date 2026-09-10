import { useMemo } from "react";
import {
  AlertTriangle,
  Award,
  Brain,
  CheckCircle2,
  DollarSign,
  Flame,
  HeartHandshake,
  LineChart,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import {
  byCheckinLevel,
  groupBy,
  mistakeCost,
  type Bucket,
} from "@/lib/emotion-metrics";
import {
  EMOTIONS_BEFORE,
  emotionAfterLabel,
  emotionBeforeLabel,
  followedPlanLabel,
  MISTAKES,
  mistakeLabel,
} from "@/lib/emotions";
import { formatCurrency } from "@/lib/metrics";
import type { MoodCheckin } from "@/lib/mood";
import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EmotionStatsProps {
  trades: Trade[];
  checkins: MoodCheckin[];
}

export function EmotionStats({ trades, checkins }: EmotionStatsProps) {
  // Emociones antes de entrar
  const beforeStats = useMemo(() => {
    return groupBy(trades, (t) => t.emotionBefore, emotionBeforeLabel);
  }, [trades]);

  // Emociones después de cerrar
  const afterStats = useMemo(() => {
    return groupBy(trades, (t) => t.emotionAfter, emotionAfterLabel);
  }, [trades]);

  // Disciplina / Seguir el plan
  const planStats = useMemo(() => {
    const yes = trades.filter((t) => t.followedPlan === "yes");
    const partial = trades.filter((t) => t.followedPlan === "partial");
    const no = trades.filter((t) => t.followedPlan === "no");

    const compute = (list: Trade[]) => {
      const pnl = list.reduce((s, t) => s + t.pnl, 0);
      const wins = list.filter((t) => t.pnl > 0).length;
      const winRate = list.length ? (wins / list.length) * 100 : 0;
      return { trades: list.length, pnl, winRate };
    };

    return {
      yes: compute(yes),
      partial: compute(partial),
      no: compute(no),
    };
  }, [trades]);

  // Coste de los errores cometidos
  const mistakeStats = useMemo(() => {
    return mistakeCost(trades, mistakeLabel);
  }, [trades]);

  // Total de dinero perdido en errores emocionales
  const totalMistakeLoss = useMemo(() => {
    const tradesWithMistakes = trades.filter(
      (t) => (t.mistakes && t.mistakes.length > 0) || t.emotionBefore === "venganza" || t.emotionBefore === "fomo",
    );
    const lossTrades = tradesWithMistakes.filter((t) => t.pnl < 0);
    return Math.abs(lossTrades.reduce((s, t) => s + t.pnl, 0));
  }, [trades]);

  // Correlación de horas de sueño con rendimiento
  const sleepCorrelation = useMemo(() => {
    const checkinByDate = new Map(checkins.map((c) => [c.date, c]));
    const lowSleepTrades: Trade[] = []; // < 6.5h
    const optimalSleepTrades: Trade[] = []; // 6.5h - 8.5h
    const highSleepTrades: Trade[] = []; // > 8.5h

    for (const t of trades) {
      const day = (t.openedAt || t.closedAt || "").slice(0, 10);
      const c = checkinByDate.get(day);
      if (!c || c.sleep_hours == null) continue;
      if (c.sleep_hours < 6.5) lowSleepTrades.push(t);
      else if (c.sleep_hours <= 8.5) optimalSleepTrades.push(t);
      else highSleepTrades.push(t);
    }

    const calc = (list: Trade[]) => {
      const pnl = list.reduce((s, t) => s + t.pnl, 0);
      const wins = list.filter((t) => t.pnl > 0).length;
      return {
        trades: list.length,
        pnl,
        winRate: list.length ? (wins / list.length) * 100 : 0,
      };
    };

    return {
      low: calc(lowSleepTrades),
      optimal: calc(optimalSleepTrades),
      high: calc(highSleepTrades),
    };
  }, [trades, checkins]);

  // Mejor y peor emoción previa
  const bestEmotion = beforeStats.find((b) => b.pnl > 0);
  const worstEmotion = [...beforeStats].reverse().find((b) => b.pnl < 0);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* BLOQUE 1: KPIs DE IMPACTO PSICOLÓGICO Y CAPITAL SALVABLE                  */}
      {/* ========================================================================= */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Mejor Estado Operativo */}
        <div className="panel p-4 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Award className="size-3.5 text-emerald-500" /> Estado Más Rentable
            </span>
            <span className="rounded bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 text-[10px] font-bold">
              En la Zona
            </span>
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">
              {bestEmotion ? bestEmotion.label : "Sin datos"}
            </p>
            {bestEmotion ? (
              <p className="num text-xs font-bold text-profit mt-0.5">
                +{formatCurrency(bestEmotion.pnl, true)} · {bestEmotion.winRate.toFixed(0)}% WR ({bestEmotion.trades} ops)
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">Registra emociones en tus trades</p>
            )}
          </div>
        </div>

        {/* 2. Estado Más Destructivo */}
        <div className="panel p-4 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Flame className="size-3.5 text-loss" /> Disparador de Tilt
            </span>
            <span className="rounded bg-loss/10 text-loss px-1.5 py-0.5 text-[10px] font-bold">
              Peligro
            </span>
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">
              {worstEmotion ? worstEmotion.label : "Sin datos"}
            </p>
            {worstEmotion ? (
              <p className="num text-xs font-bold text-loss mt-0.5">
                {formatCurrency(worstEmotion.pnl, true)} · {worstEmotion.winRate.toFixed(0)}% WR ({worstEmotion.trades} ops)
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">Sin pérdidas emocionales registradas</p>
            )}
          </div>
        </div>

        {/* 3. Coste de Indisciplina */}
        <div className="panel p-4 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="size-3.5 text-loss" /> Coste de Indisciplina
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              Fugas
            </span>
          </div>
          <div>
            <p className="num text-xl font-black text-loss">
              -{formatCurrency(totalMistakeLoss)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pérdidas en trades con errores marcados
            </p>
          </div>
        </div>

        {/* 4. Capital Salvable */}
        <div className="panel p-4 flex flex-col justify-between space-y-2 bg-gradient-to-br from-brand/5 via-card to-card border-brand/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> Potencial Salvable
            </span>
            <span className="rounded bg-brand/15 text-brand px-1.5 py-0.5 text-[10px] font-bold">
              Disciplina
            </span>
          </div>
          <div>
            <p className="num text-xl font-black text-foreground">
              +{formatCurrency(totalMistakeLoss)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ganancia extra si eliminas el FOMO y revenge
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* BLOQUE 2: MATRIZ DE EMOCIONES PRE-TRADE & DISCIPLINA                      */}
      {/* ========================================================================= */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Emociones antes de entrar */}
        <section className="panel p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="text-base font-bold font-display uppercase tracking-wide flex items-center gap-2">
                <Brain className="size-4 text-brand" /> Emoción Previa a la Entrada
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Impacto en PnL y efectividad según tu estado mental al abrir la orden
              </p>
            </div>
          </div>

          {beforeStats.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border">
              <p className="font-semibold text-foreground/80">Sin datos emocionales pre-trade</p>
              <p className="mt-0.5">Asigna la emoción antes de entrar en tus operaciones para ver el desglose.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {beforeStats.map((row) => {
                const def = EMOTIONS_BEFORE.find((e) => e.key === row.key);
                return (
                  <div
                    key={row.key}
                    className="rounded-xl border border-border bg-card p-3 text-xs space-y-2 shadow-xs transition-all hover:border-brand/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: def?.color || "var(--color-brand)" }}
                        />
                        <span className="font-bold text-foreground text-sm">{row.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          ({row.trades} {row.trades === 1 ? "operación" : "operaciones"})
                        </span>
                      </div>

                      <span
                        className={cn(
                          "num font-black text-sm",
                          row.pnl >= 0 ? "text-profit" : "text-loss",
                        )}
                      >
                        {row.pnl >= 0 ? "+" : ""}
                        {formatCurrency(row.pnl, true)}
                      </span>
                    </div>

                    {/* Barra de Win Rate */}
                    <div className="flex items-center gap-3 text-[11px] num">
                      <span className="font-semibold text-muted-foreground shrink-0 w-16">
                        {row.winRate.toFixed(0)}% WR
                      </span>
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            row.winRate >= 50 ? "bg-profit" : "bg-loss",
                          )}
                          style={{ width: `${row.winRate}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        Avg: {formatCurrency(row.avgPnl, true)}/op
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Impacto de Seguir el Plan */}
        <section className="panel p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="text-base font-bold font-display uppercase tracking-wide flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand" /> Adherencia al Plan Operativo
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comparativa directa: el coste real de saltarse las reglas
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Card 1: Siguió el plan */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <CheckCircle2 className="size-4" /> Siguiendo el Plan al 100%
                </span>
                <span
                  className={cn(
                    "num font-black text-base",
                    planStats.yes.pnl >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {planStats.yes.pnl >= 0 ? "+" : ""}
                  {formatCurrency(planStats.yes.pnl, true)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs num text-muted-foreground">
                <span>{planStats.yes.trades} operaciones</span>
                <span className="font-bold text-foreground">{planStats.yes.winRate.toFixed(1)}% Win Rate</span>
              </div>
            </div>

            {/* Card 2: Parcial */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <AlertTriangle className="size-4" /> Con Desvíos Parciales
                </span>
                <span
                  className={cn(
                    "num font-black text-base",
                    planStats.partial.pnl >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {planStats.partial.pnl >= 0 ? "+" : ""}
                  {formatCurrency(planStats.partial.pnl, true)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs num text-muted-foreground">
                <span>{planStats.partial.trades} operaciones</span>
                <span className="font-bold text-foreground">{planStats.partial.winRate.toFixed(1)}% Win Rate</span>
              </div>
            </div>

            {/* Card 3: No siguió el plan */}
            <div className="rounded-xl border border-loss/30 bg-loss/[0.04] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-loss flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <XCircle className="size-4" /> Sin Seguir el Plan (Indisciplina)
                </span>
                <span
                  className={cn(
                    "num font-black text-base",
                    planStats.no.pnl >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {planStats.no.pnl >= 0 ? "+" : ""}
                  {formatCurrency(planStats.no.pnl, true)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs num text-muted-foreground">
                <span>{planStats.no.trades} operaciones</span>
                <span className="font-bold text-foreground">{planStats.no.winRate.toFixed(1)}% Win Rate</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* BLOQUE 3: DETECTOR DE ERRORES OPERATIVOS & CORRELACIÓN DE SUEÑO          */}
      {/* ========================================================================= */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Coste de Errores Operativos */}
        <section className="panel p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="text-base font-bold font-display uppercase tracking-wide flex items-center gap-2">
                <ShieldAlert className="size-4 text-loss" /> Detector de Errores & Fugas de Capital
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cuánto dinero te ha costado cada fallo de ejecución marcado
              </p>
            </div>
          </div>

          {mistakeStats.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border">
              <p className="font-semibold text-foreground/80">Sin errores marcados</p>
              <p className="mt-0.5">¡Excelente disciplina! Continúa registrando tus operaciones con honestidad.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {mistakeStats.map((row) => {
                const mistakeDef = MISTAKES.find((m) => m.key === row.key);
                return (
                  <div
                    key={row.key}
                    className="rounded-xl border border-border bg-card p-3 text-xs space-y-1.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-loss" />
                        <span className="font-bold text-foreground">{row.label}</span>
                        <span className="text-[10px] text-muted-foreground">({row.trades} ops)</span>
                      </div>
                      <span className="num font-black text-loss">
                        {formatCurrency(row.pnl, true)}
                      </span>
                    </div>

                    {mistakeDef?.tip && (
                      <p className="text-[11px] text-muted-foreground italic bg-muted/30 px-2 py-0.5 rounded">
                        💡 Consejo: {mistakeDef.tip}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Correlación de Descanso & Sueño */}
        <section className="panel p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="text-base font-bold font-display uppercase tracking-wide flex items-center gap-2">
                <Moon className="size-4 text-indigo-400" /> Correlación Descanso vs Rendimiento
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cómo impactan las horas de sueño previas en tus ganancias operativas
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* < 6.5 horas */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                  <span className="size-2 rounded-full bg-loss" /> Poco Descanso (&lt; 6.5h)
                </span>
                <span
                  className={cn(
                    "num font-black text-sm",
                    sleepCorrelation.low.pnl >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {sleepCorrelation.low.trades > 0
                    ? `${sleepCorrelation.low.pnl >= 0 ? "+" : ""}${formatCurrency(sleepCorrelation.low.pnl, true)}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs num text-muted-foreground">
                <span>{sleepCorrelation.low.trades} operaciones registradas</span>
                <span className="font-bold text-foreground">
                  {sleepCorrelation.low.trades > 0
                    ? `${sleepCorrelation.low.winRate.toFixed(0)}% WR`
                    : "Sin datos"}
                </span>
              </div>
            </div>

            {/* 6.5h - 8.5h */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
                  <span className="size-2 rounded-full bg-emerald-500" /> Sueño Óptimo (6.5h – 8.5h)
                </span>
                <span
                  className={cn(
                    "num font-black text-sm",
                    sleepCorrelation.optimal.pnl >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {sleepCorrelation.optimal.trades > 0
                    ? `${sleepCorrelation.optimal.pnl >= 0 ? "+" : ""}${formatCurrency(sleepCorrelation.optimal.pnl, true)}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs num text-muted-foreground">
                <span>{sleepCorrelation.optimal.trades} operaciones registradas</span>
                <span className="font-bold text-foreground">
                  {sleepCorrelation.optimal.trades > 0
                    ? `${sleepCorrelation.optimal.winRate.toFixed(0)}% WR`
                    : "Sin datos"}
                </span>
              </div>
            </div>

            {/* > 8.5 horas */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                  <span className="size-2 rounded-full bg-blue-500" /> Descanso Prolongado (&gt; 8.5h)
                </span>
                <span
                  className={cn(
                    "num font-black text-sm",
                    sleepCorrelation.high.pnl >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {sleepCorrelation.high.trades > 0
                    ? `${sleepCorrelation.high.pnl >= 0 ? "+" : ""}${formatCurrency(sleepCorrelation.high.pnl, true)}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs num text-muted-foreground">
                <span>{sleepCorrelation.high.trades} operaciones registradas</span>
                <span className="font-bold text-foreground">
                  {sleepCorrelation.high.trades > 0
                    ? `${sleepCorrelation.high.winRate.toFixed(0)}% WR`
                    : "Sin datos"}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Resumen compacto para el panel principal. */
export function EmotionHighlights({ trades }: { trades: Trade[] }) {
  const before = useMemo(
    () => groupBy(trades, (t) => t.emotionBefore, emotionBeforeLabel).filter((b) => b.trades >= 2),
    [trades],
  );
  const mistakes = useMemo(() => mistakeCost(trades, mistakeLabel), [trades]);
  if (before.length === 0 && mistakes.length === 0) return null;

  const best = before[0];
  const worst = before.length > 1 ? before[before.length - 1] : undefined;
  const costliest = mistakes[0];

  return (
    <section className="panel grid gap-3 p-4 sm:grid-cols-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Mejor estado
        </p>
        <p className="mt-1 text-sm font-semibold">{best ? best.label : "—"}</p>
        {best && (
          <p className="num text-xs text-profit">{formatCurrency(best.pnl, true)}</p>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Peor estado
        </p>
        <p className="mt-1 text-sm font-semibold">{worst ? worst.label : "—"}</p>
        {worst && <p className="num text-xs text-loss">{formatCurrency(worst.pnl, true)}</p>}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Error más caro
        </p>
        <p className="mt-1 text-sm font-semibold">{costliest ? costliest.label : "—"}</p>
        {costliest && (
          <p className="num text-xs text-loss">{formatCurrency(costliest.pnl, true)}</p>
        )}
      </div>
    </section>
  );
}
