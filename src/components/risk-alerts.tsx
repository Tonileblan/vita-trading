import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  Brain,
  ChevronRight,
  ShieldAlert,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { checkRules, type RiskAlert } from "@/lib/emotion-metrics";
import { todayKey } from "@/lib/emotions";
import { useJournal } from "@/lib/journal-store";
import { accountDrawdown, accountTarget, formatCurrency } from "@/lib/metrics";
import { useCheckins, useJournalRules, DEFAULT_RULES } from "@/lib/mood";
import { cn } from "@/lib/utils";

const DISMISSED_KEY_PREFIX = "tj:dismissed-alerts-v4";

/** Hook para obtener y gestionar alertas activas del día */
export function useActiveRiskAlerts() {
  const { activeJournalId, visibleTrades, accounts, trades, withdrawals } = useJournal();
  const { data: rules = DEFAULT_RULES } = useJournalRules(activeJournalId);
  const { data: checkins = [] } = useCheckins(activeJournalId);

  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(`${DISMISSED_KEY_PREFIX}:${todayKey()}`);
      if (stored) {
        setDismissedKeys(new Set(JSON.parse(stored)));
      }
    } catch {}
  }, []);

  const dismissAlert = (key: string) => {
    setDismissedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            `${DISMISSED_KEY_PREFIX}:${todayKey()}`,
            JSON.stringify(Array.from(next)),
          );
        } catch {}
      }
      return next;
    });
  };

  const dismissAll = () => {
    const allKeys = allAlerts.map((a) => a.key);
    setDismissedKeys(new Set(allKeys));
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          `${DISMISSED_KEY_PREFIX}:${todayKey()}`,
          JSON.stringify(allKeys),
        );
      } catch {}
    }
  };

  // 1. Alertas de objetivos / payouts
  const targetAlerts: RiskAlert[] = useMemo(
    () =>
      accounts
        .map((a) => ({ account: a, status: accountTarget(a, trades, withdrawals) }))
        .filter((x) => x.status?.reached)
        .map((x) => ({
          key: `target-${x.account.id}`,
          tone: "success",
          tag: x.status!.phase === "live" ? "Payout Disponible" : "Objetivo Cumplido",
          title: `¡${x.account.name} lista para cobro!`,
          detail:
            x.status!.phase === "live"
              ? "Has alcanzado el umbral para solicitar tu retiro de fondos."
              : "Fase de evaluación superada exitosamente.",
          message: `${x.account.name} ha alcanzado el objetivo.`,
          actionLabel: x.status!.phase === "live" ? "Ver retiro" : "Ver cuentas",
          actionUrl: x.status!.phase === "live" ? "/conta" : "/cuentas",
        })),
    [accounts, trades, withdrawals],
  );

  // 2. Alertas de drawdown crítico o cuenta rota
  const drawdownAlerts: RiskAlert[] = useMemo(
    () =>
      accounts
        .filter((a) => a.type === "funded" && Boolean(a.maxLossLimit ?? a.drawdownLimit ?? a.dailyLossLimit))
        .map((a) => ({ account: a, dd: accountDrawdown(a, trades, withdrawals) }))
        .filter(
          (x) =>
            x.dd !== null &&
            (x.dd.remaining < 600 ||
              x.dd.breached ||
              (x.dd.hasDailyLimit && ((x.dd.dailyRemaining ?? 9999) < 300 || x.dd.dailyBreached))),
        )
        .map((x) => {
          const isMaxBreached = x.dd!.breached;
          const isDailyBreached = Boolean(x.dd!.hasDailyLimit && x.dd!.dailyBreached);
          const isBreached = isMaxBreached || isDailyBreached;
          const isDailyWarning = Boolean(x.dd!.hasDailyLimit && !isDailyBreached && (x.dd!.dailyRemaining ?? 9999) < 300);

          let tag = "Drawdown Crítico";
          let detail = `Solo quedan ${formatCurrency(x.dd!.remaining)} de margen disponible (Suelo: ${formatCurrency(x.dd!.floor)}).`;
          if (isMaxBreached) {
            tag = "Cuenta Rota";
            detail = `Límite máximo de pérdida total superado.`;
          } else if (isDailyBreached) {
            tag = "Límite Diario Roto";
            detail = `Límite de pérdida diaria superado hoy (Suelo: ${formatCurrency(x.dd!.dailyFloor ?? 0)}).`;
          } else if (isDailyWarning) {
            tag = "Límite Diario Crítico";
            detail = `Solo quedan ${formatCurrency(x.dd!.dailyRemaining ?? 0)} de margen diario para la sesión de hoy.`;
          }

          return {
            key: `dd-${x.account.id}`,
            tone: isBreached ? "danger" : "warn",
            tag,
            title: `Cuenta ${x.account.name}`,
            detail,
            message: `Cuenta ${x.account.name}: ${tag}.`,
            actionLabel: "Ver cuenta",
            actionUrl: `/cuenta/${x.account.id}`,
          };
        }),
    [accounts, trades, withdrawals],
  );

  // 3. Reglas operativas y psicológicas del día
  const ruleAlerts = useMemo(
    () =>
      checkRules(
        visibleTrades,
        rules,
        checkins.some((c) => c.date === todayKey()),
      ),
    [visibleTrades, rules, checkins],
  );

  const allAlerts = useMemo(
    () => [...drawdownAlerts, ...targetAlerts, ...ruleAlerts],
    [drawdownAlerts, targetAlerts, ruleAlerts],
  );

  const activeAlerts = useMemo(
    () => allAlerts.filter((a) => !dismissedKeys.has(a.key)),
    [allAlerts, dismissedKeys],
  );

  // Nivel de mayor severidad para el estilo del botón
  const highestTone = useMemo(() => {
    if (activeAlerts.some((a) => a.tone === "danger")) return "danger";
    if (activeAlerts.some((a) => a.tone === "warn")) return "warn";
    if (activeAlerts.some((a) => a.tone === "success")) return "success";
    if (activeAlerts.some((a) => a.tone === "info")) return "info";
    return "none";
  }, [activeAlerts]);

  return {
    allAlerts,
    activeAlerts,
    dismissAlert,
    dismissAll,
    highestTone,
  };
}

