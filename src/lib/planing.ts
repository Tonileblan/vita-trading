import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Account, Strategy, Trade } from "@/lib/types";
import { tradeDayKey } from "@/lib/emotions";

export interface TradingPlan {
  id: string;
  journal_id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  weekly_risk_budget: number;
  daily_risk_budget: number;
  max_daily_trades: number;
  max_loss_streak: number;
  profit_lock_target: number | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TradingPlanSlot {
  id: string;
  plan_id: string;
  journal_id: string;
  user_id: string;
  day_of_week: number; // 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes
  session_name: string;
  start_time: string; // '15:30'
  end_time: string; // '17:30'
  account_id: string | null;
  strategy_id: string | null;
  risk_amount: number | null;
  risk_pct: number | null;
  max_trades: number;
  allowed_symbols: string | null;
  setup_notes: string | null;
  is_active: boolean;
  order_index: number;
  created_at?: string;
  updated_at?: string;
}

export interface TradingPlanChecklist {
  id: string;
  plan_id: string;
  journal_id: string;
  user_id: string;
  date: string;
  slot_id: string | null;
  checked_news: boolean;
  checked_levels: boolean;
  checked_mind: boolean;
  checked_risk: boolean;
  custom_checks: { id: string; text: string; done: boolean }[];
  notes: string | null;
  status: "pending" | "active" | "completed" | "skipped";
}

export const OPERATING_DAYS = [
  { day: 1, label: "Lunes", short: "Lun", desc: "Arranque semanal" },
  { day: 2, label: "Martes", short: "Mar", desc: "Volumen institucional" },
  { day: 3, label: "Miércoles", short: "Mié", desc: "Máxima liquidez" },
  { day: 4, label: "Jueves", short: "Jue", desc: "Continuación y setups A+" },
  { day: 5, label: "Viernes", short: "Vie", desc: "Cierre y protección" },
] as const;

export const DEFAULT_SESSIONS = [
  { name: "NY Apertura", start: "15:30", end: "17:30", defaultSymbols: "MNQ, NQ, ES" },
  { name: "Londres", start: "08:30", end: "11:00", defaultSymbols: "EURUSD, GBPUSD, FDAX" },
  { name: "NY Tarde / Cierre", start: "19:00", end: "21:00", defaultSymbols: "MNQ, NQ, BTC" },
  { name: "Sesión Completa", start: "09:00", end: "18:00", defaultSymbols: "Acciones, Swing" },
] as const;

export const DEFAULT_PLAN_SETTINGS: Omit<TradingPlan, "id" | "journal_id" | "user_id"> = {
  name: "Plan Operativo GO Principal",
  is_active: true,
  weekly_risk_budget: 1500,
  daily_risk_budget: 400,
  max_daily_trades: 3,
  max_loss_streak: 2,
  profit_lock_target: 600,
  notes: "Operar únicamente en los slots configurados respetando el límite de riesgo diario y racha de pérdidas.",
};

// ==========================================
// HELPERS DE TIEMPO Y CÁLCULO
// ==========================================

/** Obtiene el día de la semana operativo actual (1=Lun ... 5=Vie). Si es Sáb(6) o Dom(0) devuelve null */
export function getCurrentOperatingDay(): number | null {
  const d = new Date();
  const day = d.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
  if (day === 0 || day === 6) return null;
  return day;
}

/** Formatea hoy como YYYY-MM-DD */
export function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Comprueba si la hora actual está dentro de una franja horaria HH:MM */
export function isCurrentTimeInSlot(startTime: string, endTime: string): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  if (startH === undefined || startM === undefined || endH === undefined || endM === undefined) {
    return false;
  }

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Calcula el estado en vivo de un slot hoy analizando los trades de hoy.
 */
export function computeSlotLiveStatus(
  slot: TradingPlanSlot,
  todayTrades: Trade[],
  plan: TradingPlan,
) {
  // Filtrar trades de hoy que pertenezcan a la cuenta o estrategia del slot
  const matchingTrades = todayTrades.filter((t) => {
    const matchAcc = !slot.account_id || t.accountId === slot.account_id;
    const matchStrat = !slot.strategy_id || t.strategyId === slot.strategy_id;
    return matchAcc && matchStrat;
  });

  const tradesCount = matchingTrades.length;
  const remainingTrades = Math.max(0, slot.max_trades - tradesCount);
  const netPnl = matchingTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const winTrades = matchingTrades.filter((t) => t.pnl > 0).length;
  const lossTrades = matchingTrades.filter((t) => t.pnl < 0).length;

  // Calcular racha de pérdidas seguidas hoy
  let currentLossStreak = 0;
  for (let i = matchingTrades.length - 1; i >= 0; i--) {
    if ((matchingTrades[i]?.pnl ?? 0) < 0) {
      currentLossStreak++;
    } else {
      break;
    }
  }

  const isTradeLimitReached = tradesCount >= slot.max_trades;
  const isLossStreakReached = currentLossStreak >= plan.max_loss_streak;
  const isProfitTargetReached =
    plan.profit_lock_target !== null && plan.profit_lock_target > 0 && netPnl >= plan.profit_lock_target;
  const isDailyRiskExceeded =
    plan.daily_risk_budget > 0 && netPnl < 0 && Math.abs(netPnl) >= plan.daily_risk_budget;

  const isBlocked = isTradeLimitReached || isLossStreakReached || isDailyRiskExceeded;

  return {
    matchingTrades,
    tradesCount,
    remainingTrades,
    netPnl,
    winTrades,
    lossTrades,
    currentLossStreak,
    isTradeLimitReached,
    isLossStreakReached,
    isProfitTargetReached,
    isDailyRiskExceeded,
    isBlocked,
  };
}

/**
 * Analiza el cumplimiento del plan (Plan Compliance Rate & Infractions).
 */
export function computePlanCompliance(
  trades: Trade[],
  slots: TradingPlanSlot[],
  plan: TradingPlan | null,
  accounts: Account[],
  strategies: Strategy[],
) {
  if (!trades.length || !slots.length) {
    return {
      adherenceRate: 100,
      totalTrades: trades.length,
      onPlanTrades: trades.length,
      offPlanTrades: 0,
      onPlanPnl: trades.reduce((acc, t) => acc + (t.pnl || 0), 0),
      offPlanPnl: 0,
      onPlanWinRate: 0,
      offPlanWinRate: 0,
      infractions: [],
    };
  }

  const slotMap = new Map<string, TradingPlanSlot[]>();
  for (const s of slots) {
    const key = `${s.day_of_week}`;
    const list = slotMap.get(key) || [];
    list.push(s);
    slotMap.set(key, list);
  }

  const infractions: {
    trade: Trade;
    accountName: string;
    strategyName: string;
    reasons: string[];
  }[] = [];

  let onPlanCount = 0;
  let offPlanCount = 0;
  let onPlanPnl = 0;
  let offPlanPnl = 0;
  let onPlanWins = 0;
  let offPlanWins = 0;

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const strategyMap = new Map(strategies.map((s) => [s.id, s.name]));

  for (const trade of trades) {
    const tradeDate = new Date(trade.openedAt || trade.closedAt || "");
    if (isNaN(tradeDate.getTime())) {
      onPlanCount++;
      onPlanPnl += trade.pnl || 0;
      continue;
    }

    const dayOfWeek = tradeDate.getDay(); // 0=Dom, 1=Lun ... 6=Sab
    const tradeHours = tradeDate.getHours();
    const tradeMinutes = tradeDate.getMinutes();
    const tradeTimeMinutes = tradeHours * 60 + tradeMinutes;

    const reasons: string[] = [];

    // 1. ¿Operado en fin de semana?
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      reasons.push("Operación realizada en fin de semana (fuera de L-V)");
    } else {
      const daySlots = slotMap.get(`${dayOfWeek}`) || [];
      if (daySlots.length === 0) {
        reasons.push(`No había ningún slot operativo planificado para ${OPERATING_DAYS[dayOfWeek - 1]?.label || "este día"}`);
      } else {
        // Buscar si encaja con algún slot de ese día
        const matchingSlot = daySlots.find((s) => {
          const matchAcc = !s.account_id || s.account_id === trade.accountId;
          const matchStrat = !s.strategy_id || s.strategy_id === trade.strategyId;
          return matchAcc && matchStrat;
        });

        if (!matchingSlot) {
          reasons.push("La cuenta o estrategia usada no estaba asignada en el planing para este día");
        } else {
          // Comprobar horario si está definido
          const [startH, startM] = matchingSlot.start_time.split(":").map(Number);
          const [endH, endM] = matchingSlot.end_time.split(":").map(Number);
          if (startH !== undefined && startM !== undefined && endH !== undefined && endM !== undefined) {
            const startMin = startH * 60 + startM;
            const endMin = endH * 60 + endM;
            // Damos 15 minutos de margen de cortesía
            if (tradeTimeMinutes < startMin - 15 || tradeTimeMinutes > endMin + 15) {
              reasons.push(`Operado fuera del horario (${matchingSlot.start_time} - ${matchingSlot.end_time})`);
            }
          }
        }
      }
    }

    const isOffPlan = reasons.length > 0;
    if (isOffPlan) {
      offPlanCount++;
      offPlanPnl += trade.pnl || 0;
      if (trade.pnl > 0) offPlanWins++;
      infractions.push({
        trade,
        accountName: accountMap.get(trade.accountId) || "Cuenta no especificada",
        strategyName: (trade.strategyId && strategyMap.get(trade.strategyId)) || "Sin estrategia",
        reasons,
      });
    } else {
      onPlanCount++;
      onPlanPnl += trade.pnl || 0;
      if (trade.pnl > 0) onPlanWins++;
    }
  }

