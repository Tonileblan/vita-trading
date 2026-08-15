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
