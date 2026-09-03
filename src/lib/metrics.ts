import type { Account, AccountStrategyPeriod, Trade } from "./types";
import { tradeDayKey, parseTradeDate, parseTradeTime, formatTradeDateLabel } from "./emotions";
export { formatCurrency, parseMoneyInput, formatPercent } from "./money";

export function formatDateTime(iso: string) {
  if (!iso) return "—";
  const d = parseTradeDate(iso);
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
  const d = parseTradeDate(iso);
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
    const aDate = a.openedAt || a.closedAt || a.createdAt || "";
    const bDate = b.openedAt || b.closedAt || b.createdAt || "";
    const diff = parseTradeTime(bDate) - parseTradeTime(aDate);
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
  const totalWins = winTrades.length;
  const totalLosses = lossTrades.length;
  const totalWinsPnl = winTrades.reduce((s, t) => s + t.pnl, 0);
  const totalLossesPnl = lossTrades.reduce((s, t) => s + t.pnl, 0);

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
    const aDate = a.openedAt || a.closedAt || a.createdAt || "";
    const bDate = b.openedAt || b.closedAt || b.createdAt || "";
    const diff = parseTradeTime(bDate) - parseTradeTime(aDate);
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
    } else if (curType === type) {
      curCount++;
      curPnl += t.pnl;
    } else {
      break;
    }
  }

  // Rachas máximas históricas
  const asc = [...desc].reverse();
  let maxWin = 0;
  let maxWinPnl = 0;
  let maxLoss = 0;
  let maxLossPnl = 0;

  let runType: "win" | "loss" | "none" = "none";
  let runCount = 0;
  let runPnl = 0;

  for (const t of asc) {
    if (t.pnl === 0) continue;
    const type: "win" | "loss" = t.pnl > 0 ? "win" : "loss";

    if (runType === type) {
      runCount++;
      runPnl += t.pnl;
    } else {
      runType = type;
      runCount = 1;
      runPnl = t.pnl;
    }

    if (runType === "win") {
      if (runCount > maxWin || (runCount === maxWin && runPnl > maxWinPnl)) {
        maxWin = runCount;
        maxWinPnl = runPnl;
      }
    } else if (runType === "loss") {
      if (runCount > maxLoss || (runCount === maxLoss && runPnl < maxLossPnl)) {
        maxLoss = runCount;
        maxLossPnl = runPnl;
      }
    }
  }

  return {
    current: { type: curType, count: curCount, pnl: curPnl },
    maxWin,
    maxWinPnl,
    maxLoss,
    maxLossPnl,
    wins: totalWins,
    losses: totalLosses,
    winsPnl: totalWinsPnl,
    lossesPnl: totalLossesPnl,
  };
}

/** Filtra operaciones a una ventana de días respecto a la operación más reciente. */
export function filterByDays(trades: Trade[], days: number) {
  if (!days) return trades;
  const latest = trades.reduce(
    (max, t) => Math.max(max, parseTradeTime(t.openedAt || t.closedAt)),
    0,
  );
  const cutoff = latest - days * 86400000;
  return trades.filter((t) => parseTradeTime(t.openedAt || t.closedAt) >= cutoff);
}

