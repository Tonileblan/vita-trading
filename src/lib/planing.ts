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
  created_at?: string;
  updated_at?: string;
}

export const OPERATING_DAYS = [
  { day: 1, label: "Lunes", short: "Lun", desc: "Arranque semanal" },
  { day: 2, label: "Martes", short: "Mar", desc: "Volumen institucional" },
  { day: 3, label: "Miércoles", short: "Mié", desc: "Máxima liquidez" },
  { day: 4, label: "Jueves", short: "Jue", desc: "Continuación y setups A+" },
  { day: 5, label: "Viernes", short: "Vie", desc: "Cierre y protección" },
] as const;

export const DEFAULT_SESSIONS = [
  { name: "Asia (Tokio / Oro)", start: "01:00", end: "06:30", defaultSymbols: "MGC, GC" },
  { name: "NY Apertura", start: "15:30", end: "17:30", defaultSymbols: "MNQ, NQ, ES" },
  { name: "Londres", start: "08:30", end: "11:00", defaultSymbols: "EURUSD, GBPUSD, FDAX" },
  { name: "NY Tarde / Cierre", start: "19:00", end: "21:00", defaultSymbols: "MNQ, NQ, BTC" },
  { name: "Sesión Completa", start: "09:00", end: "18:00", defaultSymbols: "Acciones, Swing" },
] as const;

/**
 * Deduce y devuelve la configuración por defecto de horario, símbolos, días y setup
 * asociada a una estrategia.
 * - Para la estrategia "Oro" / mercados de Oro o Asia: Horario Asia (01:00 - 06:30) y símbolos "MGC, GC".
 * - Si la estrategia contiene un horario específico en su ficha (ej: 01:00 - 06:30, 15:30 - 17:30), lo extrae automáticamente.
 */
