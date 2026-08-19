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

export interface SimultaneousTradeGroup {
  timeKey: string;
  symbol: string;
  direction: string;
  trades: {
    trade: Trade;
    accountName: string;
    strategyName: string;
  }[];
  isMultiAccount: boolean;
  totalPnl: number;
}

export interface AuditorStatusSummary {
  status: "ok" | "warning" | "danger";
  todayTradesCount: number;
  todayUniqueSetupsCount: number;
  todayPnl: number;
  maxAccountStreak: number;
  accountStreaks: { accountId: string; accountName: string; streak: number }[];
  simultaneousGroups: SimultaneousTradeGroup[];
  drawdownAlerts: {
    accountId: string;
    accountName: string;
    remainingDrawdown: number;
    danger: boolean;
  }[];
  activeAlerts: string[];
}

/**
 * Agrupa operaciones de hoy que ocurrieron casi al mismo tiempo (ventana de 3 min)
 * en el mismo símbolo para distinguir trade copying/réplicas multicuenta de sobreoperativa.
 */
export function groupSimultaneousTrades(
  todayTrades: Trade[],
  accounts: Account[],
  strategies: Strategy[],
): SimultaneousTradeGroup[] {
  const accMap = new Map(accounts.map((a) => [a.id, a.name]));
  const stratMap = new Map(strategies.map((s) => [s.id, s.name]));

  // Ordenar por fecha de cierre o apertura
  const sorted = [...todayTrades].sort(
    (a, b) => new Date(a.closedAt || a.openedAt).getTime() - new Date(b.closedAt || b.openedAt).getTime(),
  );

  const groups: SimultaneousTradeGroup[] = [];

  for (const t of sorted) {
    const tTime = new Date(t.closedAt || t.openedAt).getTime();
    const accName = accMap.get(t.accountId) || (t.accountId ? `Cuenta ${t.accountId.slice(0, 5)}` : "Sin cuenta");
    const stratName = stratMap.get(t.strategyId || "") || "Sin estrategia";

    // Buscar si encaja en un grupo existente (mismo símbolo, misma dirección, diferencia < 3 minutos)
    const existing = groups.find((g) => {
      if (g.symbol !== t.symbol || g.direction !== t.direction) return false;
      const gTime = new Date(g.trades[0].trade.closedAt || g.trades[0].trade.openedAt).getTime();
      return Math.abs(tTime - gTime) <= 3 * 60 * 1000; // 3 minutos
    });

    if (existing) {
      existing.trades.push({ trade: t, accountName: accName, strategyName: stratName });
      existing.totalPnl += t.pnl;
      if (existing.trades.some((x) => x.trade.accountId !== t.accountId)) {
        existing.isMultiAccount = true;
      }
    } else {
      groups.push({
        timeKey: (t.closedAt || t.openedAt).slice(11, 16),
        symbol: t.symbol,
        direction: t.direction,
        trades: [{ trade: t, accountName: accName, strategyName: stratName }],
        isMultiAccount: false,
        totalPnl: t.pnl,
      });
    }
  }

  return groups;
}

/**
 * Evalúa el estado del riesgo en tiempo real con contexto de cuentas y detección de trade copying.
 */