export function buildEquityCurve(
  trades: Trade[],
  startBalance: number,
  fundedAccount?: Account | null,
  allTrades?: Trade[],
) {
  if (!trades || trades.length === 0) {
    return [];
  }

  const sorted = [...trades].sort(
    (a, b) =>
      parseTradeTime(a.openedAt || a.closedAt || a.createdAt) -
      parseTradeTime(b.openedAt || b.closedAt || b.createdAt) ||
      String(a.id ?? "").localeCompare(String(b.id ?? "")),
  );

  const isFunded =
    fundedAccount?.type === "funded" &&
    Boolean(fundedAccount.maxLossLimit ?? fundedAccount.drawdownLimit);
  const ddLimit = isFunded
    ? (fundedAccount.maxLossLimit ?? fundedAccount.drawdownLimit ?? 0)
    : 0;
  const ddType = isFunded ? (fundedAccount.drawdownType ?? "static") : "static";
  const initial = fundedAccount?.initialBalance ?? startBalance;

  let computedStartBalance = startBalance;
  let runningIntradayPeak = Math.max(initial, startBalance);
  let runningEodPeak = initial;

  // Si se dispone del historial completo de la cuenta, calculamos la posición real y picos acumulados hasta justo antes de este periodo
  if (allTrades && allTrades.length > 0 && sorted.length > 0) {
    const firstTradeDateStr = sorted[0]?.openedAt || sorted[0]?.closedAt || sorted[0]?.createdAt || "";
    const firstTradeTime = parseTradeTime(firstTradeDateStr);

    const sortedAll = [...allTrades].sort(
      (a, b) =>
        parseTradeTime(a.openedAt || a.closedAt || a.createdAt) -
        parseTradeTime(b.openedAt || b.closedAt || b.createdAt) ||
        String(a.id ?? "").localeCompare(String(b.id ?? "")),
    );

    const priorTrades = sortedAll.filter((t) => {
      const ts = parseTradeTime(t.openedAt || t.closedAt || t.createdAt);
      return ts < firstTradeTime;
    });

    if (priorTrades.length > 0 || sortedAll.length > sorted.length) {
      let priorEquity = initial;
      let priorIntraPeak = initial;
      let priorEod = initial;
      const priorDailyBalances = new Map<string, number>();

      for (const t of priorTrades) {
        priorEquity += t.pnl;
        if (priorEquity > priorIntraPeak) {
          priorIntraPeak = priorEquity;
        }
        const dayKey = tradeDayKey(t);
        if (dayKey) {
          priorDailyBalances.set(dayKey, priorEquity);
        }
      }

      for (const eodBal of priorDailyBalances.values()) {
        if (eodBal > priorEod) {
          priorEod = eodBal;
        }
      }

      computedStartBalance = priorEquity;
      runningIntradayPeak = Math.max(initial, priorIntraPeak);
      runningEodPeak = Math.max(initial, priorEod);
    }
  }

  // Pre-calcular el balance EOD de cierre de cada día
  const dailyEndBalances = new Map<string, number>();
  let cumEq = computedStartBalance;
  for (const t of sorted) {
    cumEq += t.pnl;
    const day = tradeDayKey(t);
    if (day) {
      dailyEndBalances.set(day, cumEq);
    }
  }

  let equity = computedStartBalance;

  const firstDateStr = sorted[0]?.openedAt || sorted[0]?.closedAt || sorted[0]?.createdAt || "";
  const initialDrawdownFloor =
    isFunded && ddLimit > 0
      ? ddType === "static"
        ? Number((initial - ddLimit).toFixed(2))
        : ddType === "eod"
          ? Number((Math.max(initial, runningEodPeak) - ddLimit).toFixed(2))
          : Number((Math.max(initial, runningIntradayPeak) - ddLimit).toFixed(2))
      : undefined;

  const points = [
    {
      index: 0,
      date: firstDateStr ? formatTradeDateLabel(firstDateStr) : "Inicio",
      fullDate: firstDateStr ? formatDateTime(firstDateStr) : "Balance Inicial",
      equity: Number(computedStartBalance.toFixed(2)),
      ...(initialDrawdownFloor !== undefined ? { drawdownFloor: initialDrawdownFloor } : {}),
    },
  ];

  let currentDay: string | null = null;
  sorted.forEach((t, i) => {
    equity += t.pnl;
    const dateStr = t.openedAt || t.closedAt || t.createdAt || "";
    const day = tradeDayKey(t);

    runningIntradayPeak = Math.max(runningIntradayPeak, equity);

    // En EOD, el suelo se ajusta al cierre de cada día consolidado
    if (day && day !== currentDay) {
      if (currentDay && dailyEndBalances.has(currentDay)) {
        const prevDayClose = dailyEndBalances.get(currentDay)!;
        runningEodPeak = Math.max(runningEodPeak, prevDayClose);
      }
      currentDay = day;
    }

    let drawdownFloor: number | undefined;
    if (isFunded && ddLimit > 0) {
      if (ddType === "static") {
        drawdownFloor = Number((initial - ddLimit).toFixed(2));
      } else if (ddType === "trailing") {
        // En Trailing, el suelo sube inmediatamente con cada nuevo máximo intradía
        drawdownFloor = Number((runningIntradayPeak - ddLimit).toFixed(2));
      } else if (ddType === "eod") {
        // En EOD, el suelo sube al cierre consolidado del día
        const dayClose = day ? dailyEndBalances.get(day) ?? equity : equity;
        const activeEodPeak = Math.max(initial, runningEodPeak, dayClose > runningEodPeak ? dayClose : runningEodPeak);
        drawdownFloor = Number((activeEodPeak - ddLimit).toFixed(2));
      }
    }

    points.push({
      index: i + 1,
      date: dateStr ? formatTradeDateLabel(dateStr) : `T${i + 1}`,
      fullDate: dateStr ? formatDateTime(dateStr) : `Operación #${i + 1}`,
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
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return trades.filter((t) => parseTradeTime(t.openedAt || t.closedAt) >= start);
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "180d" ? 180 : 90;
  const latest = trades.reduce(
    (max, t) => Math.max(max, parseTradeTime(t.openedAt || t.closedAt)),
    now.getTime(),
  );
  const cutoff = latest - days * 86400000;
  return trades.filter((t) => parseTradeTime(t.openedAt || t.closedAt) >= cutoff);
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
  /** Balance mínimo permitido antes de romper la cuenta (Suelo Máximo). */
  floor: number;
  /** Referencia de cálculo (High Watermark para trailing/eod o inicial para static). */
  reference: number;
  /** Pico máximo alcanzado */
  highWatermark: number;
  balance: number;
  /** Pérdida total consumida (DD Consumido) */
  used: number;
  /** Margen total restante antes de la liquidación */
  remaining: number;
  /** Porcentaje de drawdown consumido (0 - 100) */
  pct: number;
  /** Porcentaje de salud / margen restante (0 - 100) */
  healthPct: number;
  breached: boolean;
  /** Último cierre diario por debajo del suelo vigente. */
  breachedAt?: string;
  /** El suelo dinámico ya no sube más (si aplica tope). */
  frozen?: boolean;
  // Métricas de Límite Diario (Daily Loss)
  hasDailyLimit: boolean;
  dailyLimit?: number;
  startOfDayBalance?: number;
  /** Suelo de liquidación diaria (start_of_day_balance - daily_loss_limit) */
  dailyFloor?: number;
  /** Pérdida consumida en la sesión de hoy */
  dailyUsed?: number;
  /** Margen diario restante */
  dailyRemaining?: number;
  dailyPct?: number;
  dailyHealthPct?: number;
  dailyBreached?: boolean;
}

const DD_LABELS: Record<NonNullable<Account["drawdownType"]>, string> = {
  trailing: "Trailing (Intraday)",
  eod: "End of Day (EOD)",
  static: "Estático",
};

/** Calcula el estado de drawdown y límite diario según el tipo configurado en la cuenta. */
export function accountDrawdown(
  account: Account,
  trades: Trade[] = [],
  withdrawals: { accountId?: string | undefined; date?: string; amount: number }[] = [],
): DrawdownStatus | null {
  const maxLimit = account.maxLossLimit ?? account.drawdownLimit ?? 0;
  const dailyLimit = account.dailyLossLimit ?? 0;
  const type = account.drawdownType ?? "static";

  // Si no tiene límite máximo ni diario configurado, no aplica control de drawdown
  if (!maxLimit && !dailyLimit) return null;

  const initial = account.initialBalance || 0;
  const balance = accountBalance(account, trades, withdrawals);

  // Filtrar operaciones de esta cuenta específica
  const accTrades =
    account.id === "combined-funded"
      ? trades.filter((t) => !t.accountId || t.accountId === account.id)
      : trades.filter((t) => t.accountId === account.id);

  // 1. Reconstruir la evolución día a día (EOD) y trade a trade (Intraday)
  // Utilizamos la misma base de curva que buildEquityCurve
  const startBalance =
    accTrades.length > 0 && account.id !== "combined-funded"
      ? accountCurveStart(account, accTrades, withdrawals)
      : initial;

  let runningIntradayPeak = Math.max(initial, startBalance);
  let runningEodPeak = Math.max(initial, startBalance);

  if (accTrades.length > 0) {
    const sortedTrades = [...accTrades].sort((a, b) => {
      const aDate = a.openedAt || a.closedAt || a.createdAt || "";
      const bDate = b.openedAt || b.closedAt || b.createdAt || "";
      const diff = parseTradeTime(aDate) - parseTradeTime(bDate);
      if (diff !== 0) return diff;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });

    const dailyBalances = new Map<string, number>();
    let runningEquity = startBalance;
    for (const t of sortedTrades) {
      runningEquity += t.pnl;
      if (runningEquity > runningIntradayPeak) {
        runningIntradayPeak = runningEquity;
      }
      const day = tradeDayKey(t);
      if (day) {
        dailyBalances.set(day, runningEquity);
      }
    }

    // El pico EOD es el máximo balance consolidado al final de cualquier sesión de trading
    for (const endOfDayBalance of dailyBalances.values()) {
      if (endOfDayBalance > runningEodPeak) {
        runningEodPeak = endOfDayBalance;
      }
    }
  }

  // 2. High Watermark real (pico histórico máximo alcanzado por la cuenta según sus operaciones)
  const truePeak =
    type === "eod"
      ? (accTrades.length > 0 ? runningEodPeak : Math.max(initial, account.highWatermark ?? initial))
      : (accTrades.length > 0 ? runningIntradayPeak : Math.max(initial, balance, account.highWatermark ?? initial));

  const highWatermark = truePeak;

  // 3. Determinar la Referencia de cálculo para el suelo según el tipo de drawdown
  // - En Estático: El suelo de pérdida parte del balance inicial (initial) y no sube.
  // - En EOD / Trailing: El suelo parte y sube desde el pico histórico consolidado (highWatermark).
  const reference = type === "static" ? initial : highWatermark;

  // 4. Fórmulas de Suelo de Pérdida Máxima y Drawdown
  const floor = maxLimit > 0 ? reference - maxLimit : 0;
  const used = Math.max(0, reference - balance);
  const remaining = maxLimit > 0 ? Math.max(0, balance - floor) : 0;
  const pct = maxLimit > 0 ? Math.min(100, Math.max(0, (used / maxLimit) * 100)) : 0;
  const healthPct = maxLimit > 0 ? Math.min(100, Math.max(0, (remaining / maxLimit) * 100)) : 100;
  const breached = maxLimit > 0 && balance <= floor;

  // 4. Fórmulas de Límite Diario (Daily Loss)
  const hasDailyLimit = Boolean(dailyLimit && dailyLimit > 0);
  let startOfDayBalance = account.startOfDayBalance;
  if (startOfDayBalance === undefined || startOfDayBalance === null || startOfDayBalance === initial) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTrades = accTrades.filter(
      (t) => (t.openedAt || t.closedAt || t.createdAt || "").slice(0, 10) === todayStr,
    );
    const todayPnl = todayTrades.reduce((s, t) => s + t.pnl, 0);
    startOfDayBalance = balance - todayPnl;
  }
  if (!startOfDayBalance) {
    startOfDayBalance = initial;
  }

  let dailyFloor: number | undefined;
  let dailyUsed: number | undefined;
  let dailyRemaining: number | undefined;
  let dailyPct: number | undefined;
  let dailyHealthPct: number | undefined;
  let dailyBreached: boolean | undefined;

  if (hasDailyLimit) {
    dailyFloor = startOfDayBalance - dailyLimit;
    dailyUsed = Math.max(0, startOfDayBalance - balance);
    dailyRemaining = Math.max(0, balance - dailyFloor);
    dailyPct = Math.min(100, Math.max(0, (dailyUsed / dailyLimit) * 100));
    dailyHealthPct = Math.min(100, Math.max(0, (dailyRemaining / dailyLimit) * 100));
    dailyBreached = balance <= dailyFloor;
  }

  return {
    type,
    label: DD_LABELS[type] ?? "Estático",
    limit: maxLimit,
    floor,
    reference,
    highWatermark,
    balance,
    used,
    remaining,
    pct,
    healthPct,
    breached,
    hasDailyLimit,
    ...(hasDailyLimit
      ? {
          dailyLimit: dailyLimit!,
          startOfDayBalance: startOfDayBalance!,
          dailyFloor: dailyFloor!,
          dailyUsed: dailyUsed!,
          dailyRemaining: dailyRemaining!,
          dailyPct: dailyPct!,
          dailyHealthPct: dailyHealthPct!,
          dailyBreached: dailyBreached!,
        }
      : {}),
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
