import { Flame, Percent, Snowflake, Target, TrendingUp } from "lucide-react";
import type { Metrics } from "@/lib/metrics";
import { formatCurrency } from "@/lib/metrics";
import { cn } from "@/lib/utils";

function Card({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  tone?: "neutral" | "profit" | "loss";
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="size-4 text-brand-soft" />
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
    </div>
  );
}

export function KpiCards({ metrics }: { metrics: Metrics }) {
  const pf = metrics.profitFactor;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        label="PnL Total"
        value={formatCurrency(metrics.totalPnl, true)}
        sub={`${metrics.total} operaciones cerradas`}
        icon={TrendingUp}
        tone={metrics.totalPnl >= 0 ? "profit" : "loss"}
      />
      <Card
        label="Win Rate"
        value={`${metrics.winRate.toFixed(1)}%`}
        sub={`${metrics.wins}G / ${metrics.losses}P`}
        icon={Percent}
      />
      <Card
        label="Profit Factor"
        value={Number.isFinite(pf) ? pf.toFixed(2) : "∞"}
        sub={`Media G ${formatCurrency(metrics.avgWin)} · P ${formatCurrency(metrics.avgLoss)}`}
        icon={Target}
        tone={pf >= 1 ? "profit" : "loss"}
      />
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

    </div>
  );
}
