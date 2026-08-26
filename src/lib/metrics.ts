import type { Account, AccountStrategyPeriod, Trade } from "./types";
import { tradeDayKey } from "./emotions";

export function formatCurrency(value: number, withSign = false) {
  const sign = withSign && value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTradeDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const month = d.toLocaleString("es-ES", { month: "short" }).replace(".", "");
  return `${day} ${month}`;
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
    const aDate = a.openedAt || a.closedAt;
    const bDate = b.openedAt || b.closedAt;
    const diff = new Date(bDate).getTime() - new Date(aDate).getTime();
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
  current: { type: "win" | "loss" | "none"; count: number; pnl: number };
  maxWin: number;
  maxWinPnl: number;
  maxLoss: number;
  maxLossPnl: number;
  wins: number;
  losses: number;
  winsPnl: number;
  lossesPnl: number;
}

/** Rachas (consecutivas) sobre un conjunto de operaciones ya filtradas por ventana, con capital acumulado. */
export function computeStreaks(trades: Trade[]): StreakInfo {
  const winTrades = trades.filter((t) => t.pnl > 0);
  const lossTrades = trades.filter((t) => t.pnl < 0);
  const wins = winTrades.length;
  const losses = lossTrades.length;
  const winsPnl = winTrades.reduce((s, t) => s + t.pnl, 0);
  const lossesPnl = lossTrades.reduce((s, t) => s + t.pnl, 0);

  if (!trades.length) {
    return {
      current: { type: "none", count: 0, pnl: 0 },
      maxWin: 0,
      maxWinPnl: 0,
      maxLoss: 0,
      maxLossPnl: 0,
      wins: 0,
      losses: 0,
      winsPnl: 0,
      lossesPnl: 0,
    };
  }

  const desc = [...trades].sort((a, b) => {
    const aDate = a.openedAt || a.closedAt;
    const bDate = b.openedAt || b.closedAt;
    const diff = new Date(bDate).getTime() - new Date(aDate).getTime();
    if (diff !== 0) return diff;
    return String(b.id ?? "").localeCompare(String(a.id ?? ""));
  });

  // Racha actual (más reciente)
  let curType: "win" | "loss" | "none" = "none";
  let curCount = 0;
  let curPnl = 0;
  for (const t of desc) {
    if (t.pnl === 0) continue; // breakeven no rompe ni suma racha
    const type: "win" | "loss" = t.pnl > 0 ? "win" : "loss";
    if (curType === "none") {
      curType = type;
      curCount = 1;
      curPnl = t.pnl;
    } else if (type === curType) {
      curCount++;
      curPnl += t.pnl;
    } else break;
  }

  // Mejor racha de ganancias y de pérdidas (recorriendo cronológicamente de antiguo a nuevo)
  const asc = [...desc].reverse();
  let maxWin = 0;
  let maxWinPnl = 0;
  let maxLoss = 0;
  let maxLossPnl = 0;

  let currentRunType: "win" | "loss" | "none" = "none";
  let currentRunCount = 0;
  let currentRunPnl = 0;

  for (const t of asc) {
    if (t.pnl === 0) continue;
    const type: "win" | "loss" = t.pnl > 0 ? "win" : "loss";
    if (currentRunType === type) {
      currentRunCount++;
      currentRunPnl += t.pnl;
    } else {
      currentRunType = type;
      currentRunCount = 1;
      currentRunPnl = t.pnl;
    }

    if (type === "win") {
      if (currentRunCount > maxWin) {
        maxWin = currentRunCount;
        maxWinPnl = currentRunPnl;
      } else if (currentRunCount === maxWin && currentRunPnl > maxWinPnl) {
        maxWinPnl = currentRunPnl;
      }
    } else {
      if (currentRunCount > maxLoss) {
        maxLoss = currentRunCount;
        maxLossPnl = currentRunPnl;
      } else if (currentRunCount === maxLoss && currentRunPnl < maxLossPnl) {
        maxLossPnl = currentRunPnl;
      }
    }
  }

  return {
    current: { type: curType, count: curCount, pnl: curPnl },
    maxWin,
    maxWinPnl,
    maxLoss,
    maxLossPnl,
    wins,
    losses,
    winsPnl,
    lossesPnl,
  };
}

