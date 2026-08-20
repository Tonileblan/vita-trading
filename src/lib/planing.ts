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
 * Genera un nombre recomendado inteligente para un nuevo plan de trading.
 */
export function generateRecommendedPlanName(): string {
  const now = new Date();
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const month = monthNames[now.getMonth()];
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `Plan Operativo Q${quarter} (${month} ${year})`;
}

/**
 * Calcula el cumplimiento y adherencia de los trades con respecto al plan.
 * Solo evalúa operaciones ejecutadas a partir de la fecha de creación del plan.
 */
export function computePlanCompliance(
  trades: Trade[],
  slots: TradingPlanSlot[],
  plan: TradingPlan,
  accounts: Account[],
  strategies: Strategy[],
  options?: { dateFilter?: "since_plan" | "last_7d" | "last_30d" | "all" },
) {
  const dateFilter = options?.dateFilter || "since_plan";

  // Determinar fecha de corte para evaluar cumplimiento
  let minTimestamp = 0;
  if (dateFilter === "since_plan" && plan.created_at) {
    const createdDate = new Date(plan.created_at);
    if (!isNaN(createdDate.getTime())) {
      // Corte a las 00:00:00 del día de creación del plan
      minTimestamp = new Date(
        createdDate.getFullYear(),
        createdDate.getMonth(),
        createdDate.getDate(),
      ).getTime();
    }
  } else if (dateFilter === "last_7d") {
    minTimestamp = Date.now() - 7 * 24 * 60 * 60 * 1000;
  } else if (dateFilter === "last_30d") {
    minTimestamp = Date.now() - 30 * 24 * 60 * 60 * 1000;
  }

  // Filtrar operaciones dentro del periodo del plan
  const eligibleTrades = trades.filter((t) => {
    const tradeTime = new Date(t.openedAt || t.closedAt || "").getTime();
    if (isNaN(tradeTime)) return false;
    return minTimestamp === 0 || tradeTime >= minTimestamp;
  });

  if (eligibleTrades.length === 0) {
    return {
      adherenceRate: 100,
      totalTrades: 0,
      onPlanTrades: 0,
      offPlanTrades: 0,
      onPlanPnl: 0,
      offPlanPnl: 0,
      onPlanWinRate: 0,
      offPlanWinRate: 0,
      infractions: [],
      hasEvaluatedTrades: false,
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

  for (const trade of eligibleTrades) {
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

  const total = eligibleTrades.length;
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
    hasEvaluatedTrades: true,
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
// PERSISTENCIA Y FALLBACK LOCAL RESILIENTE
// ==========================================

const LOCAL_PLANS_KEY = (jid: string) => `vita_trading_plans_list_${jid}`;
const LOCAL_PLAN_KEY = (jid: string) => `vita_trading_plan_${jid}`;
const LOCAL_SLOTS_KEY = (planId: string) => `vita_trading_slots_${planId}`;
const LOCAL_CHECKLIST_KEY = (jid: string, date: string) => `vita_trading_chk_${jid}_${date}`;

export function getLocalPlans(journalId: string): TradingPlan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_PLANS_KEY(journalId));
    if (raw) return JSON.parse(raw);
    const single = getLocalPlan(journalId);
    if (single) return [single];
    return [];
  } catch {
    return [];
  }
}

export function setLocalPlans(journalId: string, plans: TradingPlan[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_PLANS_KEY(journalId), JSON.stringify(plans));
  } catch {}
}

function getLocalPlan(journalId: string): TradingPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_PLAN_KEY(journalId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalPlan(journalId: string, plan: TradingPlan): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_PLAN_KEY(journalId), JSON.stringify(plan));
  } catch {}
}

function getLocalSlots(planId: string): TradingPlanSlot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_SLOTS_KEY(planId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalSlots(planId: string, slots: TradingPlanSlot[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_SLOTS_KEY(planId), JSON.stringify(slots));
  } catch {}
}

function getLocalChecklist(journalId: string, date: string): TradingPlanChecklist | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_CHECKLIST_KEY(journalId, date));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalChecklist(journalId: string, date: string, chk: TradingPlanChecklist): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_CHECKLIST_KEY(journalId, date), JSON.stringify(chk));
  } catch {}
}

// ==========================================
// REACT QUERY HOOKS CON SUPABASE + FALLBACK
// ==========================================

