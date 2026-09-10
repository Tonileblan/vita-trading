import { useEffect, useMemo, useState } from "react";
import {
  Battery,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  HeartPulse,
  Moon,
  Save,
  ShieldAlert,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateReadinessScore,
  INTENTION_PRESETS,
  SCALE_DESCRIPTIONS,
  todayKey,
} from "@/lib/emotions";
import { useSaveCheckin, type MoodCheckin } from "@/lib/mood";
import { cn } from "@/lib/utils";

interface MoodCheckinCardProps {
  journalId: string;
  existing?: MoodCheckin | undefined;
  streakDays?: number;
}

export function MoodCheckinCard({
  journalId,
  existing,
  streakDays = 0,
}: MoodCheckinCardProps) {
  const save = useSaveCheckin(journalId);

  const [activeStep, setActiveStep] = useState<"pre" | "post">("pre");

  // Escalas pre-sesión
  const [mood, setMood] = useState<number>(3);
  const [energy, setEnergy] = useState<number>(3);
  const [stress, setStress] = useState<number>(2);
  const [focus, setFocus] = useState<number>(4);
  const [sleep, setSleep] = useState<string>("7.5");
  const [intention, setIntention] = useState<string>("");

  // Cierre post-sesión
  const [review, setReview] = useState<string>("");

  useEffect(() => {
    if (!existing) return;
    setMood(existing.mood ?? 3);
    setEnergy(existing.energy ?? 3);
    setStress(existing.stress ?? 2);
    setFocus(existing.focus ?? 4);
    setSleep(existing.sleep_hours == null ? "" : String(existing.sleep_hours));
    setIntention(existing.intention ?? "");
    setReview(existing.review_note ?? "");
  }, [existing]);

  // Cálculo en vivo del Readiness Score
  const readiness = useMemo(() => {
    const sleepNum = sleep ? parseFloat(sleep) : null;
    return calculateReadinessScore({
      mood,
      energy,
      stress,
      focus,
      sleepHours: sleepNum,
    });
  }, [mood, energy, stress, focus, sleep]);

  async function submit() {
    try {
      await save.mutateAsync({
        date: todayKey(),
        mood,
        energy,
        stress,
        focus,
        sleep_hours: sleep ? parseFloat(sleep) : null,
        intention: intention.trim() || null,
        review_note: review.trim() || null,
      });
      toast.success(
        existing
          ? "Check-in actualizado correctamente"
          : "¡Check-in guardado! Mantén la calma y ejecuta tu plan",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el check-in");
    }
  }

  const handleSelectPreset = (preset: string) => {
    if (intention.includes(preset)) return;
    setIntention((prev) => (prev ? `${prev}\n${preset}` : preset));
  };

  return (
    <section className="panel p-5 space-y-4 relative overflow-hidden flex flex-col justify-between">
      {/* Background Subtle Gradient */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-brand/10 via-brand/5 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      <div>
        {/* Header con Badge de Racha */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand/10 text-brand shadow-xs">
              <Brain className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display uppercase tracking-wide text-foreground">
                Ritual Diario de Psicología
              </h3>
              <p className="text-xs text-muted-foreground">
                {existing
                  ? "✓ Registrado hoy · Puedes actualizarlo en cualquier momento"
                  : "2 minutos de preparación antes de operar"}
              </p>
            </div>
          </div>

          {streakDays > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-500">
              <Flame className="size-3.5 fill-amber-500 animate-pulse" />
              <span>Racha: {streakDays} {streakDays === 1 ? "día" : "días"}</span>
            </div>
          )}
        </div>

        {/* Step Tabs: Pre-Sesión vs Post-Sesión */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/60 mt-3">
          <button
            type="button"
            onClick={() => setActiveStep("pre")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeStep === "pre"
                ? "bg-card text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Sparkles className="size-3.5 text-brand" />
            <span>1. Pre-Sesión (Preparación & Foco)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveStep("post")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeStep === "post"
                ? "bg-card text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Target className="size-3.5 text-purple-500" />
            <span>2. Post-Sesión (Cierre & Aprendizaje)</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* PASO 1: PRE-SESIÓN                                                        */}
        {/* ========================================================================= */}
        {activeStep === "pre" ? (
          <div className="space-y-4 pt-3">
            {/* Banner de Readiness Score en Vivo */}
            <div
              className={cn(
                "rounded-xl border p-3 flex flex-wrap items-center justify-between gap-3 transition-all",
                readiness.level === "optimal"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : readiness.level === "good"
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                    : readiness.level === "caution"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                      : "bg-loss/10 border-loss/30 text-loss",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-background/80 shadow-xs border border-border/40 shrink-0">
                  <span className="num text-base font-black text-foreground">
                    {readiness.score}%
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Índice de Preparación Mental
                  </p>
                  <p className="text-xs opacity-90 leading-tight mt-0.5">
                    {readiness.advice}
                  </p>
                </div>
              </div>

              {readiness.score < 55 && (
                <span className="text-[11px] font-bold px-2 py-1 rounded bg-background/70 border border-current text-foreground shrink-0">
                  💡 Haz una respiración 3 fases
                </span>
              )}
            </div>

            {/* Escala 1: Estado de Ánimo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <Label className="font-bold text-foreground flex items-center gap-1.5">
                  <HeartPulse className="size-3.5 text-brand" /> Estado de Ánimo
                </Label>
                <span className="text-muted-foreground text-[11px] font-medium">
                  {SCALE_DESCRIPTIONS.mood[mood - 1]?.label}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {SCALE_DESCRIPTIONS.mood.map((m) => {
                  const selected = mood === m.level;
                  return (
                    <button
                      key={m.level}
                      type="button"
                      onClick={() => setMood(m.level)}
                      className={cn(
                        "flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition-all cursor-pointer group",
                        selected
                          ? "border-brand bg-brand/15 shadow-xs scale-[1.02] ring-1 ring-brand font-bold"
                          : "border-border/70 bg-card hover:bg-muted/40 hover:border-foreground/30",
                      )}
                    >
                      <span className="text-2xl leading-none transition-transform group-hover:scale-110">
                        {m.face}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-1 text-center font-medium leading-tight line-clamp-1">
                        {m.level} · {m.label.split("/")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid 2 Columnas: Energía y Estrés */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Energía */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Label className="font-bold text-foreground flex items-center gap-1.5">
                    <Zap className="size-3.5 text-amber-500" /> Nivel de Energía
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {SCALE_DESCRIPTIONS.energy[energy - 1]?.label}
                  </span>
                </div>
                <div className="flex gap-1">
                  {SCALE_DESCRIPTIONS.energy.map((e) => (
                    <button
                      key={e.level}
                      type="button"
                      onClick={() => setEnergy(e.level)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer text-center",
                        energy === e.level
                          ? "border-amber-500 bg-amber-500/20 text-foreground ring-1 ring-amber-500/50"
                          : "border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30",
                      )}
                    >
                      {e.level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estrés */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Label className="font-bold text-foreground flex items-center gap-1.5">
                    <ShieldAlert className="size-3.5 text-loss" /> Tensión / Estrés
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {SCALE_DESCRIPTIONS.stress[stress - 1]?.label}
                  </span>
                </div>
                <div className="flex gap-1">
                  {SCALE_DESCRIPTIONS.stress.map((s) => (
                    <button
                      key={s.level}
                      type="button"
                      onClick={() => setStress(s.level)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer text-center",
                        stress === s.level
                          ? "border-loss bg-loss/20 text-foreground ring-1 ring-loss/50"
                          : "border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30",
                      )}
                    >
                      {s.level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grid 2 Columnas: Foco y Horas de Sueño */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Foco */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Label className="font-bold text-foreground flex items-center gap-1.5">
                    <Target className="size-3.5 text-blue-500" /> Claridad & Foco
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {SCALE_DESCRIPTIONS.focus[focus - 1]?.label}
                  </span>
                </div>
                <div className="flex gap-1">
                  {SCALE_DESCRIPTIONS.focus.map((f) => (
                    <button
                      key={f.level}
                      type="button"
                      onClick={() => setFocus(f.level)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer text-center",
                        focus === f.level
                          ? "border-blue-500 bg-blue-500/20 text-foreground ring-1 ring-blue-500/50"
                          : "border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30",
                      )}
                    >
                      {f.level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sueño */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Label htmlFor="sleep" className="font-bold text-foreground flex items-center gap-1.5">
                    <Moon className="size-3.5 text-indigo-400" /> Horas de Sueño
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {sleep ? `${sleep} horas` : "Opcional"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    id="sleep"
                    type="number"
                    step="0.5"
                    min="3"
                    max="14"
                    value={sleep}
                    onChange={(e) => setSleep(e.target.value)}
                    placeholder="7.5"
                    className="h-8.5 flex-1 rounded-lg border border-border bg-card px-3 text-xs num font-semibold focus:ring-1 focus:ring-brand"
                  />
                  {["6", "7.5", "8.5"].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSleep(val)}
                      className={cn(
                        "h-8.5 px-2 rounded-lg border text-xs num font-semibold transition cursor-pointer",
                        sleep === val
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {val}h
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Compromiso / Intención del Día */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="intention" className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                  <Target className="size-3.5 text-brand" /> Intención & Compromiso del Día
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Atajos rápidos:
                </span>
              </div>

              {/* Chips Rápidos */}
              <div className="flex flex-wrap gap-1.5">
                {INTENTION_PRESETS.map((p) => {
                  const active = intention.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold border transition cursor-pointer text-left flex items-center gap-1",
                        active
                          ? "border-brand bg-brand text-primary-foreground font-bold shadow-xs"
                          : "border-border/70 bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30",
                      )}
                    >
                      {active && <Check className="size-3 shrink-0" />}
                      <span>{p}</span>
                    </button>
                  );
                })}
              </div>

              <Textarea
                id="intention"
                rows={2}
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="Escribe tu compromiso personal de hoy: a qué te comprometes o qué debes evitar..."
                className="text-xs rounded-xl resize-none bg-muted/20 border-border/80"
              />
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* PASO 2: POST-SESIÓN (CIERRE)                                              */
          /* ========================================================================= */
          <div className="space-y-4 pt-3">
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/[0.05] p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <Target className="size-3.5 text-purple-500" /> Auditoría de Disciplina Post-Mercado
              </p>
              <p className="leading-relaxed text-[11px]">
                Evalúa tu sesión sin juzgarte por el resultado monetario: lo que importa es si respetaste tus reglas y tu gestión de riesgo.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="review" className="font-bold text-foreground text-xs flex items-center gap-1.5">
                <Brain className="size-3.5 text-brand" /> Cierre & Aprendizajes de la Sesión
              </Label>
              <Textarea
                id="review"
                rows={4}
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="¿Qué hiciste bien hoy? ¿Qué errores cometiste que debes evitar mañana? ¿Respetaste tu plan operativo?"
                className="text-xs rounded-xl resize-none bg-muted/20 border-border/80"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer con Botón Guardar */}
      <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3 mt-4">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Clock className="size-3 text-muted-foreground/60" />
          {existing ? "Último registro guardado" : "Check-in pendiente para hoy"}
        </span>

        <Button
          type="button"
          onClick={submit}
          disabled={save.isPending}
          className="gap-2 font-bold shadow-xs cursor-pointer px-5"
        >
          <Save className="size-4" />
          {save.isPending ? "Guardando…" : existing ? "Actualizar check-in" : "Guardar check-in"}
        </Button>
      </div>
    </section>
  );
}