export function getStrategyPresetDefaults(strategy: Strategy | null | undefined): {
  startTime: string;
  endTime: string;
  symbols: string;
  sessionName: string;
  notes: string;
  riskAmount?: number;
  activeDays: number[];
} {
  if (!strategy) {
    return {
      startTime: "15:30",
      endTime: "17:30",
      symbols: "MNQ, NQ",
      sessionName: "NY Apertura",
      notes: "",
      activeDays: [1, 2, 3, 4, 5],
    };
  }

  const nameLower = (strategy.name || "").toLowerCase();
  const marketLower = (strategy.market || "").toLowerCase();
  const scheduleLower = (strategy.schedule || "").toLowerCase();
  const daysLower = (strategy.days || "").toLowerCase();

  // 1. Detección de horario
  let startTime = "15:30";
  let endTime = "17:30";
  let sessionName = strategy.name ? strategy.name : "Sesión Principal";

  const isGoldOrAsia =
    nameLower.includes("oro") ||
    nameLower.includes("gold") ||
    marketLower.includes("oro") ||
    marketLower.includes("asia") ||
    scheduleLower.includes("asia") ||
    scheduleLower.includes("tokio") ||
    scheduleLower.includes("tokyo");

  if (isGoldOrAsia) {
    startTime = "01:00";
    endTime = "06:30";
    sessionName = strategy.name ? `Asia · ${strategy.name}` : "Sesión Asia (Oro)";
  } else if (
    marketLower.includes("londres") ||
    marketLower.includes("london") ||
    scheduleLower.includes("londres") ||
    scheduleLower.includes("london") ||
    scheduleLower.includes("europa")
  ) {
    startTime = "08:30";
    endTime = "11:30";
    sessionName = strategy.name ? `Londres · ${strategy.name}` : "Sesión Londres";
  } else if (
    marketLower.includes("ny") ||
    marketLower.includes("nueva york") ||
    marketLower.includes("nasdaq") ||
    scheduleLower.includes("ny") ||
    scheduleLower.includes("apertura")
  ) {
    startTime = "15:30";
    endTime = "17:30";
    sessionName = strategy.name ? `NY · ${strategy.name}` : "NY Apertura";
  }

  // Si schedule tiene un rango de horas explícito en formato HH:MM - HH:MM
  const timeMatch = (strategy.schedule || "").match(/(\d{1,2}:\d{2})\s*(?:-|a|to|–)\s*(\d{1,2}:\d{2})/);
  if (timeMatch && timeMatch[1] && timeMatch[2]) {
    // Si no es un formato ambiguo como NY con texto Asia, priorizamos el match
    if (!isGoldOrAsia || scheduleLower.includes("asia") || scheduleLower.includes("tokio")) {
      startTime = timeMatch[1].padStart(5, "0");
      endTime = timeMatch[2].padStart(5, "0");
    }
  }

  // Si es Oro siempre fijar horario de sesión Asia (01:00 - 06:30)
  if (nameLower.includes("oro") || nameLower.includes("gold") || marketLower.includes("oro")) {
    startTime = "01:00";
    endTime = "06:30";
    sessionName = strategy.name ? `Asia · ${strategy.name}` : "Sesión Asia · Oro";
  }

  // 2. Detección de símbolos
  let symbols = strategy.mainSymbol?.trim() || "";
  if (nameLower.includes("oro") || nameLower.includes("gold") || marketLower.includes("oro")) {
    symbols = strategy.mainSymbol ? (strategy.mainSymbol.includes("GC") ? strategy.mainSymbol : `${strategy.mainSymbol}, GC`) : "MGC, GC";
  } else if (!symbols) {
    if (nameLower.includes("nasdaq") || marketLower.includes("nasdaq")) {
      symbols = "MNQ, NQ";
    } else if (nameLower.includes("sp500") || nameLower.includes("s&p") || marketLower.includes("s&p")) {
      symbols = "MES, ES";
    } else {
      symbols = "MNQ, NQ";
    }
  }

  // 3. Detección de días operativos
  let activeDays = [1, 2, 3, 4, 5];
  if (daysLower.includes("jueves") && !daysLower.includes("viernes")) {
    activeDays = [1, 2, 3, 4];
  } else if (daysLower.includes("mar") && daysLower.includes("jue") && !daysLower.includes("lun")) {
    activeDays = [2, 4];
  }

  // 4. Riesgo monetario (1 contrato = 160$ de riesgo)
  const riskAmount =
    strategy.initialCapital && strategy.riskPct
      ? Math.round(strategy.initialCapital * strategy.riskPct)
      : 160;

  return {
    startTime,
    endTime,
    symbols,
    sessionName,
    notes: strategy.setup || "",
    riskAmount,
    activeDays,
  };
}

/**
 * Determina el horario operativo y símbolos efectivos de un slot.
 * - Si el slot está vinculado a la estrategia "Oro" y conserva el horario genérico inicial "15:30 - 17:30"
 *   o el anterior "01:00 - 05:00", lo adapta retroactivamente a la franja de Asia "01:00 - 06:30".
 * - Si el usuario configuró un horario personalizado (ej: traders de Sudamérica o de otras zonas horarias),
 *   respeta íntegramente su configuración sin sobreescribirla.
 */
export function getEffectiveSlotSchedule(
  slot: TradingPlanSlot | Omit<TradingPlanSlot, "id">,
  strategy?: Strategy | null,
): {
  startTime: string;
  endTime: string;
  allowedSymbols: string;
  sessionName: string;
} {
  const stratDefaults = getStrategyPresetDefaults(strategy);
  const isGold =
    (strategy?.name || "").toLowerCase().includes("oro") ||
    (strategy?.name || "").toLowerCase().includes("gold") ||
    (strategy?.market || "").toLowerCase().includes("oro") ||
    (strategy?.market || "").toLowerCase().includes("asia") ||
    (slot.session_name || "").toLowerCase().includes("oro") ||
    (slot.session_name || "").toLowerCase().includes("gold");

  let startTime = slot.start_time || "15:30";
  let endTime = slot.end_time || "17:30";
  let allowedSymbols = slot.allowed_symbols || "MNQ, NQ";
  let sessionName = strategy?.name || slot.session_name || "Sesión Principal";

  // Si la estrategia es Oro y el slot conserva los horarios por defecto del sistema
  // (15:30 - 17:30 o 01:00 - 05:00), actualizarlo retroactivamente a 01:00 - 06:30
  if (isGold) {
    if (
      (startTime === "15:30" && endTime === "17:30") ||
      (startTime === "01:00" && endTime === "05:00")
    ) {
      startTime = "01:00";
      endTime = "06:30";
    }
    if (!allowedSymbols || allowedSymbols === "MNQ, NQ") {
      allowedSymbols = stratDefaults.symbols || "MGC, GC";
    }
  }

  return {
    startTime,
    endTime,
    allowedSymbols,
    sessionName,
  };
}

