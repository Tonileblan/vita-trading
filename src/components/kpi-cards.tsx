import { useState } from "react";
import { ArrowDown, ArrowUp, Flame, Snowflake, TrendingUp } from "lucide-react";
import type { Metrics } from "@/lib/metrics";
import type { Trade } from "@/lib/types";
import { computeStreaks, filterByDays, formatCurrency } from "@/lib/metrics";
import { cn } from "@/lib/utils";

function Card({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
  children,
  headerExtra,
}: {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  icon: React.ElementType;
  tone?: "neutral" | "profit" | "loss";
  children?: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {headerExtra ?? <Icon className="size-4 text-brand-soft" />}
      </div>
      <div
        className={cn(
          "num mt-3 text-2xl font-bold",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
        )}
      >
        {value}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      {children}
    </div>
  );
}

const STREAK_RANGES = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "180d", label: "180D", days: 180 },
] as const;

function StreakCard({ trades }: { trades: Trade[] }) {
  const [range, setRange] = useState<(typeof STREAK_RANGES)[number]["key"]>("30d");
  const days = STREAK_RANGES.find((r) => r.key === range)!.days;
  const info = computeStreaks(filterByDays(trades, days));
  const cur = info.current;


  const rangeButtons = (
    <div className="flex gap-1">
      {STREAK_RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => setRange(r.key)}
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-semibold transition-colors",
            range === r.key
              ? "bg-brand text-primary-foreground"
              : "border border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  const streakLabel =
    cur.type === "none"
      ? "Sin racha"
      : `${cur.count} ${
          cur.type === "win"
            ? cur.count === 1
              ? "ganada"
              : "ganadas"
            : cur.count === 1
              ? "perdida"
              : "perdidas"
        }`;

  return (
    <Card
      label="Racha actual"
      value={
        info.wins === 0 && info.losses === 0 ? (
          "Sin operaciones"
        ) : (
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-profit">
              <ArrowUp className="size-4" />
              {info.wins}
            </span>
            <span className="inline-flex items-center gap-1 text-loss">
              <ArrowDown className="size-4" />
              {info.losses}
            </span>
          </span>
        )
      }
      sub={`Racha: ${streakLabel}`}
      icon={cur.type === "loss" ? Snowflake : Flame}
      headerExtra={rangeButtons}
      {...(cur.type !== "none"
        ? { tone: cur.type === "win" ? ("profit" as const) : ("loss" as const) }
        : {})}
    >
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Mejor racha: {info.maxWin} ganadas · {info.maxLoss} perdidas
      </p>
    </Card>
  );
}

export function KpiCards({
  metrics,
  scope = "all",
  trades,
  fusionEquity,
}: {
  metrics: Metrics;
  scope?: "all" | "funded" | "real";
  trades?: Trade[];
  fusionEquity?: number;
}) {
  const pnlLabel = fusionEquity !== undefined
    ? "Capital + PnL"
    : scope === "funded"
      ? "PnL Fondeo"
      : scope === "real"
        ? "PnL Real"
        : "PnL Total";
  const pnlValue = fusionEquity !== undefined ? fusionEquity : metrics.totalPnl;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card
        label={pnlLabel}
        value={formatCurrency(pnlValue, true)}
        sub={`${metrics.total} operaciones cerradas`}
        icon={TrendingUp}
        tone={pnlValue >= 0 ? "profit" : "loss"}
      />
      {trades ? <StreakCard trades={trades} /> : (
        <Card
          label="Racha actual"
          value={
            metrics.streak.type === "none"
              ? "Sin racha"
              : `${metrics.streak.count} ${
                  metrics.streak.type === "win"
                    ? metrics.streak.count === 1
                      ? "ganada"
                      : "ganadas"
                    : metrics.streak.count === 1
                      ? "perdida"
                      : "perdidas"
                }`
          }
          sub={`Mejor ${formatCurrency(metrics.bestTrade)} · Peor ${formatCurrency(metrics.worstTrade)}`}
          icon={metrics.streak.type === "loss" ? Snowflake : Flame}
          {...(metrics.streak.type !== "none"
            ? { tone: metrics.streak.type === "win" ? ("profit" as const) : ("loss" as const) }
            : {})}
        />
      )}
    </div>
  );
}