export function useTradingPlans(journalId?: string) {
  return useQuery({
    queryKey: ["trading-plans", journalId],
    enabled: !!journalId,
    queryFn: async (): Promise<TradingPlan[]> => {
      if (!journalId) return [];
      try {
        const { data, error } = await supabase
          .from("trading_plans" as any)
          .select("*")
          .eq("journal_id", journalId)
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          const plans = data as unknown as TradingPlan[];
          setLocalPlans(journalId, plans);
          return plans;
        }
      } catch (err) {
        console.warn("trading_plans query fallback to local storage:", err);
      }
      return getLocalPlans(journalId);
    },
  });
}

export function useTradingPlan(journalId?: string, planId?: string) {
  return useQuery({
    queryKey: ["trading-plan", journalId, planId],
    enabled: !!journalId,
    queryFn: async (): Promise<TradingPlan | null> => {
      if (!journalId) return null;
      try {
        let query = supabase
          .from("trading_plans" as any)
          .select("*")
          .eq("journal_id", journalId);

        if (planId && planId !== "default-plan") {
          query = query.eq("id", planId);
        }

        const { data, error } = await query.maybeSingle();

        if (!error && data) {
          const plan = data as unknown as TradingPlan;
          setLocalPlan(journalId, plan);
          return plan;
        }
      } catch (err) {
        console.warn("trading_plans query fallback to local storage:", err);
      }

      const allPlans = getLocalPlans(journalId);
      if (planId && planId !== "default-plan") {
        const match = allPlans.find((p) => p.id === planId);
        if (match) return match;
      }
      return allPlans[0] || getLocalPlan(journalId);
    },
  });
}