export const DEFAULT_PLAN_SETTINGS: Omit<TradingPlan, "id" | "journal_id" | "user_id"> = {
  name: "Plan Operativo GO Principal",
  is_active: true,
  weekly_risk_budget: 800, // 5 días x 160$ (1 contrato)
  daily_risk_budget: 160,  // 1 contrato = 160$
  max_daily_trades: 1,
  max_loss_streak: 2,
  profit_lock_target: 320, // 2R (2 x 160$)
  notes: "Operar únicamente en los slots configurados respetando el límite de riesgo de 160$ por contrato/operación.",
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
  return isTradeTimeInSlot(currentMinutes, startTime, endTime, 0);
}

/** Comprueba si una hora (en minutos del día 0..1439) está dentro de una franja HH:MM con margen de cortesía */
export function isTradeTimeInSlot(
  tradeTimeMinutes: number,
  startTime: string,
  endTime: string,
  marginMinutes = 15,
): boolean {
  const [startH, startM] = (startTime || "").split(":").map(Number);
  const [endH, endM] = (endTime || "").split(":").map(Number);

  if (startH === undefined || startM === undefined || endH === undefined || endM === undefined || isNaN(startH) || isNaN(endH)) {
    return true;
  }

  const rawStart = startH * 60 + startM;
  const rawEnd = endH * 60 + endM;

  if (rawStart <= rawEnd) {
    const startMin = Math.max(0, rawStart - marginMinutes);
    const endMin = Math.min(1439, rawEnd + marginMinutes);
    return tradeTimeMinutes >= startMin && tradeTimeMinutes <= endMin;
  }

  // Franja que cruza la medianoche (ej: 23:00 a 06:30 o 01:00 a 06:30)
  const startMin = (rawStart - marginMinutes + 1440) % 1440;
  const endMin = (rawEnd + marginMinutes) % 1440;
  return tradeTimeMinutes >= startMin || tradeTimeMinutes <= endMin;
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
 * Solo evalúa operaciones de las cuentas implicadas en el plan y a partir de la fecha de creación del plan.
 */
export function computePlanCompliance(
  trades: Trade[],
  slots: TradingPlanSlot[],
  plan: TradingPlan,
  accounts: Account[],
  strategies: Strategy[],
  options?: { dateFilter?: "since_plan" | "last_7d" | "last_30d" | "all" },
) {
  // 1. Extraer las cuentas implicadas en este plan (a partir de los slots)
  const planAccountIds = new Set(
    slots
      .map((s) => s.account_id)
      .filter((id): id is string => Boolean(id)),
  );

  // Si no hay slots configurados para este plan, no hay nada que auditar
  if (slots.length === 0) {
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

  const dateFilter = options?.dateFilter || "since_plan";

  // 2. Determinar fecha de corte para evaluar cumplimiento
  let minTimestamp = 0;
  if (dateFilter === "since_plan") {
    const createdDateStr = plan.created_at || (plan as any).updated_at;
    if (createdDateStr) {
      const d = new Date(createdDateStr);
      if (!isNaN(d.getTime())) {
        minTimestamp = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).getTime();
      }
    }
    if (minTimestamp === 0) {
      const now = new Date();
      minTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
    }
  } else if (dateFilter === "last_7d") {
    minTimestamp = Date.now() - 7 * 24 * 60 * 60 * 1000;
  } else if (dateFilter === "last_30d") {
    minTimestamp = Date.now() - 30 * 24 * 60 * 60 * 1000;
  }

  // 3. Filtrar operaciones:
  //    - Deben pertenecer ESTRICTAMENTE a las cuentas asignadas a este plan.
  //    - Deben ser de fecha igual o posterior al inicio/creación del plan.
  const eligibleTrades = trades.filter((t) => {
    // Si el plan tiene cuentas asignadas, descartar absolutamente cualquier otra cuenta
    if (planAccountIds.size > 0 && !planAccountIds.has(t.accountId)) {
      return false;
    }

    const rawDate = t.openedAt || t.closedAt || (t as any).date || "";
    const tradeTime = new Date(rawDate).getTime();
    if (isNaN(tradeTime)) return false;

    // Descartar operaciones anteriores a la fecha del plan
    if (minTimestamp > 0 && tradeTime < minTimestamp) {
      return false;
    }

    return true;
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

  const slotMap = new Map<number, TradingPlanSlot[]>();
  for (const s of slots) {
    if (!s.is_active) continue;
    const list = slotMap.get(s.day_of_week) || [];
    list.push(s);
    slotMap.set(s.day_of_week, list);
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
    const rawDate = trade.openedAt || trade.closedAt || (trade as any).date || "";
    const tradeDate = new Date(rawDate);
    const dayOfWeek = tradeDate.getDay(); // 0=Dom, 1=Lun ... 6=Sab
    const tradeHours = tradeDate.getHours();
    const tradeMinutes = tradeDate.getMinutes();
    const tradeTimeMinutes = tradeHours * 60 + tradeMinutes;

    const reasons: string[] = [];

    // 1. ¿Operado en fin de semana?
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      reasons.push("Operación realizada en fin de semana (fuera de los días operativos L-V)");
    } else {
      const daySlots = slotMap.get(dayOfWeek) || [];
      if (daySlots.length === 0) {
        reasons.push(`No hay sesiones planificadas en este plan para los ${OPERATING_DAYS[dayOfWeek - 1]?.label || "este día"}`);
      } else {
        // Buscar si encaja con algún slot de ese día para esta cuenta
        const matchingSlot =
          daySlots.find((s) => {
            const matchAcc = !s.account_id || s.account_id === trade.accountId;
            const matchStrat = !s.strategy_id || s.strategy_id === trade.strategyId;
            return matchAcc && matchStrat;
          }) ||
          daySlots.find((s) => !s.account_id || s.account_id === trade.accountId) ||
          daySlots[0];

        if (!matchingSlot) {
          reasons.push("La estrategia usada no coincide con la asignada en el plan para este día");
        } else {
          // Obtener estrategia vinculada para resolver horario efectivo (ej. Oro -> 01:00 - 06:30)
          const targetStrat = strategies.find(
            (s) => s.id === (trade.strategyId || matchingSlot.strategy_id),
          );
          const effective = getEffectiveSlotSchedule(matchingSlot, targetStrat);

          if (!isTradeTimeInSlot(tradeTimeMinutes, effective.startTime, effective.endTime, 15)) {
            reasons.push(`Operado fuera de horario (${effective.startTime} - ${effective.endTime})`);
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
        accountName: accountMap.get(trade.accountId) || "Cuenta del plan",
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
    const defaults = getStrategyPresetDefaults(strat);
    const targetDays = defaults.activeDays.length > 0 ? defaults.activeDays : [1, 2, 3, 4, 5];

    targetDays.forEach((day) => {
      generated.push({
        plan_id: planId,
        journal_id: journalId,
        user_id: userId,
        day_of_week: day,
        session_name: strat.name,
        start_time: defaults.startTime,
        end_time: defaults.endTime,
        account_id: defaultAccount,
        strategy_id: strat.id,
        risk_amount:
          defaults.riskAmount ||
          (strat.initialCapital ? Math.round(strat.initialCapital * (strat.riskPct || 0.01)) : 160),
        risk_pct: strat.riskPct || 0.01,
        max_trades: 1,
        allowed_symbols: defaults.symbols,
        setup_notes: defaults.notes || strat.management || "Respetar ratio R:R y stop de pérdida",
        is_active: true,
        order_index: sIdx,
      });
    });
  });

  return generated;
}

// ==========================================
// UTILIDADES DE IDENTIFICADOR UUID
// ==========================================

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

// ==========================================
// ALMACENAMIENTO LOCAL CON CLAVES POR DIARIO
// ==========================================

const LOCAL_PLANS_KEY = (jid: string) => `vita_trading_plans_list_${jid}`;
const LOCAL_PLAN_KEY = (jid: string) => `vita_trading_plan_${jid}`;
const LOCAL_SLOTS_KEY = (planId: string) => `vita_trading_slots_${planId}`;
const LOCAL_CHECKLIST_KEY = (jid: string, date: string) => `vita_trading_chk_${jid}_${date}`;

/** Busca en todas las claves de localStorage cualquier plan guardado previamente (incluido Oro-UVI) */
export function getAllLocalPlansAcrossKeys(journalId?: string): TradingPlan[] {
  if (typeof window === "undefined") return [];
  const foundPlans = new Map<string, TradingPlan>();

  try {
    // 1. Clave específica del diario
    if (journalId) {
      const specific = getLocalPlans(journalId);
      specific.forEach((p) => {
        if (p && p.name) foundPlans.set(p.name + "_" + (p.id || ""), p);
      });
    }

    // 2. Escanear todo localStorage en busca de planes legacy o de otros diarios
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("vita_trading_plans_list_") || k.startsWith("vita_trading_plan_")) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((p: TradingPlan) => {
              if (p && p.name) foundPlans.set(p.name + "_" + (p.id || ""), p);
            });
          } else if (parsed && parsed.name) {
            foundPlans.set(parsed.name + "_" + (parsed.id || ""), parsed as TradingPlan);
          }
        } catch {}
      }
    }
  } catch {}

  return Array.from(foundPlans.values());
}

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
// REACT QUERY HOOKS CON SUPABASE + SYNC
// ==========================================

