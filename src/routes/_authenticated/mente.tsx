import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmotionStats } from "@/components/emotion-stats";
import { MoodCalendar } from "@/components/mood-calendar";
import { MoodCheckinCard } from "@/components/mood-checkin-card";
import { RiskAlerts } from "@/components/risk-alerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayKey } from "@/lib/emotions";
import { useJournal } from "@/lib/journal-store";
import { DEFAULT_RULES, useCheckins, useJournalRules, useSaveRules, type JournalRules } from "@/lib/mood";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mente")({
  head: () => ({
    meta: [
      { title: "Mente — Vita-Trading Journal" },
      {
        name: "description",
        content:
          "Check-in diario de ánimo, energía y foco, analítica emocional del trading y reglas de disciplina.",
      },
      { property: "og:title", content: "Mente — Vita-Trading Journal" },
      {
        property: "og:description",
        content: "Cruza tu estado mental con tus resultados y detecta qué emociones te cuestan dinero.",
      },
    ],
  }),
  component: MentePage,
});

const TABS = [
  { key: "hoy", label: "Hoy" },
  { key: "analitica", label: "Analítica" },
  { key: "reglas", label: "Reglas" },
] as const;

function RulesForm({ journalId }: { journalId: string }) {
  const { data } = useJournalRules(journalId);
  const save = useSaveRules(journalId);
  const [draft, setDraft] = useState<JournalRules | null>(null);
  const rules = draft ?? data ?? DEFAULT_RULES;

  function set<K extends keyof JournalRules>(key: K, value: JournalRules[K]) {
    setDraft({ ...rules, [key]: value });
  }

  return (
    <section className="panel max-w-xl space-y-4 p-4">
      <div>
        <h2 className="text-xl leading-none">Reglas y alertas</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Se comprueban con las operaciones del día y avisan en el resumen.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label>Alertas activas</Label>
        <Button
          size="sm"
          variant={rules.enabled ? "default" : "outline"}
          onClick={() => set("enabled", !rules.enabled)}
        >
          {rules.enabled ? "Activadas" : "Desactivadas"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="streak">Máx. pérdidas seguidas</Label>
          <Input
            id="streak"
            inputMode="numeric"
            value={String(rules.max_loss_streak)}
            onChange={(e) => set("max_loss_streak", Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="count">Máx. operaciones al día</Label>
          <Input
            id="count"
            inputMode="numeric"
            value={String(rules.max_trades_day)}
            onChange={(e) => set("max_trades_day", Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loss">Pérdida máxima diaria</Label>
          <Input
            id="loss"
            inputMode="decimal"
            value={rules.max_daily_loss == null ? "" : String(rules.max_daily_loss)}
            onChange={(e) =>
              set("max_daily_loss", e.target.value === "" ? null : Number(e.target.value) || 0)
            }
            placeholder="Sin límite"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Recordar check-in</Label>
          <Button
            variant={rules.require_checkin ? "default" : "outline"}
            onClick={() => set("require_checkin", !rules.require_checkin)}
          >
            {rules.require_checkin ? "Sí" : "No"}
          </Button>
        </div>
      </div>

      <Button
        disabled={save.isPending}
        onClick={async () => {
          try {
            await save.mutateAsync(rules);
            toast.success("Reglas guardadas");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudieron guardar las reglas");
          }
        }}
      >
        Guardar reglas
      </Button>
    </section>
  );
}

function MentePage() {
  const { activeJournalId, visibleTrades } = useJournal();
  const { data: checkins = [] } = useCheckins(activeJournalId);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("hoy");
  const today = checkins.find((c) => c.date === todayKey());

  return (
    <AppShell
      title="Mente"
      subtitle="Estado emocional, disciplina y reglas para proteger tu capital"
      showAccountPanel={false}
    >
      <div className="space-y-4">
        <RiskAlerts />

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                tab === t.key
                  ? "border-brand bg-brand/15 text-brand-soft"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!activeJournalId ? (
          <p className="text-sm text-muted-foreground">Selecciona un diario para empezar.</p>
        ) : tab === "hoy" ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <MoodCheckinCard journalId={activeJournalId} existing={today} />
            <MoodCalendar checkins={checkins} trades={visibleTrades} />
          </div>
        ) : tab === "analitica" ? (
          <EmotionStats trades={visibleTrades} checkins={checkins} />
        ) : (
          <RulesForm journalId={activeJournalId} />
        )}
      </div>
    </AppShell>
  );
}
