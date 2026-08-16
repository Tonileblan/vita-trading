import type { Trade } from "./types";
import type { MoodCheckin } from "./mood";
import { todayKey } from "./emotions";

export interface Bucket {
  key: string;
  label: string;
  trades: number;
  pnl: number;
  winRate: number;
  avgPnl: number;
}

function bucket(key: string, label: string, trades: Trade[]): Bucket {
  const pnl = trades.reduce((s, t) => s + t.pnl, 0);
  const wins = trades.filter((t) => t.pnl > 0).length;
  return {
    key,
    label,
    trades: trades.length,
    pnl,
    winRate: trades.length ? (wins / trades.length) * 100 : 0,
    avgPnl: trades.length ? pnl / trades.length : 0,
  };
}

export function groupBy(
  trades: Trade[],
  pick: (t: Trade) => string | undefined,
  label: (key: string) => string,
): Bucket[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = pick(t);
    if (!k) continue;
    const list = groups.get(k) ?? [];
    list.push(t);
    groups.set(k, list);
  }
  return [...groups.entries()]
    .map(([k, list]) => bucket(k, label(k), list))
    .sort((a, b) => b.pnl - a.pnl);
}

/** Coste acumulado de cada error marcado (una operación puede tener varios). */
export function mistakeCost(trades: Trade[], label: (key: string) => string): Bucket[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    for (const m of t.mistakes ?? []) {
      const list = groups.get(m) ?? [];
      list.push(t);
      groups.set(m, list);
    }
  }
  return [...groups.entries()]
    .map(([k, list]) => bucket(k, label(k), list))
    .sort((a, b) => a.pnl - b.pnl);
}

/** Fecha local YYYY-MM-DD del cierre de una operación. */
export const tradeDayKey = (t: Trade) => todayKey(new Date(t.closedAt));

export function pnlByDay(trades: Trade[]) {
  const out = new Map<string, { pnl: number; trades: number }>();
  for (const t of trades) {
    const k = tradeDayKey(t);
    const cur = out.get(k) ?? { pnl: 0, trades: 0 };
    cur.pnl += t.pnl;
    cur.trades += 1;
    out.set(k, cur);
  }
  return out;
}

/** Rendimiento agrupado por nivel (1-5) de una métrica del check-in. */
export function byCheckinLevel(
  trades: Trade[],
  checkins: MoodCheckin[],
  field: "mood" | "energy" | "stress" | "focus",
): Bucket[] {
  const level = new Map(checkins.map((c) => [c.date, c[field]]));
  return groupBy(
    trades,
    (t) => {
      const l = level.get(tradeDayKey(t));
      return l ? String(l) : undefined;
    },
    (k) => `Nivel ${k}`,
  ).sort((a, b) => Number(a.key) - Number(b.key));
}

export interface RiskRules {
  enabled: boolean;
  max_loss_streak: number;
  max_trades_day: number;
  max_daily_loss: number | null;
  require_checkin: boolean;
}

export interface RiskAlert {
  key: string;
  message: string;
  tone: "warn" | "info";
}

/** Comprueba las reglas contra las operaciones de hoy. */
export function checkRules(
  trades: Trade[],
  rules: RiskRules,
  hasCheckinToday: boolean,
): RiskAlert[] {
  if (!rules.enabled) return [];
  const key = todayKey();
  const today = trades
    .filter((t) => tradeDayKey(t) === key)
    .sort((a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime());
  const alerts: RiskAlert[] = [];

  let streak = 0;
  for (const t of [...today].reverse()) {
    if (t.pnl === 0) continue;
    if (t.pnl < 0) streak++;
    else break;
  }
  if (rules.max_loss_streak > 0 && streak >= rules.max_loss_streak) {
    alerts.push({
      key: "streak",
      tone: "warn",
      message: `Llevas ${streak} pérdidas seguidas hoy — considera parar.`,
    });
  }
  if (rules.max_trades_day > 0 && today.length >= rules.max_trades_day) {
    alerts.push({
      key: "count",
      tone: "warn",
      message: `Ya llevas ${today.length} operaciones hoy (límite ${rules.max_trades_day}).`,
    });
  }
  const dayPnl = today.reduce((s, t) => s + t.pnl, 0);
  if (rules.max_daily_loss != null && rules.max_daily_loss > 0 && dayPnl <= -rules.max_daily_loss) {
    alerts.push({
      key: "loss",
      tone: "warn",
      message: `Has superado tu pérdida máxima diaria (${dayPnl.toFixed(2)}).`,
    });
  }
  if (rules.require_checkin && !hasCheckinToday) {
    alerts.push({
      key: "checkin",
      tone: "info",
      message: "Aún no has hecho el check-in emocional de hoy.",
    });
  }
  return alerts;
}