export function useTradingPlans(journalId?: string) {
  return useQuery({
    queryKey: ["trading-plans", journalId],
    queryFn: async (): Promise<TradingPlan[]> => {
      let remotePlans: TradingPlan[] = [];

      try {
        let query = supabase
          .from("trading_plans" as any)
          .select("*")
          .order("created_at", { ascending: false });

        if (journalId) {
          query = query.or(`journal_id.eq.${journalId},journal_id.is.null`);
        }

        const { data, error } = await query;
        if (!error && data) {
          remotePlans = data as unknown as TradingPlan[];
        }
      } catch (err) {
        console.warn("trading_plans query fallback to local storage:", err);
      }

      // Obtener todos los planes locales (incluido Oro-UVI y cualquier plan creado previamente en desktop)
      const allLocal = getAllLocalPlansAcrossKeys(journalId);

      if (allLocal.length > 0) {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData?.session?.user?.id;

        const mergedMap = new Map<string, TradingPlan>();
        // Añadir primero los remotos
        remotePlans.forEach((p) => mergedMap.set(p.id, p));

        // Revisar planes locales
        for (const lp of allLocal) {
          let planToSync = lp;
          const isRemoteMatch = remotePlans.some(
            (rp) => rp.id === lp.id || (rp.name && rp.name.trim().toLowerCase() === lp.name.trim().toLowerCase()),
          );

          // Si el ID no es UUID válido, generar uno nuevo
          if (!isValidUUID(lp.id)) {
            const oldId = lp.id;
            const newId = generateUUID();
            planToSync = { ...lp, id: newId, user_id: uid || lp.user_id, journal_id: journalId || lp.journal_id };
            
            // Reasignar slots locales si existen
            const oldSlots = getLocalSlots(oldId);
            if (oldSlots.length > 0) {
              const updatedSlots = oldSlots.map((s) => ({
                ...s,
                id: isValidUUID(s.id) ? s.id : generateUUID(),
                plan_id: newId,
              }));
              setLocalSlots(newId, updatedSlots);
            }
          }

          // Si no está en remoto y tenemos usuario, sincronizarlo a Supabase
          if (uid && !isRemoteMatch && isValidUUID(planToSync.id) && journalId) {
            try {
              const { data: inserted, error: insErr } = await supabase
                .from("trading_plans" as any)
                .upsert({
                  ...planToSync,
                  journal_id: journalId,
                  user_id: uid,
                })
                .select()
                .maybeSingle();

              if (!insErr && inserted) {
                const insertedPlan = inserted as unknown as TradingPlan;
                mergedMap.set(insertedPlan.id, insertedPlan);

                // Sincronizar sus slots a Supabase
                const slotsToSync = getLocalSlots(planToSync.id);
                if (slotsToSync.length > 0) {
                  for (const s of slotsToSync) {
                    const validSlotId = isValidUUID(s.id) ? s.id : generateUUID();
                    await supabase.from("trading_plan_slots" as any).upsert({
                      ...s,
                      id: validSlotId,
                      plan_id: insertedPlan.id,
                      journal_id: journalId,
                      user_id: uid,
                    });
                  }
                }
              }
            } catch (syncErr) {
              console.warn("Auto-syncing plan to Supabase:", syncErr);
            }
          } else {
            mergedMap.set(planToSync.id, planToSync);
          }
        }

        const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });

        if (journalId) {
          setLocalPlans(journalId, mergedList);
        }
        return mergedList;
      }

      if (remotePlans.length > 0) {
        if (journalId) setLocalPlans(journalId, remotePlans);
        return remotePlans;
      }

      return journalId ? getLocalPlans(journalId) : [];
    },
  });
}

