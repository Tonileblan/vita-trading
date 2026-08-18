/** Catálogos de gestión emocional (editables). */

export type FollowedPlan = "yes" | "partial" | "no";

export const EMOTIONS_BEFORE = [
  { key: "calma", label: "Calma" },
  { key: "confianza", label: "Confianza" },
  { key: "ansiedad", label: "Ansiedad" },
  { key: "fomo", label: "FOMO" },
  { key: "aburrimiento", label: "Aburrimiento" },
  { key: "venganza", label: "Venganza" },
] as const;

export const EMOTIONS_AFTER = [
  { key: "satisfecho", label: "Satisfecho" },
  { key: "indiferente", label: "Indiferente" },
  { key: "frustrado", label: "Frustrado" },
  { key: "euforico", label: "Eufórico" },
  { key: "culpable", label: "Culpable" },
] as const;

export const MISTAKES = [
  { key: "entrada-precipitada", label: "Entrada precipitada" },
  { key: "sin-stop", label: "Sin stop" },
  { key: "mover-stop", label: "Mover el stop" },
  { key: "revenge", label: "Revenge trade" },
  { key: "sobreoperar", label: "Sobreoperar" },
  { key: "salida-temprana", label: "Salida temprana" },
  { key: "sobreapalancar", label: "Sobreapalancar" },
] as const;

export const FOLLOWED_PLAN: { key: FollowedPlan; label: string }[] = [
  { key: "yes", label: "Sí" },
  { key: "partial", label: "Parcial" },
  { key: "no", label: "No" },
];

const map = (list: readonly { key: string; label: string }[]) =>
  new Map(list.map((x) => [x.key, x.label]));

const BEFORE = map(EMOTIONS_BEFORE);
const AFTER = map(EMOTIONS_AFTER);
const MIST = map(MISTAKES);

export const emotionBeforeLabel = (k?: string | null) => (k ? (BEFORE.get(k) ?? k) : "");
export const emotionAfterLabel = (k?: string | null) => (k ? (AFTER.get(k) ?? k) : "");
export const mistakeLabel = (k: string) => MIST.get(k) ?? k;
export const followedPlanLabel = (k?: string | null) =>
  FOLLOWED_PLAN.find((f) => f.key === k)?.label ?? "";

export const MOOD_FACES = ["😖", "🙁", "😐", "🙂", "😄"];

/** Fecha local en formato YYYY-MM-DD. */
export function todayKey(d: Date | string = new Date()): string {
  const dateObj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return "";
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(
    dateObj.getDate(),
  ).padStart(2, "0")}`;
}

/** Clave local YYYY-MM-DD de una operación comercial. */
export function tradeDayKey(t: { closedAt?: string | null; openedAt?: string | null }): string {
  const iso = t.closedAt || t.openedAt;
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return todayKey(d);
}