  const total = trades.length;
  const adherenceRate = total > 0 ? (onPlanCount / total) * 100 : 100;
  const onPlanWinRate = onPlanCount > 0 ? (onPlanWins / onPlanCount) * 100 : 0;
  const offPlanWinRate = offPlanCount > 0 ? (offPlanWins / offPlanCount) * 100 : 0;

  return {
    adherenceRate,
    totalTrades: total,
    onPlanTrades: onPlanCount,
    offPlanTrades: offPlanCount,
    onPlanPnl,
    offPlanPnl,
    onPlanWinRate,
    offPlanWinRate,
    infractions,
  };
}

/**
 * Genera slots inteligentes a partir de las estrategias existentes y sus horarios/días configurados.
 */
export function generateDefaultSlotsFromJournal(
  planId: string,
  journalId: string,
  userId: string,
  strategies: Strategy[],
  accounts: Account[],
): Omit<TradingPlanSlot, "id">[] {
  const generated: Omit<TradingPlanSlot, "id">[] = [];
  const defaultAccount = accounts[0]?.id || null;

  strategies.forEach((strat, sIdx) => {
    const rawDays = (strat.days || "").toLowerCase();
    const rawSchedule = strat.schedule || "";

    // Determinar días de la semana
    const targetDays: number[] = [];
    if (rawDays.includes("lun") || rawDays.includes("lunes")) targetDays.push(1);
    if (rawDays.includes("mar") || rawDays.includes("martes")) targetDays.push(2);
    if (rawDays.includes("mie") || rawDays.includes("mié") || rawDays.includes("miercoles")) targetDays.push(3);
    if (rawDays.includes("jue") || rawDays.includes("jueves")) targetDays.push(4);
    if (rawDays.includes("vie") || rawDays.includes("viernes")) targetDays.push(5);

    // Si no tiene días especificados o dice "lun a vie", asignar los 5 días
    const daysToAssign = targetDays.length > 0 ? targetDays : [1, 2, 3, 4, 5];

    // Extraer horario si existe formato HH:MM - HH:MM
    let startTime = "15:30";
    let endTime = "17:30";
    const timeMatch = rawSchedule.match(/(\d{1,2}:\d{2})\s*(?:-|a|to)\s*(\d{1,2}:\d{2})/);
    if (timeMatch && timeMatch[1] && timeMatch[2]) {
      startTime = timeMatch[1].padStart(5, "0");
      endTime = timeMatch[2].padStart(5, "0");
    }

    daysToAssign.forEach((day) => {
      generated.push({
        plan_id: planId,
        journal_id: journalId,
        user_id: userId,
        day_of_week: day,
        session_name: strat.name,
        start_time: startTime,
        end_time: endTime,
        account_id: defaultAccount,
        strategy_id: strat.id,
        risk_amount: strat.initialCapital ? Math.round(strat.initialCapital * (strat.riskPct || 0.01)) : 200,
        risk_pct: strat.riskPct || 0.01,
        max_trades: 2,
        allowed_symbols: strat.mainSymbol || "MNQ, NQ",
        setup_notes: strat.setup || strat.management || "Respetar ratio R:R y stop de pérdida",
        is_active: true,
        order_index: sIdx,
      });
    });
  });

  return generated;
}

