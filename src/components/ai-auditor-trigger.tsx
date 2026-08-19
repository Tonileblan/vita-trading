import { useState, useMemo } from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useJournal } from "@/lib/journal-store";
import { useCheckins, useJournalRules, DEFAULT_RULES } from "@/lib/mood";
import { todayKey } from "@/lib/emotions";
import { computeAuditorStatus, type AuditorContextData } from "@/lib/ai-auditor-context";
import { AiAuditorPanel } from "./ai-auditor-panel";
import { cn } from "@/lib/utils";

export function AiAuditorTrigger() {
  const { isAdmin, isSupervisor } = useAuth();
  const { strategies, accounts, trades, activeJournalId } = useJournal();
  const { data: rules = DEFAULT_RULES } = useJournalRules(activeJournalId);
  const { data: checkins = [] } = useCheckins(activeJournalId);
  const [panelOpen, setPanelOpen] = useState(false);

  const today = todayKey();
  const todayCheckin = checkins.find((c) => c.date === today) || null;

  const ctxData: AuditorContextData = useMemo(
    () => ({
      strategies,
      accounts,
      trades,
      rules,
      todayCheckin,
    }),
    [strategies, accounts, trades, rules, todayCheckin],
  );

  const statusSummary = useMemo(() => computeAuditorStatus(ctxData), [ctxData]);

  // Solo visible para Administrador y Supervisor
  if (!isAdmin && !isSupervisor) {
    return null;
  }

  return (
    <>
      {/* BOTÓN FLOTANTE OMNIPRESENTE */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className={cn(
            "group relative flex items-center gap-2.5 rounded-full border px-3.5 py-2.5 shadow-lg transition-all hover:scale-105 active:scale-95",
            statusSummary.status === "danger"
              ? "border-loss/60 bg-card text-loss ring-2 ring-loss/30"
              : statusSummary.status === "warning"
                ? "border-amber-500/60 bg-card text-amber-500 ring-2 ring-amber-500/30"
                : "border-border bg-card text-foreground hover:border-brand",
          )}
          title="Abrir Auditor IA y Coach de Trading"
        >
          {/* Indicador de pulso */}
          <span className="relative flex size-2.5">
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                statusSummary.status === "danger"
                  ? "bg-loss"
                  : statusSummary.status === "warning"
                    ? "bg-amber-500"
                    : "bg-profit",
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-2.5 rounded-full",
                statusSummary.status === "danger"
                  ? "bg-loss"
                  : statusSummary.status === "warning"
                    ? "bg-amber-500"
                    : "bg-profit",
              )}
            />
          </span>

          {/* Icono */}
          {statusSummary.status === "danger" ? (
            <ShieldAlert className="size-4 text-loss" />
          ) : statusSummary.status === "warning" ? (
            <AlertTriangle className="size-4 text-amber-500" />
          ) : (
            <ShieldCheck className="size-4 text-profit" />
          )}

          <span className="font-display text-sm tracking-wide text-foreground">
            Auditor IA
          </span>

          {statusSummary.activeAlerts.length > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-loss text-[10px] font-bold text-white">
              {statusSummary.activeAlerts.length}
            </span>
          )}
        </button>
      </div>

      {/* PANEL LATERAL */}
      <AiAuditorPanel open={panelOpen} onOpenChange={setPanelOpen} />
    </>
  );
}

/**
 * Chip para la cabecera (opcional)
 */
export function HeaderAuditorPill({ onClick }: { onClick: () => void }) {
  const { isAdmin, isSupervisor } = useAuth();
  const { strategies, accounts, trades, activeJournalId } = useJournal();
  const { data: rules = DEFAULT_RULES } = useJournalRules(activeJournalId);
  const { data: checkins = [] } = useCheckins(activeJournalId);

  const today = todayKey();
  const todayCheckin = checkins.find((c) => c.date === today) || null;

  const ctxData: AuditorContextData = useMemo(
    () => ({
      strategies,
      accounts,
      trades,
      rules,
      todayCheckin,
    }),
    [strategies, accounts, trades, rules, todayCheckin],
  );

  const statusSummary = useMemo(() => computeAuditorStatus(ctxData), [ctxData]);

  if (!isAdmin && !isSupervisor) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden items-center gap-1.5 rounded-full border border-border/80 bg-accent/40 px-2.5 py-1 text-xs transition hover:bg-accent sm:inline-flex"
      title="Estado del Auditor IA"
    >
      <span
        className={cn(
          "size-2 rounded-full",
          statusSummary.status === "danger"
            ? "bg-loss"
            : statusSummary.status === "warning"
              ? "bg-amber-500"
              : "bg-profit",
        )}
      />
      <span className="font-display text-xs tracking-wider">Auditor IA</span>
    </button>
  );
}
