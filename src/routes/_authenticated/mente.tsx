import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  DollarSign,
  Flame,
  HeartHandshake,
  LineChart,
  Lock,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Wind,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { BreathingExercise } from "@/components/breathing-exercise";
import { EmotionStats } from "@/components/emotion-stats";
import { MoodCalendar } from "@/components/mood-calendar";
import { MoodCheckinCard } from "@/components/mood-checkin-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { calculateReadinessScore, todayKey } from "@/lib/emotions";
import { useJournal } from "@/lib/journal-store";
import {
  DEFAULT_RULES,
  useCheckins,
  useJournalRules,
  useSaveRules,
  type JournalRules,
  type MoodCheckin,
} from "@/lib/mood";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mente")({
  head: () => ({
    meta: [
      { title: "Mente & Psicología del Trading — Vita-Trading" },
      {
        name: "description",
        content:
          "Seguimiento de psicología de trading, estado emocional pre/post sesión, rituales de foco y contrato de disciplina operativa.",
      },
      { property: "og:title", content: "Mente & Psicología del Trading — Vita-Trading" },
    ],
  }),
  component: MentePage,
});

const TABS = [
  { key: "hoy", label: "Ritual Diario & Calendario", icon: CalendarDays },
  { key: "respiracion", label: "Respiración 3 Fases", icon: Wind },
  { key: "analitica", label: "Analítica Emocional & Tilt", icon: LineChart },
  { key: "reglas", label: "Contrato & Reglas de Disciplina", icon: ShieldCheck },
] as const;

