/** Catálogos de gestión emocional, escalas y descriptores enriquecidos. */

export type FollowedPlan = "yes" | "partial" | "no";

export interface EmotionDefinition {
  key: string;
  label: string;
  color: string;
  description: string;
  category: "optimal" | "alert" | "danger";
}

export const EMOTIONS_BEFORE: readonly EmotionDefinition[] = [
  {
    key: "calma",
    label: "Calma",
    color: "#10b981", // emerald
    description: "Mente serena, paciencia y lectura objetiva",
    category: "optimal",
  },
  {
    key: "confianza",
    label: "Confianza",
    color: "#3b82f6", // blue
    description: "Seguridad técnica en el setup y gestión",
    category: "optimal",
  },
  {
    key: "ansiedad",
    label: "Ansiedad",
    color: "#f59e0b", // amber
    description: "Inquietud, miedo a perder o duda al entrar",
    category: "alert",
  },
  {
    key: "fomo",
    label: "FOMO",
    color: "#8b5cf6", // purple
    description: "Miedo a quedarse fuera de un movimiento",
    category: "alert",
  },
  {
    key: "aburrimiento",
    label: "Aburrimiento",
    color: "#64748b", // slate
    description: "Operar por inercia o buscar acción",
    category: "alert",
  },
  {
    key: "venganza",
    label: "Venganza",
    color: "#ef4444", // red
    description: "Intentar recuperar una pérdida previa ya",
    category: "danger",
  },
] as const;

export const EMOTIONS_AFTER = [
  { key: "satisfecho", label: "Satisfecho", color: "#10b981" },
  { key: "indiferente", label: "Indiferente", color: "#64748b" },
  { key: "frustrado", label: "Frustrado", color: "#f59e0b" },
  { key: "euforico", label: "Eufórico", color: "#8b5cf6" },
  { key: "culpable", label: "Culpable", color: "#ef4444" },
] as const;

export const MISTAKES = [
  { key: "entrada-precipitada", label: "Entrada precipitada", tip: "Espera confirmación de vela o nivel" },
  { key: "sin-stop", label: "Sin stop loss", tip: "Nunca entres al mercado sin riesgo acotado" },
  { key: "mover-stop", label: "Mover el stop", tip: "Acepta el riesgo inicial sin alejar el stop" },
  { key: "revenge", label: "Revenge trade", tip: "Respeta el descanso tras una pérdida" },
  { key: "sobreoperar", label: "Sobreoperar (Overtrading)", tip: "Máximo 2-3 trades de alta calidad" },
  { key: "salida-temprana", label: "Salida temprana / Miedo", tip: "Deja correr el trade hasta el target" },
  { key: "sobreapalancar", label: "Sobreapalancamiento", tip: "Arriesga siempre el porcentaje planeado" },
] as const;

export const FOLLOWED_PLAN: { key: FollowedPlan; label: string; color: string }[] = [
  { key: "yes", label: "Sí (100% al plan)", color: "#10b981" },
  { key: "partial", label: "Parcial (desvíos menores)", color: "#f59e0b" },
  { key: "no", label: "No (indisciplina)", color: "#ef4444" },
];

export const INTENTION_PRESETS = [
  "🎯 Seguir mi plan al 100% sin excepciones",
  "🛑 Cero FOMO: esperaré confirmación estricta",
  "🛡️ Aceptar el Stop Loss como coste de negocio",
  "⚡ Máximo 2 operaciones de alta calidad (A+)",
  "🧘 Paciencia: no forzar trades en rangos",
  "💰 Proteger mi capital y respetar mi drawdown",
] as const;

export const SCALE_DESCRIPTIONS = {
  mood: [
    { level: 1, label: "Frustrado / Desanimado", face: "😖", color: "#ef4444" },
    { level: 2, label: "Inseguro / Negativo", face: "🙁", color: "#f97316" },
    { level: 3, label: "Neutro / Equilibrado", face: "😐", color: "#eab308" },
    { level: 4, label: "Positivo / Enfocado", face: "🙂", color: "#3b82f6" },
    { level: 5, label: "Óptimo / En la Zona", face: "😄", color: "#10b981" },
  ],
  energy: [
    { level: 1, label: "Agotado / Sin pilas", color: "#ef4444" },
    { level: 2, label: "Baja energía", color: "#f97316" },
    { level: 3, label: "Energía normal", color: "#eab308" },
    { level: 4, label: "Enérgico y despierto", color: "#3b82f6" },
    { level: 5, label: "Máxima vitalidad", color: "#10b981" },
  ],
  stress: [
    { level: 1, label: "Cero tensión (Paz)", color: "#10b981" },
    { level: 2, label: "Relajado", color: "#3b82f6" },
    { level: 3, label: "Tensión moderada", color: "#eab308" },
    { level: 4, label: "Elevado estrés", color: "#f97316" },
    { level: 5, label: "Sobrecarga / Alerta", color: "#ef4444" },
  ],
  focus: [
    { level: 1, label: "Disperso / Fatiga", color: "#ef4444" },
    { level: 2, label: "Distraído", color: "#f97316" },
    { level: 3, label: "Foco aceptable", color: "#eab308" },
    { level: 4, label: "Concentrado", color: "#3b82f6" },
    { level: 5, label: "Hiperfoco total", color: "#10b981" },
  ],
} as const;

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

