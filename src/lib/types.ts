export type AccountType = "funded" | "personal";

/** Cómo se calcula el límite de pérdida de la cuenta. */
export type DrawdownType = "static" | "trailing" | "eod";

export const DRAWDOWN_TYPES: { key: DrawdownType; label: string; help: string }[] = [
  {
    key: "static",
    label: "Estático",
    help: "El límite se fija sobre el balance inicial y no se mueve.",
  },
  {
    key: "trailing",
    label: "Dinámico (trailing)",
    help: "El límite sube con cada nuevo máximo de balance alcanzado.",
  },
  {
    key: "eod",
    label: "Dinámico a cierre (EOD)",
    help: "El límite sube con el máximo del balance al cierre de cada día.",
  },
];

/** Fase de una cuenta de fondeo. */
export type AccountPhase = "eval" | "live";

export const ACCOUNT_PHASES: { key: AccountPhase; label: string; help: string }[] = [
  {
    key: "eval",
    label: "Evaluación",
    help: "Objetivo: capital que hay que alcanzar para superar la prueba.",
  },
  {
    key: "live",
    label: "Live (fondeada)",
    help: "Objetivo: capital a partir del cual puedes solicitar retiro.",
  },
];

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** Solo cuentas de fondeo: evaluación o live. */
  phase?: AccountPhase | undefined;
  /** Capital objetivo (superar evaluación o umbral de payout). */
  profitTarget?: number | undefined;
  firm?: string | undefined;
  /** Broker para cuentas personales (type=personal). */
  broker?: string | undefined;
  initialBalance: number;
  currentBalance: number;
  drawdownLimit?: number | undefined;
  drawdownType?: DrawdownType | undefined;
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
  /** Identificador del lote de importación (capturas/fotos). */
  importBatchId?: string | undefined;
  createdAt?: string | undefined;
  /* Gestión emocional (opcional). */
  emotionBefore?: string | undefined;
  emotionAfter?: string | undefined;
  followedPlan?: "yes" | "partial" | "no" | undefined;
  mistakes: string[];
  emotionNote?: string | undefined;
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
  strategyId?: string | undefined;
  accountId?: string | undefined;
  date: string;
  amount: number;
  reason?: string | undefined;
  /** 'pending' = solicitado, pendiente de aprobación; solo 'approved' se contabiliza. */
  status: WithdrawalStatus;
  requestedAt?: string | undefined;
  approvedAt?: string | undefined;
}

export type WithdrawalStatus = "pending" | "approved" | "rejected";

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
  "Alpha Futures",
  "Apex Trader Funding",
  "Blue Guardian",
  "Blusky Trading",
  "Bulenox",
  "E8 Markets",
  "Earn2Trade",
  "Elite Trader Funding",
  "FTMO",
  "Funded Next",
  "FundedNext Futures",
  "Funding Pips",
  "Goat Funded Trader",
  "IC Markets",
  "Legends Trading",
  "Lucid Trading",
  "MyFundedFutures",
  "MyFunded FX",
  "Nova Funding",
  "OFP Funding",
  "Phidias Propfirm",
  "Prop Number One",
  "purdia Capital",
  "Take Profit Trader",
  "The5ers",
  "Topstep",
  "TradeDay",
  "Tradeify",
  "Traders With Edge",
  "Wall Street Funded",
];

/** Brokers preconfigurados para cuentas personales. */
export const BROKERS = [
  "AMP Futures",
  "Interactive Brokers",
  "NinjaTrader Brokerage",
  "Tradovate",
  "Phillip Capital",
  "Dorman Trading",
  "EdgeClear",
  "PhillipCapital",
  "Rithmic (demo)",
  "OANDA",
  "IG",
  "XTB",
  "TradeStation",
  "MetaTrader 5 (genérico)",
  "TopstepX",
  "Quantower (genérico)",
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
