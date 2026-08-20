import { CheckCircle2, DollarSign, Sparkles, Target, Trophy } from "lucide-react";
import { formatCurrency, type TargetStatus } from "@/lib/metrics";
import { cn } from "@/lib/utils";

/** Barra de progreso hacia el objetivo de evaluación o umbral de retiros en Live */
export function TargetProgress({
  status,
  compact = false,
  className,
}: {
  status: TargetStatus;
  compact?: boolean;
  className?: string;
}) {
  const isLive = status.phase === "live";
  const pctClamped = Math.min(100, Math.max(0, status.pct));

  // Variante Compacta (para sidebar / tablas)
  if (compact) {
    return (
      <div className={cn("mt-1.5 space-y-1", className)}>
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-muted-foreground flex items-center gap-1">
            {isLive ? <DollarSign className="size-3 text-emerald-500" /> : <Target className="size-3 text-sky-500" />}
            {isLive ? "Retiro" : "Target"}
          </span>
          <span className={cn("font-bold", status.reached ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
            {pctClamped.toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted/60 dark:bg-muted/40">
          <div
            className={cn(
              "h-full transition-all duration-300 rounded-full",
              status.reached ? "bg-emerald-500" : isLive ? "bg-emerald-500/70" : "bg-sky-500",
            )}
            style={{ width: `${pctClamped}%` }}
          />
        </div>
      </div>
    );
  }

  // Variante Card Completa
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 space-y-2.5 transition-all shadow-xs bg-muted/20",
        status.reached
          ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20"
          : "border-border/80",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isLive ? (
            <DollarSign className="size-3.5 text-emerald-500 shrink-0" />
          ) : (
            <Target className="size-3.5 text-sky-500 shrink-0" />
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {isLive ? "Umbral de Retiros" : "Objetivo de Evaluación"}
          </span>
        </div>

        {status.reached ? (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="size-3" /> {isLive ? "Retiro Listo" : "Superada"}
          </span>
        ) : (
          <span className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400">
            {pctClamped.toFixed(0)}% completado
          </span>
        )}
      </div>

      {/* Hero numbers: Actual vs Objetivo */}
      <div className="flex items-end justify-between gap-2 pt-0.5">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Balance Actual
          </span>
          <p className="num text-base sm:text-lg font-black font-mono tracking-tight leading-none mt-0.5 text-foreground">
            {formatCurrency(status.balance)}
          </p>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {isLive ? "Suelo de Retiro" : "Meta Objetivo"}
          </span>
          <p className="num text-xs font-bold font-mono text-foreground mt-0.5">
            {formatCurrency(status.target)}
          </p>
        </div>
      </div>

      {/* Visual Bar */}
      <div className="space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-muted/40">
          <div
            className={cn(
              "h-full transition-all duration-300 rounded-full",
              status.reached ? "bg-emerald-500" : isLive ? "bg-emerald-500/80" : "bg-sky-500",
            )}
            style={{ width: `${pctClamped}%` }}
          />
        </div>

        {/* Micro-footer info */}
        <div className="flex items-center justify-between text-[10px] font-mono">
          {status.reached ? (
            isLive ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Sparkles className="size-3" />
                Retirable: {formatCurrency(Math.max(0, status.balance - status.target))}
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Trophy className="size-3" />
                Evaluación superada con éxito
              </span>
            )
          ) : (
            <>
              <span className="text-muted-foreground">
                Faltan: <strong className="text-foreground">{formatCurrency(status.remaining)}</strong>
              </span>
              <span className="text-muted-foreground">{pctClamped.toFixed(1)}%</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Etiqueta EVAL / LIVE para cuentas de fondeo, estilo consistente con GO */
export function PhaseChip({ phase }: { phase: "eval" | "live" }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase border shadow-2xs",
        phase === "live"
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
          : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
      )}
    >
      {phase === "live" ? "Live" : "Eval"}
    </span>
  );
}
