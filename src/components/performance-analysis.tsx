import { useMemo } from "react";
import { Flame, Snowflake } from "lucide-react";
import type { Trade } from "@/lib/types";
import { computeMetrics, computeStreaks, formatCurrency } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const CONSISTENCY_LIMIT = 15; // % máximo que puede pesar el mejor día

function Donut({ value }: { value: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative size-32">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="12" className="stroke-loss" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          className="stroke-profit"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-xl font-bold">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function pfLabel(pf: number) {
  if (!Number.isFinite(pf)) return { text: "Excelente", tone: "text-profit" };
  if (pf >= 2) return { text: "Excelente", tone: "text-profit" };
  if (pf >= 1.5) return { text: "Bueno", tone: "text-profit" };
  if (pf >= 1) return { text: "Ajustado", tone: "text-muted-foreground" };
  return { text: "Pobre", tone: "text-loss" };
}

export function PerformanceAnalysis({ trades }: { trades: Trade[] }) {
  const m = useMemo(() => computeMetrics(trades), [trades]);
  const streak = useMemo(() => computeStreaks(trades), [trades]);

  const { bestDay, totalProfit } = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const t of trades) {
      const key = (t.closedAt || t.openedAt).slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + t.pnl);
    }
    const best = Math.max(0, ...Array.from(byDay.values()));
    return { bestDay: best, totalProfit: trades.reduce((s, t) => s + t.pnl, 0) };
  }, [trades]);

  const consistency = totalProfit > 0 ? (bestDay / totalProfit) * 100 : 0;
  const ok = totalProfit > 0 && consistency <= CONSISTENCY_LIMIT;
  const minRequired = bestDay / (CONSISTENCY_LIMIT / 100);

  const winShare = m.avgWin || m.avgLoss ? (m.avgWin / (m.avgWin + Math.abs(m.avgLoss))) * 100 : 50;
  const pf = pfLabel(m.profitFactor);
  const cur = streak.current;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Rendimiento */}
      <div className="panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Rendimiento
        </p>
        <div className="mt-4 flex items-center justify-around gap-3">
          <div className="text-center">
            <p className="num text-2xl font-bold">
              {Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "∞"}
            </p>
            <p className={cn("text-xs font-medium", pf.tone)}>{pf.text}</p>
            <p className="mt-3 text-xs text-muted-foreground">Profit Factor</p>
          </div>
          <div className="text-center">
            <Donut value={m.winRate} />
            <p className="mt-1 text-xs text-muted-foreground">Win Rate</p>
          </div>
        </div>
      </div>

      {/* 2. Operaciones */}
      <div className="panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Análisis de operaciones
        </p>
        <div className="mt-6 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Media ganada <span className="num font-semibold text-foreground">{formatCurrency(m.avgWin)}</span>
          </span>
          <span className="text-muted-foreground">
            <span className="num font-semibold text-foreground">{formatCurrency(m.avgLoss)}</span> Media perdida
          </span>
        </div>
        <div className="mt-3 flex h-6 overflow-hidden rounded-full bg-muted">
          <div className="bg-profit" style={{ width: `${winShare}%` }} />
          <div className="flex-1 bg-loss" />
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Mejor <span className="num font-semibold text-profit">{formatCurrency(m.bestTrade)}</span>
          </span>
          <span className="text-muted-foreground">
            <span className="num font-semibold text-loss">{formatCurrency(m.worstTrade)}</span> Peor
          </span>
        </div>
      </div>

      {/* 3. Rachas y Capital */}
      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rachas y Capital
          </p>
          <div className="flex items-center gap-1.5">
            {cur.type === "win" ? (
              <span className="flex items-center gap-1 rounded-full bg-profit/15 px-2 py-0.5 text-[11px] font-bold text-profit">
                <Flame className="size-3.5" />
                {cur.count} {cur.count === 1 ? "ganada" : "ganadas"}
              </span>
            ) : cur.type === "loss" ? (
              <span className="flex items-center gap-1 rounded-full bg-loss/15 px-2 py-0.5 text-[11px] font-bold text-loss">
                <Snowflake className="size-3.5" />
                {cur.count} {cur.count === 1 ? "perdida" : "perdidas"}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">Sin racha activa</span>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Racha actual</span>
          <span
            className={cn(
              "num text-base font-bold tabular-nums",
              cur.pnl > 0 ? "text-profit" : cur.pnl < 0 ? "text-loss" : "text-muted-foreground",
            )}
          >
            {cur.pnl > 0 ? "+" : cur.pnl < 0 ? "−" : ""}
            {formatCurrency(Math.abs(cur.pnl), false)}
          </span>
        </div>

        <dl className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-profit" />
              Ganadas seguidas
            </dt>
            <dd className="text-right">
              <span className="num text-xs font-semibold">{streak.maxWin} seguidas</span>
              <span className="num ml-2 text-xs font-bold text-profit tabular-nums">
                +{formatCurrency(streak.maxWinPnl, false)}
              </span>
            </dd>
          </div>

          <div className="flex items-center justify-between">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-loss" />
              Pérdidas seguidas
            </dt>
            <dd className="text-right">
              <span className="num text-xs font-semibold">{streak.maxLoss} seguidas</span>
              <span className="num ml-2 text-xs font-bold text-loss tabular-nums">
                −{formatCurrency(Math.abs(streak.maxLossPnl), false)}
              </span>
            </dd>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            <span>
              Ganadas: <strong className="num text-profit font-semibold">+{formatCurrency(streak.winsPnl, false)}</strong> ({streak.wins})
            </span>
            <span>
              Pérdidas: <strong className="num text-loss font-semibold">−{formatCurrency(Math.abs(streak.lossesPnl), false)}</strong> ({streak.losses})
            </span>
          </div>
        </dl>
      </div>

      {/* 4. Consistencia */}
      <div className="panel p-4">
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
            className={cn("h-full", ok ? "bg-profit" : "bg-loss")}
            style={{ width: `${Math.min(100, consistency)}%` }}
          />
        </div>
        <span
          className={cn(
            "mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold",
            ok ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
          )}
        >
          {ok ? "Cumple" : "Todavía no"}
        </span>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Mejor día</dt>
            <dd className="num font-semibold">{formatCurrency(bestDay)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Beneficio actual</dt>
            <dd className="num font-semibold">{formatCurrency(totalProfit)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Beneficio mín. req.</dt>
            <dd className="num font-semibold">{formatCurrency(minRequired)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
