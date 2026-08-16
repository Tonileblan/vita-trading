import { AlertTriangle, Info, X } from "lucide-react";
import { useEffect, useState } from "react";
import { checkRules } from "@/lib/emotion-metrics";
import { todayKey } from "@/lib/emotions";
import { useJournal } from "@/lib/journal-store";
import { accountTarget } from "@/lib/metrics";
import { useCheckins, useJournalRules, DEFAULT_RULES } from "@/lib/mood";
import { cn } from "@/lib/utils";

const MUTE_KEY = "tj:mute-alerts";

/** Banner de avisos de disciplina para el día en curso. */
export function RiskAlerts() {
  const { activeJournalId, visibleTrades, accounts, trades, withdrawals } = useJournal();
  const { data: rules = DEFAULT_RULES } = useJournalRules(activeJournalId);
  const { data: checkins = [] } = useCheckins(activeJournalId);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMuted(window.localStorage.getItem(MUTE_KEY) === todayKey());
  }, []);

  const targetAlerts = accounts
    .map((a) => ({ account: a, status: accountTarget(a, trades, withdrawals) }))
    .filter((x) => x.status?.reached)
    .map((x) => ({
      key: `target-${x.account.id}`,
      tone: "info" as const,
      message:
        x.status!.phase === "live"
          ? `${x.account.name} ha alcanzado el objetivo de retiro: ya puedes solicitar payout.`
          : `${x.account.name} ha alcanzado el objetivo de evaluación.`,
    }));

  const alerts = [
    ...targetAlerts,
    ...checkRules(visibleTrades, rules, checkins.some((c) => c.date === todayKey())),
  ];
  if (muted || alerts.length === 0) return null;

  return (
    <section className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.key}
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
            a.tone === "warn"
              ? "border-loss/50 bg-loss/10 text-loss"
              : "border-border bg-accent text-foreground",
          )}
        >
          {a.tone === "warn" ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          ) : (
            <Info className="mt-0.5 size-4 shrink-0" />
          )}
          <span className="flex-1">{a.message}</span>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") window.localStorage.setItem(MUTE_KEY, todayKey());
          setMuted(true);
        }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <X className="size-3" /> Silenciar hasta mañana
      </button>
    </section>
  );
}
