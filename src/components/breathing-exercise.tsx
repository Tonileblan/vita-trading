import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Wind,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Brain,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BreathPhase = "idle" | "inhale" | "hold" | "exhale";

interface BreathPattern {
  id: string;
  name: string;
  subtitle: string;
  inhale: number; // segundos
  hold: number;   // segundos
  exhale: number; // segundos
  tag: string;
  color: string;
}

const PATTERNS: BreathPattern[] = [
  {
    id: "triangular",
    name: "Triangular 4-4-4",
    subtitle: "Enfoque, claridad mental y presencia",
    inhale: 4,
    hold: 4,
    exhale: 4,
    tag: "Equilibrio",
    color: "from-blue-500 to-cyan-400",
  },
  {
    id: "calm-446",
    name: "Calma 4-4-6",
    subtitle: "Reducción de ansiedad pre-sesión",
    inhale: 4,
    hold: 4,
    exhale: 6,
    tag: "Pre-Trading",
    color: "from-indigo-500 to-teal-400",
  },
  {
    id: "anti-tilt",
    name: "Anti-Tilt 4-7-8",
    subtitle: "Reset parasimpático tras pérdidas",
    inhale: 4,
    hold: 7,
    exhale: 8,
    tag: "Anti-FOMO",
    color: "from-purple-500 to-emerald-400",
  },
];

