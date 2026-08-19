import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Flame, Snowflake, TrendingUp, Zap } from "lucide-react";
import type { Trade } from "@/lib/types";
import { computeMetrics, computeStreaks, formatCurrency } from "@/lib/metrics";
import { tradeDayKey } from "@/lib/emotions";
import { cn } from "@/lib/utils";

const CONSISTENCY_LIMIT = 15; // % máximo que puede pesar el mejor día

function Donut({ value }: { value: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative size-28 md:size-32">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="12" className="stroke-loss/40" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          className="stroke-profit transition-all duration-500"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-xl font-extrabold tracking-tight">
          {pct.toFixed(0)}%
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Acierto
        </span>
      </div>
    </div>
  );
}

function pfLabel(pf: number) {
  if (!Number.isFinite(pf)) return { text: "Excelente", tone: "text-profit bg-profit/15" };
  if (pf >= 2) return { text: "Excelente", tone: "text-profit bg-profit/15" };
  if (pf >= 1.5) return { text: "Bueno", tone: "text-profit bg-profit/15" };
  if (pf >= 1) return { text: "Ajustado", tone: "text-muted-foreground bg-muted" };
  return { text: "Pobre", tone: "text-loss bg-loss/15" };
}

export function PerformanceAnalysis({ trades }: { trades: Trade[] }) {
  const m = useMemo(() => computeMetrics(trades), [trades]);
  const streak = useMemo(() => computeStreaks(trades), [trades]);

  const { bestDay, totalProfit } = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const t of trades) {
      const key = tradeDayKey(t);
      if (key) byDay.set(key, (byDay.get(key) ?? 0) + t.pnl);
    }
    const best = Math.max(0, ...Array.from(byDay.values()));
    return { bestDay: best, totalProfit: trades.reduce((s, t) => s + t.pnl, 0) };
  }, [trades]);

  const consistency = totalProfit > 0 ? (bestDay / totalProfit) * 100 : 0;
  const ok = totalProfit > 0 && consistency <= CONSISTENCY_LIMIT;
  const minRequired = bestDay / (CONSISTENCY_LIMIT / 100);

  const winShare = m.avgWin || m.avgLoss ? (m.avgWin / (m.avgWin + Math.abs(m.avgLoss))) * 100 : 50;
  const totalVolumePnl = streak.winsPnl + Math.abs(streak.lossesPnl);
  const capitalWinShare = totalVolumePnl > 0 ? (streak.winsPnl / totalVolumePnl) * 100 : 50;

  const pf = pfLabel(m.profitFactor);
  const cur = streak.current;
  const payoffRatio = m.avgLoss !== 0 ? Math.abs(m.avgWin / m.avgLoss) : 0;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Rendimiento */}
      <div className="panel flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rendimiento
            </p>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", pf.tone)}>
              {pf.text}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-around gap-2">
            <div className="text-center">
              <p className="num text-3xl font-black tracking-tight">
                {Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "∞"}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Profit Factor</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Ratio {m.wins}G / {m.losses}P
              </p>
            </div>
            <div className="text-center">
              <Donut value={m.winRate} />
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-border/60 pt-2.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>Total operaciones</span>
          <span className="num font-bold text-foreground">{m.total}</span>
        </div>
      </div>

      {/* 2. Análisis de Operaciones (Ganadas vs Perdidas) */}
      <div className="panel flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ganadas vs Pérdidas
            </p>
            <span className="text-[11px] font-medium text-muted-foreground">
              Ratio R/B: <strong className="num text-foreground">{payoffRatio ? payoffRatio.toFixed(2) : "—"}</strong>
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-profit/25 bg-profit/10 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-profit flex items-center gap-0.5">
                  <ArrowUpRight className="size-3.5" /> Media Ganada
                </span>
              </div>
              <p className="num mt-1 text-base font-bold text-profit tabular-nums">
                +{formatCurrency(m.avgWin, false)}
              </p>
            </div>

            <div className="rounded-xl border border-loss/25 bg-loss/10 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-loss flex items-center gap-0.5">
                  <ArrowDownRight className="size-3.5" /> Media Perdida
                </span>
              </div>
              <p className="num mt-1 text-base font-bold text-loss tabular-nums">
                −{formatCurrency(Math.abs(m.avgLoss), false)}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
              <span className="text-profit">{winShare.toFixed(0)}% Ganancia media</span>
              <span className="text-loss">{(100 - winShare).toFixed(0)}% Pérdida media</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              <div className="bg-profit transition-all" style={{ width: `${winShare}%` }} />
              <div className="flex-1 bg-loss transition-all" />
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-border/60 pt-2.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground truncate">
            Mejor: <strong className="num text-profit font-semibold">+{formatCurrency(m.bestTrade, false)}</strong>
          </span>
          <span className="text-muted-foreground truncate">
            Peor: <strong className="num text-loss font-semibold">−{formatCurrency(Math.abs(m.worstTrade), false)}</strong>
          </span>
        </div>
      </div>

      {/* 3. Rachas y Capital (Destacado y muy visual) */}
      <div className="panel flex flex-col justify-between p-4 border-brand/30 bg-card shadow-xs">
        <div>
          {/* Header con Racha Actual Vibrante */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Zap className="size-3.5 text-brand" /> Rachas & Capital
            </p>
            {cur.type === "win" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-profit/40 bg-profit/15 px-2.5 py-0.5 text-[11px] font-black text-profit shadow-xs animate-pulse">
                <Flame className="size-3.5 fill-current" />
                {cur.count} {cur.count === 1 ? "ganada" : "ganadas"} (+{formatCurrency(cur.pnl, false)})
              </span>
            ) : cur.type === "loss" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-loss/40 bg-loss/15 px-2.5 py-0.5 text-[11px] font-black text-loss shadow-xs">
                <Snowflake className="size-3.5" />
                {cur.count} {cur.count === 1 ? "perdida" : "perdidas"} (−{formatCurrency(Math.abs(cur.pnl), false)})
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Sin racha activa
              </span>
            )}
          </div>

          {/* Comparativa Visual de Capital: Ganadas vs Pérdidas */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-profit/30 bg-profit/10 p-2.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-profit">
                  Total Ganado
                </span>
                <span className="rounded-full bg-profit/20 px-1.5 py-0.2 text-[9px] font-extrabold text-profit">
                  {streak.wins} ops
                </span>
              </div>
              <p className="num mt-1 text-base font-black text-profit tabular-nums leading-none">
                +{formatCurrency(streak.winsPnl, false)}
              </p>
            </div>

            <div className="rounded-xl border border-loss/30 bg-loss/10 p-2.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-loss">
                  Total Cedido
                </span>
                <span className="rounded-full bg-loss/20 px-1.5 py-0.2 text-[9px] font-extrabold text-loss">
                  {streak.losses} ops
                </span>
              </div>
              <p className="num mt-1 text-base font-black text-loss tabular-nums leading-none">
                −{formatCurrency(Math.abs(streak.lossesPnl), false)}
              </p>
            </div>
          </div>

          {/* Barra de Proporción de Capital */}
          <div className="mt-2.5">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="bg-profit transition-all" style={{ width: `${capitalWinShare}%` }} />
              <div className="flex-1 bg-loss transition-all" />
            </div>
          </div>
        </div>

        {/* Rachas Máximas */}
        <div className="mt-3 border-t border-border/60 pt-2.5 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
              <Flame className="size-3 text-profit" /> Máx. racha ganadora
            </span>
            <span className="font-semibold text-foreground">
              <span className="num font-bold">{streak.maxWin}</span> seguidas{" "}
              <strong className="num text-profit font-bold">
                (+{formatCurrency(streak.maxWinPnl, false)})
              </strong>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
              <Snowflake className="size-3 text-loss" /> Máx. racha perdedora
            </span>
            <span className="font-semibold text-foreground">
              <span className="num font-bold">{streak.maxLoss}</span> seguidas{" "}
              <strong className="num text-loss font-bold">
                (−{formatCurrency(Math.abs(streak.maxLossPnl), false)})
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* 4. Consistencia */}
      <div className="panel flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Consistencia
            </p>
            <div className="flex items-center gap-2">
              <span className="num text-sm font-bold">
                {consistency.toFixed(0)}
                <span className="text-xs font-medium text-muted-foreground">/{CONSISTENCY_LIMIT}%</span>
              </span>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full transition-all", ok ? "bg-profit" : "bg-loss")}
              style={{ width: `${Math.min(100, consistency)}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span
              className={cn(
                "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
                ok ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
              )}
            >
              {ok ? "Cumple regla" : "Excede límite"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Máx. día: {CONSISTENCY_LIMIT}%
            </span>
          </div>
        </div>

        <dl className="mt-3 space-y-1.5 border-t border-border/60 pt-2.5 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Mejor día</dt>
            <dd className="num font-bold text-foreground">{formatCurrency(bestDay)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Beneficio neto</dt>
            <dd className={cn("num font-bold", totalProfit >= 0 ? "text-profit" : "text-loss")}>
              {formatCurrency(totalProfit, true)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Beneficio mín. req.</dt>
            <dd className="num font-semibold text-muted-foreground">{formatCurrency(minRequired)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