/**
 * Parsea de forma segura cualquier formato de fecha (ISO, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY)
 * evitando que JavaScript interprete DD/MM/YYYY como MM/DD/YYYY (ej: 05/08/2026 como 8 de mayo).
 */
export function parseTradeDate(val: string | number | Date | null | undefined): Date {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val === "number") return new Date(val);

  const s = String(val).trim();
  if (!s) return new Date();

  // 1. Formato ISO YYYY-MM-DD o YYYY/MM/DD (con o sin hora)
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const hour = Number(isoMatch[4] ?? 0);
    const min = Number(isoMatch[5] ?? 0);
    const sec = Number(isoMatch[6] ?? 0);
    return new Date(year, month, day, hour, min, sec);
  }

  // 2. Formato con día/mes o mes/día (DD/MM/YYYY, MM/DD/YYYY, D-M-YYYY)
  const slashMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (slashMatch) {
    const a = Number(slashMatch[1]);
    const b = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    const hour = Number(slashMatch[4] ?? 0);
    const min = Number(slashMatch[5] ?? 0);
    const sec = Number(slashMatch[6] ?? 0);

    let day = a;
    let month = b - 1; // 0-indexed

    if (a > 12 && b <= 12) {
      // Formato Europeo estricto: DD/MM/YYYY (ej: 28/07/2026 -> 28 jul)
      day = a;
      month = b - 1;
    } else if (b > 12 && a <= 12) {
      // Formato US estricto: MM/DD/YYYY (ej: 07/28/2026 -> 28 jul)
      day = b;
      month = a - 1;
    } else {
      // Caso ambiguo (ambos <= 12, ej: 08/04/2026 vs 04/08/2026):
      // El número mayor corresponde al mes activo de trading (julio=7, agosto=8, septiembre=9, etc.)
      if (a >= 7 && a <= 12 && b < a) {
        // 'a' es el mes (formato US: MM/DD/YYYY, ej: 08/04/2026 -> 4 de agosto)
        month = a - 1;
        day = b;
      } else if (b >= 7 && b <= 12 && a < b) {
        // 'b' es el mes (formato EU: DD/MM/YYYY, ej: 04/08/2026 -> 4 de agosto)
        month = b - 1;
        day = a;
      } else {
        // Fallback natural a DD/MM/YYYY
        day = a;
        month = b - 1;
      }
    }

    return new Date(year, month, day, hour, min, sec);
  }

  // 3. Fallback estándar
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function parseTradeTime(val: string | number | Date | null | undefined): number {
  return parseTradeDate(val).getTime();
}

export function formatTradeDateLabel(val: string | number | Date | null | undefined): string {
  const d = parseTradeDate(val);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

/** Clave local YYYY-MM-DD de una operación comercial. */
export function tradeDayKey(t: { closedAt?: string | null; openedAt?: string | null }): string {
  const iso = t.openedAt || t.closedAt;
  if (!iso) return "";
  const d = parseTradeDate(iso);
  return todayKey(d);
}

/**
 * Calcula un Índice de Preparación Mental (Readiness Score 0-100)
 * basado en ánimo, energía, estrés inverso, foco y horas de sueño.
 */
export function calculateReadinessScore(params: {
  mood: number;
  energy: number;
  stress: number;
  focus: number;
  sleepHours?: number | null;
}): { score: number; level: "optimal" | "good" | "caution" | "danger"; advice: string } {
  const { mood, energy, stress, focus, sleepHours } = params;
  
  // Estrés inverso: 1 es estrés nulo (óptimo 5), 5 es estrés máximo (1)
  const invertedStress = 6 - Math.min(Math.max(stress, 1), 5);
  
  const baseScore = ((mood + energy + invertedStress + focus) / 20) * 100;
  
  let sleepMultiplier = 1.0;
  if (sleepHours != null) {
    if (sleepHours < 5.5) sleepMultiplier = 0.85;
    else if (sleepHours < 6.5) sleepMultiplier = 0.93;
    else if (sleepHours >= 7 && sleepHours <= 9) sleepMultiplier = 1.05;
  }
  
  const finalScore = Math.min(Math.max(Math.round(baseScore * sleepMultiplier), 0), 100);

  if (finalScore >= 80) {
    return {
      score: finalScore,
      level: "optimal",
      advice: "Mente en estado óptimo. Claridad, foco y calma para ejecutar tu plan.",
    };
  }
  if (finalScore >= 60) {
    return {
      score: finalScore,
      level: "good",
      advice: "Buen estado operativo. Mantén la paciencia y no forces entradas.",
    };
  }
  if (finalScore >= 40) {
    return {
      score: finalScore,
      level: "caution",
      advice: "Nivel de alerta: estrés moderado o energía baja. Reduce tamaño de posición.",
    };
  }
  return {
    score: finalScore,
    level: "danger",
    advice: "Estado crítico de tilt o fatiga. Haz una sesión de respiración antes de operar.",
  };
}
