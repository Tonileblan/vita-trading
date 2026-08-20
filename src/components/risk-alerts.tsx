import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertOctagon,
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Flame,
  Info,
  ShieldAlert,
  Trophy,
  X,
} from "lucide-react";
import { checkRules, type RiskAlert } from "@/lib/emotion-metrics";
import { todayKey } from "@/lib/emotions";
import { useJournal } from "@/lib/journal-store";
import { accountDrawdown, accountTarget, formatCurrency } from "@/lib/metrics";
import { useCheckins, useJournalRules, DEFAULT_RULES } from "@/lib/mood";
import { cn } from "@/lib/utils";

const DISMISSED_KEY_PREFIX = "tj:dismissed-alerts-v2";

/**
 * Banner rediseñado de alertas y disciplina con diseño visual moderno,
 * textos concisos de alto impacto y botón 'X' directo para descartar cada aviso.
 */
export function RiskAlerts() {
  const { activeJournalId, visibleTrades, accounts, trades, withdrawals } = useJournal();
  const { data: rules = DEFAULT_RULES } = useJournalRules(activeJournalId);
  const { data: checkins = [] } = useCheckins(activeJournalId);

  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set());

  // Cargar alertas descartadas hoy
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

  // 1. Alertas de objetivos / payouts
  const targetAlerts: RiskAlert[] = accounts
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
    }));

  // 2. Alertas de drawdown crítico o cuenta rota
  const drawdownAlerts: RiskAlert[] = accounts
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
    });

  // 3. Reglas operativas y psicológicas del día
  const ruleAlerts = checkRules(
    visibleTrades,
    rules,
    checkins.some((c) => c.date === todayKey()),
  );

  const allAlerts = [...drawdownAlerts, ...targetAlerts, ...ruleAlerts];
  const activeAlerts = allAlerts.filter((a) => !dismissedKeys.has(a.key));

  if (activeAlerts.length === 0) return null;

  return (
    <section aria-label="Avisos de riesgo y disciplina" className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-1 md:grid-cols-2">
        {activeAlerts.map((a) => {
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
          }[a.tone];

          const IconComponent = toneStyles.Icon;

          return (
            <div
              key={a.key}
              className={cn(
                "group relative flex items-center justify-between gap-3 rounded-xl border p-3 transition-all backdrop-blur-xs",
                toneStyles.card,
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Icono temático */}
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    toneStyles.iconBg,
                  )}
                >
                  <IconComponent className="size-4.5 shrink-0" />
                </div>

                {/* Texto conciso y etiqueta */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.tag && (
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider",
                          toneStyles.tag,
                        )}
                      >
                        {a.tag}
                      </span>
                    )}
                    <span className="truncate text-xs font-bold text-foreground">
                      {a.title || a.message}
                    </span>
                  </div>

                  {a.detail && (
                    <p className="text-[11px] text-muted-foreground truncate opacity-90">
                      {a.detail}
                    </p>
                  )}
                </div>
              </div>

              {/* Botón de acción opcional + Botón 'X' para descartar */}
              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                {a.actionUrl && a.actionLabel && (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 px-2 text-[11px] font-bold gap-1 cursor-pointer",
                      toneStyles.action,
                    )}
                  >
                    <Link to={a.actionUrl}>
                      {a.actionLabel}
                      <ChevronRight className="size-3" />
                    </Link>
                  </Button>
                )}

                <button
                  type="button"
                  onClick={() => dismissAlert(a.key)}
                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/80 hover:bg-foreground/10 hover:text-foreground transition-colors cursor-pointer"
                  title="Cerrar aviso"
                  aria-label="Cerrar aviso"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
