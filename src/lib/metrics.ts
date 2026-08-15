import type { Account, Trade } from "./types";

export function formatCurrency(value: number, withSign = false) {
  const sign = withSign && value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export interface Metrics {
  totalPnl: number;
  winRate: number;
  profitFactor: number;
  wins: number;
  losses: number;
  total: number;
  avgWin: number;
  avgLoss: number;
  streak: { type: "win" | "loss" | "none"; count: number };
  bestTrade: number;
  worstTrade: number;
}

export function computeMetrics(trades: Trade[]): Metrics {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const sorted = [...trades].sort((a, b) => {
    const diff = new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime();
    if (diff !== 0) return diff;
    return String(b.id ?? "").localeCompare(String(a.id ?? ""));
  });

  let streakType: "win" | "loss" | "none" = "none";
  let streakCount = 0;
  for (const t of sorted) {
    if (t.pnl === 0) continue; // breakeven no rompe ni suma racha
    const type: "win" | "loss" = t.pnl > 0 ? "win" : "loss";
    if (streakType === "none") {
      streakType = type;
      streakCount = 1;
    } else if (type === streakType) {
      streakCount++;
    } else break;
  }


  return {
    totalPnl: trades.reduce((s, t) => s + t.pnl, 0),
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit ? Infinity : 0,
    wins: wins.length,
    losses: losses.length,
    total: trades.length,
    avgWin: wins.length ? grossProfit / wins.length : 0,
    avgLoss: losses.length ? -grossLoss / losses.length : 0,
    streak: { type: streakType, count: streakCount },
    bestTrade: trades.length ? Math.max(...trades.map((t) => t.pnl)) : 0,
    worstTrade: trades.length ? Math.min(...trades.map((t) => t.pnl)) : 0,
  };
}

export interface StreakInfo {
  current: { type: "win" | "loss" | "none"; count: number };
  maxWin: number;
  maxLoss: number;
  wins: number;
  losses: number;
}

/** Rachas (consecutivas) sobre un conjunto de operaciones ya filtradas por ventana. */
export function computeStreaks(trades: Trade[]): StreakInfo {
  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl < 0).length;
  if (!trades.length) {
    return { current: { type: "none", count: 0 }, maxWin: 0, maxLoss: 0, wins, losses };
  }
  const desc = [...trades].sort((a, b) => {
    const diff = new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime();
    if (diff !== 0) return diff;
    return String(b.id ?? "").localeCompare(String(a.id ?? ""));
  });
  // Racha actual (más reciente)
  let curType: "win" | "loss" | "none" = "none";
  let curCount = 0;
  for (const t of desc) {
    if (t.pnl === 0) continue;
    const type: "win" | "loss" = t.pnl > 0 ? "win" : "loss";
    if (curType === "none") {
      curType = type;
      curCount = 1;
    } else if (type === curType) {
      curCount++;
    } else break;
  }
  // Mejor racha de ganancias y de pérdidas (recorriendo de antiguo a nuevo)
  let maxWin = 0;
  let maxLoss = 0;
  let runType: "win" | "loss" = "win";
  let runCount = 0;
  for (const t of [...desc].reverse()) {
    if (t.pnl === 0) continue;
    const type: "win" | "loss" = t.pnl > 0 ? "win" : "loss";
    if (runType === type) {
      runCount++;
    } else {
      runType = type;
      runCount = 1;
    }
    if (type === "win") maxWin = Math.max(maxWin, runCount);
    else maxLoss = Math.max(maxLoss, runCount);
  }
  return { current: { type: curType, count: curCount }, maxWin, maxLoss, wins, losses };
}

/** Filtra operaciones a una ventana de días respecto a la operación más reciente. */
export function filterByDays(trades: Trade[], days: number) {
  if (!days) return trades;
  const latest = trades.reduce(
    (max, t) => Math.max(max, new Date(t.closedAt).getTime()),
    0,
  );
  const cutoff = latest - days * 86400000;
  return trades.filter((t) => new Date(t.closedAt).getTime() >= cutoff);
}

export function buildEquityCurve(trades: Trade[], startBalance: number) {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime(),
  );
  let equity = startBalance;
  return sorted.map((t, i) => {
    equity += t.pnl;
    return {
      index: i + 1,
      date: new Date(t.closedAt).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      }),
      equity: Number(equity.toFixed(2)),
    };
  });
}

export function filterByRange(trades: Trade[], range: "7d" | "30d" | "90d" | "all") {
  if (range === "all") return trades;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const latest = trades.reduce(
    (max, t) => Math.max(max, new Date(t.closedAt).getTime()),
    0,
  );
  const cutoff = latest - days * 86400000;
  return trades.filter((t) => new Date(t.closedAt).getTime() >= cutoff);
}

/** PnL acumulado de las operaciones de una cuenta. */
export function accountPnl(trades: Trade[], accountId: string) {
  return trades
    .filter((t) => t.accountId === accountId)
    .reduce((s, t) => s + t.pnl, 0);
}

/** Balance real = balance inicial + suma de las operaciones registradas. */
export function accountBalance(account: Account, trades: Trade[]) {
  return account.initialBalance + accountPnl(trades, account.id);
}

export interface DrawdownStatus {
  type: NonNullable<Account["drawdownType"]>;
  label: string;
  limit: number;
  /** Balance mínimo permitido antes de romper la cuenta. */
  floor: number;
  /** Referencia sobre la que se calcula el suelo (inicial o máximo alcanzado). */
  reference: number;
  balance: number;
  used: number;
  remaining: number;
  pct: number;
  breached: boolean;
  /** Fecha en la que se perforó el suelo por primera vez (ISO). */
  breachedAt?: string;
  /** El suelo dinámico ya no sube más (alcanzó el capital inicial). */
  frozen: boolean;
}

