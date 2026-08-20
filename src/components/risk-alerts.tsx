import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ShieldAlert,
  Sparkles,
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

const DISMISSED_KEY_PREFIX = "tj:dismissed-alerts-v3";

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
        .filter((a) => a.type === "funded" && Boolean(a.drawdownLimit))
        .map((a) => ({ account: a, dd: accountDrawdown(a, trades, withdrawals) }))
        .filter((x) => x.dd !== null && (x.dd.remaining < 600 || x.dd.breached))
        .map((x) => {
          const isBreached = x.dd!.breached;
          return {
            key: `dd-${x.account.id}`,
            tone: "danger",
            tag: isBreached ? "Cuenta Rota" : "Drawdown Crítico",
            title: `Cuenta ${x.account.name}`,
            detail: isBreached
              ? "Límite máximo de drawdown superado."
              : `Solo quedan ${formatCurrency(x.dd!.remaining)} de colchón operativo.`,
            message: isBreached
              ? `Cuenta ${x.account.name}: Cuenta rota.`
              : `Cuenta ${x.account.name}: Drawdown crítico (${formatCurrency(x.dd!.remaining)} restantes).`,
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

  // Estado de mayor severidad
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

/** Renderiza una tarjeta individual de alerta con su botón X */
export function AlertCard({
  alert,
  onDismiss,
}: {
  alert: RiskAlert;
  onDismiss: (key: string) => void;
}) {
  const toneStyles = {
    danger: {
      card: "border-loss/40 bg-loss/[0.08] dark:bg-loss/[0.12] text-foreground hover:border-loss/60 shadow-xs",
      iconBg: "bg-loss/20 text-loss border border-loss/30",
      tag: "bg-loss/15 text-loss border border-loss/30",
      action: "text-loss hover:text-loss/80",
      Icon: ShieldAlert,
    },
    warn: {
      card: "border-amber-500/40 bg-amber-500/[0.08] dark:bg-amber-500/[0.12] text-foreground hover:border-amber-500/60 shadow-xs",
      iconBg: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30",
      tag: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30",
      action: "text-amber-600 dark:text-amber-400 hover:opacity-80",
      Icon: AlertTriangle,
    },
    success: {
      card: "border-emerald-500/40 bg-emerald-500/[0.08] dark:bg-emerald-500/[0.12] text-foreground hover:border-emerald-500/60 shadow-xs",
      iconBg: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
      tag: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
      action: "text-emerald-600 dark:text-emerald-400 hover:opacity-80",
      Icon: Trophy,
    },
    info: {
      card: "border-brand/40 bg-brand/[0.06] dark:bg-brand/[0.10] text-foreground hover:border-brand/60 shadow-xs",
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
        "group relative flex items-center justify-between gap-3 rounded-xl border p-3 transition-all backdrop-blur-xs",
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
 * Botón de alertas para la barra de navegación superior (Header)
 * Siempre visible y accesible desde cualquier página.
 */
export function HeaderAlertsButton() {
  const { activeAlerts, dismissAlert, dismissAll, highestTone } = useActiveRiskAlerts();
  const [open, setOpen] = useState(false);

  if (activeAlerts.length === 0) return null;

  const badgeStyle = {
    danger: "border-loss/60 bg-loss/15 text-loss hover:bg-loss/25",
    warn: "border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25",
    success: "border-emerald-500/60 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25",
    info: "border-brand/60 bg-brand/15 text-brand hover:bg-brand/25",
    none: "border-border text-muted-foreground",
  }[highestTone];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "relative gap-1.5 font-display text-sm tracking-wide transition-all cursor-pointer shadow-xs",
            badgeStyle,
          )}
          aria-label={`Ver ${activeAlerts.length} avisos`}
        >
          {highestTone === "danger" ? (
            <ShieldAlert className="size-4 animate-pulse text-loss" />
          ) : highestTone === "warn" ? (
            <AlertTriangle className="size-4 text-amber-500" />
          ) : (
            <Bell className="size-4 text-brand" />
          )}

          <span className="hidden sm:inline">Avisos</span>
          <span className="flex size-4.5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
            {activeAlerts.length}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[380px] sm:w-[440px] p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-brand" />
            <h4 className="text-xs font-bold font-display uppercase tracking-wider text-foreground">
              Avisos de Riesgo & Disciplina ({activeAlerts.length})
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

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {activeAlerts.map((a) => (
            <AlertCard key={a.key} alert={a} onDismiss={dismissAlert} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Componente in-page para panel.tsx y mente.tsx:
 * Se muestra como un elegante botón/píldora plegable que no satura la pantalla
 * y que al pulsarlo despliega las tarjetas con sus botones 'X'.
 */
export function RiskAlerts() {
  const { activeAlerts, dismissAlert, highestTone } = useActiveRiskAlerts();
  const [expanded, setExpanded] = useState(false);

  if (activeAlerts.length === 0) return null;

  const triggerStyles = {
    danger: {
      bar: "border-loss/40 bg-loss/[0.08] dark:bg-loss/[0.14] text-foreground hover:border-loss/60 shadow-xs",
      pill: "bg-loss/20 text-loss border border-loss/30",
      Icon: ShieldAlert,
    },
    warn: {
      bar: "border-amber-500/40 bg-amber-500/[0.08] dark:bg-amber-500/[0.14] text-foreground hover:border-amber-500/60 shadow-xs",
      pill: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30",
      Icon: AlertTriangle,
    },
    success: {
      bar: "border-emerald-500/40 bg-emerald-500/[0.08] dark:bg-emerald-500/[0.14] text-foreground hover:border-emerald-500/60 shadow-xs",
      pill: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
      Icon: Trophy,
    },
    info: {
      bar: "border-brand/40 bg-brand/[0.06] dark:bg-brand/[0.12] text-foreground hover:border-brand/60 shadow-xs",
      pill: "bg-brand/20 text-brand border border-brand/30",
      Icon: Bell,
    },
    none: {
      bar: "border-border bg-card text-foreground",
      pill: "bg-muted text-muted-foreground",
      Icon: Bell,
    },
  }[highestTone];

  const IconComponent = triggerStyles.Icon;

  return (
    <section aria-label="Avisos de riesgo y disciplina" className="space-y-2.5">
      {/* Botón Píldora Desplegable */}
      <div
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl border p-2.5 sm:px-4 cursor-pointer transition-all backdrop-blur-xs select-none",
          triggerStyles.bar,
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg font-bold text-xs",
              triggerStyles.pill,
            )}
          >
            <IconComponent className="size-3.5" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-foreground">
              {activeAlerts.length === 1
                ? "1 aviso de riesgo o disciplina activo"
                : `${activeAlerts.length} avisos de riesgo o disciplina activos`}
            </span>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              · Pulsa para {expanded ? "ocultar" : "desplegar detalles"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-xs font-bold text-muted-foreground hover:text-foreground">
          <span>{expanded ? "Ocultar" : "Ver avisos"}</span>
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </div>

      {/* Tarjetas Desplegadas con Botón 'X' */}
      {expanded && (
        <div className="grid gap-2.5 sm:grid-cols-1 md:grid-cols-2 pt-1 animate-in fade-in-50 duration-200">
          {activeAlerts.map((a) => (
            <AlertCard key={a.key} alert={a} onDismiss={dismissAlert} />
          ))}
        </div>
      )}
    </section>
  );
}
