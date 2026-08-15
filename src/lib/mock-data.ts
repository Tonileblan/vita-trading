import type { Account, Strategy, Trade, Withdrawal } from "./types";

export const mockStrategies: Strategy[] = [
  { id: "str-indices", name: "Método Índices", initialCapital: 10000, riskPct: 0.03, mainSymbol: "MNQ", color: "var(--brand)" },
  { id: "str-fondeo", name: "Plan de Fondeo", initialCapital: 10000, riskPct: 0.03, mainSymbol: "MNQ", color: "var(--profit)" },
  { id: "str-oro", name: "Sesión Oro", initialCapital: 10000, riskPct: 0.03, mainSymbol: "MGC", color: "var(--warning, #eab308)" },
  { id: "str-asia", name: "Sesión Asia", initialCapital: 10000, riskPct: 0.025, mainSymbol: "MNQ", color: "var(--brand-soft)" },
];

export const mockWithdrawals: Withdrawal[] = [
  { id: "wd-1", strategyId: "str-fondeo", date: "2026-06-05T00:00:00.000Z", amount: 1200, reason: "Payout mensual" },
  { id: "wd-2", strategyId: "str-indices", date: "2026-07-02T00:00:00.000Z", amount: 800, reason: "Retiro de beneficios" },
];

export const mockAccounts: Account[] = [
  {
    id: "acc-apex",
    name: "Apex 50K — Eval",
    type: "funded",
    firm: "Apex Trader Funding",
    initialBalance: 50000,
    currentBalance: 53650,
    drawdownLimit: 2500,
    currency: "USD",
  },
  {
    id: "acc-wsf",
    name: "Wall Street Funded 100K",
    type: "funded",
    firm: "Wall Street Funded",
    initialBalance: 100000,
    currentBalance: 103553,
    drawdownLimit: 3000,
    currency: "USD",
  },
  {
    id: "acc-lucid",
    name: "Lucid 25K PA",
    type: "funded",
    firm: "Lucid Trading",
    initialBalance: 25000,
    currentBalance: 23880,
    drawdownLimit: 1500,
    currency: "USD",
  },
  {
    id: "acc-icm",
    name: "IC Markets Personal",
    type: "personal",
    initialBalance: 5000,
    currentBalance: 6420,
    currency: "USD",
  },
  {
    id: "acc-swing",
    name: "Cuenta Swing Propia",
    type: "personal",
    initialBalance: 12000,
    currentBalance: 11180,
    currency: "USD",
  },
];

// Deterministic pseudo-random so SSR and client render identically.
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const SYMBOLS = ["NQ1!", "ES1!", "NQ", "EURUSD", "GBPUSD", "XAUUSD", "MNQ1!"];
const TAGS = ["ICT", "Wyckoff", "Smart Money", "Order Block", "FVG", "Breakout"];
const NOTES = [
  "Pre-market: sesgo alcista tras barrido de mínimos asiáticos. Espero mitigación del FVG de H1.",
  "Post-market: entré tarde, la ejecución fue correcta pero el sizing excesivo para el contexto.",
  "Setup limpio de Wyckoff: Spring en la zona de acumulación y confirmación con volumen.",
  "Order block de 15m respetado al tick. Gestión a break-even tras 1R.",
  "Sobreoperé la sesión de tarde. Regla rota: máximo 3 operaciones por día.",
];

function buildTrades(): Trade[] {
  const rng = makeRng(20260815);
  const trades: Trade[] = [];
  const start = Date.UTC(2026, 4, 4, 13, 35); // 4 May 2026
  for (let i = 0; i < 142; i++) {
    const account = mockAccounts[i % mockAccounts.length]!;
    const symbol = SYMBOLS[Math.floor(rng() * SYMBOLS.length)]!;
    const direction = rng() > 0.45 ? "long" : "short";
    const win = rng() < 0.58;
    const isFx = symbol.length === 6;
    const size = isFx ? Number((rng() * 1.5 + 0.2).toFixed(2)) : Math.ceil(rng() * 4);
    const magnitude = win ? rng() * 780 + 90 : -(rng() * 520 + 70);
    const pnl = Number(magnitude.toFixed(2));
    const entryPrice = isFx
      ? Number((1.05 + rng() * 0.15).toFixed(5))
      : Number((17800 + rng() * 900).toFixed(2));
    const move = (isFx ? 0.0025 : 24) * (win ? 1 : -1) * (direction === "long" ? 1 : -1);
    const exitPrice = Number((entryPrice + move).toFixed(isFx ? 5 : 2));
    const openedAt = new Date(start + i * 6.4 * 3600 * 1000).toISOString();
    const closedAt = new Date(
      start + i * 6.4 * 3600 * 1000 + (12 + Math.floor(rng() * 140)) * 60000,
    ).toISOString();
    const tagCount = 1 + Math.floor(rng() * 2);
    const tags: string[] = [];
    for (let t = 0; t < tagCount; t++) {
      const tag = TAGS[Math.floor(rng() * TAGS.length)]!;
      if (!tags.includes(tag)) tags.push(tag);
    }
    trades.push({
      id: `trd-${1000 + i}`,
      accountId: account.id,
      strategyId: mockStrategies[i % mockStrategies.length]!.id,
      symbol,
      direction,
      openedAt,
      closedAt,
      entryPrice,
      exitPrice,
      size,
      pnl,
      tags,
      notes: NOTES[Math.floor(rng() * NOTES.length)]!,
      screenshots: [],
      source: rng() > 0.75 ? "webhook" : "manual",
    });
  }
  return trades.reverse();
}

export const mockTrades: Trade[] = buildTrades();