// ==========================================
// REACT QUERY HOOKS CON SUPABASE
// ==========================================

export function useTradingPlan(journalId?: string) {
  return useQuery({
    queryKey: ["trading-plan", journalId],
    enabled: !!journalId,
    queryFn: async (): Promise<TradingPlan | null> => {
      if (!journalId) return null;
      const { data, error } = await supabase
        .from("trading_plans" as any)
        .select("*")
        .eq("journal_id", journalId)
        .maybeSingle();

      if (error) {
        console.warn("trading_plans table query warning:", error.message);
        return null;
      }
      return data as unknown as TradingPlan | null;
    },
  });
}

export function useSaveTradingPlan(journalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Partial<TradingPlan>) => {
      if (!journalId) throw new Error("Journal ID no disponible");
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Usuario no autenticado");

      const payload = {
        journal_id: journalId,
        user_id: uid,
        name: plan.name || DEFAULT_PLAN_SETTINGS.name,
        is_active: plan.is_active ?? DEFAULT_PLAN_SETTINGS.is_active,
        weekly_risk_budget: plan.weekly_risk_budget ?? DEFAULT_PLAN_SETTINGS.weekly_risk_budget,
        daily_risk_budget: plan.daily_risk_budget ?? DEFAULT_PLAN_SETTINGS.daily_risk_budget,
        max_daily_trades: plan.max_daily_trades ?? DEFAULT_PLAN_SETTINGS.max_daily_trades,
        max_loss_streak: plan.max_loss_streak ?? DEFAULT_PLAN_SETTINGS.max_loss_streak,
        profit_lock_target: plan.profit_lock_target ?? null,
        notes: plan.notes ?? null,
      };

      const { data, error } = await supabase
        .from("trading_plans" as any)
        .upsert(payload, { onConflict: "journal_id,user_id" })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as TradingPlan;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-plan", journalId] });
    },
  });
}

