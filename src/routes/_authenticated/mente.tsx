import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  CalendarDays,
  CheckCircle2,
  HeartHandshake,
  LineChart,
  Save,
  ShieldCheck,
  Sparkles,
  Wind,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { BreathingExercise } from "@/components/breathing-exercise";
import { EmotionStats } from "@/components/emotion-stats";
import { MoodCalendar } from "@/components/mood-calendar";
import { MoodCheckinCard } from "@/components/mood-checkin-card";
import { RiskAlerts } from "@/components/risk-alerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { todayKey } from "@/lib/emotions";
import { useJournal } from "@/lib/journal-store";
import { DEFAULT_RULES, useCheckins, useJournalRules, useSaveRules, type JournalRules } from "@/lib/mood";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mente")({
  head: () => ({
    meta: [
      { title: "Mente & Psicología — Vita-Trading" },
      {
        name: "description",
        content:
          "Seguimiento de psicología de trading, estado emocional pre/post sesión y respeto de reglas operativas.",
      },
      { property: "og:title", content: "Mente & Psicología — Vita-Trading" },
    ],
  }),
  component: MentePage,
});

const TABS = [
  { key: "hoy", label: "Check-in & Calendario", icon: CalendarDays },
  { key: "respiracion", label: "Respiración 3 Fases", icon: Wind },
  { key: "analitica", label: "Analítica Emocional", icon: LineChart },
  { key: "reglas", label: "Reglas & Disciplina", icon: ShieldCheck },
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
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        {/* Card 1: Estado de las Alertas */}
        <section className="panel flex flex-col justify-between p-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Sistema de Alertas de Riesgo</h3>
                <p className="text-xs text-muted-foreground">
                  Supervisión automática en el panel de resumen
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 text-xs text-muted-foreground space-y-2">
              <p className="leading-relaxed">
                Cuando las alertas están activas, el sistema detecta violaciones de tu plan (exceso de operaciones, racha perdedora o superación de la pérdida máxima) y te alerta visualmente para proteger tu cuenta.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/80 p-3.5">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground">
                  {rules.enabled ? "Alertas Activadas" : "Alertas Desactivadas"}
                </span>
                <p className="text-[11px] text-muted-foreground">
                  {rules.enabled ? "Monitoreo en tiempo real" : "Sin avisos automáticos"}
                </p>
              </div>
              <Switch
                checked={rules.enabled}
                onCheckedChange={(checked) => set("enabled", checked)}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/80 p-3.5">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground">Recordar Check-in Diario</span>
                <p className="text-[11px] text-muted-foreground">
                  Aviso para registrar tu estado mental antes de operar
                </p>
              </div>
              <Switch
                checked={rules.require_checkin}
                onCheckedChange={(checked) => set("require_checkin", checked)}
              />
            </div>
          </div>
        </section>

        {/* Card 2: Parámetros de Disciplina */}
        <section className="panel flex flex-col justify-between p-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Límites y Reglas Cuantitativas</h3>
                <p className="text-xs text-muted-foreground">
                  Umbrales de corte para evitar el overtrading y el tilt
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="streak" className="text-xs font-semibold">
                  Máximo de pérdidas seguidas permitidas
                </Label>
                <Input
                  id="streak"
                  inputMode="numeric"
                  value={String(rules.max_loss_streak)}
                  onChange={(e) => set("max_loss_streak", Number(e.target.value) || 0)}
                  placeholder="3"
                />
                <p className="text-[11px] text-muted-foreground">
                  Al alcanzar este número consecutivo de pérdidas, se mostrará alerta de parada.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="count" className="text-xs font-semibold">
                  Máximo de operaciones diarias (Trades/día)
                </Label>
                <Input
                  id="count"
                  inputMode="numeric"
                  value={String(rules.max_trades_day)}
                  onChange={(e) => set("max_trades_day", Number(e.target.value) || 0)}
                  placeholder="5"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="loss" className="text-xs font-semibold">
                  Límite de pérdida máxima diaria ($)
                </Label>
                <Input
                  id="loss"
                  inputMode="decimal"
                  value={rules.max_daily_loss == null ? "" : String(rules.max_daily_loss)}
                  onChange={(e) =>
                    set("max_daily_loss", e.target.value === "" ? null : Number(e.target.value) || 0)
                  }
                  placeholder="Sin límite (opcional)"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-border/60">
            <Button
              className="w-full gap-2"
              disabled={save.isPending}
              onClick={async () => {
                try {
                  await save.mutateAsync(rules);
                  toast.success("Reglas de disciplina guardadas");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "No se pudieron guardar las reglas",
                  );
                }
              }}
            >
              <Save className="size-4" />
              {save.isPending ? "Guardando…" : "Guardar reglas de disciplina"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function MentePage() {
  const { activeJournalId, visibleTrades } = useJournal();
  const { data: checkins = [] } = useCheckins(activeJournalId);
  const { data: rulesData } = useJournalRules(activeJournalId);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("hoy");

  const today = checkins.find((c) => c.date === todayKey());
  const rules = rulesData ?? DEFAULT_RULES;

  return (
    <AppShell
      title="Mente & Psicología del Trading"
      subtitle="Supervisa tu estado mental, disciplina operativa y detecta qué emociones influyen en tus resultados"
      showAccountPanel={false}
    >
      <div className="space-y-6">
        {/* Risk Alerts Banner if triggered */}
        <RiskAlerts />

        {/* Hero KPI Counters */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Brain className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estado de Hoy</p>
              <p className="text-sm font-bold text-foreground">
                {today ? (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <CheckCircle2 className="size-4" /> Check-in hecho
                  </span>
                ) : (
                  <span className="text-amber-500">Pendiente de registro</span>
                )}
              </p>
            </div>
          </div>

          <div className="panel flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
              <Activity className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Check-ins Registrados</p>
              <p className="text-xl font-bold">{checkins.length}</p>
            </div>
          </div>

          <div className="panel flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reglas de Riesgo</p>
              <p className="text-sm font-bold text-foreground">
                {rules.enabled ? "Supervisión Activa" : "Desactivadas"}
              </p>
            </div>
          </div>

          <div className="panel flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Límite Diario</p>
              <p className="text-sm font-bold text-foreground">
                {rules.max_trades_day} ops / {rules.max_loss_streak} pérdidas
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all",
                  active
                    ? "border-brand text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        {!activeJournalId ? (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            Selecciona un diario activo para empezar a registrar tu estado mental.
          </div>
        ) : tab === "hoy" ? (
          <div className="space-y-5">
            {/* Quick Breathing Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-teal-500/10 p-4 sm:p-5">
              <div className="flex items-center gap-3.5">
                <div className="flex size-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500 shrink-0">
                  <Wind className="size-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Ejercicio de Respiración de 3 Fases</h4>
                  <p className="text-xs text-muted-foreground">
                    Inhala · Retén · Exhala. Reduce el estrés y entra en zona antes de abrir la sesión.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTab("respiracion")}
                className="gap-2 font-bold shrink-0 self-end sm:self-auto border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
              >
                <Wind className="size-4" /> Iniciar ejercicio
              </Button>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <MoodCheckinCard journalId={activeJournalId} existing={today} />
              <MoodCalendar checkins={checkins} trades={visibleTrades} />
            </div>
          </div>
        ) : tab === "respiracion" ? (
          <BreathingExercise />
        ) : tab === "analitica" ? (
          <EmotionStats trades={visibleTrades} checkins={checkins} />
        ) : (
          <RulesForm journalId={activeJournalId} />
        )}
      </div>
    </AppShell>
  );
}
