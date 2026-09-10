import { supabase } from "@/integrations/supabase/client";
import { mockStrategies, mockAccounts, mockTrades, mockWithdrawals } from "./mock-data";

type Row = Record<string, unknown>;

function strategyRow(s: (typeof mockStrategies)[number], journalId: string, userId: string): Row {
  return {
    name: s.name,
    initial_capital: s.initialCapital,
    risk_pct: s.riskPct,
    main_symbol: s.mainSymbol,
    color: s.color,
    market: s.market ?? null,
    chart: s.chart ?? null,
    days: s.days ?? null,
    schedule: s.schedule ?? null,
    execution: s.execution ?? null,
    setup: s.setup ?? null,
    management: s.management ?? null,
    contracts: s.contracts ?? null,
    journal_id: journalId,
    user_id: userId,
  };
}

function accountRow(a: (typeof mockAccounts)[number], journalId: string, userId: string): Row {
  return {
    name: a.name,
    type: a.type,
    status: a.status ?? "active",
    burned_at: a.burnedAt ?? null,
    burned_reason: a.burnedReason ?? null,
    phase: a.phase ?? "eval",
    profit_target: a.profitTarget ?? null,
    firm: a.firm ?? null,
    broker: a.broker ?? null,
    initial_balance: a.initialBalance,
    current_balance: a.currentBalance,
    max_loss_limit: a.maxLossLimit ?? a.drawdownLimit ?? null,
    daily_loss_limit: a.dailyLossLimit ?? null,
    high_watermark: a.highWatermark ?? a.initialBalance,
    start_of_day_balance: a.startOfDayBalance ?? a.initialBalance,
    drawdown_limit: a.maxLossLimit ?? a.drawdownLimit ?? null,
    drawdown_type: a.drawdownType ?? "static",
    currency: a.currency,
    journal_id: journalId,
    user_id: userId,
  };
}

function withdrawalRow(
  w: (typeof mockWithdrawals)[number],
  journalId: string,
  userId: string,
  accountId: string | null,
  strategyId: string | null,
): Row {
  return {
    strategy_id: strategyId,
    account_id: accountId,
    date: w.date,
    amount: w.amount,
    reason: w.reason ?? null,
    journal_id: journalId,
    user_id: userId,
  };
}

/**
 * Crea un diario de ejemplo con estrategias, cuentas, operaciones y retiros
 * ya cargados para que el usuario pueda explorar la aplicación de inmediato.
 */
export async function createExampleJournal(name = "Diario de ejemplo") {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("No hay sesión activa");

  // 1. Crear el diario
  const { data: journal, error: jErr } = await supabase
    .from("journals")
    .insert({
      owner_id: userId,
      name,
      description: "Diario de ejemplo con datos de muestra para explorar la aplicación.",
      base_currency: "USD",
    })
    .select()
    .single();
  if (jErr) throw jErr;
  const journalId = journal.id;

  // 2. Sembrar estrategias (mapear id local -> uuid real)
  const stratRows = mockStrategies.map((s) => strategyRow(s, journalId, userId));
  const { data: insertedStrats, error: sErr } = await supabase
    .from("strategies")
    .insert(stratRows as never)
    .select("id, name");
  if (sErr) throw sErr;
  const stratIdByName = new Map(
    (insertedStrats ?? []).map((s) => [String(s.name), String(s.id)]),
  );
  // map local id -> name -> real id
  const stratIdMap = new Map<string, string>();
  for (const s of mockStrategies) {
    const real = stratIdByName.get(s.name);
    if (real) stratIdMap.set(s.id, real);
  }

  // 3. Sembrar cuentas (mapear id local -> uuid real)
  const accRows = mockAccounts.map((a) => accountRow(a, journalId, userId));
  const { data: insertedAccs, error: aErr } = await supabase
    .from("accounts")
    .insert(accRows as never)
    .select("id, name");
  if (aErr) throw aErr;
  const accIdByName = new Map(
    (insertedAccs ?? []).map((a) => [String(a.name), String(a.id)]),
  );
  const accIdMap = new Map<string, string>();
  for (const a of mockAccounts) {
    const real = accIdByName.get(a.name);
    if (real) accIdMap.set(a.id, real);
  }

  // 4. Sembrar operaciones (subset representativo: primeras 30)
  const sample = mockTrades.slice(0, 30);
  const tradeRows: Row[] = sample.map((t) => ({
    account_id: accIdMap.get(t.accountId) ?? null,
    strategy_id: (t.strategyId ? stratIdMap.get(t.strategyId) : null) ?? null,
    symbol: t.symbol,
    direction: t.direction,
    opened_at: t.openedAt,
    closed_at: t.closedAt,
    entry_price: t.entryPrice,
    exit_price: t.exitPrice,
    size: t.size,
    pnl: t.pnl,
    tags: t.tags,
    notes: t.notes ?? null,
    screenshots: t.screenshots,
    source: t.source,
    journal_id: journalId,
    user_id: userId,
  }));
  const { error: tErr } = await supabase.from("trades").insert(tradeRows as never);
  if (tErr) throw tErr;

  // 5. Sembrar retiros (mapear a la primera cuenta y estrategia disponibles)
  if (mockWithdrawals.length > 0) {
    const firstAcc = accIdMap.get(mockAccounts[0]!.id) ?? null;
    const wdRows = mockWithdrawals.map((w) =>
      withdrawalRow(
        w,
        journalId,
        userId,
        firstAcc,
        w.strategyId ? (stratIdMap.get(w.strategyId) ?? null) : null,
      ),
    );
    const { error: wErr } = await supabase.from("withdrawals").insert(wdRows as never);
    if (wErr) throw wErr;
  }

  return journal;
}
