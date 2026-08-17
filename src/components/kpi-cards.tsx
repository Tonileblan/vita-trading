import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Flame, Snowflake, TrendingUp } from "lucide-react";
import type { Metrics } from "@/lib/metrics";
import type { Trade } from "@/lib/types";
import { computeStreaks, filterByDays, formatCurrency } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const STREAK_RANGES = [
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "180", label: "180d" },
  { key: "all", label: "Todo" },
] as const;

type StreakRange = (typeof STREAK_RANGES)[number]["key"];

function streakLabel(cur: { type: "win" | "loss" | "none"; count: number }) {
  if (cur.type === "none") return "Sin racha";
  const noun =
    cur.type === "win"
      ? cur.count === 1
        ? "ganada"
        : "ganadas"
      : cur.count === 1
        ? "perdida"
        : "perdidas";
  return `${cur.count} ${noun}`;
}

export function KpiCards({
  metrics,
  scope = "all",
  trades,
  fusionEquity,
  fusionInitial,
}: {
  metrics: Metrics;
  scope?: "all" | "funded" | "real";
  trades?: Trade[] | undefined;
  fusionEquity?: number | undefined;
  fusionInitial?: number | undefined;
}) {
  const [streakRange, setStreakRange] = useState<StreakRange>("30");

  const pnlLabel = fusionEquity !== undefined
    ? "Capital"
    : scope === "funded"
      ? "PnL Fondeo"
      : scope === "real"
        ? "PnL Real"
        : "PnL Total";
  const pnlValue = fusionEquity !== undefined ? fusionEquity : metrics.totalPnl;
  const fmtNoSign = (v: number) =>
    `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const streakTrades = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    if (streakRange === "all") return trades;
    const days = Number(streakRange);
    return Number.isFinite(days) && days > 0 ? filterByDays(trades, days) : trades;
  }, [trades, streakRange]);
  const streak = useMemo(() => computeStreaks(streakTrades), [streakTrades]);
  const cur = streak.current;
  const StreakIcon = cur.type === "loss" ? Snowflake : Flame;
  const streakTone =
    cur.type !== "none"
      ? cur.type === "win"
        ? ("profit" as const)
        : ("loss" as const)
      : undefined;

  const noOps = streak.wins === 0 && streak.losses === 0;

  return (
    <div className="panel p-4">
      {/* ---- Bloque PnL ---- */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {pnlLabel}
        </span>
        <TrendingUp className="size-4 text-brand-soft" />
      </div>
      <div
        className={cn(
          "num mt-2 text-2xl font-bold",
          fusionEquity === undefined && pnlValue >= 0 && "text-profit",
          fusionEquity === undefined && pnlValue < 0 && "text-loss",
        )}
      >
        {fusionEquity !== undefined && fusionInitial !== undefined
          ? fmtNoSign(fusionInitial)
          : formatCurrency(pnlValue, true)}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {fusionEquity === undefined ? `${metrics.total} operaciones cerradas` : "Capital inicial"}
      </p>
      {fusionEquity !== undefined && (
        <div className="mt-1 text-lg font-bold tabular-nums">
          <span className={metrics.totalPnl >= 0 ? "text-profit" : "text-loss"}>
            {metrics.totalPnl >= 0 ? "+" : "−"} {formatCurrency(Math.abs(metrics.totalPnl), false)}
          </span>
        </div>
      )}

      {/* ---- Divisor ---- */}
      <div className="my-3 h-px bg-border" />

      {/* ---- Bloque Racha ---- */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Racha actual
        </span>
        <StreakIcon className="size-4 text-brand-soft" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {noOps ? (
          <span className="text-2xl font-bold tabular-nums">Sin operaciones</span>
        ) : (
          <span
            className={cn(
              "num inline-flex items-center gap-3 text-2xl font-bold tabular-nums",
              streakTone === "profit" && "text-profit",
              streakTone === "loss" && "text-loss",
            )}
          >
            <span className="inline-flex items-center gap-1 text-profit">
              <ArrowUp className="size-4" />
              {streak.wins}
            </span>
            <span className="inline-flex items-center gap-1 text-loss">
              <ArrowDown className="size-4" />
              {streak.losses}
            </span>
          </span>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">
          {noOps ? "" : `Racha: ${streakLabel(cur)}`}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          {STREAK_RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setStreakRange(r.key)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                streakRange === r.key
                  ? "bg-brand text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          Mejor racha: {streak.maxWin} ganadas · {streak.maxLoss} perdidas
        </p>
      </div>
    </div>
  );
}
