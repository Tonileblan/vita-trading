import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MOOD_FACES, todayKey } from "@/lib/emotions";
import { useSaveCheckin, type MoodCheckin } from "@/lib/mood";
import { cn } from "@/lib/utils";

const SCALES = [
  { key: "mood", label: "Ánimo" },
  { key: "energy", label: "Energía" },
  { key: "stress", label: "Estrés" },
  { key: "focus", label: "Foco" },
] as const;

type ScaleKey = (typeof SCALES)[number]["key"];

function Scale({
  label,
  value,
  onChange,
  faces,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  faces?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "flex-1 rounded-md border text-sm font-semibold transition-colors",
              faces
                ? "flex h-9 items-center justify-center text-2xl leading-none"
                : "h-9",
              value === n
                ? "border-brand bg-brand/15 text-brand-soft"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {faces ? MOOD_FACES[n - 1] : n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MoodCheckinCard({
  journalId,
  existing,
}: {
  journalId: string;
  existing?: MoodCheckin | undefined;
}) {
  const save = useSaveCheckin(journalId);
  const [values, setValues] = useState<Record<ScaleKey, number>>({
    mood: 3,
    energy: 3,
    stress: 3,
    focus: 3,
  });
  const [sleep, setSleep] = useState("");
  const [intention, setIntention] = useState("");
  const [review, setReview] = useState("");

  useEffect(() => {
    if (!existing) return;
    setValues({
      mood: existing.mood,
      energy: existing.energy,
      stress: existing.stress,
      focus: existing.focus,
    });
    setSleep(existing.sleep_hours == null ? "" : String(existing.sleep_hours));
    setIntention(existing.intention ?? "");
    setReview(existing.review_note ?? "");
  }, [existing]);

  async function submit() {
    try {
      await save.mutateAsync({
        date: todayKey(),
        ...values,
        sleep_hours: sleep ? Number(sleep) : null,
        intention: intention.trim() || null,
        review_note: review.trim() || null,
      });
      toast.success("Check-in guardado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el check-in");
    }
  }

  return (
    <section className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl leading-none">Check-in de hoy</h2>
        <span className="text-xs text-muted-foreground">
          {existing ? "Ya registrado · puedes actualizarlo" : "Menos de 20 segundos"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SCALES.map((s) => (
          <Scale
            key={s.key}
            label={s.label}
            value={values[s.key]}
            faces={s.key === "mood"}
            onChange={(v) => setValues((prev) => ({ ...prev, [s.key]: v }))}
          />
        ))}
        <div className="space-y-1.5">
          <Label htmlFor="sleep">Horas de sueño</Label>
          <Input
            id="sleep"
            inputMode="decimal"
            value={sleep}
            onChange={(e) => setSleep(e.target.value)}
            placeholder="7.5"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="intention">Intención del día</Label>
          <Textarea
            id="intention"
            rows={2}
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="Qué me preocupa / a qué me comprometo hoy"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review">Cierre del día</Label>
          <Textarea
            id="review"
            rows={2}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Qué hice bien, qué repetir, qué evitar"
          />
        </div>
      </div>
      <Button onClick={submit} disabled={save.isPending}>
        Guardar check-in
      </Button>
    </section>
  );
}