/** Tarjeta individual de alerta con su botón X para cerrarla */
export function AlertCard({
  alert,
  onDismiss,
}: {
  alert: RiskAlert;
  onDismiss: (key: string) => void;
}) {
  const toneStyles = {
    danger: {
      card: "border-loss/40 bg-loss/[0.08] dark:bg-loss/[0.14] text-foreground hover:border-loss/60 shadow-xs",
      iconBg: "bg-loss/20 text-loss border border-loss/30",
      tag: "bg-loss/15 text-loss border border-loss/30",
      action: "text-loss hover:text-loss/80",
      Icon: ShieldAlert,
    },
    warn: {
      card: "border-amber-500/40 bg-amber-500/[0.08] dark:bg-amber-500/[0.14] text-foreground hover:border-amber-500/60 shadow-xs",
      iconBg: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30",
      tag: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30",
      action: "text-amber-600 dark:text-amber-400 hover:opacity-80",
      Icon: AlertTriangle,
    },
    success: {
      card: "border-emerald-500/40 bg-emerald-500/[0.08] dark:bg-emerald-500/[0.14] text-foreground hover:border-emerald-500/60 shadow-xs",
      iconBg: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
      tag: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
      action: "text-emerald-600 dark:text-emerald-400 hover:opacity-80",
      Icon: Trophy,
    },
    info: {
      card: "border-brand/40 bg-brand/[0.06] dark:bg-brand/[0.12] text-foreground hover:border-brand/60 shadow-xs",
      iconBg: "bg-brand/20 text-brand border border-brand/30",
      tag: "bg-brand/15 text-brand border border-brand/30",
      action: "text-brand hover:opacity-80",
      Icon: Brain,
    },
  }[alert.tone];

  const IconComponent = toneStyles.Icon;

  return (
    <div
      className={cn(
        "group relative flex items-center justify-between gap-3 rounded-xl border p-3 transition-all backdrop-blur-xs shadow-xs",
        toneStyles.card,
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Icono temático */}
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            toneStyles.iconBg,
          )}
        >
          <IconComponent className="size-4 shrink-0" />
        </div>

        {/* Texto conciso y etiqueta */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            {alert.tag && (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider",
                  toneStyles.tag,
                )}
              >
                {alert.tag}
              </span>
            )}
            <span className="truncate text-xs font-bold text-foreground">
              {alert.title || alert.message}
            </span>
          </div>

          {alert.detail && (
            <p className="text-[11px] text-muted-foreground truncate opacity-90">
              {alert.detail}
            </p>
          )}
        </div>
      </div>

      {/* Botón de acción opcional + Botón 'X' para descartar */}
      <div className="flex items-center gap-1.5 shrink-0 pl-1">
        {alert.actionUrl && alert.actionLabel && (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-[11px] font-bold gap-1 cursor-pointer",
              toneStyles.action,
            )}
          >
            <Link to={alert.actionUrl}>
              {alert.actionLabel}
              <ChevronRight className="size-3" />
            </Link>
          </Button>
        )}

        <button
          type="button"
          onClick={() => onDismiss(alert.key)}
          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/80 hover:bg-foreground/10 hover:text-foreground transition-colors cursor-pointer"
          title="Cerrar aviso"
          aria-label="Cerrar aviso"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Botón parpadeante de "Alertas" para la cabecera (Header / Navbar).
 * Al hacer clic abre el centro de avisos una detrás de otra.
 */
export function HeaderAlertsButton() {
  const { activeAlerts, dismissAlert, dismissAll, highestTone } = useActiveRiskAlerts();
  const [open, setOpen] = useState(false);

  if (activeAlerts.length === 0) return null;

  const buttonStyle = {
    danger: "border-loss/70 bg-loss/15 text-loss hover:bg-loss/25 shadow-loss/20 animate-pulse",
    warn: "border-amber-500/70 bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 shadow-amber-500/20 animate-pulse",
    success: "border-emerald-500/70 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 shadow-emerald-500/20 animate-pulse",
    info: "border-brand/70 bg-brand/15 text-brand hover:bg-brand/25 shadow-brand/20 animate-pulse",
    none: "border-border text-muted-foreground",
  }[highestTone];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-display text-sm tracking-wide font-bold transition-all cursor-pointer shadow-xs",
            buttonStyle,
          )}
          aria-label={`Ver ${activeAlerts.length} alertas`}
        >
          {highestTone === "danger" ? (
            <ShieldAlert className="size-4 text-loss shrink-0 animate-bounce" />
          ) : highestTone === "warn" ? (
            <AlertTriangle className="size-4 text-amber-500 shrink-0" />
          ) : (
            <Bell className="size-4 text-brand shrink-0" />
          )}

          <span>Alertas</span>
          <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-black text-background">
            {activeAlerts.length}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[380px] sm:w-[460px] p-4 space-y-3 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-brand" />
            <h4 className="text-xs font-bold font-display uppercase tracking-wider text-foreground">
              Avisos Activos ({activeAlerts.length})
            </h4>
          </div>

          <button
            type="button"
            onClick={dismissAll}
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
          >
            Silenciar todos hoy
          </button>
        </div>

        {/* Lista de alertas una detrás de otra */}
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {activeAlerts.map((a) => (
            <AlertCard key={a.key} alert={a} onDismiss={dismissAlert} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

