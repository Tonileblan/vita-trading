/**
 * Utilidades centralizadas para formateo y parseo de dinero, porcentajes y valores numéricos
 */

/**
 * Formatea un valor numérico como divisa con símbolo de dólar/euro y separadores legibles
 */
export function formatCurrency(
  value: number,
  withSign = false,
  currency = "USD",
): string {
  if (!Number.isFinite(value)) return "$0.00";
  const sign = withSign && value > 0 ? "+" : value < 0 ? "-" : "";
  const prefix = currency === "EUR" ? "€" : "$";
  
  const formattedNumber = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${sign}${prefix}${formattedNumber}`;
}

/**
 * Parsea de forma segura cualquier string de entrada de dinero admitiendo tanto formato español (coma decimal)
 * como internacional (punto decimal), espacios y separadores de miles.
 */
export function parseMoneyInput(value: string | number | null | undefined): number {
  if (value == null) return Number.NaN;
  if (typeof value === "number") return value;

  const normalized = value.trim().replace(/\s/g, "").replace(/[$€]/g, "");
  if (!normalized) return Number.NaN;

  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");

  // Ambos presentes: el último determina el decimal y el anterior el separador de miles
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    const thousands = decimal === "," ? /\./g : /,/g;
    return Number(normalized.replace(thousands, "").replace(decimal, "."));
  }

  // Solo coma presente: si tiene 1 o 2 decimales al final es coma decimal
  if (comma >= 0) {
    const parts = normalized.split(",");
    const part0 = parts[0];
    const part1 = parts[1];
    if (parts.length === 2 && part1 != null && part1.length <= 2) {
      return Number(normalized.replace(",", "."));
    }
    // Si tiene 3 dígitos tras la coma, podría ser miles (ej: 1,000)
    if (parts.length === 2 && part0 != null && part1 != null && part1.length === 3 && part0.length >= 1) {
      return Number(part0 + part1);
    }
    return Number(normalized.replace(/,/g, ""));
  }

  // Solo punto presente o número plano
  return Number(normalized);
}

/**
 * Formatea un número como porcentaje (ej: 54.2%)
 */
export function formatPercent(value: number, decimals = 1, withSign = false): string {
  if (!Number.isFinite(value)) return "0.0%";
  const sign = withSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}