/** Filtra operaciones a una ventana de días respecto a la operación más reciente. */
export function filterByDays(trades: Trade[], days: number) {
  if (!days) return trades;
  const latest = trades.reduce(
    (max, t) => Math.max(max, new Date(t.openedAt || t.closedAt).getTime()),
    0,
  );
  const cutoff = latest - days * 86400000;
  return trades.filter((t) => new Date(t.openedAt || t.closedAt).getTime() >= cutoff);
}

export function buildEquityCurve(
  trades: Trade[],
  startBalance: number,
  fundedAccount?: Account | null,
) {
  if (!trades || trades.length === 0) {
    return [];
  }

  const sorted = [...trades].sort(
    (a, b) =>
      new Date(a.openedAt || a.closedAt || a.createdAt || 0).getTime() -
      new Date(b.openedAt || b.closedAt || b.createdAt || 0).getTime(),
  );

  let equity = startBalance;
  const isFunded = fundedAccount?.type === "funded" && Boolean(fundedAccount.drawdownLimit);
  const ddLimit = isFunded ? (fundedAccount.drawdownLimit ?? 0) : 0;
  const ddType = isFunded ? (fundedAccount.drawdownType ?? "static") : "static";
  const initial = fundedAccount?.initialBalance ?? startBalance;

  let peak = Math.max(initial, startBalance);
  let eodRef = initial;
  let lastDay: string | null = null;

  const firstDateStr = sorted[0]?.openedAt || sorted[0]?.closedAt || sorted[0]?.createdAt || "";
  const initialDrawdownFloor =
    isFunded && ddLimit > 0
      ? ddType === "static"
        ? Number((initial - ddLimit).toFixed(2))
        : Number((Math.max(initial, startBalance) - ddLimit).toFixed(2))
      : undefined;

  const points = [
    {
      index: 0,
      date: firstDateStr
        ? new Date(firstDateStr).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
          })
        : "Inicio",
      equity: Number(startBalance.toFixed(2)),
      ...(initialDrawdownFloor !== undefined ? { drawdownFloor: initialDrawdownFloor } : {}),
    },
  ];

  sorted.forEach((t, i) => {
    equity += t.pnl;
    const dateStr = t.openedAt || t.closedAt || t.createdAt || "";
    const day = dateStr ? dateStr.slice(0, 10) : "";

    peak = Math.max(peak, equity);

    let drawdownFloor: number | undefined;
    if (isFunded && ddLimit > 0) {
      if (ddType === "static") {
        drawdownFloor = Number((initial - ddLimit).toFixed(2));
      } else if (ddType === "trailing") {
        // El trailing drawdown sigue a la curva de capital conforme sube a nuevos picos
        drawdownFloor = Number((peak - ddLimit).toFixed(2));
      } else if (ddType === "eod") {
        drawdownFloor = Number((Math.max(initial, eodRef) - ddLimit).toFixed(2));
        if (day && day !== lastDay) {
          eodRef = Math.max(eodRef, equity);
          lastDay = day;
        }
      }
    }

    points.push({
      index: i + 1,
      date: dateStr
        ? new Date(dateStr).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
          })
        : `T${i + 1}`,
      equity: Number(equity.toFixed(2)),
      ...(drawdownFloor !== undefined ? { drawdownFloor } : {}),
    });
  });

  return points;
}