export function useTradingPlanSlots(planId?: string) {
  return useQuery({
    queryKey: ["trading-plan-slots", planId],
    enabled: !!planId,
    queryFn: async (): Promise<TradingPlanSlot[]> => {
      if (!planId) return [];
      const { data, error } = await supabase
        .from("trading_plan_slots" as any)
        .select("*")
        .eq("plan_id", planId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) {
        console.warn("trading_plan_slots query error:", error.message);
        return [];
      }
      return (data || []) as unknown as TradingPlanSlot[];
    },
  });
}

export function useSavePlanSlot(planId?: string, journalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slot: Partial<TradingPlanSlot>) => {
      if (!planId || !journalId) throw new Error("Plan ID o Journal ID faltante");
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Usuario no autenticado");

      const payload = {
        ...(slot.id ? { id: slot.id } : {}),
        plan_id: planId,
        journal_id: journalId,
        user_id: uid,
        day_of_week: slot.day_of_week ?? 1,
        session_name: slot.session_name || "Sesión Principal",
        start_time: slot.start_time || "15:30",
        end_time: slot.end_time || "17:30",
        account_id: slot.account_id || null,
        strategy_id: slot.strategy_id || null,
        risk_amount: slot.risk_amount ?? null,
        risk_pct: slot.risk_pct ?? null,
        max_trades: slot.max_trades ?? 2,
        allowed_symbols: slot.allowed_symbols ?? "MNQ, NQ",
        setup_notes: slot.setup_notes ?? null,
        is_active: slot.is_active ?? true,
        order_index: slot.order_index ?? 0,
      };

      const { data, error } = await supabase
        .from("trading_plan_slots" as any)
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as TradingPlanSlot;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-plan-slots", planId] });
    },
  });
}

export function useDeletePlanSlot(planId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase
        .from("trading_plan_slots" as any)
        .delete()
        .eq("id", slotId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-plan-slots", planId] });
    },
  });
}

export function useSeedPlanSlots(planId?: string, journalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slots: Omit<TradingPlanSlot, "id">[]) => {
      if (!planId || !journalId || !slots.length) return;
      const { error } = await supabase
        .from("trading_plan_slots" as any)
        .insert(slots);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-plan-slots", planId] });
    },
  });
}

export function usePlanChecklist(date: string, journalId?: string) {
  return useQuery({
    queryKey: ["trading-plan-checklist", journalId, date],
    enabled: !!journalId && !!date,
    queryFn: async (): Promise<TradingPlanChecklist | null> => {
      if (!journalId || !date) return null;
      const { data, error } = await supabase
        .from("trading_plan_checklists" as any)
        .select("*")
        .eq("journal_id", journalId)
        .eq("date", date)
        .maybeSingle();

      if (error) {
        console.warn("trading_plan_checklists query error:", error.message);
        return null;
      }
      return data as unknown as TradingPlanChecklist | null;
    },
  });
}

export function useSavePlanChecklist(date: string, journalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (checklist: Partial<TradingPlanChecklist>) => {
      if (!journalId || !date) throw new Error("Datos incompletos para guardar checklist");
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Usuario no autenticado");

      const payload = {
        journal_id: journalId,
        user_id: uid,
        date,
        plan_id: checklist.plan_id,
        slot_id: checklist.slot_id || null,
        checked_news: checklist.checked_news ?? false,
        checked_levels: checklist.checked_levels ?? false,
        checked_mind: checklist.checked_mind ?? false,
        checked_risk: checklist.checked_risk ?? false,
        custom_checks: checklist.custom_checks ?? [],
        notes: checklist.notes ?? null,
        status: checklist.status ?? "active",
      };

      const { data, error } = await supabase
        .from("trading_plan_checklists" as any)
        .upsert(payload, { onConflict: "journal_id,user_id,date,slot_id" })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as TradingPlanChecklist;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-plan-checklist", journalId, date] });
    },
  });
}
