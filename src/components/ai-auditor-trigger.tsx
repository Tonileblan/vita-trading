import { useState, useMemo, useEffect } from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, Sparkles, Bot } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useJournal } from "@/lib/journal-store";
import { useCheckins, useJournalRules, DEFAULT_RULES } from "@/lib/mood";
import { todayKey } from "@/lib/emotions";
import { computeAuditorStatus, type AuditorContextData } from "@/lib/ai-auditor-context";
import { AiAuditorPanel } from "./ai-auditor-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPEN_AUDITOR_EVENT = "vita:open-ai-auditor";

export function openAiAuditor() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_AUDITOR_EVENT));
  }
}

export function AiAuditorTrigger() {
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setPanelOpen(true);
    window.addEventListener(OPEN_AUDITOR_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_AUDITOR_EVENT, handleOpen);
  }, []);

  return <AiAuditorPanel open={panelOpen} onOpenChange={setPanelOpen} />;
}

/**
 * Botón para la cabecera (Header)
 */
export function HeaderAuditorButton() {
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
    <Button
      variant="outline"
      size="sm"
      onClick={() => openAiAuditor()}
      className={cn(
        "gap-1.5 font-display text-sm tracking-wide transition-all",
        statusSummary.status === "danger"
          ? "border-loss/60 text-loss hover:bg-loss/10"
          : statusSummary.status === "warning"
            ? "border-amber-500/60 text-amber-500 hover:bg-amber-500/10"
            : "hover:border-brand hover:text-brand",
      )}
      title="Abrir Auditor IA"
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
      <Bot className="size-3.5" />
      <span>Auditor IA</span>
      {statusSummary.activeAlerts.length > 0 && (
        <span className="ml-0.5 rounded-full bg-loss px-1.5 py-0.2 text-[10px] font-bold text-white">
          {statusSummary.activeAlerts.length}
        </span>
      )}
    </Button>
  );
}
