import { useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  Flame,
  Layers,
  Plus,
  Rocket,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useJournal } from "@/lib/journal-store";
import {
  computeSlotLiveStatus,
  getCurrentOperatingDay,
  getTodayDateStr,
  isCurrentTimeInSlot,
  OPERATING_DAYS,
  usePlanChecklist,
  useSavePlanChecklist,
  type TradingPlan,
  type TradingPlanChecklist,
  type TradingPlanSlot,
} from "@/lib/planing";
import { formatCurrency } from "@/lib/metrics";
import { tradeDayKey } from "@/lib/emotions";
import { cn } from "@/lib/utils";

interface GoCockpitProps {
  plan: TradingPlan;
  slots: TradingPlanSlot[];
  onNavigateToMatrix?: () => void;
}

export function GoCockpit({
  plan,
  slots,
  onNavigateToMatrix,
}: GoCockpitProps) {
  const { accounts, strategies, trades, activeJournalId } = useJournal();
  const todayDate = getTodayDateStr();
  const currentDayOfWeek = getCurrentOperatingDay(); // 1..5 o null si finde

  // Días para ver: por defecto hoy (o Lunes si es fin de semana)
  const [selectedDay, setSelectedDay] = useState<number>(currentDayOfWeek || 1);

  // Cargar checklist de hoy
  const { data: checklistData } = usePlanChecklist(todayDate, activeJournalId);
  const saveChecklistMutation = useSavePlanChecklist(todayDate, activeJournalId);

  const [newCheckItem, setNewCheckItem] = useState("");

  const currentDayInfo = OPERATING_DAYS.find((d) => d.day === selectedDay) || OPERATING_DAYS[0]!;
  const isViewingToday = currentDayOfWeek === selectedDay;

  // Filtrar los slots para el día seleccionado
  const daySlots = slots.filter((s) => s.day_of_week === selectedDay && s.is_active);

  // Cuentas implicadas en este plan (a partir de los slots)
  const planAccountIds = useMemo(() => {
    const ids = new Set<string>();
    slots.forEach((s) => {
      if (s.account_id) ids.add(s.account_id);
    });
    return ids;
  }, [slots]);

  // Filtrar trades de hoy pertenecientes a este plan
  const todayTrades = useMemo(() => {
    return trades.filter((t) => {
      if (tradeDayKey(t) !== todayDate) return false;
      if (planAccountIds.size > 0 && !planAccountIds.has(t.accountId)) return false;
      return true;
    });
  }, [trades, todayDate, planAccountIds]);

  // Mapeos rápidos
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const strategyMap = new Map(strategies.map((s) => [s.id, s]));

  // Totales de hoy del plan
  const todayNetPnl = todayTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const todayTradesCount = todayTrades.length;

  // Checklist state con fallback
  const checklist: TradingPlanChecklist = checklistData || {
    id: "local",
    plan_id: plan.id,
    journal_id: activeJournalId || "",
    user_id: "",
    date: todayDate,
    slot_id: null,
    checked_news: false,
    checked_levels: false,
    checked_mind: false,
    checked_risk: false,
    custom_checks: [],
    notes: null,
    status: "active",
  };

  const completedChecksCount =
    (checklist.checked_news ? 1 : 0) +
    (checklist.checked_levels ? 1 : 0) +
    (checklist.checked_mind ? 1 : 0) +
    (checklist.checked_risk ? 1 : 0) +
    checklist.custom_checks.filter((c) => c.done).length;

  const totalChecksCount = 4 + checklist.custom_checks.length;
  const isPreFlightReady = completedChecksCount === totalChecksCount && totalChecksCount > 0;

  const toggleCheck = (key: "checked_news" | "checked_levels" | "checked_mind" | "checked_risk") => {
    const updated = {
      ...checklist,
      plan_id: plan.id,
      [key]: !checklist[key],
    };
    saveChecklistMutation.mutate(updated);
  };

  const toggleCustomCheck = (id: string) => {
    const updatedCustom = checklist.custom_checks.map((c) =>
      c.id === id ? { ...c, done: !c.done } : c,
    );
    saveChecklistMutation.mutate({
      ...checklist,
      plan_id: plan.id,
      custom_checks: updatedCustom,
    });
  };

  const addCustomCheckItem = () => {
    if (!newCheckItem.trim()) return;
    const newItem = {
      id: `check_${Date.now()}`,
      text: newCheckItem.trim(),
      done: false,
    };
    const updatedCustom = [...checklist.custom_checks, newItem];
    saveChecklistMutation.mutate({
      ...checklist,
      plan_id: plan.id,
      custom_checks: updatedCustom,
    });
    setNewCheckItem("");
  };

  const removeCustomCheckItem = (id: string) => {
    const updatedCustom = checklist.custom_checks.filter((c) => c.id !== id);
    saveChecklistMutation.mutate({
      ...checklist,
      plan_id: plan.id,
      custom_checks: updatedCustom,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. BARRA SUPERIOR DE ESTADO EN VIVO Y SELECTOR DE DÍA */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg font-bold shadow-xs",
              isPreFlightReady
                ? "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                : "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
            )}
          >
            {isPreFlightReady ? <Rocket className="size-5" /> : <Clock className="size-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-semibold tracking-tight">
                Cockpit Operativo — {currentDayInfo.label}
              </span>
              {isViewingToday && (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                  ● Hoy en Vivo
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentDayInfo.desc} · Presupuesto diario:{" "}
              <strong className="text-foreground">{formatCurrency(plan.daily_risk_budget)}</strong> · Máx {plan.max_daily_trades} trades
            </p>
          </div>
        </div>

        {/* Selector de días L-V */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1">
          {OPERATING_DAYS.map((d) => {
            const isSelected = d.day === selectedDay;
            const isToday = d.day === currentDayOfWeek;
            const daySlotCount = slots.filter((s) => s.day_of_week === d.day && s.is_active).length;
            return (
              <button
                key={d.day}
                onClick={() => setSelectedDay(d.day)}
                type="button"
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  isSelected
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
                )}
              >
                <span>{d.short}</span>
                {isToday && <span className="size-1.5 rounded-full bg-emerald-500" />}
                {daySlotCount > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
                    {daySlotCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. ALERTAS DE CIRCUIT BREAKER DIARIAS */}
      {todayNetPnl < 0 && Math.abs(todayNetPnl) >= plan.daily_risk_budget && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-destructive">
          <AlertOctagon className="size-5 shrink-0" />
          <div className="text-xs">
            <strong className="block font-semibold">¡Límite de Pérdida Diaria Alcanzado! ({formatCurrency(todayNetPnl)})</strong>
            Has alcanzado el presupuesto máximo de riesgo fijado ({formatCurrency(plan.daily_risk_budget)}). El protocolo GO exige cerrar terminales y no forzar más operaciones hoy.
          </div>
        </div>
      )}

      {plan.profit_lock_target && todayNetPnl >= plan.profit_lock_target && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-emerald-700 dark:text-emerald-300">
          <Sparkles className="size-5 shrink-0" />
          <div className="text-xs">
            <strong className="block font-semibold">¡Objetivo de Ganancia Alcanzado! (+{formatCurrency(todayNetPnl)})</strong>
            Has superado el Target Lock fijado ({formatCurrency(plan.profit_lock_target)}). Protege tus beneficios y considera terminar la jornada con disciplina.
          </div>
        </div>
      )}

      {/* 3. GRID PRINCIPAL: SLOTS DE HOY + CHECKLIST PRE-FLIGHT */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* COLUMNA IZQUIERDA Y CENTRAL: SLOTS PROGRAMADOS */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-brand" />
              <h3 className="font-display text-base font-semibold">
                Sesiones y Estrategias Programadas ({daySlots.length})
              </h3>
            </div>
            {daySlots.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToMatrix}
                className="gap-1.5 text-xs"
              >
                <Plus className="size-3.5" /> Diseñar Slots para {currentDayInfo.label}
              </Button>
            )}
          </div>

          {daySlots.length === 0 ? (
            <Card className="border-dashed py-8 text-center">
              <CardContent className="space-y-3">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Clock className="size-6" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-semibold">No hay sesiones activas para {currentDayInfo.label}</h4>
                  <p className="mx-auto max-w-sm text-xs text-muted-foreground">
                    Este día está marcado como libre o sin horario operativo asignado. Puedes configurar bloques en la matriz semanal.
                  </p>
                </div>
                <Button size="sm" onClick={onNavigateToMatrix} className="gap-1.5 text-xs">
                  <Plus className="size-3.5" /> Abrir Matriz Semanal
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {daySlots.map((slot) => {
                const account = slot.account_id ? accountMap.get(slot.account_id) : null;
                const strategy = slot.strategy_id ? strategyMap.get(slot.strategy_id) : null;
                const isNowInSlot = isCurrentTimeInSlot(slot.start_time, slot.end_time) && isViewingToday;

                const liveStatus = computeSlotLiveStatus(slot, todayTrades, plan);

                return (
                  <Card
                    key={slot.id}
                    className={cn(
                      "relative overflow-hidden transition-all",
                      isNowInSlot
                        ? "border-brand/40 shadow-sm ring-1 ring-brand/20 bg-brand/[0.02]"
                        : "border-border/80",
                    )}
                  >
                    {/* Indicador de color lateral de la estrategia */}
                    <div
                      className="absolute top-0 bottom-0 left-0 w-1.5"
                      style={{ backgroundColor: strategy?.color || "var(--brand)" }}
                    />

                    <CardHeader className="p-4 pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs font-semibold"
                            style={{
                              borderColor: `${strategy?.color || "var(--brand)"}40`,
                              backgroundColor: `${strategy?.color || "var(--brand)"}15`,
                              color: strategy?.color || "inherit",
                            }}
                          >
                            {strategy?.name || slot.session_name}
                          </Badge>
                          {account && (
                            <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                              <Wallet className="size-3 text-muted-foreground" />
                              {account.name}
                            </Badge>
                          )}
                          {isNowInSlot && (
                            <Badge className="bg-emerald-500 text-white animate-pulse text-[10px]">
                              EN VIVO AHORA
                            </Badge>
                          )}
                        </div>

                        {/* Horario */}
                        <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                          <Clock className="size-3.5" />
                          <span>
                            {slot.start_time} - {slot.end_time}
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-2 space-y-3">
                      {/* Subtítulo / Setups y notas */}
                      {slot.setup_notes && (
                        <p className="text-xs text-muted-foreground italic line-clamp-2">
                          "{slot.setup_notes}"
                        </p>
                      )}

                      {/* Métricas en vivo del slot */}
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-lg bg-muted/40 p-2.5 text-xs">
                        <div>
                          <span className="text-[11px] text-muted-foreground block">Trades usados</span>
                          <span className="font-semibold text-foreground font-mono">
                            {liveStatus.tradesCount} / {slot.max_trades}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground block">Riesgo / Trade</span>
                          <span className="font-semibold text-foreground font-mono">
                            {slot.risk_amount ? formatCurrency(slot.risk_amount) : slot.risk_pct ? `${(slot.risk_pct * 100).toFixed(1)}%` : "0.5%"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground block">PnL Hoy</span>
                          <span
                            className={cn(
                              "font-semibold font-mono",
                              liveStatus.netPnl > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : liveStatus.netPnl < 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-muted-foreground",
                            )}
                          >
                            {liveStatus.netPnl !== 0 ? formatCurrency(liveStatus.netPnl) : "$0.00"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground block">Símbolos</span>
                          <span className="font-semibold text-foreground font-mono truncate block">
                            {slot.allowed_symbols || strategy?.mainSymbol || "MNQ"}
                          </span>
                        </div>
                      </div>

                      {/* Acciones y Avisos */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-xs">
                          {liveStatus.isTradeLimitReached ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                              <ShieldAlert className="size-3.5" /> Cupo de trades completado
                            </span>
                          ) : liveStatus.isLossStreakReached ? (
                            <span className="text-destructive font-medium flex items-center gap-1">
                              <AlertOctagon className="size-3.5" /> Racha de pérdidas: Pausa obligatoria
                            </span>
                          ) : isViewingToday ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <ShieldCheck className="size-3.5" /> {liveStatus.remainingTrades} trade(s) disponible(s)
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Sesión de {currentDayInfo.label}</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: CHECKLIST PRE-FLIGHT DEL DÍA */}
        <div className="space-y-4">
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-brand" />
                  <CardTitle className="font-display text-base">Checklist Pre-Flight</CardTitle>
                </div>
                <Badge
                  variant={isPreFlightReady ? "default" : "outline"}
                  className={cn(
                    "text-[10px] font-mono",
                    isPreFlightReady && "bg-emerald-600 text-white",
                  )}
                >
                  {completedChecksCount}/{totalChecksCount} LISTO
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Protocolo obligatorio antes de realizar la primera operación del día.
              </CardDescription>
              <Progress value={(completedChecksCount / Math.max(1, totalChecksCount)) * 100} className="h-1.5 mt-2" />
            </CardHeader>

            <CardContent className="p-4 pt-0 space-y-3">
              {/* Check 1: Noticias */}
              <div
                onClick={() => toggleCheck("checked_news")}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-2.5 text-xs cursor-pointer transition-all",
                  checklist.checked_news
                    ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                    : "border-border/60 hover:bg-accent/50 text-muted-foreground",
                )}
              >
                {checklist.checked_news ? (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <span className={cn("font-medium block", checklist.checked_news && "text-emerald-700 dark:text-emerald-300")}>
                    1. Noticias de Alto Impacto (Red News)
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    Comprobar ForexFactory / Investing (CPI, FOMC, NFP, Discursos Fed).
                  </span>
                </div>
              </div>

              {/* Check 2: Mente & Psicología */}
              <div
                onClick={() => toggleCheck("checked_mind")}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-2.5 text-xs cursor-pointer transition-all",
                  checklist.checked_mind
                    ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                    : "border-border/60 hover:bg-accent/50 text-muted-foreground",
                )}
              >
                {checklist.checked_mind ? (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <span className={cn("font-medium block", checklist.checked_mind && "text-emerald-700 dark:text-emerald-300")}>
                    2. Check-in Emocional en 'Mente'
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    Sin cansancio ni FOMO. Disposición a aceptar pérdidas con calma.
                  </span>
                </div>
              </div>

              {/* Check 3: Niveles Clave */}
              <div
                onClick={() => toggleCheck("checked_levels")}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-2.5 text-xs cursor-pointer transition-all",
                  checklist.checked_levels
                    ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                    : "border-border/60 hover:bg-accent/50 text-muted-foreground",
                )}
              >
                {checklist.checked_levels ? (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <span className={cn("font-medium block", checklist.checked_levels && "text-emerald-700 dark:text-emerald-300")}>
                    3. Contexto y Niveles Marcados
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    High/Low de sesión previa, zonas de liquidez y tendencia clara en HTF.
                  </span>
                </div>
              </div>

              {/* Check 4: Riesgo Calculado */}
              <div
                onClick={() => toggleCheck("checked_risk")}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-2.5 text-xs cursor-pointer transition-all",
                  checklist.checked_risk
                    ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                    : "border-border/60 hover:bg-accent/50 text-muted-foreground",
                )}
              >
                {checklist.checked_risk ? (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <span className={cn("font-medium block", checklist.checked_risk && "text-emerald-700 dark:text-emerald-300")}>
                    4. Tamaño de Lote y Stop Loss
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    Contratos ajustados para que el Stop Loss no exceda el riesgo planificado.
                  </span>
                </div>
              </div>

              {/* Checks Personalizados */}
              {checklist.custom_checks.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 p-2 text-xs hover:bg-accent/40"
                >
                  <div
                    onClick={() => toggleCustomCheck(item.id)}
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    {item.done ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="size-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className={cn("text-xs", item.done && "line-through text-muted-foreground")}>
                      {item.text}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustomCheckItem(item.id)}
                    className="text-muted-foreground hover:text-destructive text-[11px] px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Añadir check rápido */}
              <div className="flex gap-1.5 pt-1">
                <Input
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomCheckItem()}
                  placeholder="Añadir regla pre-sesión..."
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" onClick={addCustomCheckItem} className="h-8 px-2.5 text-xs">
                  <Plus className="size-3.5" />
                </Button>
              </div>

              {/* Resumen de Estado */}
              <div
                className={cn(
                  "rounded-lg p-3 text-xs text-center font-medium",
                  isPreFlightReady
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {isPreFlightReady ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Rocket className="size-4 text-emerald-500" /> ¡Protocolo Pre-Flight Completo! Listo para operar.
                  </span>
                ) : (
                  <span>Completa todos los pasos del checklist para desbloquear tu sesión.</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
