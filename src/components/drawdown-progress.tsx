import { AlertTriangle, ShieldAlert } from "lucide-react";
import { formatCurrency, type DrawdownStatus } from "@/lib/metrics";
import { cn } from "@/lib/utils";

interface DrawdownProgressProps {
  status: DrawdownStatus;
  threshold?: number;
  className?: string;
  variant?: "card" | "detail" | "compact";
}

const TYPE_SHORT_LABELS: Record<NonNullable<DrawdownStatus["type"]>, string> = {
  static: "Estático",
  trailing: "Trailing",
  eod: "EOD",
};

/**
 * Componente visual para mostrar el estado y colchón de Drawdown
 * con mínima carga de texto y máxima claridad visual del margen restante.
 */
export function DrawdownProgress({
  status,
  threshold = 600,
  className,
  variant = "card",
}: DrawdownProgressProps) {
  const isBreached = status.breached;
  const isCritical = !isBreached && (status.remaining < threshold || status.pct >= 75);
  const isWarning = !isBreached && !isCritical && status.pct >= 50;

  const typeLabel = TYPE_SHORT_LABELS[status.type] ?? status.label;

  const healthPct = Math.min(100, Math.max(0, (status.remaining / (status.limit || 1)) * 100));

  if (variant === "compact") {
    return (
      <div className={cn("space-y-1", className)}>
        <div className="flex items-center justify-between text-xs">
          <span
            className={cn(
              "num text-xs font-bold",
              isBreached || isCritical ? "text-loss" : isWarning ? "text-brand" : "text-profit",
            )}
          >
            {formatCurrency(status.remaining)}
          </span>
          <span
            className={cn(
              "text-[10px] font-mono",
              isBreached || isCritical ? "text-loss" : isWarning ? "text-brand" : "text-profit",
            )}
          >
            {healthPct.toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className={cn(
              "h-full transition-all duration-300 rounded-full",
              isBreached || isCritical ? "bg-loss" : isWarning ? "bg-brand" : "bg-profit",
            )}
            style={{ width: `${healthPct}%` }}
          />
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div
        className={cn(
          "rounded-xl border p-4 space-y-3.5 transition-colors",
          isBreached
            ? "border-loss/60 bg-loss/10 shadow-xs"
            : isCritical
              ? "border-loss/40 bg-loss/[0.06] dark:bg-loss/[0.12] shadow-xs"
              : "border-border/80 bg-card/60",
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ShieldAlert className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-bold text-foreground">Drawdown</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {typeLabel}
            </span>
            {status.frozen && (
              <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                Suelo fijo
              </span>
            )}
          </div>

          {isBreached ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-loss/15 px-2 py-0.5 text-xs font-bold text-loss border border-loss/30 animate-pulse">
              <AlertTriangle className="size-3.5" /> Cuenta rota
            </span>
          ) : isCritical ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-loss/15 px-2 py-0.5 text-xs font-bold text-loss border border-loss/30">
              <AlertTriangle className="size-3.5" /> Crítico (&lt; {formatCurrency(threshold)})
            </span>
          ) : (
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground num">
              {status.pct.toFixed(0)}% usado
            </span>
          )}
        </div>

        {/* Hero metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg bg-muted/25 p-3 border border-border/40">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Colchón restante
            </p>
            <p
              className={cn(
                "num text-base sm:text-lg font-black tracking-tight",
                isBreached || isCritical ? "text-loss" : "text-foreground",
              )}
            >
              {formatCurrency(status.remaining)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Suelo liquidación
            </p>
            <p className="num text-base font-bold text-foreground">
              {formatCurrency(status.floor)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Referencia
            </p>
            <p className="num text-base font-bold text-foreground">
              {formatCurrency(status.reference)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Límite total
            </p>
            <p className="num text-base font-bold text-foreground">
              {formatCurrency(status.limit)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className={cn(
                "h-full transition-all duration-300 rounded-full",
                isBreached || isCritical ? "bg-loss" : isWarning ? "bg-brand" : "bg-profit",
              )}
              style={{ width: `${Math.min(100, Math.max(0, status.pct))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground num">
            <span>Consumido: {formatCurrency(status.used)} ({status.pct.toFixed(1)}%)</span>
            <span>Margen restante: {formatCurrency(status.remaining)}</span>
          </div>
        </div>

        {status.breachedAt && !status.breached && (
          <p className="text-xs text-muted-foreground border-t border-border/40 pt-2">
            Aviso: Cierre por debajo del suelo el {new Date(status.breachedAt).toLocaleDateString("es-ES")} (recuperada).
          </p>
        )}
      </div>
    );
  }

  // Variant "card" (por defecto)
  return (
    <div
      className={cn(
        "rounded-xl border p-3 space-y-2.5 transition-colors",
        isBreached
          ? "border-loss/60 bg-loss/10"
          : isCritical
            ? "border-loss/40 bg-loss/[0.05] dark:bg-loss/[0.10]"
            : "border-border/80 bg-muted/20",
        className,
      )}
    >
      {/* Top row: Drawdown tag + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Drawdown
          </span>
          <span className="rounded bg-muted/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/80 uppercase">
            {typeLabel}
          </span>
          {status.frozen && (
            <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
              Fijo
            </span>
          )}
        </div>

        {isBreached ? (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-loss/15 text-loss border border-loss/30 animate-pulse">
            <AlertTriangle className="size-3" /> Rota
          </span>
        ) : isCritical ? (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-loss/15 text-loss border border-loss/30">
            <AlertTriangle className="size-3" /> Crítico
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-muted-foreground num">
            {status.pct.toFixed(0)}% usado
          </span>
        )}
      </div>

      {/* Hero numbers: Colchón restante vs Suelo */}
      <div className="flex items-end justify-between gap-2 pt-0.5">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Colchón restante
          </span>
          <p
            className={cn(
              "num text-lg font-black tracking-tight leading-none mt-0.5",
              isBreached || isCritical ? "text-loss" : "text-foreground",
            )}
          >
            {formatCurrency(status.remaining)}
          </p>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Suelo
          </span>
          <p className="num text-xs font-bold text-foreground mt-0.5">
            {formatCurrency(status.floor)}
          </p>
        </div>
      </div>

      {/* Visual Bar */}
      <div className="space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-muted/40">
          <div
            className={cn(
              "h-full transition-all duration-300 rounded-full",
              isBreached || isCritical
                ? "bg-loss"
                : isWarning
                  ? "bg-brand"
                  : "bg-profit",
            )}
            style={{ width: `${Math.min(100, Math.max(0, status.pct))}%` }}
          />
        </div>

        {/* Micro-footer info */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 num">
          <span>Consumido: {formatCurrency(status.used)}</span>
          <span>Límite: {formatCurrency(status.limit)}</span>
        </div>
      </div>
    </div>
  );
}
