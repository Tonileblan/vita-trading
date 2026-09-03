export type CaptureTimezoneMode = "bogota" | "local" | "ny" | "madrid" | "utc";

export const CAPTURE_TIMEZONE_CONFIGS: {
  id: CaptureTimezoneMode;
  label: string;
  shortLabel: string;
  offset: string | null;
  description: string;
}[] = [
  {
    id: "bogota",
    label: "Bogotá / Colombia (UTC-5)",
    shortLabel: "Bogotá (UTC-5)",
    offset: "-05:00",
    description: "Para plataformas y VPS en hora de Colombia (ej. Tradovate / NinjaTrader)",
  },
  {
    id: "local",
    label: "Hora local de mi dispositivo (Sin conversión)",
    shortLabel: "Hora local",
    offset: null,
    description: "Mantiene la hora exacta tal como se ve en la captura",
  },
  {
    id: "ny",
    label: "Nueva York / EST (UTC-4 / UTC-5)",
    shortLabel: "Nueva York (ET)",
    offset: "-04:00",
    description: "Para plataformas configuradas en horario de mercado NY",
  },
  {
    id: "madrid",
    label: "Madrid / Europa (UTC+1 / UTC+2)",
    shortLabel: "Madrid (CET/CEST)",
    offset: "+02:00",
    description: "Para capturas tomadas en hora española/europea",
  },
];

const MONTHS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Convierte una fecha y hora leída de una captura a una cadena ISO local (YYYY-MM-DDTHH:mm:ss)
 * adaptada a la zona horaria del navegador del usuario según el modo seleccionado (por defecto Bogotá UTC-5).
 */
const build = (
  y: number,
  m: number,
  d: number,
  hh = 0,
  mm = 0,
  ss = 0,
  hasExplicitTime = true,
  tzMode: CaptureTimezoneMode = "bogota",
) => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const year = y < 100 ? 2000 + y : y;

  const targetConfig = CAPTURE_TIMEZONE_CONFIGS.find((c) => c.id === tzMode) ?? CAPTURE_TIMEZONE_CONFIGS[0];
  const offset = targetConfig?.offset;

  if (hasExplicitTime && offset) {
    const isoString = `${year}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}${offset}`;
    const dateObj = new Date(isoString);
    if (!Number.isNaN(dateObj.getTime())) {
      const ly = dateObj.getFullYear();
      const lm = dateObj.getMonth() + 1;
      const ld = dateObj.getDate();
      const lhh = dateObj.getHours();
      const lmm = dateObj.getMinutes();
      const lss = dateObj.getSeconds();
      return `${ly}-${pad(lm)}-${pad(ld)}T${pad(lhh)}:${pad(lmm)}:${pad(lss)}`;
    }
  }

  const date = new Date(year, m - 1, d, hh, mm, ss);
  if (Number.isNaN(date.getTime())) return null;
  return `${year}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}`;
};

/**
 * Interpreta fechas detectadas en capturas de trading.
 * Convierte de la zona horaria de origen de la captura (por defecto Bogotá UTC-5)
 * a la hora local del usuario para su diario y slots operativos.
 */