const DD_LABELS: Record<NonNullable<Account["drawdownType"]>, string> = {
  static: "Estático",
  trailing: "Dinámico (trailing)",
  eod: "Dinámico a cierre (EOD)",
};

function localDayKey(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calcula el estado de drawdown según el tipo configurado en la cuenta. */
export function accountDrawdown(
  account: Account,
  trades: Trade[],
  withdrawals: { accountId?: string | undefined; date: string; amount: number }[] = [],
): DrawdownStatus | null {
  const limit = account.drawdownLimit ?? 0;
  const type = account.drawdownType ?? "static";
  if (!limit) return null;

  const initial = account.initialBalance;
  // El suelo dinámico deja de subir cuando la referencia alcanza inicial + límite.
  const maxReference = initial + limit;

  type Ev = { at: string; delta: number };
  const events: Ev[] = [
    ...trades.filter((t) => t.accountId === account.id).map((t) => ({ at: t.closedAt, delta: t.pnl })),
    ...withdrawals
      .filter((w) => w.accountId === account.id)
      .map((w) => ({ at: w.date, delta: -Math.abs(w.amount) })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const today = localDayKey(new Date().toISOString());

  let running = initial;
  let peak = initial;
  let breachedAt: string | undefined;
  const eodBalances = new Map<string, number>();
  // Referencia EOD vigente durante el recorrido (mayor cierre de días anteriores).
  let eodReference = initial;
  let lastDay: string | null = null;

  for (const ev of events) {
    const day = localDayKey(ev.at);
    if (lastDay !== null && day !== lastDay) {
      const prevClose = eodBalances.get(lastDay);
      if (prevClose !== undefined) eodReference = Math.max(eodReference, prevClose);
    }
    lastDay = day;

    running += ev.delta;
    eodBalances.set(day, running);
    peak = Math.max(peak, running);

    let refNow = initial;
    if (type === "trailing") refNow = Math.min(peak, maxReference);
    if (type === "eod") refNow = Math.min(Math.max(initial, eodReference), maxReference);
    if (!breachedAt && running <= refNow - limit) breachedAt = ev.at;
  }
  // Consolida el último día si ya no es hoy.
  if (lastDay !== null && lastDay !== today) {
    const close = eodBalances.get(lastDay);
    if (close !== undefined) eodReference = Math.max(eodReference, close);
  }

  const balance = running;

  let reference = initial;
  if (type === "trailing") reference = Math.min(peak, maxReference);
  if (type === "eod") reference = Math.min(Math.max(initial, eodReference), maxReference);

  const floor = reference - limit;
  const used = Math.max(0, reference - balance);
  const frozen = type !== "static" && reference >= maxReference;
  const breached = balance <= floor || breachedAt !== undefined;
  return {
    type,
    label: DD_LABELS[type],
    limit,
    floor,
    reference,
    balance,
    used,
    remaining: Math.max(0, balance - floor),
    pct: Math.min(100, (used / limit) * 100),
    breached,
    ...(breachedAt ? { breachedAt } : {}),
    frozen,
  };
}


export function accountsStartBalance(accounts: Account[]) {
  return accounts.reduce((s, a) => s + a.initialBalance, 0);
}


import type { Strategy, Withdrawal } from "./types";

export interface StrategyStats {
  strategy: Strategy;
  net: number;
  withdrawn: number;
  currentCapital: number;
  trades: number;
  winRate: number;
  profitFactor: number;
  returnPct: number;
  expectancy: number;
  riskPerTrade: number;
}

export function computeStrategyStats(
  strategy: Strategy,
  trades: Trade[],
  withdrawals: Withdrawal[],
): StrategyStats {
  const own = trades.filter((t) => t.strategyId === strategy.id);
  const m = computeMetrics(own);
  const withdrawn = withdrawals
    .filter((w) => w.strategyId === strategy.id)
    .reduce((s, w) => s + w.amount, 0);
  const currentCapital = strategy.initialCapital + m.totalPnl - withdrawn;
  return {
    strategy,
    net: m.totalPnl,
    withdrawn,
    currentCapital,
    trades: m.total,
    winRate: m.winRate,
    profitFactor: m.profitFactor,
    returnPct: strategy.initialCapital ? (m.totalPnl / strategy.initialCapital) * 100 : 0,
    expectancy: m.total ? m.totalPnl / m.total : 0,
    riskPerTrade: currentCapital * strategy.riskPct,
  };
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function monthlyNet(trades: Trade[], startCapital: number) {
  const nets = new Array(12).fill(0) as number[];
  for (const t of trades) {
    const i = new Date(t.closedAt).getUTCMonth();
    nets[i] = (nets[i] ?? 0) + t.pnl;
  }
  let acc = 0;
  return nets.map((net, i) => {
    acc += net;
    return { month: MONTHS[i]!, net, acc, capital: startCapital + acc };
  });
}

/** Plan de escalado: cuántos contratos soporta el capital manteniendo el % de riesgo. */
export function scalingPlan(
  capital: number,
  riskPct: number,
  stopPoints: number,
  pointValue: number,
  levels = 6,
) {
  const riskPerContract = stopPoints * pointValue;
  const rows = [];
  for (let contracts = 1; contracts <= levels; contracts++) {
    const capitalNeeded = riskPerContract * contracts / riskPct;
    rows.push({
      contracts,
      capitalNeeded,
      riskAmount: riskPerContract * contracts,
      unlocked: capital >= capitalNeeded,
      missing: Math.max(0, capitalNeeded - capital),
    });
  }
  return rows;
}
