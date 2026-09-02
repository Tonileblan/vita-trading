import { normalizeSymbol, getInstrumentSpec } from "./symbols";
import { parseDetectedDate } from "./parse-date";
import { todayKey } from "./emotions";
import type { Strategy } from "./types";

/**
 * Preselección inteligente de estrategia basada en el activo (GCM -> Oro, MNQ -> IFT/Asia/Fondeo) y horario
 */
export function guessStrategyForTrade(
  symbol: string,
  timeIso: string | null | undefined,
  accountDefaultStrategyId: string,
  strategies: Strategy[],
): string {
  const norm = normalizeSymbol(symbol);

  // 1. Si el activo es Oro (GCM / MGC / GC) -> Preselecciona estrategia "Oro"
  if (norm === "GCM" || norm === "MGC" || norm === "GC") {
    const goldStrat = strategies.find(
      (s) =>
        s.name.toLowerCase().includes("oro") ||
        s.name.toLowerCase().includes("gold") ||
        s.mainSymbol?.toUpperCase() === "GCM" ||
        s.mainSymbol?.toUpperCase() === "MGC" ||
        s.mainSymbol?.toUpperCase() === "GC",
    );
    if (goldStrat) return goldStrat.id;
  }

  // 2. Si el activo es MNQ / NQ -> Preselecciona entre IFT, Asia, Fondeo, etc.
  if (norm === "MNQ" || norm === "NQ") {
    if (timeIso) {
      try {
        const d = new Date(timeIso);
        const hour = d.getHours();
        if ((hour >= 18 || hour <= 5) && strategies.some((s) => s.name.toLowerCase().includes("asia"))) {
          const asiaStrat = strategies.find((s) => s.name.toLowerCase().includes("asia"));
          if (asiaStrat) return asiaStrat.id;
        }
      } catch {}
    }

    const accStrat = strategies.find((s) => s.id === accountDefaultStrategyId);
    if (accStrat && (accStrat.mainSymbol?.toUpperCase() === "MNQ" || accStrat.mainSymbol?.toUpperCase() === "NQ")) {
      return accStrat.id;
    }

    const iftStrat = strategies.find((s) => s.name.toLowerCase().includes("ift"));
    if (iftStrat) return iftStrat.id;

    const fondeoStrat = strategies.find((s) => s.name.toLowerCase().includes("fondeo"));
    if (fondeoStrat) return fondeoStrat.id;

    const asiaStrat = strategies.find((s) => s.name.toLowerCase().includes("asia"));
    if (asiaStrat) return asiaStrat.id;

    const mnqStrat = strategies.find(
      (s) => s.mainSymbol?.toUpperCase() === "MNQ" || s.mainSymbol?.toUpperCase() === "NQ",
    );
    if (mnqStrat) return mnqStrat.id;
  }

  // 3. Si es ES / MES
  if (norm === "ES" || norm === "MES") {
    const swingStrat = strategies.find(
      (s) =>
        s.name.toLowerCase().includes("swing") ||
        s.mainSymbol?.toUpperCase() === "ES" ||
        s.mainSymbol?.toUpperCase() === "MES",
    );
    if (swingStrat) return swingStrat.id;
  }

  // 4. Coincidencia por mainSymbol de la estrategia
  const bySymbol = strategies.find((s) => s.mainSymbol?.toUpperCase() === norm);
  if (bySymbol) return bySymbol.id;

  // 5. Fallback a la estrategia por defecto de la cuenta o primera disponible
  return accountDefaultStrategyId || strategies[0]?.id || "";
}

/**
 * Clave de deduplicación de trades para evitar duplicados en importaciones
 */
export function dedupeKey(t: {
  symbol: string;
  direction: string;
  closedAt?: string | null | undefined;
  pnl: number;
}): string {
  const parsed = parseDetectedDate(t.closedAt);
  const day = parsed ? parsed.slice(0, 10) : "sin-fecha";
  return [normalizeSymbol(t.symbol), t.direction, day, t.pnl.toFixed(2)].join("|");
}

export function getYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

export function formatDisplayDate(dateKey: string): string {
  if (!dateKey) return "Sin fecha seleccionada";
  try {
    const parts = dateKey.split("-").map(Number);
    const y = parts[0] ?? 2026;
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return dateKey;
    const formatted = date.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return dateKey;
  }
}

export function combineDateTimeToIso(dateStr: string, timeStr?: string): string {
  try {
    const parts = (dateStr || todayKey()).split("-").map(Number);
    const y = parts[0] ?? 2026;
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;

    let hour = 12;
    let min = 0;
    let sec = 0;

    if (timeStr) {
      const tParts = timeStr.split(":").map(Number);
      hour = tParts[0] ?? 12;
      min = tParts[1] ?? 0;
      sec = tParts[2] ?? 0;
    }

    const date = new Date(y, m - 1, d, hour, min, sec);
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Calcula el PnL estimado a partir de precios y tamaño según el instrumento
 */
export function calculatePnlFromPrices(
  symbol: string,
  direction: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  size: number,
): number {
  const spec = getInstrumentSpec(symbol);
  const diff = direction === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
  return diff * spec.pointValue * (size || 1);
}