export function BreathingExercise() {
  const [selectedPattern, setSelectedPattern] = useState<BreathPattern>(PATTERNS[0]!);
  const [targetCycles, setTargetCycles] = useState<number>(5);
  const [completedCycles, setCompletedCycles] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [phase, setPhase] = useState<BreathPhase>("idle");
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Audio Context synth chime
  const playChime = (freq = 440, type: OscillatorType = "sine") => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.9);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Timer loop
  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) {
          return prev - 1;
        }

        // Transición de fase
        if (phase === "inhale") {
          playChime(523.25); // Do5 (C5)
          setPhase("hold");
          return selectedPattern.hold;
        } else if (phase === "hold") {
          playChime(392.0); // Sol4 (G4)
          setPhase("exhale");
          return selectedPattern.exhale;
        } else if (phase === "exhale") {
          const nextCycles = completedCycles + 1;
          setCompletedCycles(nextCycles);

          if (nextCycles >= targetCycles) {
            setIsRunning(false);
            setPhase("idle");
            setIsFinished(true);
            playChime(659.25, "triangle"); // Mi5 (E5)
            return 0;
          }

          playChime(440.0); // La4 (A4)
          setPhase("inhale");
          return selectedPattern.inhale;
        }
        return 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, phase, selectedPattern, completedCycles, targetCycles, soundEnabled]);

  const handleStart = () => {
    setIsFinished(false);
    setIsRunning(true);
    setPhase("inhale");
    setSecondsLeft(selectedPattern.inhale);
    playChime(440);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleResume = () => {
    setIsRunning(true);
  };

  const handleReset = () => {
    setIsRunning(false);
    setPhase("idle");
    setSecondsLeft(0);
    setCompletedCycles(0);
    setIsFinished(false);
  };

  const currentPhaseTitle = () => {
    switch (phase) {
      case "inhale":
        return "Inhala";
      case "hold":
        return "Retén el aire";
      case "exhale":
        return "Exhala";
      default:
        return isFinished ? "¡Completado!" : "Listo";
    }
  };

  const currentPhaseSubtitle = () => {
    switch (phase) {
      case "inhale":
        return "Inhala suavemente por la nariz llenando los pulmones";
      case "hold":
        return "Mantén la respiración y aquieta tus pensamientos";
      case "exhale":
        return "Suelta el aire despacio por la boca liberando tensión";
      default:
        return isFinished
          ? "Has alcanzado un estado mental óptimo y enfocado para tu sesión."
          : "Respira hondo para centrar tu mente y reducir el estrés.";
    }
  };

  const currentOrbScale = () => {
    switch (phase) {
      case "inhale":
        return "scale-125 md:scale-135 bg-blue-500/25 border-blue-400 shadow-blue-500/40";
      case "hold":
        return "scale-125 md:scale-135 bg-indigo-500/30 border-indigo-400 shadow-indigo-500/50 animate-pulse";
      case "exhale":
        return "scale-85 md:scale-90 bg-emerald-500/20 border-emerald-400 shadow-emerald-500/30";
      default:
        return "scale-100 bg-brand/10 border-brand/40 shadow-brand/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Pattern Selector Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {PATTERNS.map((p) => {
          const isSelected = selectedPattern.id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={isRunning}
              onClick={() => {
                setSelectedPattern(p);
                handleReset();
              }}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200",
                isSelected
                  ? "border-brand bg-brand/10 shadow-md shadow-brand/5 ring-1 ring-brand/30"
                  : "border-border bg-card/60 hover:border-border/80 hover:bg-muted/40",
                isRunning && "opacity-60 cursor-not-allowed",
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {p.tag}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      isSelected
                        ? "bg-brand text-brand-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {p.inhale}s · {p.hold}s · {p.exhale}s
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-bold text-foreground">{p.name}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{p.subtitle}</p>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <span className="inline-block size-2 rounded-full bg-blue-500" /> Inhala ({p.inhale}s)
                <span className="text-border">·</span>
                <span className="inline-block size-2 rounded-full bg-indigo-500" /> Retén ({p.hold}s)
                <span className="text-border">·</span>
                <span className="inline-block size-2 rounded-full bg-emerald-500" /> Exhala ({p.exhale}s)
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Breathing Arena */}
      <div className="panel relative overflow-hidden p-6 md:p-10 flex flex-col items-center justify-center text-center">
        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-indigo-500/10 blur-3xl" />

        {/* Header Controls (Cycles & Sound) */}
        <div className="w-full flex items-center justify-between pb-6 border-b border-border/50 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Objetivo:</span>
            <div className="flex gap-1">
              {[3, 5, 8, 10].map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={isRunning}
                  onClick={() => {
                    setTargetCycles(c);
                    setCompletedCycles(0);
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                    targetCycles === c
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted hover:text-foreground",
                    isRunning && "cursor-not-allowed opacity-60",
                  )}
                >
                  {c} ciclos
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 hover:bg-muted transition-colors"
              title={soundEnabled ? "Silenciar campanadas" : "Activar sonido"}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="size-3.5 text-brand" /> Sonido activado
                </>
              ) : (
                <>
                  <VolumeX className="size-3.5 text-muted-foreground" /> Silenciado
                </>
              )}
            </button>
          </div>
        </div>

        {/* The Animated Breathing Orb */}
        <div className="relative my-8 md:my-12 flex size-64 md:size-80 items-center justify-center">
          {/* Outer Ripple Wave */}
          <div
            className={cn(
              "absolute inset-0 rounded-full border border-dashed transition-all duration-1000",
              phase === "inhale" && "border-blue-400/40 scale-110",
              phase === "hold" && "border-indigo-400/50 scale-115 rotate-45",
              phase === "exhale" && "border-emerald-400/30 scale-95",
              phase === "idle" && "border-border/40 scale-100",
            )}
          />

          {/* Core Breathing Orb */}
          <div
            className={cn(
              "relative flex size-44 md:size-52 items-center justify-center rounded-full border-2 shadow-2xl backdrop-blur-md transition-all duration-[2500ms] ease-in-out",
              currentOrbScale(),
            )}
          >
            {/* Inner Glowing Content */}
            <div className="flex flex-col items-center justify-center px-4">
              {isFinished ? (
                <CheckCircle2 className="size-14 text-emerald-400 animate-bounce" />
              ) : (
                <>
                  <p className="text-3xl md:text-4xl font-extrabold tabular-nums tracking-tight text-foreground">
                    {isRunning ? secondsLeft : <Wind className="size-10 text-brand" />}
                  </p>
                  <p className="mt-1 text-sm md:text-base font-bold uppercase tracking-wider text-foreground">
                    {currentPhaseTitle()}
                  </p>
                  {isRunning && (
                    <span className="mt-1 text-[11px] font-semibold text-muted-foreground">
                      Ciclo {completedCycles + 1} de {targetCycles}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Phase Subtitle & Instructions */}
        <div className="max-w-md space-y-2">
          <p className="text-sm md:text-base font-medium text-foreground">
            {currentPhaseSubtitle()}
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 font-semibold transition-all",
                phase === "inhale"
                  ? "bg-blue-500 text-white shadow-sm"
                  : "bg-muted/70 text-muted-foreground",
              )}
            >
              1. Inhalar ({selectedPattern.inhale}s)
            </span>
            <span>→</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 font-semibold transition-all",
                phase === "hold"
                  ? "bg-indigo-500 text-white shadow-sm"
                  : "bg-muted/70 text-muted-foreground",
              )}
            >
              2. Retener ({selectedPattern.hold}s)
            </span>
            <span>→</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 font-semibold transition-all",
                phase === "exhale"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-muted/70 text-muted-foreground",
              )}
            >
              3. Exhalar ({selectedPattern.exhale}s)
            </span>
          </div>
        </div>

        {/* Interactive Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {!isRunning ? (
            <Button
              size="lg"
              onClick={phase !== "idle" ? handleResume : handleStart}
              className="gap-2 px-8 shadow-lg shadow-brand/20 font-bold"
            >
              <Play className="size-4 fill-current" />
              {isFinished ? "Iniciar nueva ronda" : phase !== "idle" ? "Reanudar" : "Comenzar respiración"}
            </Button>
          ) : (
            <Button size="lg" variant="outline" onClick={handlePause} className="gap-2 px-8 font-bold">
              <Pause className="size-4 fill-current" /> Pausar
            </Button>
          )}

          {(isRunning || phase !== "idle" || isFinished) && (
            <Button size="lg" variant="ghost" onClick={handleReset} className="gap-2 text-muted-foreground">
              <RotateCcw className="size-4" /> Reiniciar
            </Button>
          )}
        </div>
      </div>

      {/* Psychology & Trading Benefits Breakdown */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5 space-y-2">
          <div className="flex items-center gap-2.5 text-blue-500 font-bold text-sm">
            <Brain className="size-4" />
            <span>Fase 1: Inhalación Consciente</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Oxigena la corteza prefrontal, aumentando la velocidad de procesamiento y la claridad para evaluar setups sin prisa.
          </p>
        </div>

        <div className="panel p-5 space-y-2">
          <div className="flex items-center gap-2.5 text-indigo-500 font-bold text-sm">
            <ShieldCheck className="size-4" />
            <span>Fase 2: Pausa y Retención</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Interrumpe la reactividad por FOMO o impulsividad. Te brinda el espacio de calma necesario antes de apretar el gatillo.
          </p>
        </div>

        <div className="panel p-5 space-y-2">
          <div className="flex items-center gap-2.5 text-emerald-500 font-bold text-sm">
            <Zap className="size-4" />
            <span>Fase 3: Exhalación Lenta</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Activa el nervio vago y el sistema parasimpático, disipando la tensión muscular y el pulso acelerado tras un trade perdedor.
          </p>
        </div>
      </div>
    </div>
  );
}
