import type { Account, Strategy, Trade } from "./types";
import type { RiskRules } from "./emotion-metrics";
import type { MoodCheckin } from "./mood";
import { todayKey, tradeDayKey } from "./emotions";

export interface AuditorContextData {
  strategies: Strategy[];
  accounts: Account[];
  trades: Trade[];
  rules?: RiskRules;
  todayCheckin?: MoodCheckin | null;
}

export interface AuditorStatusSummary {
  status: "ok" | "warning" | "danger";
  todayTradesCount: number;
  todayPnl: number;
  currentStreak: number;
  drawdownAlerts: {
    accountId: string;
    accountName: string;
    remainingDrawdown: number;
    danger: boolean;
  }[];
  activeAlerts: string[];
}

/**
 * Evalúa el estado del riesgo en tiempo real para determinar el color/estado del indicador.
 */
export function computeAuditorStatus(ctx: AuditorContextData): AuditorStatusSummary {
  const today = todayKey();
  const todayTrades = ctx.trades.filter((t) => tradeDayKey(t) === today);
  const todayPnl = todayTrades.reduce((acc, t) => acc + t.pnl, 0);

  // Calcular racha actual de pérdidas
  let streak = 0;
  const sortedDesc = [...todayTrades].sort(
    (a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime(),
  );
  for (const t of sortedDesc) {
    if (t.pnl < 0) streak++;
    else if (t.pnl > 0) break;
  }

  const activeAlerts: string[] = [];
  let hasDanger = false;
  let hasWarning = false;

  // 1. Reglas del diario
  if (ctx.rules?.enabled) {
    if (ctx.rules.max_loss_streak > 0 && streak >= ctx.rules.max_loss_streak) {
      activeAlerts.push(
        `Racha de ${streak} pérdidas consecutivas (límite: ${ctx.rules.max_loss_streak}). Recomendado parar o reducir 50% de tamaño.`,
      );
      hasDanger = true;
    }
    if (ctx.rules.max_trades_day > 0 && todayTrades.length >= ctx.rules.max_trades_day) {
      activeAlerts.push(
        `Has alcanzado el límite diario de operaciones (${todayTrades.length}/${ctx.rules.max_trades_day}). Riesgo de sobreoperativa.`,
      );
      hasWarning = true;
    }
    if (
      ctx.rules.max_daily_loss != null &&
      ctx.rules.max_daily_loss > 0 &&
      todayPnl <= -ctx.rules.max_daily_loss
    ) {
      activeAlerts.push(
        `Pérdida máxima diaria superada (-$${Math.abs(todayPnl).toFixed(2)} vs máx -$${ctx.rules.max_daily_loss}). Alto riesgo.`,
      );
      hasDanger = true;
    }
  }

  // 2. Drawdowns de cuentas
  const drawdownAlerts = ctx.accounts.map((acc) => {
    if (!acc.drawdownLimit || acc.drawdownLimit <= 0) {
      return {
        accountId: acc.id,
        accountName: acc.name,
        remainingDrawdown: 999999,
        danger: false,
      };
    }
    const currentLoss = Math.max(0, acc.initialBalance - acc.currentBalance);
    const remaining = Math.max(0, acc.drawdownLimit - currentLoss);
    const danger = remaining <= acc.drawdownLimit * 0.25; // Menos del 25% de buffer restante
    const warning = remaining <= acc.drawdownLimit * 0.5;

    if (danger) {
      activeAlerts.push(
        `Cuenta "${acc.name}": A solo $${remaining.toFixed(2)} del límite de drawdown ($${acc.drawdownLimit}).`,
      );
      hasDanger = true;
    } else if (warning) {
      activeAlerts.push(
        `Cuenta "${acc.name}": Ha consumido más del 50% del drawdown permitido (restan $${remaining.toFixed(2)}).`,
      );
      hasWarning = true;
    }

    return {
      accountId: acc.id,
      accountName: acc.name,
      remainingDrawdown: remaining,
      danger,
    };
  });

  // 3. Estrategias: revisar si hubo operaciones no planificadas hoy
  const unassignedTrades = todayTrades.filter((t) => !t.strategyId && !t.accountId);
  if (unassignedTrades.length > 0) {
    activeAlerts.push(
      `${unassignedTrades.length} operación(es) de hoy no tienen estrategia asignada.`,
    );
    hasWarning = true;
  }

  const notFollowedCount = todayTrades.filter((t) => t.followedPlan === "no").length;
  if (notFollowedCount > 0) {
    activeAlerts.push(
      `Has marcado ${notFollowedCount} operación(es) fuera del plan hoy. Revisa tu disciplina.`,
    );
    hasWarning = true;
  }

  const status = hasDanger ? "danger" : hasWarning ? "warning" : "ok";

  return {
    status,
    todayTradesCount: todayTrades.length,
    todayPnl,
    currentStreak: streak,
    drawdownAlerts,
    activeAlerts,
  };
}

/**
 * Convierte los datos del diario en un resumen estructurado legible para el LLM.
 */
export function formatAuditorContextForPrompt(ctx: AuditorContextData): string {
  const parts: string[] = [];

  // 1. Estrategias y Plantillas
  parts.push("=== ESTRATEGIAS Y PLANTILLAS ACTIVAS ===");
  if (ctx.strategies.length === 0) {
    parts.push("No hay estrategias registradas todavía.");
  } else {
    ctx.strategies.forEach((s, idx) => {
      parts.push(
        `Estrategia ${idx + 1}: ${s.name} (ID: ${s.id})
- Símbolo principal: ${s.mainSymbol || "No especificado"}
- Capital inicial: $${s.initialCapital} | Riesgo por trade: ${(s.riskPct * 100).toFixed(2)}% ($${(s.initialCapital * s.riskPct).toFixed(2)})
- Mercado / Instrumento: ${s.market || "General"}
- Gráfico / Timeframe: ${s.chart || "No especificado"}
- Días operativos: ${s.days || "Todos"}
- Horario de operativa: ${s.schedule || "Sin restricción horaria"}
- Configuración / Setup: ${s.setup || "No especificado"}
- Ejecución / Entrada: ${s.execution || "No especificado"}
- Gestión de posición: ${s.management || "No especificado"}
- Contratos / Apalancamiento: ${s.contracts || "No especificado"}`,
      );
    });
  }

  // 2. Cuentas
  parts.push("\n=== ESTADO DE LAS CUENTAS ===");
  if (ctx.accounts.length === 0) {
    parts.push("No hay cuentas registradas.");
  } else {
    ctx.accounts.forEach((a) => {
      const pnl = a.currentBalance - a.initialBalance;
      const targetInfo = a.profitTarget ? ` | Objetivo: $${a.profitTarget}` : "";
      const ddInfo = a.drawdownLimit
        ? ` | Límite Drawdown: $${a.drawdownLimit} (${a.drawdownType || "estático"})`
        : "";
      parts.push(
        `- Cuenta: "${a.name}" (ID: ${a.id}, ${a.type === "funded" ? `Fondeo - ${a.phase || "eval"}` : "Personal"}) | Balance actual: $${a.currentBalance.toFixed(2)} (Inicio: $${a.initialBalance.toFixed(2)}, PnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)})${targetInfo}${ddInfo}`,
      );
    });
  }

  // 3. Reglas de Disciplina
  if (ctx.rules?.enabled) {
    parts.push("\n=== REGLAS DE DISCIPLINA ACTIVAS ===");
    parts.push(`- Racha máxima de pérdidas permitida: ${ctx.rules.max_loss_streak || "Sin límite"}`);
    parts.push(`- Operaciones máximas por día: ${ctx.rules.max_trades_day || "Sin límite"}`);
    parts.push(
      `- Pérdida máxima diaria: ${ctx.rules.max_daily_loss ? `$${ctx.rules.max_daily_loss}` : "Sin límite"}`,
    );
  }

  // 4. Estado Emocional de Hoy
  if (ctx.todayCheckin) {
    parts.push("\n=== CHECK-IN EMOCIONAL DE HOY ===");
    parts.push(
      `- Estado de ánimo: ${ctx.todayCheckin.mood}/5 | Energía: ${ctx.todayCheckin.energy}/5 | Concentración: ${ctx.todayCheckin.focus}/5 | Estrés: ${ctx.todayCheckin.stress}/5`,
    );
    if (ctx.todayCheckin.intention) {
      parts.push(`- Intención para la sesión: "${ctx.todayCheckin.intention}"`);
    }
  }

  // 5. Operaciones de Hoy y Recientes
  const today = todayKey();
  const todayTrades = ctx.trades.filter((t) => tradeDayKey(t) === today);
  const recentTrades = ctx.trades
    .slice()
    .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
    .slice(0, 15);

  parts.push(`\n=== OPERACIONES DE HOY (${todayTrades.length}) ===`);
  if (todayTrades.length === 0) {
    parts.push("No se han registrado operaciones hoy todavía.");
  } else {
    todayTrades.forEach((t, i) => {
      const plan = t.followedPlan ? ` | Siguió plan: ${t.followedPlan}` : "";
      const mistakes = t.mistakes?.length ? ` | Errores: ${t.mistakes.join(", ")}` : "";
      parts.push(
        `#${i + 1} [${t.symbol}] ${t.direction.toUpperCase()} | PnL: ${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)} | Tamaño: ${t.size} | Cierre: ${t.closedAt}${plan}${mistakes}`,
      );
    });
  }

  parts.push(`\n=== ÚLTIMAS ${recentTrades.length} OPERACIONES GENERALES ===`);
  recentTrades.forEach((t, i) => {
    const plan = t.followedPlan ? ` | Plan: ${t.followedPlan}` : "";
    parts.push(
      `#${i + 1} ${t.closedAt.slice(0, 10)} | ${t.symbol} ${t.direction.toUpperCase()} | PnL: ${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}${plan}`,
    );
  });

  return parts.join("\n");
}