export function useSaveTradingPlan(journalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Partial<TradingPlan>) => {
      if (!journalId) throw new Error("Journal ID no disponible");
      let uid = "local-user";
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) uid = userData.user.id;
      } catch {}

      const currentPlans = getLocalPlans(journalId);
      const isNew = !plan.id || plan.id === "default-plan" || !currentPlans.some((p) => p.id === plan.id);
      const planId = isNew
        ? `plan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        : plan.id!;

      const existing = currentPlans.find((p) => p.id === planId);

      const payload: TradingPlan = {
        id: planId,
        journal_id: journalId,
        user_id: uid,
        name: plan.name || existing?.name || generateRecommendedPlanName(),
        is_active: plan.is_active ?? existing?.is_active ?? DEFAULT_PLAN_SETTINGS.is_active,
        weekly_risk_budget: plan.weekly_risk_budget ?? existing?.weekly_risk_budget ?? DEFAULT_PLAN_SETTINGS.weekly_risk_budget,
        daily_risk_budget: plan.daily_risk_budget ?? existing?.daily_risk_budget ?? DEFAULT_PLAN_SETTINGS.daily_risk_budget,
        max_daily_trades: plan.max_daily_trades ?? existing?.max_daily_trades ?? DEFAULT_PLAN_SETTINGS.max_daily_trades,
        max_loss_streak: plan.max_loss_streak ?? existing?.max_loss_streak ?? DEFAULT_PLAN_SETTINGS.max_loss_streak,
        profit_lock_target: plan.profit_lock_target ?? existing?.profit_lock_target ?? null,
        notes: plan.notes ?? existing?.notes ?? null,
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Actualizar lista local de planes
      let updatedPlans: TradingPlan[];
      const idx = currentPlans.findIndex((p) => p.id === planId);
      if (idx >= 0) {
        updatedPlans = [...currentPlans];
        updatedPlans[idx] = payload;
      } else {
        updatedPlans = [payload, ...currentPlans];
      }
      setLocalPlans(journalId, updatedPlans);
      setLocalPlan(journalId, payload);

      // Intentar sincronizar con Supabase
      try {
        const { data, error } = await supabase
          .from("trading_plans" as any)
          .upsert(payload)
          .select()
          .single();

        if (!error && data) {
          const remote = data as unknown as TradingPlan;
          setLocalPlan(journalId, remote);
          return remote;
        }
      } catch (err: any) {
        console.warn("Supabase trading_plans no disponible aún, guardado localmente:", err?.message || err);
      }

      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-plans", journalId] });
      qc.invalidateQueries({ queryKey: ["trading-plan", journalId] });
    },
  });
}

export function useDeleteTradingPlan(journalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      if (!journalId) return;
      const currentPlans = getLocalPlans(journalId);
      const remaining = currentPlans.filter((p) => p.id !== planId);
      setLocalPlans(journalId, remaining);
      if (remaining[0]) setLocalPlan(journalId, remaining[0]);

      try {
        await supabase
          .from("trading_plans" as any)
          .delete()
          .eq("id", planId);
      } catch {}
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-plans", journalId] });
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
      try {
        const { data, error } = await supabase
          .from("trading_plan_slots" as any)
          .select("*")
          .eq("plan_id", planId)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });

        if (!error && data && data.length > 0) {
          const remoteSlots = data as unknown as TradingPlanSlot[];
          setLocalSlots(planId, remoteSlots);
          return remoteSlots;
        }
      } catch (err) {
        console.warn("trading_plan_slots query fallback to local storage:", err);
      }
      return getLocalSlots(planId);
    },
  });
}

export function useSavePlanSlot(planId?: string, journalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slot: Partial<TradingPlanSlot>) => {
      if (!planId || !journalId) throw new Error("Plan ID o Journal ID faltante");
      let uid = "local-user";
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) uid = userData.user.id;
      } catch {}

      const slotId = slot.id || `slot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const payload: TradingPlanSlot = {
        id: slotId,
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Guardar localmente
      const currentSlots = getLocalSlots(planId);
      const existingIdx = currentSlots.findIndex(
        (s) =>
          (slot.id && s.id === slot.id) ||
          (s.day_of_week === payload.day_of_week &&
            s.account_id === payload.account_id &&
            s.strategy_id === payload.strategy_id),
      );

      let nextSlots: TradingPlanSlot[];
      if (existingIdx >= 0) {
        nextSlots = [...currentSlots];
        nextSlots[existingIdx] = { ...currentSlots[existingIdx], ...payload };
      } else {
        nextSlots = [...currentSlots, payload];
      }
      setLocalSlots(planId, nextSlots);

      // Intentar guardar en Supabase
      try {
        const { data, error } = await supabase
          .from("trading_plan_slots" as any)
          .upsert(payload)
          .select()
          .single();

        if (!error && data) {
          const remoteSlot = data as unknown as TradingPlanSlot;
          const updated = nextSlots.map((s) => (s.id === slotId ? remoteSlot : s));
          setLocalSlots(planId, updated);
          return remoteSlot;
        }
      } catch (err: any) {
        console.warn("Supabase trading_plan_slots no disponible aún, guardado localmente:", err?.message || err);
      }

      return payload;
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
      if (planId) {
        const currentSlots = getLocalSlots(planId);
        setLocalSlots(planId, currentSlots.filter((s) => s.id !== slotId));
      }

      try {
        await supabase
          .from("trading_plan_slots" as any)
          .delete()
          .eq("id", slotId);
      } catch {}
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
      const hydratedSlots: TradingPlanSlot[] = slots.map((s, idx) => ({
        ...s,
        id: `seed-slot-${Date.now()}-${idx}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      setLocalSlots(planId, hydratedSlots);

      try {
        await supabase
          .from("trading_plan_slots" as any)
          .insert(slots);
      } catch {}
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
      try {
        const { data, error } = await supabase
          .from("trading_plan_checklists" as any)
          .select("*")
          .eq("journal_id", journalId)
          .eq("date", date)
          .maybeSingle();

        if (!error && data) {
          const remoteChk = data as unknown as TradingPlanChecklist;
          setLocalChecklist(journalId, date, remoteChk);
          return remoteChk;
        }
      } catch {}
      return getLocalChecklist(journalId, date);
    },
  });
}

export function useSavePlanChecklist(date: string, journalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (checklist: Partial<TradingPlanChecklist>) => {
      if (!journalId || !date) throw new Error("Datos incompletos para guardar checklist");
      let uid = "local-user";
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) uid = userData.user.id;
      } catch {}

      const chkId = checklist.id || `chk-${journalId}-${date}`;
      const payload: TradingPlanChecklist = {
        id: chkId,
        journal_id: journalId,
        user_id: uid,
        date,
        plan_id: checklist.plan_id || `plan-${journalId}`,
        slot_id: checklist.slot_id || null,
        checked_news: checklist.checked_news ?? false,
        checked_levels: checklist.checked_levels ?? false,
        checked_mind: checklist.checked_mind ?? false,
        checked_risk: checklist.checked_risk ?? false,
        custom_checks: checklist.custom_checks ?? [],
        notes: checklist.notes ?? null,
        status: checklist.status ?? "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setLocalChecklist(journalId, date, payload);

      try {
        const { data, error } = await supabase
          .from("trading_plan_checklists" as any)
          .upsert(payload, { onConflict: "journal_id,user_id,date,slot_id" })
          .select()
          .single();

        if (!error && data) {
          const remote = data as unknown as TradingPlanChecklist;
          setLocalChecklist(journalId, date, remote);
          return remote;
        }
      } catch {}

      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-plan-checklist", journalId, date] });
    },
  });
}