export function filterByRange(
  trades: Trade[],
  range: "7d" | "30d" | "90d" | "180d" | "month" | "all",
) {
  if (range === "all") return trades;
  const now = new Date();
  if (range === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return trades.filter((t) => new Date(t.openedAt || t.closedAt).getTime() >= start.getTime());
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "180d" ? 180 : 90;
  const latest = trades.reduce(
    (max, t) => Math.max(max, new Date(t.openedAt || t.closedAt).getTime()),
    now.getTime(),
  );
  const cutoff = latest - days * 86400000;
  return trades.filter((t) => new Date(t.openedAt || t.closedAt).getTime() >= cutoff);
}

/** PnL acumulado de las operaciones de una cuenta. */
/**
 * Estrategia efectiva de una operación:
 * 1) la estrategia propia de la operación (si la tiene asignada directamente),
 * 2) el tramo de fechas asignado a su cuenta (si lo hay),
 * 3) la estrategia por defecto de la cuenta.
 */
export function effectiveStrategyId(
  trade: Trade,
  accounts: Account[],
  periods: AccountStrategyPeriod[] = [],
) {
  if (trade.strategyId) return trade.strategyId;
  const day = tradeDayKey(trade) || (trade.openedAt || trade.closedAt || "").slice(0, 10);
  if (day) {
    const period = periods.find(
      (p) =>
        p.accountId === trade.accountId &&
        day >= p.startDate &&
        (!p.endDate || day <= p.endDate),
    );
    if (period) return period.strategyId;
  }
  return accounts.find((a) => a.id === trade.accountId)?.strategyId ?? "";
}


export function accountPnl(trades: Trade[], accountId: string) {
  return trades
    .filter((t) => t.accountId === accountId)
    .reduce((s, t) => s + t.pnl, 0);
}

/** Retiros aprobados imputados a una cuenta. */
export function accountWithdrawn(
  withdrawals: { accountId?: string | undefined; amount: number }[],
  accountId: string,
) {
  return withdrawals
    .filter((w) => w.accountId === accountId)
    .reduce((s, w) => s + Math.abs(w.amount), 0);
}

/** Balance real = balance actual guardado − retiros aprobados de la cuenta. */
export function accountBalance(
  account: Account,
  trades: Trade[],
  withdrawals: { accountId?: string | undefined; amount: number }[] = [],
) {
  return account.currentBalance - accountWithdrawn(withdrawals, account.id);
}


/** Resultado real de la cuenta = balance vigente − capital inicial. */
export function accountResult(
  account: Account,
  trades: Trade[],
  withdrawals: { accountId?: string | undefined; amount: number }[] = [],
) {
  return accountBalance(account, trades, withdrawals) - account.initialBalance;
}

/** Base de una curva para que termine en el balance actual registrado. */
export function accountCurveStart(
  account: Account,
  trades: Trade[],
  withdrawals: { accountId?: string | undefined; amount: number }[] = [],
) {
  return accountBalance(account, trades, withdrawals) - accountPnl(trades, account.id);
}


export function accountsCurveStart(
  accounts: Account[],
  trades: Trade[],
  withdrawals: { accountId?: string | undefined; amount: number }[] = [],
) {
  return accounts.reduce((sum, account) => sum + accountCurveStart(account, trades, withdrawals), 0);
}

export interface TargetStatus {
  phase: NonNullable<Account["phase"]>;
  label: string;
  /** Capital objetivo absoluto. */
  target: number;
  balance: number;
  /** Progreso 0-100. */
  pct: number;
  /** Cuánto falta para el objetivo (0 si alcanzado). */
  remaining: number;
  reached: boolean;
}

/** Progreso de una cuenta de fondeo hacia su objetivo (evaluación o payout). */
export function accountTarget(
  account: Account,
  trades: Trade[],
  withdrawals: { accountId?: string | undefined; amount: number }[] = [],
): TargetStatus | null {
  if (account.type !== "funded") return null;
  const target = account.profitTarget ?? 0;
  if (!target || target <= account.initialBalance) return null;

  const phase = account.phase ?? "eval";
  const balance = accountBalance(account, trades, withdrawals);
  const span = target - account.initialBalance;
  const gained = balance - account.initialBalance;
  const pct = Math.max(0, Math.min(100, (gained / span) * 100));

  return {
    phase,
    label: phase === "live" ? "Objetivo de retiro" : "Objetivo de evaluación",
    target,
    balance,
    pct,
    remaining: Math.max(0, target - balance),
    reached: balance >= target,
  };
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
  /** Último cierre diario por debajo del suelo vigente (informativo, no rompe la cuenta). */
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
  const recordedPnl = accountPnl(trades, account.id);
  const balanceBeforeEvents = account.currentBalance - recordedPnl;


  // El suelo dinámico deja de subir cuando la referencia alcanza inicial + límite.
  const maxReference = initial + limit;

  type Ev = { at: string; delta: number };
  const events: Ev[] = [
    ...trades
      .filter((t) => t.accountId === account.id)
      .map((t) => ({
        at: t.openedAt || t.closedAt || new Date().toISOString(),
        delta: t.pnl,
      })),
    ...withdrawals
      .filter((w) => w.accountId === account.id)
      .map((w) => ({ at: w.date, delta: -Math.abs(w.amount) })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const today = localDayKey(new Date().toISOString());

  let running = balanceBeforeEvents;
  let peak = Math.max(initial, balanceBeforeEvents);
  let breachedAt: string | undefined;
  const eodBalances = new Map<string, number>();
  // Referencia EOD vigente durante el recorrido (mayor cierre de días anteriores).
  let eodReference = initial;
  let lastDay: string | null = null;
  let lastAt: string | null = null;

  const refFor = (peakNow: number, eodRef: number) => {
    if (type === "trailing") return Math.min(peakNow, maxReference);
    if (type === "eod") return Math.min(Math.max(initial, eodRef), maxReference);
    return initial;
  };

  const closeDay = (day: string, at: string) => {
    const close = eodBalances.get(day);
    if (close === undefined) return;
    // La rotura se evalúa solo sobre cierres diarios ya consolidados.
    const refNow = refFor(peak, eodReference);
    if (close <= refNow - limit) breachedAt = at;
    eodReference = Math.max(eodReference, close);
  };

  for (const ev of events) {
    const day = localDayKey(ev.at);
    if (lastDay !== null && day !== lastDay) closeDay(lastDay, lastAt ?? ev.at);
    lastDay = day;
    lastAt = ev.at;

    running += ev.delta;
    eodBalances.set(day, running);
    peak = Math.max(peak, running);
  }
  // Consolida el último día si ya no es hoy.
  if (lastDay !== null && lastDay !== today) closeDay(lastDay, lastAt ?? new Date().toISOString());

  const balance = running;

  const reference = refFor(peak, eodReference);

  const floor = reference - limit;
  const used = Math.max(0, reference - balance);
  const frozen = type !== "static" && reference >= maxReference;
  const breached = balance <= floor;

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
  /** Capital inicial agregado de las cuentas asignadas a la estrategia. */
  initialCapital: number;
  net: number;
  withdrawn: number;
  currentCapital: number;
  accounts: Account[];
  trades: number;
  daysOperated: number;
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
  accounts: Account[] = [],
  periods: AccountStrategyPeriod[] = [],
): StrategyStats {
  const own = trades.filter((t) => effectiveStrategyId(t, accounts, periods) === strategy.id);
  const m = computeMetrics(own);
  const mine = accounts.filter((a) => a.strategyId === strategy.id);
  const approved = withdrawals.filter((w) => w.status === "approved");
  const withdrawn = mine.reduce((s, a) => s + accountWithdrawn(approved, a.id), 0);
  const initialCapital = mine.reduce((s, a) => s + a.initialBalance, 0);
  const currentCapital = mine.reduce((s, a) => s + accountBalance(a, trades, approved), 0);
  const uniqueDays = new Set(own.map((t) => tradeDayKey(t)).filter(Boolean));

  return {
    strategy,
    initialCapital,
    net: m.totalPnl,
    withdrawn,
    currentCapital,
    accounts: mine,
    trades: m.total,
    daysOperated: uniqueDays.size,
    winRate: m.winRate,
    profitFactor: m.profitFactor,
    returnPct: initialCapital ? (m.totalPnl / initialCapital) * 100 : 0,
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
    const dateStr = t.openedAt || t.closedAt;
    const i = dateStr ? new Date(dateStr).getUTCMonth() : 0;
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