/** Calcula la racha consecutiva de días con check-in */
function computeCheckinStreak(checkins: MoodCheckin[]): number {
  if (!checkins.length) return 0;
  const dates = new Set(checkins.map((c) => c.date));
  let streak = 0;
  const d = new Date();

  const todayStr = todayKey(d);
  const yesterday = new Date(d);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = todayKey(yesterday);

  let current = dates.has(todayStr) ? new Date() : dates.has(yesterdayStr) ? yesterday : null;
  if (!current) return 0;

  while (true) {
    const k = todayKey(current);
    if (dates.has(k)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

const GOLDEN_RULES = [
  { id: "r1", text: "1. No moveré el Stop Loss una vez colocado en el gráfico." },
  { id: "r2", text: "2. Cero Revenge Trading: si tengo 2 pérdidas seguidas, haré una pausa obligatoria." },
  { id: "r3", text: "3. Si alcanzo mi pérdida máxima diaria, cerraré las plataformas sin dudar." },
  { id: "r4", text: "4. Solo entraré al mercado cuando mi Setup cumpla el 100% de mis reglas." },
];

const PRE_SESSION_CHECKLIST = [
  { id: "c1", label: "Mente despejada y sin prisa ni distracciones externas" },
  { id: "c2", label: "Noticias de alto impacto y horarios de mercado revisados" },
  { id: "c3", label: "Riesgo por trade fijado y pérdida máxima diaria clara" },
  { id: "c4", label: "Niveles clave y contexto mayor identificados antes de abrir órdenes" },
];

function RulesForm({ journalId }: { journalId: string }) {
  const { data } = useJournalRules(journalId);
  const save = useSaveRules(journalId);
  const [draft, setDraft] = useState<JournalRules | null>(null);
  const rules = draft ?? data ?? DEFAULT_RULES;

  // Estado local para checklist pre-sesión
  const [checkedList, setCheckedList] = useState<Record<string, boolean>>({});

  function set<K extends keyof JournalRules>(key: K, value: JournalRules[K]) {
    setDraft({ ...rules, [key]: value });
  }

  const toggleChecklist = (id: string) => {
    setCheckedList((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allChecksPassed = PRE_SESSION_CHECKLIST.every((c) => checkedList[c.id]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* BLOQUE 1: MANIFIESTO Y CONTRATO DE DISCIPLINA                             */}
      {/* ========================================================================= */}
      <section className="panel p-5 bg-gradient-to-br from-brand/[0.06] via-card to-card border-brand/40 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand/15 text-brand shadow-xs">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display uppercase tracking-wide text-foreground">
                Contrato de Disciplina del Trader
              </h3>
              <p className="text-xs text-muted-foreground">
                Tus 4 Reglas de Oro innegociables para proteger tu cuenta y tu psicología
              </p>
            </div>
          </div>

          <span className="rounded-full bg-brand/15 text-brand border border-brand/30 px-3 py-1 text-xs font-bold flex items-center gap-1.5">
            <Lock className="size-3.5" /> Compromiso Inquebrantable
          </span>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {GOLDEN_RULES.map((rule) => (
            <div
              key={rule.id}
              className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-background/60 p-3 text-xs"
            >
              <CheckCircle2 className="size-4 text-brand shrink-0 mt-0.5" />
              <p className="font-semibold text-foreground/90 leading-relaxed">{rule.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ========================================================================= */}
        {/* CARD 2: PROTOCOLO PRE-SESIÓN (CHECKLIST PRE-VUELO)                        */}
        {/* ========================================================================= */}
        <section className="panel p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                  <CheckSquare className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display uppercase tracking-wide">
                    Protocolo Pre-Vuelo
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Verificación antes de abrir el primer trade
                  </p>
                </div>
              </div>

              <span
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-bold",
                  allChecksPassed
                    ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {allChecksPassed ? "✓ Listo para operar" : "Verificación pendiente"}
              </span>
            </div>

            <div className="space-y-2">
              {PRE_SESSION_CHECKLIST.map((item) => {
                const checked = Boolean(checkedList[item.id]);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleChecklist(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border text-left text-xs transition-all cursor-pointer",
                      checked
                        ? "border-emerald-500/40 bg-emerald-500/[0.05] text-foreground font-semibold"
                        : "border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30",
                    )}
                  >
                    <div
                      className={cn(
                        "size-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        checked
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-border bg-background",
                      )}
                    >
                      {checked && <CheckCircle2 className="size-3" />}
                    </div>
                    <span className="leading-snug">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {Object.values(checkedList).filter(Boolean).length} de {PRE_SESSION_CHECKLIST.length} completados
            </span>
            <button
              type="button"
              onClick={() => setCheckedList({})}
              className="text-[11px] text-brand hover:underline cursor-pointer"
            >
              Reiniciar checklist
            </button>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CARD 3: PARÁMETROS Y LÍMITES CUANTITATIVOS DE RIESGO                     */}
        {/* ========================================================================= */}
        <section className="panel p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <AlertTriangle className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display uppercase tracking-wide">
                    Límites de Protección & Parada
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Umbrales automáticos para frenar el tilt y el overtrading
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {rules.enabled ? "Activas" : "Pausadas"}
                </span>
                <Switch
                  checked={rules.enabled}
                  onCheckedChange={(checked) => set("enabled", checked)}
                />
              </div>
            </div>

            <div className="space-y-3.5">
              {/* Racha de pérdidas */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Label htmlFor="streak" className="font-bold text-foreground">
                    Máximo de pérdidas consecutivas (Racha)
                  </Label>
                  <span className="num font-bold text-brand">{rules.max_loss_streak} pérdidas</span>
                </div>
                <Input
                  id="streak"
                  inputMode="numeric"
                  value={String(rules.max_loss_streak)}
                  onChange={(e) => set("max_loss_streak", Number(e.target.value) || 0)}
                  placeholder="3"
                  className="h-8.5 text-xs num font-semibold"
                />
                <p className="text-[11px] text-muted-foreground">
                  Al alcanzar {rules.max_loss_streak} stops seguidos, el sistema activará alerta roja de parada.
                </p>
              </div>

              {/* Límite de trades diarios */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Label htmlFor="count" className="font-bold text-foreground">
                    Máximo de operaciones diarias (Trades/día)
                  </Label>
                  <span className="num font-bold text-brand">{rules.max_trades_day} trades</span>
                </div>
                <Input
                  id="count"
                  inputMode="numeric"
                  value={String(rules.max_trades_day)}
                  onChange={(e) => set("max_trades_day", Number(e.target.value) || 0)}
                  placeholder="5"
                  className="h-8.5 text-xs num font-semibold"
                />
              </div>

              {/* Pérdida máxima diaria ($) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Label htmlFor="loss" className="font-bold text-foreground">
                    Pérdida máxima diaria permitida ($)
                  </Label>
                  <span className="num font-bold text-red-500">
                    {rules.max_daily_loss ? `-$${rules.max_daily_loss}` : "Sin límite"}
                  </span>
                </div>
                <Input
                  id="loss"
                  inputMode="decimal"
                  value={rules.max_daily_loss == null ? "" : String(rules.max_daily_loss)}
                  onChange={(e) =>
                    set("max_daily_loss", e.target.value === "" ? null : Number(e.target.value) || 0)
                  }
                  placeholder="Ej: 500 (dejar vacío si no aplica)"
                  className="h-8.5 text-xs num font-semibold"
                />
              </div>

              {/* Recordar Check-in */}
              <div className="flex items-center justify-between rounded-xl border border-border/80 p-3 bg-muted/20">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-foreground">Recordar Check-in Diario</span>
                  <p className="text-[11px] text-muted-foreground">
                    Mostrar aviso si operas sin haber completado tu preparación mental
                  </p>
                </div>
                <Switch
                  checked={rules.require_checkin}
                  onCheckedChange={(checked) => set("require_checkin", checked)}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border/60">
            <Button
              className="w-full gap-2 font-bold shadow-xs cursor-pointer"
              disabled={save.isPending}
              onClick={async () => {
                try {
                  await save.mutateAsync(rules);
                  toast.success("Reglas de disciplina y límites de riesgo guardados");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "No se pudieron guardar las reglas",
                  );
                }
              }}
            >
              <Save className="size-4" />
              {save.isPending ? "Guardando…" : "Guardar & Firmar Reglas de Disciplina"}
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

  const todayCheckin = checkins.find((c) => c.date === todayKey());
  const rules = rulesData ?? DEFAULT_RULES;

  const streakDays = useMemo(() => computeCheckinStreak(checkins), [checkins]);

  // Tasa de seguimiento del plan
  const planAdherence = useMemo(() => {
    if (!visibleTrades.length) return 100;
    const planYes = visibleTrades.filter((t) => t.followedPlan === "yes").length;
    return (planYes / visibleTrades.length) * 100;
  }, [visibleTrades]);

  // Readiness Score de hoy si ya se hizo el checkin
  const todayReadiness = useMemo(() => {
    if (!todayCheckin) return null;
    return calculateReadinessScore({
      mood: todayCheckin.mood,
      energy: todayCheckin.energy,
      stress: todayCheckin.stress,
      focus: todayCheckin.focus,
      sleepHours: todayCheckin.sleep_hours,
    });
  }, [todayCheckin]);

  return (
    <AppShell
      title="Mente & Psicología del Trading"
      subtitle="Supervisa tu estado mental, rituales pre/post sesión, disciplina operativa y detecta patrones de tilt"
      showAccountPanel={false}
    >
      <div className="space-y-6">


        {/* ========================================================================= */}
        {/* HERO KPI CARDS                                                            */}
        {/* ========================================================================= */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Estado de Hoy */}
          <div className="panel flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand shrink-0">
                <Brain className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Preparación Hoy
                </p>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {todayReadiness ? (
                    <span className="flex items-center gap-1 text-emerald-500 num font-black">
                      <CheckCircle2 className="size-4" /> {todayReadiness.score}% — Listo
                    </span>
                  ) : (
                    <span className="text-amber-500 font-semibold">Pendiente de registro</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Racha de Disciplina */}
          <div className="panel flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                <Flame className="size-5 fill-amber-500" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Racha de Check-ins
                </p>
                <p className="text-lg font-black text-foreground mt-0.5 num">
                  {streakDays} {streakDays === 1 ? "día continuo" : "días continuos"}
                </p>
              </div>
            </div>
          </div>

          {/* 3. Adherencia al Plan */}
          <div className="panel flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Adherencia al Plan
                </p>
                <p className="text-lg font-black text-foreground mt-0.5 num">
                  {planAdherence.toFixed(1)}% de trades
                </p>
              </div>
            </div>
          </div>

          {/* 4. Límites de Riesgo */}
          <div className="panel flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                <Target className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Límites de Seguridad
                </p>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {rules.enabled ? (
                    <span className="text-foreground num font-bold">
                      {rules.max_trades_day} trades · {rules.max_loss_streak} stops
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Desactivados</span>
                  )}
                </p>
              </div>
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
                  "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer",
                  active
                    ? "border-brand text-foreground font-bold"
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-teal-500/10 p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="flex size-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500 shrink-0">
                  <Wind className="size-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    Ejercicio de Respiración de 3 Fases
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Inhala · Retén · Exhala. Reduce el ritmo cardíaco y la ansiedad para entrar en zona antes de operar.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTab("respiracion")}
                className="gap-2 font-bold shrink-0 self-end sm:self-auto border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
              >
                <Wind className="size-4" /> Iniciar ejercicio
              </Button>
            </div>

            {/* Checkin Card & Mood Calendar */}
            <div className="grid gap-5 lg:grid-cols-2">
              <MoodCheckinCard
                journalId={activeJournalId}
                existing={todayCheckin}
                streakDays={streakDays}
              />
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
