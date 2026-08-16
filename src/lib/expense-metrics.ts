import type { Expense } from "./expenses";

/** Una ocurrencia concreta de un costo (los recurrentes generan varias). */
export interface Occurrence {
  expense: Expense;
  date: Date;
  amount: number;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Expande los costos recurrentes en ocurrencias hasta `until` (por defecto hoy). */
export function expand(expenses: Expense[], until = new Date()): Occurrence[] {
  const out: Occurrence[] = [];
  for (const e of expenses) {
    const start = new Date(e.date);
    if (Number.isNaN(start.getTime())) continue;
    const end = e.recurrence_end ? new Date(e.recurrence_end) : until;
    const limit = end < until ? end : until;
    if (e.recurrence === "none") {
      out.push({ expense: e, date: start, amount: e.amount });
      continue;
    }
    const step = e.recurrence === "monthly" ? 1 : 12;
    let cursor = new Date(start);
    let guard = 0;
    while (cursor <= limit && guard < 600) {
      out.push({ expense: e, date: new Date(cursor), amount: e.amount });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + step, cursor.getDate());
      guard++;
    }
  }
  return out.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export const total = (occ: Occurrence[]) => occ.reduce((s, o) => s + o.amount, 0);

export function inMonth(occ: Occurrence[], ref = new Date()) {
  const k = monthKey(ref);
  return occ.filter((o) => monthKey(o.date) === k);
}

export function inYear(occ: Occurrence[], ref = new Date()) {
  return occ.filter((o) => o.date.getFullYear() === ref.getFullYear());
}

/** Coste fijo mensual equivalente de los recurrentes activos. */
export function fixedMonthlyCost(expenses: Expense[], ref = new Date()) {
  return expenses.reduce((sum, e) => {
    if (e.recurrence === "none") return sum;
    if (e.recurrence_end && new Date(e.recurrence_end) < ref) return sum;
    if (new Date(e.date) > ref) return sum;
    return sum + (e.recurrence === "monthly" ? e.amount : e.amount / 12);
  }, 0);
}

export function byCategory(occ: Occurrence[]) {
  const map = new Map<string, number>();
  for (const o of occ) map.set(o.expense.category, (map.get(o.expense.category) ?? 0) + o.amount);
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Serie de los últimos `months` meses con el total de costos de cada uno. */
export function monthlySeries(occ: Occurrence[], months = 12, ref = new Date()) {
  const out: { key: string; label: string; amount: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const k = monthKey(d);
    out.push({
      key: k,
      label: d.toLocaleDateString("es-ES", { month: "short" }),
      amount: occ.filter((o) => monthKey(o.date) === k).reduce((s, o) => s + o.amount, 0),
    });
  }
  return out;
}

/** Costos imputados a una cuenta concreta. */
export function accountCost(expenses: Expense[], accountId: string) {
  return total(expand(expenses.filter((e) => e.account_id === accountId)));
}
