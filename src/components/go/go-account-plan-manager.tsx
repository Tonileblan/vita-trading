import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  History,
  Layers,
  Lock,
  Plus,
  Rocket,
  RotateCcw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useJournal } from "@/lib/journal-store";
import { accountDrawdown, formatCurrency } from "@/lib/metrics";
import { DrawdownProgress } from "@/components/drawdown-progress";
import { tradeDayKey } from "@/lib/emotions";
import {
  getCurrentOperatingDay,
  getTodayDateStr,
  OPERATING_DAYS,
  useDeletePlanSlot,
  usePlanChecklist,
  useSavePlanChecklist,
  useSavePlanSlot,
  useSaveTradingPlan,
  useTradingPlan,
  useTradingPlanSlots,
  type TradingPlan,
  type TradingPlanSlot,
} from "@/lib/planing";
import type { Account, AccountStrategyPeriod, Strategy } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GoAccountPlanManager() {
  const {
    accounts,
    strategies,
    trades,
    strategyPeriods,
    activeJournalId,
    activeJournal,
    addStrategyPeriod,
    removeStrategyPeriod,
    updateAccount,
  } = useJournal();

  // 1. Cargar Planing general
  const { data: planData } = useTradingPlan(activeJournalId);
  const plan: TradingPlan = useMemo(() => {
    if (planData) return planData;
    return {
      id: "default-plan",
      journal_id: activeJournalId || "",
      user_id: "",
      name: "Plan Operativo GO Principal",
      is_active: true,
      weekly_risk_budget: 1500,
      daily_risk_budget: 400,
      max_daily_trades: 3,
      max_loss_streak: 2,
      profit_lock_target: 600,
      notes: "Operar respetando los slots, límites de pérdida diaria y pausas de disciplina.",
    };
  }, [planData, activeJournalId]);

  const { data: slots = [] } = useTradingPlanSlots(plan.id === "default-plan" ? undefined : plan.id);
  const saveSlotMutation = useSavePlanSlot(plan.id, activeJournalId);
  const deleteSlotMutation = useDeletePlanSlot(plan.id);
  const savePlanMutation = useSaveTradingPlan(activeJournalId);

  // Selección de cuenta activa para configurar
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || "");

  useEffect(() => {
    if (accounts.length > 0 && (!selectedAccountId || !accounts.some((a) => a.id === selectedAccountId))) {
      setSelectedAccountId(accounts[0]!.id);
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) || accounts[0] || null,
    [accounts, selectedAccountId],
  );

  // Mapeos rápidos
  const strategyMap = useMemo(() => new Map(strategies.map((s) => [s.id, s])), [strategies]);

  // Periodos de estrategia para la cuenta seleccionada
  const accountPeriods = useMemo(() => {
    if (!selectedAccount) return [];
    return strategyPeriods
      .filter((p) => p.accountId === selectedAccount.id)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [strategyPeriods, selectedAccount]);

  // Periodo activo actual (sin endDate o con endDate >= hoy)
  const todayStr = getTodayDateStr();
  const currentActivePeriod = useMemo(() => {
    if (!accountPeriods.length) return null;
    return accountPeriods.find((p) => !p.endDate || p.endDate >= todayStr) || accountPeriods[0] || null;
  }, [accountPeriods, todayStr]);

  // Estrategia asignada efectiva
  const effectiveStratId = currentActivePeriod?.strategyId || selectedAccount?.strategyId || strategies[0]?.id || "";
  const effectiveStrategy = strategyMap.get(effectiveStratId) || strategies[0] || null;

  // Estado del formulario de Asignación de Estrategia y Periodo (Paso 2)
  const [assignStratId, setAssignStratId] = useState<string>(effectiveStratId);
  const [periodType, setPeriodType] = useState<"ongoing" | "range">("ongoing");
  const [startDate, setStartDate] = useState<string>(currentActivePeriod?.startDate || todayStr);
  const [endDate, setEndDate] = useState<string>(currentActivePeriod?.endDate || "");
  const [periodNote, setPeriodNote] = useState<string>(currentActivePeriod?.note || "");
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);

  // Sincronizar formulario si cambia la cuenta
  useEffect(() => {
    if (selectedAccount) {
      const activeP = strategyPeriods.find((p) => p.accountId === selectedAccount.id && (!p.endDate || p.endDate >= todayStr));
      const sId = activeP?.strategyId || selectedAccount.strategyId || strategies[0]?.id || "";
      setAssignStratId(sId);
      setStartDate(activeP?.startDate || todayStr);
      setEndDate(activeP?.endDate || "");
      setPeriodType(activeP?.endDate ? "range" : "ongoing");
      setPeriodNote(activeP?.note || "");
    }
  }, [selectedAccount?.id, strategyPeriods, strategies, todayStr]);

  // Estado de Operativa y Riesgo para esta Cuenta/Estrategia (Paso 3)
  const accountSlots = useMemo(() => {
    if (!selectedAccount) return [];
    return slots.filter((s) => !s.account_id || s.account_id === selectedAccount.id);
  }, [slots, selectedAccount]);

  // Días activos seleccionados (1..5)
  const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [sessionStartTime, setSessionStartTime] = useState("15:30");
  const [sessionEndTime, setSessionEndTime] = useState("17:30");
  const [riskPerTrade, setRiskPerTrade] = useState("250");
  const [maxTradesPerDay, setMaxTradesPerDay] = useState("2");
  const [dailyLossLimit, setDailyLossLimit] = useState(String(plan.daily_risk_budget));
  const [maxLossStreak, setMaxLossStreak] = useState(String(plan.max_loss_streak));
  const [allowedSymbols, setAllowedSymbols] = useState(effectiveStrategy?.mainSymbol || "MNQ, NQ");
  const [sessionNotes, setSessionNotes] = useState(effectiveStrategy?.setup || "");

  // Cargar slots existentes en el formulario de la cuenta
  useEffect(() => {
    if (accountSlots.length > 0) {
      const first = accountSlots[0]!;
      const days = Array.from(new Set(accountSlots.map((s) => s.day_of_week))).sort();
      setActiveDays(days.length > 0 ? days : [1, 2, 3, 4, 5]);
      setSessionStartTime(first.start_time || "15:30");
      setSessionEndTime(first.end_time || "17:30");
      setRiskPerTrade(first.risk_amount ? String(first.risk_amount) : "250");
      setMaxTradesPerDay(String(first.max_trades || 2));
      setAllowedSymbols(first.allowed_symbols || effectiveStrategy?.mainSymbol || "MNQ, NQ");
      setSessionNotes(first.setup_notes || effectiveStrategy?.setup || "");
    } else if (effectiveStrategy) {
      setAllowedSymbols(effectiveStrategy.mainSymbol || "MNQ, NQ");
      setSessionNotes(effectiveStrategy.setup || effectiveStrategy.management || "");
    }
  }, [selectedAccountId, accountSlots, effectiveStrategy]);

  // Guardar asignación de Estrategia y Periodo
  const handleSaveStrategyPeriod = async () => {
    if (!selectedAccount) return;
    if (!assignStratId) {
      toast.error("Selecciona una estrategia");
      return;
    }

    setIsSavingPeriod(true);
    try {
      // 1. Añadir periodo de estrategia a la cuenta
      await addStrategyPeriod({
        accountId: selectedAccount.id,
        strategyId: assignStratId,
        startDate: startDate || todayStr,
        endDate: periodType === "range" && endDate ? endDate : undefined,
        note: periodNote.trim() || undefined,
      });

      // 2. Actualizar estrategia por defecto en la cuenta
      await updateAccount(selectedAccount.id, {
        strategyId: assignStratId,
      });

      toast.success("Estrategia y periodo asignados con éxito a la cuenta");
    } catch (err: any) {
      toast.error("Error al guardar periodo: " + (err.message || ""));
    } finally {
      setIsSavingPeriod(false);
    }
  };

  // Guardar Planing Operativo y Riesgo para los días seleccionados
  const handleSaveOperationalPlan = async () => {
    if (!selectedAccount) return;

    try {
      // Guardar parámetros globales de riesgo si aplican
      await savePlanMutation.mutateAsync({
        daily_risk_budget: parseFloat(dailyLossLimit) || 400,
        max_loss_streak: parseInt(maxLossStreak, 10) || 2,
        max_daily_trades: parseInt(maxTradesPerDay, 10) || 3,
      });

      // Guardar o actualizar slots para cada día seleccionado (Lunes a Viernes)
      for (const day of activeDays) {
        await saveSlotMutation.mutateAsync({
          day_of_week: day,
          session_name: effectiveStrategy?.name || "Sesión Principal",
          start_time: sessionStartTime,
          end_time: sessionEndTime,
          account_id: selectedAccount.id,
          strategy_id: assignStratId || effectiveStrategy?.id || null,
          max_trades: parseInt(maxTradesPerDay, 10) || 2,
          risk_amount: parseFloat(riskPerTrade) || 250,
          allowed_symbols: allowedSymbols.trim() || "MNQ, NQ",
          setup_notes: sessionNotes.trim() || null,
          is_active: true,
        });
      }

      toast.success(`Planing y gestión de riesgo guardados para ${activeDays.length} día(s) operativos`);
    } catch (err: any) {
      toast.error("Error al guardar planing operativo: " + (err.message || ""));
    }
  };

  const toggleDay = (dayNum: number) => {
    setActiveDays((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort(),
    );
  };

  // Cálculos de la cuenta activa
  const selectedAccountDrawdown = selectedAccount ? accountDrawdown(selectedAccount, trades) : null;
  const currentDayOfWeek = getCurrentOperatingDay(); // 1..5

  return (
    <div className="space-y-8">
      {/* ========================================================================= */}
      {/* 1. PASO 1: LISTA DE CUENTAS & ESTADO DE DRAWDOWN Y BALANCE                */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-brand/15 text-brand text-xs font-bold font-mono">
                1
              </span>
              <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                Tus Cuentas & Estado de Capital
              </h3>
            </div>
            <p className="text-xs text-muted-foreground ml-8">
              Selecciona la cuenta que deseas planificar para ver su balance, colchón de drawdown y fase operativa.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs w-fit">
            {accounts.length} cuenta(s) en este diario
          </Badge>
        </div>

        {/* GRID / LISTA DE CUENTAS */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => {
            const isSelected = acc.id === selectedAccountId;
            const ddStatus = accountDrawdown(acc, trades);
            const stratPeriod = strategyPeriods.find(
              (p) => p.accountId === acc.id && (!p.endDate || p.endDate >= todayStr),
            );
            const strat = stratPeriod
              ? strategyMap.get(stratPeriod.strategyId)
              : acc.strategyId
                ? strategyMap.get(acc.strategyId)
                : null;

            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={cn(
                  "cursor-pointer rounded-xl border p-4 transition-all relative overflow-hidden space-y-3",
                  isSelected
                    ? "border-brand bg-brand/[0.03] shadow-sm ring-2 ring-brand/20"
                    : "border-border/80 bg-card hover:border-border hover:bg-muted/20",
                )}
              >
                {/* Indicador de selección */}
                {isSelected && (
                  <div className="absolute top-0 right-0 rounded-bl-lg bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-foreground font-mono">
                    SELECCIONADA
                  </div>
                )}

                {/* Cabecera de la cuenta */}
                <div className="flex items-start justify-between gap-2 pr-14">
                  <div className="space-y-1">
                    <span className="font-display text-sm font-bold block truncate text-foreground">
                      {acc.name}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={acc.type === "funded" ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0 uppercase"
                      >
                        {acc.type === "funded"
                          ? acc.phase === "live"
                            ? "Live / Fondeada"
                            : "Evaluación"
                          : "Personal"}
                      </Badge>
                      {acc.firm && (
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {acc.firm}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Balance y Capital */}
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-sans">Balance Actual</span>
                    <span className="font-bold text-foreground">{formatCurrency(acc.currentBalance)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-sans">Inicial / Base</span>
                    <span className="text-muted-foreground">{formatCurrency(acc.initialBalance)}</span>
                  </div>
                </div>

                {/* Drawdown y Colchón */}
                {ddStatus && (
                  <div className="pt-1">
                    <DrawdownProgress status={ddStatus} variant="compact" />
                  </div>
                )}

                {/* Estrategia vinculada actualmente */}
                <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                  <span className="text-muted-foreground">Estrategia:</span>
                  {strat ? (
                    <span
                      className="font-medium flex items-center gap-1"
                      style={{ color: strat.color || "inherit" }}
                    >
                      <span
                        className="size-2 rounded-full inline-block"
                        style={{ backgroundColor: strat.color || "var(--brand)" }}
                      />
                      {strat.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">Sin asignar</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedAccount && (
        <>
          {/* ========================================================================= */}
          {/* 2. PASO 2: ASIGNAR ESTRATEGIA & TIEMPO / VIGENCIA DE LA ESTRATEGIA         */}
          {/* ========================================================================= */}
          <div className="space-y-4 rounded-xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand/15 text-brand text-xs font-bold font-mono">
                    2
                  </span>
                  <h3 className="font-display text-base font-bold tracking-tight text-foreground">
                    Asignación de Estrategia & Periodo en <span className="text-brand">{selectedAccount.name}</span>
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground ml-8">
                  Elige qué estrategia operará esta cuenta y durante qué rango de tiempo o vigencia.
                </p>
              </div>

              {effectiveStrategy && (
                <Badge
                  variant="secondary"
                  className="font-mono text-xs gap-1.5 self-start sm:self-auto"
                  style={{
                    borderColor: `${effectiveStrategy.color}40`,
                    backgroundColor: `${effectiveStrategy.color}15`,
                    color: effectiveStrategy.color,
                  }}
                >
                  <Layers className="size-3" /> {effectiveStrategy.name}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 pt-2">
              {/* Selector de Estrategia */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Estrategia a Asignar</Label>
                <Select value={assignStratId} onValueChange={setAssignStratId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecciona estrategia" />
                  </SelectTrigger>
                  <SelectContent>
                    {strategies.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: s.color || "var(--brand)" }}
                          />
                          <span>{s.name}</span>
                          {s.mainSymbol && <span className="font-mono text-muted-foreground">({s.mainSymbol})</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Mini ficha de la estrategia seleccionada */}
                {effectiveStrategy && (
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Símbolo: <strong className="text-foreground font-mono">{effectiveStrategy.mainSymbol || "MNQ"}</strong></span>
                      <span>Riesgo Base: <strong className="text-foreground font-mono">{((effectiveStrategy.riskPct || 0.01) * 100).toFixed(1)}%</strong></span>
                    </div>
                    {effectiveStrategy.chart && (
                      <div className="text-[11px] text-muted-foreground">
                        Timeframe: <strong className="text-foreground">{effectiveStrategy.chart}</strong>
                      </div>
                    )}
                    {effectiveStrategy.setup && (
                      <p className="text-[11px] text-muted-foreground italic line-clamp-2 pt-1 border-t border-border/40">
                        Setup: {effectiveStrategy.setup}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Tiempo / Periodo de Vigencia */}
              <div className="space-y-3">
                <Label className="text-xs font-medium">Tiempo / Vigencia de la Estrategia</Label>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={periodType === "ongoing" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPeriodType("ongoing")}
                    className="h-8 text-xs flex-1"
                  >
                    🟢 En Curso / Indefinida
                  </Button>
                  <Button
                    type="button"
                    variant={periodType === "range" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPeriodType("range")}
                    className="h-8 text-xs flex-1"
                  >
                    📅 Rango de Fechas
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Fecha Inicio</span>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  {periodType === "range" ? (
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground block">Fecha Fin</span>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground block">Estado</span>
                      <div className="h-8 rounded-md border border-border/60 bg-muted/40 px-2.5 flex items-center text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        ● Activa sin fecha fin
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notas del periodo y botón guardar */}
              <div className="space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Notas / Objetivo del Periodo</Label>
                  <Input
                    value={periodNote}
                    onChange={(e) => setPeriodNote(e.target.value)}
                    placeholder="Ej: Fase 1 evaluación con micro contratos..."
                    className="h-8 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground block">
                    Registra el objetivo de mantener esta estrategia durante este tramo.
                  </span>
                </div>

                <Button
                  onClick={handleSaveStrategyPeriod}
                  disabled={isSavingPeriod || !assignStratId}
                  className="gap-1.5 text-xs shadow-xs h-9"
                >
                  <Save className="size-3.5" /> Guardar Asignación de Estrategia
                </Button>
              </div>
            </div>

            {/* Historial de periodos previos */}
            {accountPeriods.length > 0 && (
              <div className="pt-3 border-t border-border/50 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <History className="size-3.5" />
                  <span>Historial de Estrategias en esta Cuenta ({accountPeriods.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {accountPeriods.map((p) => {
                    const st = strategyMap.get(p.strategyId);
                    const isCurrent = !p.endDate || p.endDate >= todayStr;
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-xs flex items-center gap-2",
                          isCurrent
                            ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                            : "border-border/60 bg-muted/20 text-muted-foreground",
                        )}
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: st?.color || "var(--brand)" }}
                        />
                        <span className="font-semibold">{st?.name || "Estrategia"}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {p.startDate} {p.endDate ? `a ${p.endDate}` : "(Activa)"}
                        </span>
                        {p.note && <span className="italic text-[10px]">· "{p.note}"</span>}
                        <button
                          type="button"
                          onClick={() => removeStrategyPeriod(p.id)}
                          className="text-muted-foreground hover:text-destructive text-[11px] ml-1"
                          title="Eliminar este periodo del historial"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 3. PASO 3: PLANING OPERATIVO (DÍAS L-V) & GESTIÓN DE RIESGO               */}
          {/* ========================================================================= */}
          <div className="space-y-5 rounded-xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand/15 text-brand text-xs font-bold font-mono">
                    3
                  </span>
                  <h3 className="font-display text-base font-bold tracking-tight text-foreground">
                    Planing Operativo & Gestión de Riesgo
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground ml-8">
                  Configura los días operativos (L-V), horario de sesión y límites de riesgo para esta cuenta y estrategia.
                </p>
              </div>

              <Badge variant="outline" className="font-mono text-xs w-fit">
                {activeDays.length} días operativos activos
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 pt-1">
              {/* DÍAS OPERATIVOS (LUNES A VIERNES) */}
              <div className="space-y-3">
                <Label className="text-xs font-medium">1. Días Operativos en la Semana (Lunes a Viernes)</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {OPERATING_DAYS.map((d) => {
                    const isSelected = activeDays.includes(d.day);
                    const isToday = d.day === currentDayOfWeek;
                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => toggleDay(d.day)}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-lg border py-2.5 text-xs transition-all relative",
                          isSelected
                            ? "border-brand bg-brand/10 text-foreground font-bold shadow-2xs"
                            : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40",
                        )}
                      >
                        <span>{d.short}</span>
                        {isToday && (
                          <span className="absolute bottom-1 size-1.5 rounded-full bg-emerald-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  Pulsa en los días de la semana en los que está permitido operar esta estrategia.
                </span>

                {/* HORARIO DE SESIÓN */}
                <div className="pt-2 space-y-1.5">
                  <Label className="text-xs font-medium">Horario de Sesión (Mercado)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Hora Inicio</span>
                      <Input
                        type="time"
                        value={sessionStartTime}
                        onChange={(e) => setSessionStartTime(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Hora Fin</span>
                      <Input
                        type="time"
                        value={sessionEndTime}
                        onChange={(e) => setSessionEndTime(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* GESTIÓN DE RIESGO POR OPERACIÓN Y DÍA */}
              <div className="space-y-3">
                <Label className="text-xs font-medium">2. Reglas de Riesgo y Cupo de Trades</Label>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block font-medium">Riesgo / Trade ($)</span>
                    <Input
                      type="number"
                      value={riskPerTrade}
                      onChange={(e) => setRiskPerTrade(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block font-medium">Máx Trades / Día</span>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={maxTradesPerDay}
                      onChange={(e) => setMaxTradesPerDay(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block font-medium">Pérdida Máx Diaria ($)</span>
                    <Input
                      type="number"
                      value={dailyLossLimit}
                      onChange={(e) => setDailyLossLimit(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block font-medium">Stop tras Pérdidas Seguidas</span>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={maxLossStreak}
                      onChange={(e) => setMaxLossStreak(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground block font-medium">Símbolos Autorizados</span>
                  <Input
                    value={allowedSymbols}
                    onChange={(e) => setAllowedSymbols(e.target.value)}
                    placeholder="MNQ, NQ, ES..."
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* NOTAS Y PROTOCOLO DE DISCIPLINA */}
              <div className="space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">3. Protocolo de Setup & Disciplina</Label>
                  <Input
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Ej: Solo operar rupturas con confirmación, respetar Stop..."
                    className="h-8 text-xs"
                  />
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-[11px] text-muted-foreground space-y-1">
                    <strong className="text-foreground block font-medium">Resumen del Plan Operativo:</strong>
                    <p>
                      • {activeDays.length} días activos ({sessionStartTime} - {sessionEndTime}).
                    </p>
                    <p>
                      • Arriesgando {formatCurrency(parseFloat(riskPerTrade) || 250)} por operación en {selectedAccount.name}.
                    </p>
                    <p>
                      • Máx {maxTradesPerDay} trades/día y stop forzado tras {maxLossStreak} pérdidas seguidas.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleSaveOperationalPlan}
                  disabled={saveSlotMutation.isPending || savePlanMutation.isPending || activeDays.length === 0}
                  className="gap-1.5 text-xs shadow-xs h-9 mt-2"
                >
                  <ShieldCheck className="size-3.5" /> Guardar Planing Operativo
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
