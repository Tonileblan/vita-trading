import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, unknown>;

const STRAT_COLS = [
  "name", "initial_capital", "risk_pct", "main_symbol", "color",
  "market", "chart", "days", "schedule", "execution", "setup",
  "management", "contracts",
] as const;

const ACC_COLS = [
  "name", "type", "firm", "broker", "phase", "profit_target",
  "initial_balance", "current_balance", "drawdown_limit", "drawdown_type",
  "max_loss_limit", "daily_loss_limit", "high_watermark", "start_of_day_balance",
  "status", "burned_at", "burned_reason",
  "currency",
] as const;

/**
 * Clona un diario publicado como plantilla pública a un nuevo diario propio
 * del usuario actual. Copia estrategias, cuentas, operaciones, retiros,
 * gastos, reglas y registros emocionales (mapeando los ids nuevos).
 */
export async function cloneTemplateJournal(templateId: string, newName: string) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("No hay sesión activa");

  // 0. Datos de la plantilla (cabecera)
  const { data: tpl, error: jErr } = await supabase
    .from("journals")
    .select("name, description, base_currency")
    .eq("id", templateId)
    .single();
  if (jErr) throw jErr;

  // 1. Crear el nuevo diario
  const { data: journal, error: njErr } = await supabase
    .from("journals")
    .insert({
      owner_id: userId,
      name: newName,
      description: tpl?.description ?? null,
      base_currency: tpl?.base_currency ?? "USD",
    })
    .select()
    .single();
  if (njErr) throw njErr;
  const journalId = String(journal.id);

  // 2. Estrategias
  const { data: strats } = await supabase
    .from("strategies")
    .select("*")
    .eq("journal_id", templateId);
  const stratIdMap = new Map<string, string>();
  const stratRows: Row[] = [];
  for (const s of strats ?? []) {
    const row: Row = { journal_id: journalId, user_id: userId };
    for (const c of STRAT_COLS) row[c] = s[c];
    stratRows.push(row);
  }
  if (stratRows.length) {
    const { data: inserted, error } = await supabase
      .from("strategies")
      .insert(stratRows as never)
      .select("id, name");
    if (error) throw error;
    for (const s of strats ?? []) {
      const match = (inserted ?? []).find((x) => x.name === s.name);
      if (match) stratIdMap.set(String(s.id), String(match.id));
    }
  }

  // 3. Cuentas
  const { data: accs } = await supabase
    .from("accounts")
    .select("*")
    .eq("journal_id", templateId);
  const accIdMap = new Map<string, string>();
  const accRows: Row[] = [];
  for (const a of accs ?? []) {
    const row: Row = { journal_id: journalId, user_id: userId };
    for (const c of ACC_COLS) row[c] = a[c];
    accRows.push(row);
  }
  if (accRows.length) {
    const { data: inserted, error } = await supabase
      .from("accounts")
      .insert(accRows as never)
      .select("id, name");
    if (error) throw error;
    for (const a of accs ?? []) {
      const match = (inserted ?? []).find((x) => x.name === a.name);
      if (match) accIdMap.set(String(a.id), String(match.id));
    }
  }

  // 4. Operaciones
  const { data: trades } = await supabase
    .from("trades")
    .select("*")
    .eq("journal_id", templateId);
  if (trades && trades.length) {
    const tradeRows: Row[] = trades.map((t) => ({
      journal_id: journalId,
      user_id: userId,
      account_id: t.account_id ? (accIdMap.get(String(t.account_id)) ?? null) : null,
      strategy_id: t.strategy_id ? (stratIdMap.get(String(t.strategy_id)) ?? null) : null,
      symbol: t.symbol,
      direction: t.direction,
      opened_at: t.opened_at,
      closed_at: t.closed_at,
      entry_price: t.entry_price,
      exit_price: t.exit_price,
      size: t.size,
      pnl: t.pnl,
      tags: t.tags,
      notes: t.notes,
      screenshots: t.screenshots,
      source: t.source,
      import_batch_id: t.import_batch_id,
      emotion_before: t.emotion_before,
      emotion_after: t.emotion_after,
      followed_plan: t.followed_plan,
      mistakes: t.mistakes,
      emotion_note: t.emotion_note,
    }));
    const { error } = await supabase.from("trades").insert(tradeRows as never);
    if (error) throw error;
  }

  // 5. Retiros
  const { data: withdrawals } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("journal_id", templateId);
  if (withdrawals && withdrawals.length) {
    const wdRows: Row[] = withdrawals.map((w) => ({
      journal_id: journalId,
      user_id: userId,
      strategy_id: w.strategy_id ? (stratIdMap.get(String(w.strategy_id)) ?? null) : null,
      account_id: w.account_id ? (accIdMap.get(String(w.account_id)) ?? null) : null,
      date: w.date,
      amount: w.amount,
      reason: w.reason,
      status: w.status ?? "approved",
      requested_at: w.requested_at,
      approved_at: w.approved_at,
    }));
    const { error } = await supabase.from("withdrawals").insert(wdRows as never);
    if (error) throw error;
  }

  // 6. Gastos
  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("journal_id", templateId);
  if (expenses && expenses.length) {
    const expRows: Row[] = expenses.map((e) => ({
      journal_id: journalId,
      user_id: userId,
      account_id: e.account_id ? (accIdMap.get(String(e.account_id)) ?? null) : null,
      category: e.category,
      concept: e.concept,
      amount: e.amount,
      currency: e.currency,
      date: e.date,
      recurrence: e.recurrence,
      recurrence_end: e.recurrence_end,
      paid: e.paid,
      notes: e.notes,
    }));
    const { error } = await supabase.from("expenses").insert(expRows as never);
    if (error) throw error;
  }

  // 7. Reglas de disciplina
  const { data: rules } = await supabase
    .from("journal_rules")
    .select("*")
    .eq("journal_id", templateId);
  if (rules && rules.length) {
    const ruleRows: Row[] = rules.map((r) => ({
      journal_id: journalId,
      user_id: userId,
      enabled: r.enabled,
      max_loss_streak: r.max_loss_streak,
      max_trades_day: r.max_trades_day,
      max_daily_loss: r.max_daily_loss,
      require_checkin: r.require_checkin,
    }));
    const { error } = await supabase.from("journal_rules").insert(ruleRows as never);
    if (error) throw error;
  }

  return journal;
}
