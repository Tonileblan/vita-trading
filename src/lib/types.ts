export type AccountType = "funded" | "personal";

/** Cómo se calcula el límite de pérdida de la cuenta. */
export type DrawdownType = "trailing" | "eod" | "static";

export const DRAWDOWN_TYPES: { key: DrawdownType; label: string; help: string }[] = [
  {
    key: "trailing",
    label: "Trailing (Intraday)",
    help: "El límite sube dinámicamente con cada nuevo pico máximo alcanzado (High Watermark).",
  },
  {
    key: "eod",
    label: "End of Day (EOD)",
    help: "El límite sube con el balance máximo consolidado al cierre de cada sesión/día.",
  },
  {
    key: "static",
    label: "Estático",
    help: "El límite se fija sobre el balance inicial y nunca sube.",
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
  /** Estrategia asignada a la cuenta (las operaciones cuentan para ella por defecto). */
  strategyId?: string | undefined;
  initialBalance: number;
  currentBalance: number;
  /** Límite total de pérdida (Max Loss Limit) */
  maxLossLimit?: number | undefined;
  /** Límite máximo de pérdida diaria (Daily Loss Limit) */
  dailyLossLimit?: number | undefined;
  /** Pico máximo histórico de balance/equity alcanzado */
  highWatermark?: number | undefined;
  /** Balance al inicio de la jornada de trading */
  startOfDayBalance?: number | undefined;
  /** Alias para retrocompatibilidad con maxLossLimit */
  drawdownLimit?: number | undefined;
  drawdownType?: DrawdownType | undefined;
  currency: string;
}

export type Direction = "long" | "short";

export interface Trade {
  id: string;
  journalId?: string | undefined;
  accountId: string;
  strategyId?: string | undefined;
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
  /** Si la estrategia está compartida con todos los usuarios */
  isShared?: boolean | undefined;
  /** Propietario o creador de la estrategia */
  userId?: string | undefined;
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
  journalId?: string | undefined;
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

/** Tramo de fechas en el que una cuenta operó con una estrategia concreta. */
export interface AccountStrategyPeriod {
  id: string;
  accountId: string;
  strategyId: string;
  /** Fecha de inicio (YYYY-MM-DD), incluida. */
  startDate: string;
  /** Fecha de fin (YYYY-MM-DD), incluida. Vacío = sigue vigente. */
  endDate?: string | undefined;
  note?: string | undefined;
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
