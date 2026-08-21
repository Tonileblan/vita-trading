const MONTHS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

const BOGOTA_OFFSET = "-05:00";

/**
 * Convierte una fecha y hora leída de una captura (en hora de Bogotá UTC-5)
 * a una cadena ISO local (YYYY-MM-DDTHH:mm:ss) adaptada a la zona horaria del navegador del usuario.
 * Si el usuario está en España (+6/+7h), las 19:30 de Bogotá se convierten en las 01:30 o 02:30.
 * Si el usuario está en Colombia (UTC-5), se mantiene en 19:30.
 * Si el usuario está en Argentina (UTC-3), se convierte en 21:30.
 */
const build = (
  y: number,
  m: number,
  d: number,
  hh = 0,
  mm = 0,
  ss = 0,
  interpretAsBogota = true,
) => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const year = y < 100 ? 2000 + y : y;

  if (interpretAsBogota) {
    const isoBogota = `${year}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}${BOGOTA_OFFSET}`;
    const dateObj = new Date(isoBogota);
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
 * Las marcas de tiempo de las capturas corresponden a la zona horaria de Bogotá (UTC-5).
 * Se convierten automáticamente a la hora local del usuario para su diario.
 */
export function parseDetectedDate(raw?: string | null): string | null {
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
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]), hh, mm, ss, hasExplicitTime);

  // Numérica con / . o -
  const num = value.match(/(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?/);
  if (num) {
    const a = Number(num[1]);
    const b = Number(num[2]);
    const year = num[3] ? Number(num[3]) : currentYear;
    // Si el primero supera 12 es día (formato europeo); si el segundo supera 12 es día → formato US.
    if (a > 12 && b <= 12) return build(year, b, a, hh, mm, ss, hasExplicitTime);
    if (b > 12 && a <= 12) return build(year, a, b, hh, mm, ss, hasExplicitTime);
    // Ambiguo: asumimos día/mes (formato usado en ES y la mayoría de plataformas EU/Latam).
    return build(year, b, a, hh, mm, ss, hasExplicitTime);
  }

  // Textual: "14 may 2026" o "May 14, 2026"
  const textual = value.match(/(\d{1,2})\s*(?:de\s*)?([a-záéíóú]{3,10})\.?\s*(?:de\s*)?(\d{2,4})?/i);
  if (textual) {
    const key = textual[2]!.toLowerCase().slice(0, 4);
    const month = MONTHS[key] ?? MONTHS[key.slice(0, 3)];
    if (month) {
      return build(textual[3] ? Number(textual[3]) : currentYear, month, Number(textual[1]), hh, mm, ss, hasExplicitTime);
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
    );
  }
  return null;
}
