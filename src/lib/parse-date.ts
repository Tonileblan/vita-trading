const MONTHS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

const build = (y: number, m: number, d: number, hh = 0, mm = 0, ss = 0) => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const year = y < 100 ? 2000 + y : y;
  const date = new Date(year, m - 1, d, hh, mm, ss);
  if (Number.isNaN(date.getTime())) return null;
  return `${year}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}`;
};

/**
 * Interpreta fechas detectadas en capturas de trading.
 * Soporta ISO, dd/mm/yyyy, mm/dd/yyyy, dd-mm-yy y "14 may 2026", con hora opcional.
 * Devuelve una fecha local ISO (sin zona) o null si no se puede leer.
 */
export function parseDetectedDate(raw?: string | null): string | null {
  if (!raw) return null;
  const value = String(raw).trim().replace(/\s+/g, " ");
  if (!value) return null;

  // Hora opcional al final (24h o am/pm)
  const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
  let hh = 0;
  let mm = 0;
  let ss = 0;
  if (timeMatch) {
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
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]), hh, mm, ss);

  // Numérica con / . o -
  const num = value.match(/(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?/);
  if (num) {
    const a = Number(num[1]);
    const b = Number(num[2]);
    const year = num[3] ? Number(num[3]) : currentYear;
    // Si el primero supera 12 es día (formato europeo); si el segundo supera 12 es día → formato US.
    if (a > 12 && b <= 12) return build(year, b, a, hh, mm, ss);
    if (b > 12 && a <= 12) return build(year, a, b, hh, mm, ss);
    // Ambiguo: asumimos día/mes (formato usado en ES y la mayoría de plataformas EU).
    return build(year, b, a, hh, mm, ss);
  }

  // Textual: "14 may 2026" o "May 14, 2026"
  const textual = value.match(/(\d{1,2})\s*(?:de\s*)?([a-záéíóú]{3,10})\.?\s*(?:de\s*)?(\d{2,4})?/i);
  if (textual) {
    const key = textual[2]!.toLowerCase().slice(0, 4);
    const month = MONTHS[key] ?? MONTHS[key.slice(0, 3)];
    if (month) {
      return build(textual[3] ? Number(textual[3]) : currentYear, month, Number(textual[1]), hh, mm, ss);
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
    );
  }
  return null;
}