export function useTradingPlan(journalId?: string, planId?: string) {
  return useQuery({
    queryKey: ["trading-plan", journalId, planId],
    queryFn: async (): Promise<TradingPlan | null> => {
      try {
        let query = supabase
          .from("trading_plans" as any)
          .select("*");

        if (planId && planId !== "default-plan" && isValidUUID(planId)) {
          query = query.eq("id", planId);
        } else if (journalId) {
          query = query.eq("journal_id", journalId);
        }

        const { data, error } = await query.maybeSingle();

        if (!error && data) {
          const plan = data as unknown as TradingPlan;
          if (journalId) setLocalPlan(journalId, plan);
          return plan;
        }
      } catch (err) {
        console.warn("trading_plans query fallback to local storage:", err);
      }

      const allPlans = journalId ? getLocalPlans(journalId) : getAllLocalPlansAcrossKeys();
      if (planId && planId !== "default-plan") {
        const match = allPlans.find((p) => p.id === planId);
        if (match) return match;
      }
      return allPlans[0] || (journalId ? getLocalPlan(journalId) : null);
    },
  });
}

export function useSaveTradingPlan(journalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Partial<TradingPlan>) => {
      if (!journalId) throw new Error("Journal ID no disponible");
      
      let uid = "";
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        uid = sessionData?.session?.user?.id || "";
        if (!uid) {
          const { data: userData } = await supabase.auth.getUser();
          uid = userData?.user?.id || "";
        }
      } catch {}

      if (!uid) throw new Error("Debes haber iniciado sesión para guardar tu plan de trading");

      const currentPlans = getLocalPlans(journalId);
      const isNew = !plan.id || plan.id === "default-plan" || !isValidUUID(plan.id) || !currentPlans.some((p) => p.id === plan.id);
      const planId = isNew ? generateUUID() : plan.id!;

      const existing = currentPlans.find((p) => p.id === planId);
      const planName = (plan.name && plan.name.trim()) ? plan.name.trim() : (existing?.name || generateRecommendedPlanName());

      const payload: TradingPlan = {
        id: planId,
        journal_id: journalId,
        user_id: uid,
        name: planName,
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

      // Guardar en Supabase
      try {
        const { data, error } = await supabase
          .from("trading_plans" as any)
          .upsert(payload)
          .select()
          .single();

        if (error) {
          console.error("Error al sincronizar trading_plans en Supabase:", error);
        } else if (data) {
          const remote = data as unknown as TradingPlan;
          setLocalPlan(journalId, remote);
        }
      } catch (err: any) {
        console.warn("Supabase trading_plans error:", err?.message || err);
      }

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

      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-plans"] });
      qc.invalidateQueries({ queryKey: ["trading-plan"] });
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

      if (isValidUUID(planId)) {
        try {
          await supabase
            .from("trading_plans" as any)
            .delete()
            .eq("id", planId);
        } catch {}
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-plans"] });
      qc.invalidateQueries({ queryKey: ["trading-plan"] });
    },
  });
}

