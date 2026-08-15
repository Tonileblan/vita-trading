export type AccountType = "funded" | "personal";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  firm?: string | undefined;
  initialBalance: number;
  currentBalance: number;
  drawdownLimit?: number | undefined;
  currency: string;
}

export type Direction = "long" | "short";

export interface Trade {
  id: string;
  accountId: string;
  strategyId: string;
  symbol: string;
  direction: Direction;
  openedAt: string;
  closedAt: string;
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  tags: string[];
  notes?: string | undefined;
  screenshots: string[];
  source: "manual" | "webhook";
}

/** Cada estrategia gestiona su propio capital y su propio riesgo. */
export interface Strategy {
  id: string;
  name: string;
  initialCapital: number;
  riskPct: number; // 0.03 = 3%
  mainSymbol: string;
  color: string;
  /** Ficha operativa (opcional). */
  market?: string | undefined;
  chart?: string | undefined;
  days?: string | undefined;
  schedule?: string | undefined;
  execution?: string | undefined;
  setup?: string | undefined;
  management?: string | undefined;
  contracts?: string | undefined;
}

/** Los retiros restan capital pero NO cuentan como pérdida operativa. */
export interface Withdrawal {
  id: string;
  strategyId: string;
  date: string;
  amount: number;
  reason?: string | undefined;
}

/** Valor por punto (referencia) de los futuros más habituales. */
export const FUTURES_SPECS: { symbol: string; pointValue: number }[] = [
  { symbol: "MNQ", pointValue: 2 },
  { symbol: "MES", pointValue: 5 },
  { symbol: "MGC", pointValue: 10 },
  { symbol: "NQ", pointValue: 20 },
  { symbol: "ES", pointValue: 50 },
  { symbol: "GC", pointValue: 100 },
  { symbol: "M2K", pointValue: 5 },
  { symbol: "MYM", pointValue: 0.5 },
];

export const PROP_FIRMS = [
  "Apex Trader Funding",
  "Wall Street Funded",
  "Lucid Trading",
  "IC Markets",
  "Topstep",
  "FTMO",
];

export const STRATEGY_TAGS = [
  "ICT",
  "Wyckoff",
  "Smart Money",
  "Order Block",
  "FVG",
  "Breakout",
  "Reversión",
  "Scalping",
];
