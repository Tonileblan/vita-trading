import { AlertTriangle, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
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
 * Mide el margen de vida restante antes de que la cuenta toque el suelo de liquidación.
 * Si remaining > 600: Verde. Si <= 600: Ámbar. Si <= 0 o rota: Rojo.
 */
export function DrawdownProgress({
  status,
  threshold = 600,
  className,
  variant = "card",
}: DrawdownProgressProps) {
  const isBreached = status.breached || status.remaining <= 0;
  const isLowHealth = !isBreached && status.remaining <= threshold;
  const isHealthy = !isBreached && !isLowHealth;

  const typeLabel = TYPE_SHORT_LABELS[status.type] ?? status.label;
  const healthPct = Math.min(100, Math.max(0, (status.remaining / (status.limit || 1)) * 100));

  // Color de texto y barra
  const colorClass = isBreached || isLowHealth
    ? "text-rose-600 dark:text-rose-400"
    : "text-emerald-600 dark:text-emerald-400";

  const barBgClass = isBreached || isLowHealth
    ? "bg-rose-500"
    : "bg-emerald-500";

  // VARIANTE COMPACTA (para tablas y listas)
  if (variant === "compact") {
    return (
      <div className={cn("space-y-1 min-w-[100px]", className)}>
        <div className="flex items-center justify-between text-xs">
          <span className={cn("num font-bold font-mono text-xs", colorClass)}>
            {formatCurrency(status.remaining)}
          </span>
          <span className={cn("text-[10px] font-mono font-semibold", colorClass)}>
            {healthPct.toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-muted/40">
          <div
            className={cn("h-full transition-all duration-300 rounded-full", barBgClass)}
            style={{ width: `${healthPct}%` }}
          />
        </div>
      </div>
    );
  }

  // VARIANTE DETALLADA (para vista individual de cuenta)
  if (variant === "detail") {
    return (
      <div
        className={cn(
          "rounded-xl border p-4.5 space-y-4 transition-all shadow-xs bg-card",
          isBreached
            ? "border-rose-500/40 bg-rose-500/5 ring-1 ring-rose-500/20"
            : isLowHealth
              ? "border-rose-500/40 bg-rose-500/10 ring-1 ring-rose-500/20 shadow-rose-500/5"
              : "border-border/80",
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            {isBreached ? (
              <ShieldAlert className="size-4 text-rose-500 shrink-0" />
            ) : isLowHealth ? (
              <AlertTriangle className="size-4 text-rose-500 shrink-0 animate-pulse" />
            ) : (
              <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
            )}
            <span className="text-sm font-bold text-foreground">Colchón de Drawdown</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              {typeLabel}
            </span>
            {status.frozen && (
              <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                Suelo congelado
              </span>
            )}
          </div>

          {isBreached ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
              <AlertTriangle className="size-3.5" /> Cuenta rota
            </span>
          ) : isLowHealth ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/40 animate-drawdown-corner">
              <AlertTriangle className="size-3.5 animate-pulse" /> DD Crítico (&lt; {formatCurrency(threshold)})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="size-3.5" /> Saludable ({healthPct.toFixed(0)}%)
            </span>
          )}
        </div>

        {/* Hero metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg bg-muted/30 p-3 border border-border/50">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Margen Restante
            </p>
            <p className={cn("num text-lg sm:text-xl font-black font-mono tracking-tight", colorClass)}>
              {formatCurrency(status.remaining)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Suelo de Liquidación
            </p>
            <p className="num text-base sm:text-lg font-bold font-mono text-foreground">
              {formatCurrency(status.floor)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Máximo Alcanzado
            </p>
            <p className="num text-base sm:text-lg font-bold font-mono text-foreground">
              {formatCurrency(status.reference)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Límite Drawdown
            </p>
            <p className="num text-base sm:text-lg font-bold font-mono text-muted-foreground">
              {formatCurrency(status.limit)}
            </p>
          </div>
        </div>

        {/* Barra de Progreso de Salud */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground text-[11px]">
              {healthPct.toFixed(1)}% de margen de supervivencia
            </span>
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              Consumido: {formatCurrency(status.used)} / {formatCurrency(status.limit)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-muted/40">
            <div
              className={cn("h-full transition-all duration-300 rounded-full", barBgClass)}
              style={{ width: `${healthPct}%` }}
            />
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

  // VARIANTE CARD (para tarjetas de cuentas en la vista /cuentas)
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 space-y-2.5 transition-all shadow-xs bg-muted/20",
        isBreached
          ? "border-rose-500/40 bg-rose-500/5 ring-1 ring-rose-500/20"
          : isLowHealth
            ? "border-rose-500/40 bg-rose-500/10 ring-1 ring-rose-500/20 shadow-rose-500/5"
            : "border-border/80",
        className,
      )}
    >
      {/* Top row: Drawdown tag + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Drawdown
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground/80 uppercase font-mono">
            {typeLabel}
          </span>
          {status.frozen && (
            <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
              Fijo
            </span>
          )}
        </div>

        {isBreached ? (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
            <AlertTriangle className="size-3" /> Rota
          </span>
        ) : isLowHealth ? (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/40 animate-drawdown-corner">
            <AlertTriangle className="size-3 animate-pulse" /> DD Crítico
          </span>
        ) : (
          <span className={cn("text-[10px] font-mono font-bold", colorClass)}>
            {healthPct.toFixed(0)}% salud
          </span>
        )}
      </div>

      {/* Hero numbers: Margen restante vs Suelo */}
      <div className="flex items-end justify-between gap-2 pt-0.5">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Margen restante
          </span>
          <p className={cn("num text-lg font-black font-mono tracking-tight leading-none mt-0.5", colorClass)}>
            {formatCurrency(status.remaining)}
          </p>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Suelo
          </span>
          <p className="num text-xs font-bold font-mono text-foreground mt-0.5">
            {formatCurrency(status.floor)}
          </p>
        </div>
      </div>

      {/* Visual Bar: Mide la salud restante */}
      <div className="space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-muted/40">
          <div
            className={cn("h-full transition-all duration-300 rounded-full", barBgClass)}
            style={{ width: `${healthPct}%` }}
          />
        </div>

        {/* Micro-footer info */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <span>Consumido: {formatCurrency(status.used)}</span>
          <span>Límite: {formatCurrency(status.limit)}</span>
        </div>
      </div>
    </div>
  );
}
