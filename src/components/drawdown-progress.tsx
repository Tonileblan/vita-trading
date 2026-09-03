import { AlertTriangle, Clock, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatCurrency, type DrawdownStatus } from "@/lib/metrics";
import { cn } from "@/lib/utils";

interface DrawdownProgressProps {
  status: DrawdownStatus;
  threshold?: number;
  className?: string;
  variant?: "card" | "detail" | "compact";
}

const TYPE_SHORT_LABELS: Record<NonNullable<DrawdownStatus["type"]>, string> = {
  trailing: "Trailing (Intraday)",
  eod: "EOD (Cierre)",
  static: "Estático",
};

/**
 * Componente visual para mostrar el estado y colchón de Drawdown Total y Límite Diario.
 * Mide el margen de vida restante antes de que la cuenta toque el suelo de liquidación.
 * Si remaining > 600: Verde (Saludable). Si <= 600: Ámbar. Si <= 0 o rota: Rojo.
 */
export function DrawdownProgress({
  status,
  threshold = 600,
  className,
  variant = "card",
}: DrawdownProgressProps) {
  const isMaxBreached = status.breached || status.remaining <= 0;
  const isDailyBreached = Boolean(status.hasDailyLimit && (status.dailyBreached || (status.dailyRemaining ?? 1) <= 0));
  const isBreached = isMaxBreached || isDailyBreached;

  const isLowHealthMax = !isMaxBreached && status.remaining <= threshold;
  const isLowHealthDaily = Boolean(
    status.hasDailyLimit &&
    !isDailyBreached &&
    (status.dailyRemaining ?? 9999) <= threshold / 2,
  );
  const isLowHealth = isLowHealthMax || isLowHealthDaily;

  const typeLabel = TYPE_SHORT_LABELS[status.type] ?? status.label;
  const healthPct = status.healthPct ?? Math.min(100, Math.max(0, (status.remaining / (status.limit || 1)) * 100));

  // Color de texto y barra usando el tono exacto de loss del tema
  const colorClass = isBreached || isLowHealth ? "text-loss" : "text-profit";
  const barBgClass = isBreached || isLowHealth ? "bg-loss" : "bg-profit";

  // VARIANTE COMPACTA (para tablas y listas)
  if (variant === "compact") {
    return (
      <div className={cn("space-y-1 min-w-[110px]", className)}>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[10px] text-muted-foreground font-medium">Le queda:</span>
          <span className={cn("num font-bold font-mono text-xs", colorClass)}>
            {formatCurrency(status.remaining)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <span>
            Límite: <strong className="text-foreground font-medium">{formatCurrency(status.limit)}</strong>
          </span>
          <span className={cn("font-semibold", colorClass)}>{healthPct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-muted/40">
          <div
            className={cn("h-full transition-all duration-300 rounded-full", barBgClass)}
            style={{ width: `${healthPct}%` }}
          />
        </div>
        {status.hasDailyLimit && status.dailyFloor !== undefined && (
          <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono">
            <span>Suelo Hoy:</span>
            <span className="font-semibold text-foreground/90">{formatCurrency(status.dailyFloor)}</span>
          </div>
        )}
      </div>
    );
  }

  // VARIANTE DETALLADA (para vista individual de cuenta /cuenta/$accountId)
  if (variant === "detail") {
    const dailyHealthPct = status.dailyHealthPct ?? 100;
    const dailyBarBgClass = isDailyBreached || isLowHealthDaily ? "bg-loss" : "bg-sky-500";

    return (
      <div
        className={cn(
          "rounded-xl border p-4.5 space-y-4.5 transition-all shadow-xs bg-card",
          isBreached || isLowHealth
            ? "border-loss/50 bg-loss/10 ring-1 ring-loss/20 shadow-loss/5"
            : "border-border/80",
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {isBreached ? (
              <ShieldAlert className="size-4.5 text-loss shrink-0" />
            ) : isLowHealth ? (
              <AlertTriangle className="size-4.5 text-loss shrink-0 animate-pulse" />
            ) : (
              <ShieldCheck className="size-4.5 text-profit shrink-0" />
            )}
            <span className="text-sm font-bold text-foreground">Control de Riesgo & Drawdown</span>
            <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              {typeLabel}
            </span>
            {status.frozen && (
              <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                Suelo congelado
              </span>
            )}
          </div>

          {isMaxBreached ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-loss/15 px-2.5 py-1 text-xs font-bold text-loss border border-loss/50 animate-pulse">
              <AlertTriangle className="size-3.5" /> Cuenta Rota (Límite Máximo)
            </span>
          ) : isDailyBreached ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-loss/15 px-2.5 py-1 text-xs font-bold text-loss border border-loss/50 animate-pulse">
              <AlertTriangle className="size-3.5" /> Límite Diario Roto
            </span>
          ) : isLowHealth ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-loss/15 px-2.5 py-1 text-xs font-bold text-loss border border-loss/50 animate-drawdown-corner">
              <AlertTriangle className="size-3.5 animate-pulse" /> DD Crítico (&lt; {formatCurrency(threshold)})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-profit/10 px-2.5 py-1 text-xs font-semibold text-profit border border-profit/20">
              <ShieldCheck className="size-3.5" /> Saludable ({healthPct.toFixed(0)}%)
            </span>
          )}
        </div>

        {/* Hero metrics: Margen, Límite, Suelo, Max, Bajada */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 rounded-lg bg-muted/30 p-3.5 border border-border/50">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Margen
            </p>
            <p className={cn("num text-lg sm:text-xl font-black font-mono tracking-tight", colorClass)}>
              {formatCurrency(status.remaining)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Límite Drawdown
            </p>
            <p className="num text-base sm:text-lg font-bold font-mono text-foreground">
              {formatCurrency(status.limit)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" title="Límite en el que se quema la cuenta">
              Suelo Liquidación
            </p>
            <p className="num text-base sm:text-lg font-bold font-mono text-foreground">
              {formatCurrency(status.floor)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Max Histórico
            </p>
            <p className="num text-base sm:text-lg font-bold font-mono text-foreground">
              {formatCurrency(status.highWatermark)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Bajada desde Max
            </p>
            <p
              className={cn(
                "num text-base sm:text-lg font-bold font-mono",
                status.used > 0 ? "text-loss" : "text-foreground",
              )}
            >
              {formatCurrency(status.used)}
            </p>
          </div>
        </div>

        {/* Barra de Progreso de Pérdida Total */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground text-[11px]">
              {healthPct.toFixed(1)}% de margen de supervivencia total
            </span>
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              Bajada: {formatCurrency(status.used)} / Límite: {formatCurrency(status.limit)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-muted/40">
            <div
              className={cn("h-full transition-all duration-300 rounded-full", barBgClass)}
              style={{ width: `${healthPct}%` }}
            />
          </div>
        </div>

        {/* SECCIÓN DE LÍMITE DIARIO (Si está configurado) */}
        {status.hasDailyLimit && (
          <div className="rounded-lg border border-border/60 bg-muted/15 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-sky-500" /> Límite de Pérdida Diaria (Sesión de Hoy)
              </span>
              <span className="text-xs font-mono font-bold text-foreground">
                Suelo Diario: <strong className="text-brand">{formatCurrency(status.dailyFloor ?? 0)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              <div>
                <p className="text-[10px] text-muted-foreground">Balance Inicio Día</p>
                <p className="font-mono font-bold">{formatCurrency(status.startOfDayBalance ?? 0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Límite Diario</p>
                <p className="font-mono font-bold text-muted-foreground">{formatCurrency(status.dailyLimit ?? 0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Pérdida Consumida Hoy</p>
                <p className={cn("font-mono font-bold", (status.dailyUsed ?? 0) > 0 ? "text-loss" : "text-foreground")}>
                  {formatCurrency(status.dailyUsed ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Margen Diario Restante</p>
                <p className={cn("font-mono font-bold", isDailyBreached || isLowHealthDaily ? "text-loss" : "text-profit")}>
                  {formatCurrency(status.dailyRemaining ?? 0)}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-muted/40">
                <div
                  className={cn("h-full transition-all duration-300 rounded-full", dailyBarBgClass)}
                  style={{ width: `${dailyHealthPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>{dailyHealthPct.toFixed(0)}% margen diario disponible</span>
                <span>Pérdida hoy: {formatCurrency(status.dailyUsed ?? 0)} / {formatCurrency(status.dailyLimit ?? 0)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // VARIANTE CARD (para tarjetas de cuentas en la vista /cuentas)
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 space-y-2.5 transition-all shadow-xs bg-muted/20",
        isBreached || isLowHealth
          ? "border-loss/50 bg-loss/10 ring-1 ring-loss/20 shadow-loss/5"
          : "border-border/80",
        className,
      )}
    >
      {/* Top row: Drawdown tag + health % */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Drawdown
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground/80 uppercase font-mono">
            {typeLabel}
          </span>
        </div>

        {isBreached ? (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-loss/15 text-loss border border-loss/50 animate-pulse">
            <AlertTriangle className="size-3" /> {isMaxBreached ? "Cuenta Rota" : "Límite Diario Roto"}
          </span>
        ) : isLowHealth ? (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-loss/15 text-loss border border-loss/50 animate-drawdown-corner">
            <AlertTriangle className="size-3 animate-pulse" /> DD Crítico
          </span>
        ) : (
          <span className="text-[10px] font-mono font-bold text-muted-foreground">
            {healthPct.toFixed(0)}%
          </span>
        )}
      </div>

      {/* Hero numbers: Margen restante vs Suelo de liquidación */}
      <div className="flex items-end justify-between gap-2 pt-0.5">
        <div>
          <p className={cn("num text-lg font-black font-mono tracking-tight leading-none", colorClass)}>
            {formatCurrency(status.remaining)}
          </p>
        </div>

        <div className="text-right">
          <p className="num text-xs font-bold font-mono text-foreground" title="Límite en el que se quema la cuenta">
            Suelo: {formatCurrency(status.floor)}
          </p>
        </div>
      </div>

      {/* Visual Bar: Mide la salud de Drawdown Total */}
      <div className="space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-muted/40">
          <div
            className={cn("h-full transition-all duration-300 rounded-full", barBgClass)}
            style={{ width: `${healthPct}%` }}
          />
        </div>

        {/* Micro-footer info */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <span>Max: {formatCurrency(status.highWatermark)}</span>
          <span className={status.used > 0 ? "text-loss font-semibold" : "text-muted-foreground"}>
            {status.used > 0 ? `Bajada: -${formatCurrency(status.used)}` : "En máximos"}
          </span>
        </div>
      </div>

      {/* Indicador de Suelo Diario (si tiene límite diario) */}
      {status.hasDailyLimit && status.dailyFloor !== undefined && (
        <div className="border-t border-border/50 pt-2 flex items-center justify-between text-[11px] font-mono">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="size-3 text-sky-500" /> Suelo Diario:
          </span>
          <span className="font-bold text-foreground">
            {formatCurrency(status.dailyFloor)}
            <span className="text-[10px] text-muted-foreground font-normal ml-1">
              (Margen: {formatCurrency(status.dailyRemaining ?? 0)})
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
