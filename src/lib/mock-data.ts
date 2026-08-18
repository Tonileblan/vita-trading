import type { Account, Strategy, Trade, Withdrawal } from "./types";

/** Estrategias por defecto de cada diario nuevo. */
export const mockStrategies: Strategy[] = [
  {
    id: "str-indices",
    name: "IFT",
    initialCapital: 10000,
    riskPct: 0.03,
    mainSymbol: "MNQ",
    color: "var(--brand)",
    isShared: true,
    market: "Nueva York · Nasdaq (MNQ / NQ)",
    chart: "5 minutos",
    days: "Lunes, martes, jueves y viernes",
    schedule: "9:31 - 11:00 (NY)",
    execution: "Manual o bot",
    setup: "SL: 210 ticks",
    management: "TP2 (RR 1:2) · Break-even automático 170 ticks · BE Plus +4",
    contracts: "4 a 5 contratos de referencia; ajustar según gestión de riesgo",
  },
  {
    id: "str-fondeo",
    name: "Fondeo",
    initialCapital: 10000,
    riskPct: 0.03,
    mainSymbol: "MNQ",
    color: "var(--profit)",
    isShared: true,
    market: "Nueva York · MNQ",
    chart: "4.500 ticks",
    days: "Martes a jueves",
    schedule: "9:00 - 16:00 (NY) · 2 sesiones por día",
    execution: "Solo bot",
    setup: "SL dinámico: ATR(14) × 4",
    management: "RR 1:1",
    contracts: "Según el plan de gestión de riesgo",
  },
  {
    id: "str-asia",
    name: "Asia",
    initialCapital: 10000,
    riskPct: 0.025,
    mainSymbol: "MNQ",
    color: "var(--brand-soft)",
    isShared: true,
    market: "Asia · MNQ",
    chart: "200 ticks",
    days: "Martes, miércoles y jueves",
    schedule: "19:00 - 23:30 (NY)",
    execution: "Manual o bot",
    setup: "SL dinámico: ATR(14) × 6",
    management: "TP 300 ticks (RR 1:2) · Riesgo de referencia 300",
    contracts: "Según el plan de gestión de riesgo",
  },
  {
    id: "str-oro",
    name: "Oro",
    initialCapital: 10000,
    riskPct: 0.03,
    mainSymbol: "MGC",
    color: "var(--warning, #eab308)",
    isShared: true,
    market: "Asia · Oro (GC)",
    chart: "150 ticks",
    days: "Lunes a jueves",
    schedule: "19:00 - 23:30 (NY)",
    execution: "Manual o bot",
    setup: "SL fijo: 150 ticks · 150 USD de riesgo por contrato",
    management: "RR 1:1.5 · Break-even automático a +75 ticks",
    contracts: "Según el plan de gestión de riesgo",
  },
  {
    id: "str-lite",
    name: "Lite",
    initialCapital: 10000,
    riskPct: 0.02,
    mainSymbol: "MNQ",
    color: "var(--loss)",
    isShared: true,
    market: "Nueva York · MNQ",
    chart: "2 minutos",
    days: "Lunes a viernes",
    schedule: "9:30 (apertura NY)",
    execution: "Manual",
    setup: "Monitorear las primeras 5 velas tras la apertura",
    management: "RR 1:1",
    contracts: "Según el plan de gestión de riesgo",
  },
  {
    id: "str-swing",
    name: "Swing",
    initialCapital: 20000,
    riskPct: 0.02,
    mainSymbol: "ES",
    color: "var(--purple, #8b5cf6)",
    isShared: true,
    market: "Futuros S&P 500 (ES / MES)",
    chart: "1h / 4h / Diario",
    days: "Semanal",
    schedule: "Cierre de sesión / Apertura",
    execution: "Manual o bot",
    setup: "Retroceso en zona de equilibrio / Fibo 61.8%",
    management: "Stop swing estructurado · TP ratio 1:3",
    contracts: "1 contrato MES / ES",
  },
  {
    id: "str-scalping",
    name: "Scalping",
    initialCapital: 10000,
    riskPct: 0.02,
    mainSymbol: "MNQ",
    color: "var(--teal, #14b8a6)",
    isShared: true,
    market: "Nueva York · Scalping MNQ / MGC",
    chart: "1 minuto / 30 seg",
    days: "Lunes a Viernes",
    schedule: "15:30 - 17:30 (Apertura y volatilidad)",
    execution: "Manual rápida",
    setup: "Rechazo en niveles de liquidez intradía · Micro-estructuras",
    management: "Stop ceñido 10-15 ticks · TP rápido 20-30 ticks · Ratio 1:2",
    contracts: "1 a 3 contratos micro",
  },
];

export const mockWithdrawals: Withdrawal[] = [
  { id: "wd-1", strategyId: "str-fondeo", date: "2026-06-05T00:00:00.000Z", amount: 1200, reason: "Payout mensual", status: "approved" },
  { id: "wd-2", strategyId: "str-indices", date: "2026-07-02T00:00:00.000Z", amount: 800, reason: "Retiro de beneficios", status: "approved" },
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
      mistakes: [],
      tags,

      notes: NOTES[Math.floor(rng() * NOTES.length)]!,
      screenshots: [],
      source: rng() > 0.75 ? "webhook" : "manual",
    });
  }
  return trades.reverse();
}

export const mockTrades: Trade[] = buildTrades();