export function computeAuditorStatus(ctx: AuditorContextData): AuditorStatusSummary {
  const today = todayKey();
  const todayTrades = ctx.trades.filter((t) => tradeDayKey(t) === today);
  const todayPnl = todayTrades.reduce((acc, t) => acc + t.pnl, 0);

  const simultaneousGroups = groupSimultaneousTrades(todayTrades, ctx.accounts, ctx.strategies);
  const uniqueSetupsCount = simultaneousGroups.length;

  const activeAlerts: string[] = [];
  let hasDanger = false;
  let hasWarning = false;

  // 1. Calcular racha por cuenta individual
  const accountStreaks: { accountId: string; accountName: string; streak: number }[] = [];
  let maxAccountStreak = 0;

  for (const acc of ctx.accounts) {
    const accTrades = todayTrades
      .filter((t) => t.accountId === acc.id)
      .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());

    let streak = 0;
    for (const t of accTrades) {
      if (t.pnl < 0) streak++;
      else if (t.pnl > 0) break;
    }

    accountStreaks.push({ accountId: acc.id, accountName: acc.name, streak });
    if (streak > maxAccountStreak) maxAccountStreak = streak;

    // Regla de racha por cuenta
    if (ctx.rules?.enabled && ctx.rules.max_loss_streak > 0 && streak >= ctx.rules.max_loss_streak) {
      activeAlerts.push(
        `Cuenta "${acc.name}": Racha de ${streak} pérdidas consecutivas (límite: ${ctx.rules.max_loss_streak}). Detener operativa en esta cuenta o reducir tamaño.`,
      );
      hasDanger = true;
    }
  }

  // 2. Detección de operaciones multicuenta vs sobreoperativa
  const multiAccountLossGroups = simultaneousGroups.filter((g) => g.isMultiAccount && g.totalPnl < 0);
  if (multiAccountLossGroups.length > 0) {
    activeAlerts.push(
      `Detectada réplica multicuenta perdedora en ${multiAccountLossGroups[0].symbol}: ${multiAccountLossGroups[0].trades.length} cuentas afectadas simultáneamente (-$${Math.abs(multiAccountLossGroups[0].totalPnl).toFixed(2)}). Riesgo de sobreexposición global.`,
    );
    hasWarning = true;
  }

  // 3. Reglas de límite de operaciones diarias (usando setups únicos para no penalizar réplicas)
  if (ctx.rules?.enabled) {
    if (ctx.rules.max_trades_day > 0 && uniqueSetupsCount >= ctx.rules.max_trades_day) {
      activeAlerts.push(
        `Has realizado ${uniqueSetupsCount} decisiones/setups hoy (${todayTrades.length} órdenes en total, límite ${ctx.rules.max_trades_day}). Riesgo de sobreoperativa.`,
      );
      hasWarning = true;
    }
    if (
      ctx.rules.max_daily_loss != null &&
      ctx.rules.max_daily_loss > 0 &&
      todayPnl <= -ctx.rules.max_daily_loss
    ) {
      activeAlerts.push(
        `Pérdida máxima diaria de la cartera superada (-$${Math.abs(todayPnl).toFixed(2)} vs máx -$${ctx.rules.max_daily_loss}).`,
      );
      hasDanger = true;
    }
  }

  // 4. Drawdowns por cuenta
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
    const danger = remaining <= acc.drawdownLimit * 0.25;
    const warning = remaining <= acc.drawdownLimit * 0.5;

    if (danger) {
      activeAlerts.push(
        `Cuenta "${acc.name}": A solo $${remaining.toFixed(2)} del límite de drawdown ($${acc.drawdownLimit}).`,
      );
      hasDanger = true;
    } else if (warning) {
      activeAlerts.push(
        `Cuenta "${acc.name}": Consumido más del 50% de drawdown (restan $${remaining.toFixed(2)}).`,
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

  const status = hasDanger ? "danger" : hasWarning ? "warning" : "ok";

  return {
    status,
    todayTradesCount: todayTrades.length,
    todayUniqueSetupsCount: uniqueSetupsCount,
    todayPnl,
    maxAccountStreak,
    accountStreaks,
    simultaneousGroups,
    drawdownAlerts,
    activeAlerts,
  };
}

/**
 * Convierte los datos del diario en un resumen enriquecido que explica al LLM
 * las diferencias entre cuentas, réplicas multicuenta y rachas individuales.
 */
export function formatAuditorContextForPrompt(ctx: AuditorContextData): string {
  const parts: string[] = [];
  const accMap = new Map(ctx.accounts.map((a) => [a.id, a.name]));
  const stratMap = new Map(ctx.strategies.map((s) => [s.id, s.name]));

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

  // 2. Cuentas y su estado de Drawdown
  parts.push("\n=== ESTADO DETALLADO POR CUENTA ===");
  if (ctx.accounts.length === 0) {
    parts.push("No hay cuentas registradas.");
  } else {
    ctx.accounts.forEach((a) => {
      const pnl = a.currentBalance - a.initialBalance;
      const targetInfo = a.profitTarget ? ` | Objetivo: $${a.profitTarget}` : "";
      const currentLoss = Math.max(0, a.initialBalance - a.currentBalance);
      const remainingDD = a.drawdownLimit ? Math.max(0, a.drawdownLimit - currentLoss) : null;
      const ddInfo = a.drawdownLimit
        ? ` | Límite Drawdown: $${a.drawdownLimit} (${a.drawdownType || "estático"}, Restan para quebrar: $${remainingDD?.toFixed(2)})`
        : "";
      parts.push(
        `- Cuenta "${a.name}" (ID: ${a.id}, Tipo: ${a.type === "funded" ? `Fondeo (${a.phase || "eval"})` : "Personal"}): Balance: $${a.currentBalance.toFixed(2)} (Inicio: $${a.initialBalance.toFixed(2)}, PnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)})${targetInfo}${ddInfo}`,
      );
    });
  }

  // 3. Reglas de Disciplina
  if (ctx.rules?.enabled) {
    parts.push("\n=== REGLAS DE DISCIPLINA DEL DIARIO ===");
    parts.push(`- Racha máxima permitida por cuenta: ${ctx.rules.max_loss_streak || "Sin límite"}`);
    parts.push(`- Setups/decisiones máximas por día: ${ctx.rules.max_trades_day || "Sin límite"}`);
    parts.push(
      `- Pérdida máxima diaria permitida: ${ctx.rules.max_daily_loss ? `$${ctx.rules.max_daily_loss}` : "Sin límite"}`,
    );
  }

  // 4. Estado Emocional de Hoy
  if (ctx.todayCheckin) {
    parts.push("\n=== CHECK-IN EMOCIONAL DE HOY ===");
    parts.push(
      `- Ánimo: ${ctx.todayCheckin.mood}/5 | Energía: ${ctx.todayCheckin.energy}/5 | Concentración: ${ctx.todayCheckin.focus}/5 | Estrés: ${ctx.todayCheckin.stress}/5`,
    );
    if (ctx.todayCheckin.intention) {
      parts.push(`- Intención declarada: "${ctx.todayCheckin.intention}"`);
    }
  }

  // 5. Análisis de Operaciones de Hoy con Detección de Multicuenta
  const today = todayKey();
  const todayTrades = ctx.trades.filter((t) => tradeDayKey(t) === today);
  const simultaneousGroups = groupSimultaneousTrades(todayTrades, ctx.accounts, ctx.strategies);

  parts.push(`\n=== OPERACIONES DE HOY (Total: ${todayTrades.length} órdenes, ${simultaneousGroups.length} decisiones/setups) ===`);
  if (todayTrades.length === 0) {
    parts.push("No se han registrado operaciones hoy todavía.");
  } else {
    simultaneousGroups.forEach((group, gIdx) => {
      const isMulti = group.isMultiAccount;
      const typeLabel = isMulti
        ? `[RÉPLICA MULTICUENTA - ${group.trades.length} cuentas simultáneas]`
        : `[OPERACIÓN INDIVIDUAL]`;

      parts.push(`\nDecisión/Setup #${gIdx + 1} a las ~${group.timeKey} (${group.symbol} ${group.direction.toUpperCase()}) ${typeLabel}:`);
      group.trades.forEach((item) => {
        const t = item.trade;
        const plan = t.followedPlan ? ` | Plan: ${t.followedPlan}` : "";
        const mistakes = t.mistakes?.length ? ` | Errores: ${t.mistakes.join(", ")}` : "";
        parts.push(
          `  -> Cuenta "${item.accountName}" | Estrategia "${item.strategyName}" | PnL: ${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)} | Tamaño: ${t.size} contratos | Cierre: ${t.closedAt}${plan}${mistakes}`,
        );
      });
      if (isMulti) {
        parts.push(`  * PnL combinado de este setup en toda la cartera: ${group.totalPnl >= 0 ? "+" : ""}$${group.totalPnl.toFixed(2)}`);
      }
    });
  }

  // 6. Historial Reciente de Referencia
  const recentTrades = ctx.trades
    .slice()
    .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
    .slice(0, 15);

  parts.push(`\n=== ÚLTIMAS OPERACIONES HISTÓRICAS DE REFERENCIA ===`);
  recentTrades.forEach((t, i) => {
    const accName = accMap.get(t.accountId) || "Cuenta";
    const plan = t.followedPlan ? ` | Plan: ${t.followedPlan}` : "";
    parts.push(
      `#${i + 1} ${t.closedAt.slice(0, 10)} [${accName}] ${t.symbol} ${t.direction.toUpperCase()} | PnL: ${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}${plan}`,
    );
  });

  return parts.join("\n");
}