export function parseDetectedDate(
  raw?: string | null,
  tzMode: CaptureTimezoneMode = "bogota",
): string | null {
  if (!raw) return null;
  const value = String(raw).trim().replace(/\s+/g, " ");
  if (!value) return null;

  // Si ya contiene zona horaria explícita (ej. Z o +02:00 o -05:00)
  const explicitTzMatch = value.match(/(Z|[+-]\d{2}(?::?\d{2})?)$/);
  if (explicitTzMatch) {
    const dateObj = new Date(value);
    if (!Number.isNaN(dateObj.getTime())) {
      const ly = dateObj.getFullYear();
      const lm = dateObj.getMonth() + 1;
      const ld = dateObj.getDate();
      const lhh = dateObj.getHours();
      const lmm = dateObj.getMinutes();
      const lss = dateObj.getSeconds();
      return `${ly}-${pad(lm)}-${pad(ld)}T${pad(lhh)}:${pad(lmm)}:${pad(lss)}`;
    }
  }

  // Hora opcional al final (24h o am/pm)
  const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
  let hh = 0;
  let mm = 0;
  let ss = 0;
  let hasExplicitTime = false;
  if (timeMatch) {
    hasExplicitTime = true;
    hh = Number(timeMatch[1]);
    mm = Number(timeMatch[2]);
    ss = Number(timeMatch[3] ?? 0);
    const suffix = timeMatch[4]?.toLowerCase();
    if (suffix?.startsWith("p") && hh < 12) hh += 12;
    if (suffix?.startsWith("a") && hh === 12) hh = 0;
    if (hh > 23 || mm > 59) return null;
  }

  const currentYear = new Date().getFullYear();

  // ISO: 2026-05-14 (opcionalmente con hora ya capturada)
  const iso = value.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]), hh, mm, ss, hasExplicitTime, tzMode);

  // Numérica con / . o -
  const num = value.match(/(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?/);
  if (num) {
    const a = Number(num[1]);
    const b = Number(num[2]);
    const year = num[3] ? Number(num[3]) : currentYear;
    // Si el primero supera 12 es día (formato europeo D/M/YYYY)
    if (a > 12 && b <= 12) return build(year, b, a, hh, mm, ss, hasExplicitTime, tzMode);
    // Si el segundo supera 12 es día (formato US M/D/YYYY)
    if (b > 12 && a <= 12) return build(year, a, b, hh, mm, ss, hasExplicitTime, tzMode);

    // Caso ambiguo (ambos <= 12, ej: 9/3/2026):
    const now = new Date();
    const curMonth = now.getMonth() + 1; // 9 para septiembre
    if (a === curMonth && b !== curMonth) {
      // 'a' es el mes actual (ej: 9/3 en septiembre -> Mes 9, Día 3)
      return build(year, a, b, hh, mm, ss, hasExplicitTime, tzMode);
    }
    if (b === curMonth && a !== curMonth) {
      // 'b' es el mes actual (ej: 3/9 en septiembre -> Mes 9, Día 3)
      return build(year, b, a, hh, mm, ss, hasExplicitTime, tzMode);
    }

    // Por defecto en plataformas de futuros (NinjaTrader, Tradovate, Rithmic, Topstep): formato M/D/YYYY
    return build(year, a, b, hh, mm, ss, hasExplicitTime, tzMode);
  }

  // Textual: "14 may 2026" o "May 14, 2026"
  const textual = value.match(/(\d{1,2})\s*(?:de\s*)?([a-záéíóú]{3,10})\.?\s*(?:de\s*)?(\d{2,4})?/i);
  if (textual) {
    const key = textual[2]!.toLowerCase().slice(0, 4);
    const month = MONTHS[key] ?? MONTHS[key.slice(0, 3)];
    if (month) {
      return build(textual[3] ? Number(textual[3]) : currentYear, month, Number(textual[1]), hh, mm, ss, hasExplicitTime, tzMode);
    }
  }
  const textualUs = value.match(/([a-záéíóú]{3,10})\.?\s+(\d{1,2})(?:,)?\s*(\d{2,4})?/i);
  if (textualUs) {
    const key = textualUs[1]!.toLowerCase().slice(0, 4);
    const month = MONTHS[key] ?? MONTHS[key.slice(0, 3)];
    if (month) {
      return build(
        textualUs[3] ? Number(textualUs[3]) : currentYear,
        month,
        Number(textualUs[2]),
        hh,
        mm,
        ss,
        hasExplicitTime,
        tzMode,
      );
    }
  }

  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) {
    return build(
      fallback.getFullYear(),
      fallback.getMonth() + 1,
      fallback.getDate(),
      fallback.getHours(),
      fallback.getMinutes(),
      fallback.getSeconds(),
      false,
      tzMode,
    );
  }
  return null;
}