export function useTradingPlanSlots(planId?: string) {
  return useQuery({
    queryKey: ["trading-plan-slots", planId],
    enabled: !!planId,
    queryFn: async (): Promise<TradingPlanSlot[]> => {
      if (!planId) return [];

      if (isValidUUID(planId)) {
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
          console.warn("trading_plan_slots query error:", err);
        }
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
      
      let uid = "";
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        uid = sessionData?.session?.user?.id || "";
        if (!uid) {
          const { data: userData } = await supabase.auth.getUser();
          uid = userData?.user?.id || "";
        }
      } catch {}

      const slotId = (slot.id && isValidUUID(slot.id)) ? slot.id : generateUUID();
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
        max_trades: slot.max_trades ?? 1,
        allowed_symbols: slot.allowed_symbols ?? "MNQ, NQ",
        setup_notes: slot.setup_notes ?? null,
        is_active: slot.is_active ?? true,
        order_index: slot.order_index ?? 0,
        created_at: slot.created_at || new Date().toISOString(),
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

      // Intentar guardar en Supabase si planId y slotId son UUIDs válidos
      if (isValidUUID(planId) && isValidUUID(slotId) && uid) {
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
          console.warn("Supabase trading_plan_slots error:", err?.message || err);
        }
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

      if (isValidUUID(slotId)) {
        try {
          await supabase
            .from("trading_plan_slots" as any)
            .delete()
            .eq("id", slotId);
        } catch {}
      }
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

      let uid = "";
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        uid = sessionData?.session?.user?.id || "";
      } catch {}

      const hydratedSlots: TradingPlanSlot[] = slots.map((s, idx) => ({
        ...s,
        id: generateUUID(),
        plan_id: planId,
        journal_id: journalId,
        user_id: uid,
        order_index: idx,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      setLocalSlots(planId, hydratedSlots);

      if (isValidUUID(planId) && uid) {
        try {
          await supabase
            .from("trading_plan_slots" as any)
            .upsert(hydratedSlots);
        } catch (err) {
          console.error("Error al guardar seed slots en Supabase:", err);
        }
      }
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
      let uid = "";
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        uid = sessionData?.session?.user?.id || "";
      } catch {}

      const chkId = (checklist.id && isValidUUID(checklist.id)) ? checklist.id : generateUUID();
      const payload: TradingPlanChecklist = {
        id: chkId,
        journal_id: journalId,
        user_id: uid,
        date,
        plan_id: (checklist.plan_id && isValidUUID(checklist.plan_id)) ? checklist.plan_id : generateUUID(),
        slot_id: (checklist.slot_id && isValidUUID(checklist.slot_id)) ? checklist.slot_id : null,
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

      if (uid) {
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
      }

      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-plan-checklist", journalId, date] });
    },
  });
}
