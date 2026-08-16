import { Target } from "lucide-react";
import { formatCurrency, type TargetStatus } from "@/lib/metrics";
import { cn } from "@/lib/utils";

/** Barra de progreso hacia el objetivo de una cuenta de fondeo. */
export function TargetProgress({
  status,
  compact = false,
  className,
}: {
  status: TargetStatus;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div className={cn("mt-1", className)}>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full", status.reached ? "bg-profit" : "bg-brand")}
            style={{ width: `${status.pct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("mt-4", className)}>
      <div className="flex flex-wrap justify-between gap-x-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Target className="size-3" /> {status.label}
        </span>
        <span className="num">
          {formatCurrency(status.balance)} / {formatCurrency(status.target)}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full", status.reached ? "bg-profit" : "bg-brand")}
          style={{ width: `${status.pct}%` }}
        />
      </div>
      <p
        className={cn(
          "mt-1 text-xs",
          status.reached ? "font-semibold text-profit" : "text-muted-foreground",
        )}
      >
        {status.reached
          ? status.phase === "live"
            ? "Objetivo alcanzado: ya puedes solicitar retiro"
            : "Objetivo alcanzado: evaluación superada"
          : `Faltan ${formatCurrency(status.remaining)} (${status.pct.toFixed(0)}%)`}
      </p>
    </div>
  );
}

/** Etiqueta EVAL / LIVE para cuentas de fondeo. */
export function PhaseChip({ phase }: { phase: "eval" | "live" }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        phase === "live" ? "bg-profit/15 text-profit" : "bg-brand/15 text-brand-soft",
      )}
    >
      {phase === "live" ? "Live" : "Eval"}
    </span>
  );
}
