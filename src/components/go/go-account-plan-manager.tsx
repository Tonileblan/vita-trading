import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Coins,
  Copy,
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
  Square,
  Table,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJournal } from "@/lib/journal-store";
import { accountDrawdown, formatCurrency } from "@/lib/metrics";
import { DrawdownProgress } from "@/components/drawdown-progress";
import {
  getCurrentOperatingDay,
  getTodayDateStr,
  OPERATING_DAYS,
  useDeletePlanSlot,
  useSavePlanSlot,
  useSaveTradingPlan,
  useTradingPlan,
  useTradingPlanSlots,
  type TradingPlan,
  type TradingPlanSlot,
} from "@/lib/planing";
import type { Account, AccountStrategyPeriod, Strategy } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AccountSortField = "name" | "type" | "balance" | "pnl" | "drawdown" | "strategy";
export type SortDirection = "asc" | "desc";

export function GoAccountPlanManager() {
  const {
    accounts,
    strategies,
    trades,
    strategyPeriods,
    activeJournalId,
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
  const savePlanMutation = useSaveTradingPlan(activeJournalId);

  // SELECCIÓN MÚLTIPLE DE CUENTAS
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() =>
    accounts.length > 0 ? [accounts[0]!.id] : [],
  );

  // Asegurar que si hay cuentas y ninguna seleccionada, se seleccione la primera
  useEffect(() => {
    if (accounts.length > 0 && selectedAccountIds.length === 0) {
      setSelectedAccountIds([accounts[0]!.id]);
    }
  }, [accounts, selectedAccountIds.length]);

  // ORDENACIÓN DE LA HOJA DE CÁLCULO
  const [sortField, setSortField] = useState<AccountSortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (field: AccountSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const todayStr = getTodayDateStr();
  const currentDayOfWeek = getCurrentOperatingDay(); // 1..5

  // Mapeos
  const strategyMap = useMemo(() => new Map(strategies.map((s) => [s.id, s])), [strategies]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Cuentas seleccionadas actualmente
  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selectedAccountIds.includes(a.id)),
    [accounts, selectedAccountIds],
  );

  // Toggle cuenta individual
  const toggleSelectAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id],
    );
  };

  // Toggle seleccionar todas
  const isAllSelected = accounts.length > 0 && selectedAccountIds.length === accounts.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Dejar al menos la primera seleccionada
      setSelectedAccountIds(accounts.length > 0 ? [accounts[0]!.id] : []);
    } else {
      setSelectedAccountIds(accounts.map((a) => a.id));
    }
  };

  // Calcular métricas y estado enriquecido para cada cuenta
  const enrichedAccounts = useMemo(() => {
    return accounts.map((acc) => {
      const ddStatus = accountDrawdown(acc, trades);
      const accTrades = trades.filter((t) => t.accountId === acc.id);
      const netPnl = accTrades.reduce((s, t) => s + (t.pnl || 0), 0);
      const pnlPct = acc.initialBalance > 0 ? (netPnl / acc.initialBalance) * 100 : 0;

      const activePeriod = strategyPeriods.find(
        (p) => p.accountId === acc.id && (!p.endDate || p.endDate >= todayStr),
      );
      const stratId = activePeriod?.strategyId || acc.strategyId || "";
      const strat = stratId ? strategyMap.get(stratId) : null;

      const accSlots = slots.filter((s) => !s.account_id || s.account_id === acc.id);
      const daysCount = new Set(accSlots.map((s) => s.day_of_week)).size;

      return {
        ...acc,
        ddStatus,
        netPnl,
        pnlPct,
        activePeriod,
        strategy: strat,
        slotsCount: accSlots.length,
        daysCount,
        firstSlot: accSlots[0] || null,
      };
    });
  }, [accounts, trades, strategyPeriods, slots, todayStr, strategyMap]);

  // Cuentas ordenadas
  const sortedAccounts = useMemo(() => {
    return [...enrichedAccounts].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      } else if (sortField === "type") {
        const typeA = `${a.type}-${a.phase || ""}`;
        const typeB = `${b.type}-${b.phase || ""}`;
        cmp = typeA.localeCompare(typeB);
      } else if (sortField === "balance") {
        cmp = a.currentBalance - b.currentBalance;
      } else if (sortField === "pnl") {
        cmp = a.netPnl - b.netPnl;
      } else if (sortField === "drawdown") {
        const remA = a.ddStatus?.remaining ?? 999999;
        const remB = b.ddStatus?.remaining ?? 999999;
        cmp = remA - remB;
      } else if (sortField === "strategy") {
        const sA = a.strategy?.name || "";
        const sB = b.strategy?.name || "";
        cmp = sA.localeCompare(sB, "es", { sensitivity: "base" });
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [enrichedAccounts, sortField, sortDirection]);

  // =========================================================================
  // PASO 2: ASIGNACIÓN DE ESTRATEGIA (MULTI-CUENTA)
  // =========================================================================
  const [assignStratId, setAssignStratId] = useState<string>(strategies[0]?.id || "");
  const [periodType, setPeriodType] = useState<"ongoing" | "range">("ongoing");
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>("");
  const [periodNote, setPeriodNote] = useState<string>("");
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);

  // Sincronizar formulario con la primera cuenta seleccionada
  useEffect(() => {
    if (selectedAccounts.length === 1 && selectedAccounts[0]) {
      const single = selectedAccounts[0];
      const activeP = strategyPeriods.find(
        (p) => p.accountId === single.id && (!p.endDate || p.endDate >= todayStr),
      );
      const sId = activeP?.strategyId || single.strategyId || strategies[0]?.id || "";
      setAssignStratId(sId);
      setStartDate(activeP?.startDate || todayStr);
      setEndDate(activeP?.endDate || "");
      setPeriodType(activeP?.endDate ? "range" : "ongoing");
      setPeriodNote(activeP?.note || "");
    }
  }, [selectedAccounts, strategyPeriods, strategies, todayStr]);

  const selectedStrategy = strategyMap.get(assignStratId) || strategies[0] || null;

  // Guardar asignación en todas las cuentas seleccionadas
  const handleSaveStrategyToSelectedAccounts = async () => {
    if (selectedAccounts.length === 0) {
      toast.error("Selecciona al menos una cuenta");
      return;
    }
    if (!assignStratId) {
      toast.error("Selecciona una estrategia");
      return;
    }

    setIsSavingPeriod(true);
    try {
      for (const acc of selectedAccounts) {
        await addStrategyPeriod({
          accountId: acc.id,
          strategyId: assignStratId,
          startDate: startDate || todayStr,
          endDate: periodType === "range" && endDate ? endDate : undefined,
          note: periodNote.trim() || undefined,
        });

        await updateAccount(acc.id, {
          strategyId: assignStratId,
        });
      }

      toast.success(
        `Estrategia y periodo asignados a ${selectedAccounts.length} cuenta(s) seleccionada(s)`,
      );
    } catch (err: any) {
      toast.error("Error al asignar estrategia: " + (err.message || ""));
    } finally {
      setIsSavingPeriod(false);
    }
  };

  // =========================================================================
  // PASO 3: PLANING OPERATIVO (L-V) Y RIESGO (MULTI-CUENTA)
  // =========================================================================
  const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [sessionStartTime, setSessionStartTime] = useState("15:30");
  const [sessionEndTime, setSessionEndTime] = useState("17:30");
  const [riskPerTrade, setRiskPerTrade] = useState("250");
  const [maxTradesPerDay, setMaxTradesPerDay] = useState("2");
  const [dailyLossLimit, setDailyLossLimit] = useState(String(plan.daily_risk_budget));
  const [maxLossStreak, setMaxLossStreak] = useState(String(plan.max_loss_streak));
  const [allowedSymbols, setAllowedSymbols] = useState(selectedStrategy?.mainSymbol || "MNQ, NQ");
  const [sessionNotes, setSessionNotes] = useState(selectedStrategy?.setup || "");

  useEffect(() => {
    if (selectedStrategy) {
      if (selectedStrategy.mainSymbol) setAllowedSymbols(selectedStrategy.mainSymbol);
      if (selectedStrategy.setup) setSessionNotes(selectedStrategy.setup);
      if (selectedStrategy.initialCapital && selectedStrategy.riskPct) {
        setRiskPerTrade(String(Math.round(selectedStrategy.initialCapital * selectedStrategy.riskPct)));
      }
    }
  }, [selectedStrategy]);

  const toggleDay = (dayNum: number) => {
    setActiveDays((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort(),
    );
  };

  // Guardar Planing Operativo en todas las cuentas seleccionadas
  const handleSaveOperationalPlanToSelectedAccounts = async () => {
    if (selectedAccounts.length === 0) {
      toast.error("Selecciona al menos una cuenta");
      return;
    }

    try {
      await savePlanMutation.mutateAsync({
        daily_risk_budget: parseFloat(dailyLossLimit) || 400,
        max_loss_streak: parseInt(maxLossStreak, 10) || 2,
        max_daily_trades: parseInt(maxTradesPerDay, 10) || 3,
      });

      for (const acc of selectedAccounts) {
        for (const day of activeDays) {
          await saveSlotMutation.mutateAsync({
            day_of_week: day,
            session_name: selectedStrategy?.name || "Sesión Principal",
            start_time: sessionStartTime,
            end_time: sessionEndTime,
            account_id: acc.id,
            strategy_id: assignStratId || acc.strategyId || null,
            max_trades: parseInt(maxTradesPerDay, 10) || 2,
            risk_amount: parseFloat(riskPerTrade) || 250,
            allowed_symbols: allowedSymbols.trim() || "MNQ, NQ",
            setup_notes: sessionNotes.trim() || null,
            is_active: true,
          });
        }
      }

      toast.success(
        `Planing operativo y riesgo guardados para ${selectedAccounts.length} cuenta(s) en ${activeDays.length} días (L-V)`,
      );
    } catch (err: any) {
      toast.error("Error al guardar operativa: " + (err.message || ""));
    }
  };

  // Métricas agregadas de las cuentas seleccionadas
  const selectedTotalBalance = selectedAccounts.reduce((acc, a) => acc + a.currentBalance, 0);
  const selectedTotalDrawdownRemaining = selectedAccounts.reduce((acc, a) => {
    const dd = accountDrawdown(a, trades);
    return acc + (dd?.remaining || 0);
  }, 0);

  return (
    <div className="space-y-8">
      {/* ========================================================================= */}
      {/* PASO 1: HOJA DE CÁLCULO DE CUENTAS (MAQUEADA & MULTI-SELECCIÓN)            */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-brand/15 text-brand text-xs font-bold font-mono">
                1
              </span>
              <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                Tus Cuentas (Hoja de Cálculo Operativa)
              </h3>
            </div>
            <p className="text-xs text-muted-foreground ml-8">
              Selecciona una o varias cuentas para asignarles estrategias, periodos y reglas de riesgo en bloque.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="h-8 text-xs gap-1.5 font-mono"
            >
              {isAllSelected ? <CheckSquare className="size-3.5 text-brand" /> : <Square className="size-3.5" />}
              {isAllSelected ? "Deseleccionar todas" : "Seleccionar todas"}
            </Button>
            <Badge variant="secondary" className="font-mono text-xs">
              {selectedAccountIds.length} / {accounts.length} seleccionada(s)
            </Badge>
          </div>
        </div>

        {/* TABLA ESTILO HOJA DE CÁLCULO MAQUEADA */}
        <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground font-semibold">
                  {/* Checkbox All */}
                  <th className="w-10 px-3 py-3 text-center">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Seleccionar todas las cuentas"
                    />
                  </th>

                  {/* Nombre Cuenta + Balance Inicial debajo */}
                  <th className="px-3 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort("name")}
                      className="inline-flex items-center gap-1 hover:text-foreground font-semibold"
                    >
                      <span>Cuenta</span>
                      {sortField === "name" && (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-brand" /> : <ArrowDown className="size-3 text-brand" />
                      )}
                    </button>
                  </th>

                  {/* Fase (Live / Eval) */}
                  <th className="px-3 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort("type")}
                      className="inline-flex items-center gap-1 hover:text-foreground font-semibold"
                    >
                      <span>Fase</span>
                      {sortField === "type" && (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-brand" /> : <ArrowDown className="size-3 text-brand" />
                      )}
                    </button>
                  </th>

                  {/* Balance Actual */}
                  <th className="px-3 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort("balance")}
                      className="inline-flex items-center gap-1 hover:text-foreground font-semibold"
                    >
                      <span>Balance</span>
                      {sortField === "balance" && (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-brand" /> : <ArrowDown className="size-3 text-brand" />
                      )}
                    </button>
                  </th>

                  {/* Drawdown */}
                  <th className="px-3 py-3 whitespace-nowrap w-36 min-w-[120px]">
                    <button
                      type="button"
                      onClick={() => handleSort("drawdown")}
                      className="inline-flex items-center gap-1 hover:text-foreground font-semibold"
                    >
                      <span>Drawdown</span>
                      {sortField === "drawdown" && (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-brand" /> : <ArrowDown className="size-3 text-brand" />
                      )}
                    </button>
                  </th>

                  {/* Estrategia */}
                  <th className="px-3 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort("strategy")}
                      className="inline-flex items-center gap-1 hover:text-foreground font-semibold"
                    >
                      <span>Estrategia</span>
                      {sortField === "strategy" && (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-brand" /> : <ArrowDown className="size-3 text-brand" />
                      )}
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border/60 font-mono">
                {sortedAccounts.map((acc) => {
                  const isSelected = selectedAccountIds.includes(acc.id);
                  const isEval = acc.type === "funded" && acc.phase === "eval";
                  const firmLabel = acc.firm || (acc.type === "funded" ? "Prop Firm" : "Personal");

                  return (
                    <tr
                      key={acc.id}
                      onClick={() => toggleSelectAccount(acc.id)}
                      className={cn(
                        "cursor-pointer transition-colors select-none",
                        isSelected
                          ? "bg-brand/[0.06] hover:bg-brand/[0.09]"
                          : "hover:bg-muted/40",
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectAccount(acc.id)}
                          aria-label={`Seleccionar cuenta ${acc.name}`}
                        />
                      </td>

                      {/* Nombre Cuenta + Prop firm delante de raya + Balance Inicial */}
                      <td className="px-3 py-3 font-sans">
                        <div className="flex items-center gap-2">
                          <Wallet className="size-3.5 text-muted-foreground shrink-0" />
                          <div>
                            <span className="font-bold block text-foreground leading-tight">
                              {acc.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground block font-mono">
                              {firmLabel} — {formatCurrency(acc.initialBalance)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Fase: Live (verde) / Eval (azul) */}
                      <td className="px-3 py-3 font-sans">
                        {isEval ? (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                            Eval
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            Live
                          </span>
                        )}
                      </td>

                      {/* Balance Actual */}
                      <td className="px-3 py-3 font-bold text-foreground">
                        {formatCurrency(acc.currentBalance)}
                      </td>

                      {/* Drawdown (Compacto sin la palabra colchón) */}
                      <td className="px-3 py-3 w-36 min-w-[120px]" onClick={(e) => e.stopPropagation()}>
                        {acc.ddStatus ? (() => {
                          const rem = acc.ddStatus.remaining;
                          const lim = acc.ddStatus.limit || 1;
                          const healthPct = Math.min(100, Math.max(0, (rem / lim) * 100));
                          const isBreached = acc.ddStatus.breached || rem <= 0;
                          const isCritical = !isBreached && rem <= 600;
                          const isWarning = !isBreached && !isCritical && rem <= 1000;

                          return (
                            <div className="space-y-1 max-w-[130px]">
                              <div className="flex items-center justify-between text-xs">
                                <span
                                  className={cn(
                                    "font-bold font-mono text-xs",
                                    isBreached || isCritical
                                      ? "text-rose-600 dark:text-rose-400"
                                      : isWarning
                                        ? "text-amber-500"
                                        : "text-emerald-600 dark:text-emerald-400",
                                  )}
                                >
                                  {formatCurrency(rem)}
                                </span>
                                <span
                                  className={cn(
                                    "text-[10px] font-mono",
                                    isBreached || isCritical
                                      ? "text-rose-600 dark:text-rose-400"
                                      : isWarning
                                        ? "text-amber-500"
                                        : "text-emerald-600 dark:text-emerald-400",
                                  )}
                                >
                                  {healthPct.toFixed(0)}%
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                                <div
                                  className={cn(
                                    "h-full transition-all duration-300 rounded-full",
                                    isBreached || isCritical
                                      ? "bg-rose-500"
                                      : isWarning
                                        ? "bg-amber-500"
                                        : "bg-emerald-500",
                                  )}
                                  style={{ width: `${healthPct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })() : (
                          <span className="text-muted-foreground italic font-sans">—</span>
                        )}
                      </td>

                      {/* Estrategia */}
                      <td className="px-3 py-3 font-sans">
                        {acc.strategy ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="size-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: acc.strategy.color || "var(--brand)" }}
                            />
                            <span className="font-semibold text-foreground truncate max-w-[180px]">
                              {acc.strategy.name}
                            </span>
                            {acc.strategy.mainSymbol && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                ({acc.strategy.mainSymbol})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Sin asignar</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* BARRA INFERIOR DE RESUMEN DE SELECCIÓN */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-border bg-muted/30 p-3 px-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground font-sans">
                {selectedAccounts.length} cuenta(s) seleccionada(s):
              </span>
              <span className="text-muted-foreground truncate max-w-md font-sans">
                {selectedAccounts.map((a) => a.name).join(", ")}
              </span>
            </div>
            <div className="flex items-center gap-4 font-mono text-muted-foreground">
              <span>Capital Total: <strong className="text-foreground">{formatCurrency(selectedTotalBalance)}</strong></span>
              <span>Colchón Total: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedTotalDrawdownRemaining)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {selectedAccounts.length > 0 && (
        <>
          {/* ========================================================================= */}
          {/* PASO 2: ASIGNACIÓN DE ESTRATEGIA & TIEMPO / VIGENCIA                        */}
          {/* ========================================================================= */}
          <div className="space-y-4 rounded-xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand/15 text-brand text-xs font-bold font-mono">
                    2
                  </span>
                  <h3 className="font-display text-base font-bold tracking-tight text-foreground">
                    Asignación de Estrategia & Vigencia ({selectedAccounts.length} Cuentas)
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground ml-8">
                  Aplica la estrategia y su periodo de tiempo a todas las cuentas seleccionadas simultáneamente.
                </p>
              </div>

              {selectedStrategy && (
                <Badge
                  variant="secondary"
                  className="font-mono text-xs gap-1.5 self-start sm:self-auto"
                  style={{
                    borderColor: `${selectedStrategy.color}40`,
                    backgroundColor: `${selectedStrategy.color}15`,
                    color: selectedStrategy.color,
                  }}
                >
                  <Layers className="size-3" /> {selectedStrategy.name}
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

                {selectedStrategy && (
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Símbolo: <strong className="text-foreground font-mono">{selectedStrategy.mainSymbol || "MNQ"}</strong></span>
                      <span>Riesgo Base: <strong className="text-foreground font-mono">{((selectedStrategy.riskPct || 0.01) * 100).toFixed(1)}%</strong></span>
                    </div>
                    {selectedStrategy.chart && (
                      <div className="text-[11px] text-muted-foreground">
                        Timeframe: <strong className="text-foreground">{selectedStrategy.chart}</strong>
                      </div>
                    )}
                    {selectedStrategy.setup && (
                      <p className="text-[11px] text-muted-foreground italic line-clamp-2 pt-1 border-t border-border/40">
                        Setup: {selectedStrategy.setup}
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
                    placeholder="Ej: Sprint mensual de evaluación con micro contratos..."
                    className="h-8 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground block">
                    Se guardará en el historial de periodos de cada cuenta seleccionada.
                  </span>
                </div>

                <Button
                  onClick={handleSaveStrategyToSelectedAccounts}
                  disabled={isSavingPeriod || !assignStratId}
                  className="gap-1.5 text-xs shadow-xs h-9"
                >
                  <Save className="size-3.5" /> Aplicar a {selectedAccounts.length} Cuenta(s)
                </Button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PASO 3: PLANING OPERATIVO (DÍAS L-V) & GESTIÓN DE RIESGO                   */}
          {/* ========================================================================= */}
          <div className="space-y-5 rounded-xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand/15 text-brand text-xs font-bold font-mono">
                    3
                  </span>
                  <h3 className="font-display text-base font-bold tracking-tight text-foreground">
                    Planing Operativo & Gestión de Riesgo ({selectedAccounts.length} Cuentas)
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground ml-8">
                  Configura los días operativos (L-V), horario de sesión y límites de riesgo para todas las cuentas elegidas.
                </p>
              </div>

              <Badge variant="outline" className="font-mono text-xs w-fit">
                {activeDays.length} días operativos activos
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 pt-1">
              {/* DÍAS OPERATIVOS (LUNES A VIERNES) */}
              <div className="space-y-3">
                <Label className="text-xs font-medium">1. Días Operativos (Lunes a Viernes)</Label>
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
                  Pulsa en los días de la semana autorizados para operar.
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

              {/* GESTIÓN DE RIESGO */}
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

              {/* NOTAS Y GUARDADO */}
              <div className="space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">3. Protocolo de Setup & Resumen</Label>
                  <Input
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Ej: Solo operar rupturas con confirmación..."
                    className="h-8 text-xs"
                  />
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-[11px] text-muted-foreground space-y-1">
                    <strong className="text-foreground block font-medium">Configuración a aplicar:</strong>
                    <p>
                      • {activeDays.length} días activos ({sessionStartTime} - {sessionEndTime}).
                    </p>
                    <p>
                      • {formatCurrency(parseFloat(riskPerTrade) || 250)} por operación en {selectedAccounts.length} cuenta(s).
                    </p>
                    <p>
                      • Máx {maxTradesPerDay} trades/día y stop forzado tras {maxLossStreak} pérdidas seguidas.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleSaveOperationalPlanToSelectedAccounts}
                  disabled={saveSlotMutation.isPending || savePlanMutation.isPending || activeDays.length === 0}
                  className="gap-1.5 text-xs shadow-xs h-9 mt-2"
                >
                  <ShieldCheck className="size-3.5" /> Guardar Planing en {selectedAccounts.length} Cuenta(s)
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
