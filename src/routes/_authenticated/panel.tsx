import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  Building2,
  CalendarIcon,
  Check,
  CheckCheck,
  Filter,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Wallet,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { EquityChart } from "@/components/equity-chart";
import { PnlCalendar } from "@/components/pnl-calendar";
import { PerformanceAnalysis } from "@/components/performance-analysis";
import { PhaseChip, TargetProgress } from "@/components/target-progress";
import { DrawdownProgress } from "@/components/drawdown-progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TradesTable } from "@/components/trades-table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSupervisorFilter } from "@/hooks/use-supervisor-filter";
import {
  useJournal,
  toAccount,
  toStrategy,
  toTrade,
  toWithdrawal,
  toPeriod,
} from "@/lib/journal-store";
import {
  accountBalance,
  accountCurveStart,
  accountDrawdown,
  accountTarget,
  accountResult,
  accountsCurveStart,
  buildEquityCurve,
  effectiveStrategyId,
  filterByRange,
  formatCurrency,
  isTradeOfAccount,
} from "@/lib/metrics";
import { tradeDayKey, parseTradeTime } from "@/lib/emotions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/panel")({
  validateSearch: (search: Record<string, unknown>): { account?: string; filter?: string } => ({
    ...(typeof search["account"] === "string" ? { account: search["account"] as string } : {}),
    ...(typeof search["filter"] === "string" ? { filter: search["filter"] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Resumen — Vita-Trading" },
      {
        name: "description",
        content:
          "Panel general de Vita-Trading: métricas de trading, rendimiento de cuentas y evolución temporal.",
      },
      { property: "og:title", content: "Resumen — Vita-Trading" },
      {
        property: "og:description",
        content: "Consolida tus cuentas de fondeo y personales en un único panel de métricas.",
      },
    ],
  }),
  component: Overview,
});

const RANGES = [
  { key: "7d", label: "7 días" },
  { key: "month", label: "Mes actual" },
  { key: "30d", label: "30 días" },
  { key: "180d", label: "180 días" },
  { key: "all", label: "Todo" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"] | "custom";
type DateRange = { from: Date | undefined; to: Date | undefined };

const SCOPES = [
  { key: "all", label: "Consolidado", icon: Layers },
  { key: "funded", label: "Cuentas fondeo", icon: Building2 },
  { key: "real", label: "Capital real", icon: User },
] as const;

type Scope = (typeof SCOPES)[number]["key"];

function Overview() {
  const { isSupervisor, isAdmin, user, canEditOtherUsers } = useAuth();
  const journalStore = useJournal();

  const {
    selectedUserFilter: supervisorUserFilter,
    setSelectedUserFilter: setSupervisorUserFilter,
    availableUsers: svProfiles,
    isSupervisingOther: isSupervisedView,
    isReadOnly,
  } = useSupervisorFilter();

  // Filtro por clic en un día concreto del calendario (YYYY-MM-DD)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [showAllTrades, setShowAllTrades] = useState(false);

  const { data: svData } = useQuery({
    queryKey: ["sv-panel-data", supervisorUserFilter],
    enabled: (isSupervisor || isAdmin) && supervisorUserFilter !== "mine",
    queryFn: async () => {
      const targetUserId = supervisorUserFilter;
      const [accs, trds, strats, wds, pers] = await Promise.all([
        supabase.from("accounts").select("*").eq("user_id", targetUserId),
        supabase
          .from("trades")
          .select("*")
          .eq("user_id", targetUserId)
          .order("closed_at", { ascending: false }),
        supabase.from("strategies").select("*").eq("user_id", targetUserId),
        supabase
          .from("withdrawals")
          .select("*")
          .eq("user_id", targetUserId)
          .order("date", { ascending: false }),
        supabase
          .from("account_strategy_periods")
          .select("*")
          .eq("user_id", targetUserId)
          .order("start_date", { ascending: true }),
      ]);
      return {
        accounts: (accs.data ?? []).map((r) => toAccount(r as Record<string, unknown>)),
        trades: (trds.data ?? []).map((r) => toTrade(r as Record<string, unknown>)),
        strategies: (strats.data ?? []).map((r) => toStrategy(r as Record<string, unknown>)),
        withdrawals: (wds.data ?? [])
          .map((r) => toWithdrawal(r as Record<string, unknown>))
          .filter((w) => w.status === "approved"),
        strategyPeriods: (pers.data ?? []).map((r) => toPeriod(r as Record<string, unknown>)),
      };
    },
  });

  const canEdit = !isReadOnly;
  const accounts = useMemo(
    () => (isSupervisedView ? (svData?.accounts ?? []) : journalStore.accounts),
    [isSupervisedView, svData?.accounts, journalStore.accounts],
  );
  const strategies = useMemo(
    () => (isSupervisedView ? (svData?.strategies ?? []) : journalStore.strategies),
    [isSupervisedView, svData?.strategies, journalStore.strategies],
  );
  const allTrades = useMemo(
    () => (isSupervisedView ? (svData?.trades ?? []) : journalStore.trades),
    [isSupervisedView, svData?.trades, journalStore.trades],
  );
  const visibleTrades = isSupervisedView ? allTrades : journalStore.visibleTrades;
  const withdrawals = useMemo(
    () => (isSupervisedView ? (svData?.withdrawals ?? []) : journalStore.withdrawals),
    [isSupervisedView, svData?.withdrawals, journalStore.withdrawals],
  );
  const strategyPeriods = useMemo(
    () => (isSupervisedView ? (svData?.strategyPeriods ?? []) : journalStore.strategyPeriods),
    [isSupervisedView, svData?.strategyPeriods, journalStore.strategyPeriods],
  );
  const selectedAccountIds = useMemo(
    () => (isSupervisedView ? accounts.map((a) => a.id) : journalStore.selectedAccountIds),
    [isSupervisedView, accounts, journalStore.selectedAccountIds],
  );

  const searchParams = Route.useSearch();
  const [range, setRange] = useState<RangeKey>("all");
  const [customRange, setCustomRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [scope, setScope] = useState<Scope>("all");
  const [filter, setFilter] = useState<string>(() => searchParams.account || searchParams.filter || "all");
  const [selectedStrategyAccountIds, setSelectedStrategyAccountIds] = useState<string[]>([]);
  const [isDeselectedAll, setIsDeselectedAll] = useState(false);

  useEffect(() => {
    if (searchParams.account) {
      setFilter(searchParams.account);
      setRange("all");
      setSelectedCalendarDate(null);
      setSelectedStrategyAccountIds([]);
      setIsDeselectedAll(false);
    } else if (searchParams.filter) {
      setFilter(searchParams.filter);
      setRange("all");
      setSelectedCalendarDate(null);
      setSelectedStrategyAccountIds([]);
      setIsDeselectedAll(false);
    }
  }, [searchParams.account, searchParams.filter]);

  useEffect(() => {
    setSelectedStrategyAccountIds([]);
    setIsDeselectedAll(false);
    setSelectedCalendarDate(null);
  }, [filter]);

  const isStrategy = filter.startsWith("strategy:");
  const accountFilter = isStrategy ? "all" : filter;
  const strategyFilter = isStrategy ? filter.slice("strategy:".length) : "all";

  const selectedAccounts = useMemo(
    () =>
      accounts.filter((a) =>
        accountFilter === "all" ? selectedAccountIds.includes(a.id) : a.id === accountFilter,
      ),
    [accounts, selectedAccountIds, accountFilter],
  );
  const scopedAccounts = useMemo(
    () =>
      accountFilter !== "all"
        ? selectedAccounts
        : selectedAccounts.filter((a) =>
            scope === "all" ? true : scope === "funded" ? a.type === "funded" : a.type !== "funded",
          ),
    [selectedAccounts, scope, accountFilter],
  );
  const scopedIds = useMemo(() => new Set(scopedAccounts.map((a) => a.id)), [scopedAccounts]);

  const strategyAccounts = useMemo(() => {
    if (!isStrategy) return [];
    const ids = new Set<string>();
    for (const a of selectedAccounts) {
      if (a.strategyId === strategyFilter) ids.add(a.id);
    }
    for (const p of strategyPeriods) {
      if (p.strategyId === strategyFilter) ids.add(p.accountId);
    }
    for (const t of visibleTrades) {
      if (
        t.accountId &&
        (t.strategyId === strategyFilter ||
          effectiveStrategyId(t, accounts, strategyPeriods) === strategyFilter)
      ) {
        const found = accounts.find((a) => isTradeOfAccount(t, a));
        if (found) ids.add(found.id);
        else ids.add(t.accountId);
      }
    }
    return accounts.filter((a) => ids.has(a.id));
  }, [isStrategy, strategyFilter, selectedAccounts, strategyPeriods, visibleTrades, accounts]);

  const activeStrategyAccountIds = useMemo(() => {
    if (!isStrategy) return [];
    if (isDeselectedAll) return [];
    if (selectedStrategyAccountIds.length > 0) return selectedStrategyAccountIds;
    return strategyAccounts.map((a) => a.id);
  }, [isStrategy, isDeselectedAll, selectedStrategyAccountIds, strategyAccounts]);

  const handleToggleStrategyAccount = (accId: string) => {
    setIsDeselectedAll(false);
    const current = activeStrategyAccountIds;
    if (current.includes(accId)) {
      const next = current.filter((id) => id !== accId);
      setSelectedStrategyAccountIds(next);
      if (next.length === 0) {
        setIsDeselectedAll(true);
      }
    } else {
      const next = [...current, accId];
      setSelectedStrategyAccountIds(next);
    }
  };

  const handleSelectAllStrategyAccounts = () => {
    setSelectedStrategyAccountIds(strategyAccounts.map((a) => a.id));
    setIsDeselectedAll(false);
  };

  const handleDeselectAllStrategyAccounts = () => {
    setSelectedStrategyAccountIds([]);
    setIsDeselectedAll(true);
  };

  const scopedTrades = useMemo(
    () =>
      visibleTrades.filter((t) => {
        if (strategyFilter !== "all") {
          const matchesStrat =
            effectiveStrategyId(t, accounts, strategyPeriods) === strategyFilter ||
            t.strategyId === strategyFilter;
          if (!matchesStrat) return false;

          if (strategyAccounts.length > 0) {
            if (activeStrategyAccountIds.length === 0) return false;
            if (activeStrategyAccountIds.length < strategyAccounts.length) {
              const activeAccs = strategyAccounts.filter((a) =>
                activeStrategyAccountIds.includes(a.id),
              );
              return activeAccs.some((a) => isTradeOfAccount(t, a));
            }
          }
          return true;
        }

        if (accountFilter !== "all") {
          const acc = accounts.find((a) => a.id === accountFilter);
          return acc ? isTradeOfAccount(t, acc) : t.accountId === accountFilter;
        }

        return (
          scopedIds.size === 0 ||
          accounts.some((a) => scopedIds.has(a.id) && isTradeOfAccount(t, a)) ||
          (!t.accountId && scope === "all")
        );
      }),
    [
      visibleTrades,
      scopedIds,
      accountFilter,
      scope,
      strategyFilter,
      activeStrategyAccountIds,
      strategyAccounts,
      accounts,
      strategyPeriods,
    ],
  );

  const accountStrategies = useMemo(() => {
    if (accountFilter === "all") return strategies;
    const targetAcc = accounts.find((a) => a.id === accountFilter);
    const used = new Set(
      visibleTrades
        .filter((t) => (targetAcc ? isTradeOfAccount(t, targetAcc) : t.accountId === accountFilter))
        .map((t) => effectiveStrategyId(t, accounts, strategyPeriods)),
    );
    const filtered = strategies.filter((s) => used.has(s.id));
    return filtered.length ? filtered : strategies;
  }, [strategies, visibleTrades, accountFilter, accounts, strategyPeriods]);

  const trades = useMemo(() => {
    if (selectedCalendarDate) {
      return scopedTrades.filter((t) => tradeDayKey(t) === selectedCalendarDate);
    }
    if (range === "custom") {
      const from = customRange.from;
      const to = customRange.to;
      if (!from && !to) return scopedTrades;
      return scopedTrades.filter((t) => {
        const ts = parseTradeTime(t.openedAt || t.closedAt);
        if (from && ts < from.getTime()) return false;
        if (to && ts > new Date(to.getTime() + 86400000).getTime()) return false;
        return true;
      });
    }
    return filterByRange(scopedTrades, range);
  }, [scopedTrades, range, customRange, selectedCalendarDate]);

  const selectedStrategy = useMemo(
    () => (isStrategy ? strategies.find((s) => s.id === strategyFilter) : null),
    [isStrategy, strategies, strategyFilter],
  );

  const fusionAccounts = useMemo(() => {
    if (isStrategy) {
      if (activeStrategyAccountIds.length === 0) return [];
      return strategyAccounts.filter((a) => activeStrategyAccountIds.includes(a.id));
    }
    return scopedAccounts;
  }, [isStrategy, activeStrategyAccountIds, strategyAccounts, scopedAccounts]);

  const fusionEquity = useMemo(
    () =>
      fusionAccounts.reduce(
        (sum, account) => sum + accountBalance(account, visibleTrades, withdrawals),
        0,
      ),
    [fusionAccounts, visibleTrades, withdrawals],
  );

  const calendarTrades = scopedTrades;

  const selectedFundedAccount = useMemo(() => {
    if (isStrategy) {
      const activeFunded = strategyAccounts.filter(
        (a) => activeStrategyAccountIds.includes(a.id) && a.type === "funded",
      );
      // No mostrar drawdown si se elige más de 1 cuenta (solo cuando hay exactamente 1)
      if (activeFunded.length === 1) return activeFunded[0];
      return null;
    }
    if (accountFilter !== "all") {
      const acc = accounts.find((a) => a.id === accountFilter);
      return acc?.type === "funded" ? acc : null;
    }
    const fundedAccs = scopedAccounts.filter((a) => a.type === "funded");
    // No mostrar drawdown para selección global/múltiple
    if (fundedAccs.length === 1) {
      return fundedAccs[0];
    }
    return null;
  }, [
    isStrategy,
    activeStrategyAccountIds,
    strategyAccounts,
    accountFilter,
    accounts,
    scopedAccounts,
  ]);

  const fundedTarget = useMemo(() => {
    if (!selectedFundedAccount) return null;
    return accountTarget(selectedFundedAccount, visibleTrades, withdrawals);
  }, [selectedFundedAccount, visibleTrades, withdrawals]);

  const fundedDrawdown = useMemo(() => {
    if (!selectedFundedAccount) return null;
    return accountDrawdown(selectedFundedAccount, visibleTrades, withdrawals);
  }, [selectedFundedAccount, visibleTrades, withdrawals]);

  const curveAccounts = isStrategy
    ? strategyAccounts.filter((a) => activeStrategyAccountIds.includes(a.id))
    : scopedAccounts;

  const curve = useMemo(() => {
    if (isStrategy) {
      if (activeStrategyAccountIds.length === 1) {
        const singleAcc = strategyAccounts.find((a) => a.id === activeStrategyAccountIds[0]);
        if (singleAcc) {
          return buildEquityCurve(
            trades,
            accountCurveStart(singleAcc, scopedTrades, withdrawals),
            singleAcc,
            scopedTrades,
          );
        }
      }
      return buildEquityCurve(trades, 0, null, scopedTrades);
    }
    return buildEquityCurve(
      trades,
      selectedFundedAccount
        ? accountCurveStart(selectedFundedAccount, scopedTrades, withdrawals)
        : accountsCurveStart(curveAccounts, scopedTrades, withdrawals),
      selectedFundedAccount,
      scopedTrades,
    );
  }, [
    isStrategy,
    activeStrategyAccountIds,
    strategyAccounts,
    trades,
    curveAccounts,
    withdrawals,
    selectedFundedAccount,
    scopedTrades,
  ]);

  const getAccountStratPnl = useCallback(
    (acc: Account) => {
      return visibleTrades
        .filter(
          (t) =>
            (effectiveStrategyId(t, accounts, strategyPeriods) === strategyFilter ||
              t.strategyId === strategyFilter) &&
            isTradeOfAccount(t, acc),
        )
        .reduce((s, t) => s + (t.pnl ?? 0), 0);
    },
    [visibleTrades, strategyFilter, accounts, strategyPeriods],
  );

  const getAccountStratCount = useCallback(
    (acc: Account) => {
      return visibleTrades.filter(
        (t) =>
          (effectiveStrategyId(t, accounts, strategyPeriods) === strategyFilter ||
            t.strategyId === strategyFilter) &&
          isTradeOfAccount(t, acc),
      ).length;
    },
    [visibleTrades, strategyFilter, accounts, strategyPeriods],
  );

  const fundedAccounts = selectedAccounts.filter((a) => a.type === "funded");
  const realAccounts = selectedAccounts.filter((a) => a.type !== "funded");
  const fundedEquity = fundedAccounts.reduce(
    (s, a) => s + accountBalance(a, visibleTrades, withdrawals),
    0,
  );
  const realEquity = realAccounts.reduce(
    (s, a) => s + accountBalance(a, visibleTrades, withdrawals),
    0,
  );
  const fundedPnl = fundedAccounts.reduce(
    (s, a) => s + accountResult(a, visibleTrades, withdrawals),
    0,
  );
  const realPnl = realAccounts.reduce(
    (s, a) => s + accountResult(a, visibleTrades, withdrawals),
    0,
  );

  // PnL total histórico de la estrategia
  const strategyTotalPnl = useMemo(
    () => (isStrategy ? scopedTrades.reduce((s, t) => s + t.pnl, 0) : 0),
    [isStrategy, scopedTrades],
  );

  // Profit Factor de la estrategia en el periodo
  const strategyProfitFactor = useMemo(() => {
    const grossProfit = trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
    if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
    return grossProfit / grossLoss;
  }, [trades]);

  // PnL del recuadro
  const fusionPnl =
    selectedCalendarDate || isStrategy || range !== "all"
      ? trades.reduce((s, t) => s + t.pnl, 0)
      : fusionAccounts.reduce((s, a) => s + accountResult(a, visibleTrades, withdrawals), 0);

  const scopeValue = (key: Scope) => {
    if (key === "funded") return fundedEquity;
    if (key === "real") return realEquity;
    return fundedEquity + realEquity;
  };

  const scopePnl = (key: Scope) => {
    if (selectedCalendarDate || isStrategy || range !== "all") {
      const relevantTrades = trades.filter((t) => {
        const acc = accounts.find((a) => a.id === t.accountId);
        if (!acc) return true;
        if (key === "funded") return acc.type === "funded";
        if (key === "real") return acc.type !== "funded";
        return true;
      });
      return relevantTrades.reduce((s, t) => s + t.pnl, 0);
    }
    if (key === "funded") return fundedPnl;
    if (key === "real") return realPnl;
    return fundedPnl + realPnl;
  };

  return (
    <AppShell
      title="Resumen"
      subtitle={
        selectedCalendarDate
          ? `Filtrado por día ${selectedCalendarDate.split("-").reverse().join("/")} · ${trades.length} operación(es) · PnL ${fusionPnl >= 0 ? "+" : "−"}${formatCurrency(Math.abs(fusionPnl), false)}`
          : isStrategy
            ? `Estrategia: ${selectedStrategy?.name ?? "Estrategia"}${selectedStrategy?.mainSymbol ? ` (${selectedStrategy.mainSymbol})` : ""} · ${trades.length} operación(es) en periodo · PnL ${fusionPnl >= 0 ? "+" : "−"}${formatCurrency(Math.abs(fusionPnl), false)}`
            : isSupervisedView
              ? `Supervisando a ${svProfiles.find((p) => p.id === supervisorUserFilter)?.display_name ?? "usuario"} · ${accounts.length} cuenta(s) · Fondeo ${formatCurrency(fundedEquity)} · Real ${formatCurrency(realEquity)}`
              : `${selectedAccounts.length} cuenta(s) activas · Fondeo ${formatCurrency(fundedEquity)} · Real ${formatCurrency(realEquity)}`
      }
    >
      <div className="space-y-6">
        {/* Banner informativo de supervisión */}
        {isSupervisedView && (
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 px-4 py-2.5 text-xs font-medium shadow-xs",
              canEdit
                ? "border-amber-500/50 bg-amber-500/15 text-amber-950 dark:text-amber-100"
                : "border-sky-600/50 bg-sky-500/15 text-sky-950 dark:text-sky-100",
            )}
          >
            <div className="flex items-center gap-2">
              {canEdit ? (
                <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              ) : (
                <ShieldCheck className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
              )}
              <span className="font-semibold">
                {canEdit
                  ? "Modo edición de supervisión activo: Las modificaciones afectarán directamente a los datos de este usuario."
                  : "Modo supervisión (Solo lectura): No se pueden editar ni eliminar datos de otros usuarios."}
              </span>
            </div>
            {!canEdit && isAdmin && (
              <span className="text-[11px] text-muted-foreground">
                (Puedes habilitar la edición desde tu Perfil de Administrador)
              </span>
            )}
          </div>
        )}

        {/* Banner informativo de filtro lateral activo */}
        {!isSupervisedView &&
          journalStore.selectedAccountIds &&
          journalStore.selectedAccountIds.length < accounts.length && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                <span>
                  Filtro lateral activo: viendo datos de {selectedAccounts.length} de{" "}
                  {accounts.length} cuentas.
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-500/40 text-amber-100 hover:bg-amber-500/20"
                onClick={journalStore.selectAll}
              >
                Ver todas las cuentas
              </Button>
            </div>
          )}

        {/* ========================================================================= */}
        {/* BARRA SUPERIOR DE CONTROL Y FILTROS                                       */}
        {/* ========================================================================= */}
        <section className="panel p-3 bg-card shadow-xs">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Izquierda: Selectores de Entidad y Supervisor */}
            <div className="flex flex-wrap items-center gap-2">
              {(isSupervisor || isAdmin) && svProfiles.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border-2 border-brand/70 bg-brand/10 px-2.5 py-1.5 shadow-xs transition-colors hover:border-brand">
                  <User className="size-4 text-brand shrink-0" />
                  <select
                    value={supervisorUserFilter}
                    onChange={(e) => {
                      setSupervisorUserFilter(e.target.value);
                      setFilter("all");
                      setSelectedCalendarDate(null);
                    }}
                    className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer [&>option]:bg-popover [&>option]:text-popover-foreground [&>optgroup]:bg-popover [&>optgroup]:text-muted-foreground"
                    aria-label="Ver resumen de usuario"
                  >
                    <option value="mine">📖 Mi diario personal</option>
                    <optgroup label="Usuarios registrados">
                      {svProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.display_name ?? `Usuario ${p.id.slice(0, 6)}`}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-lg border-2 border-border/90 bg-muted/60 dark:bg-muted/30 px-2.5 py-1.5 shadow-xs transition-colors hover:border-foreground/40">
                <Filter className="size-4 text-brand shrink-0" />
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setSelectedCalendarDate(null);
                  }}
                  className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer [&>option]:bg-popover [&>option]:text-popover-foreground [&>optgroup]:bg-popover [&>optgroup]:text-muted-foreground"
                  aria-label="Cuenta o estrategia"
                >
                  <option value="all">🌐 Todas las cuentas y estrategias</option>
                  {accounts.filter((a) => a.type === "funded").length > 0 && (
                    <optgroup label="🏢 Cuentas de Fondeo">
                      {accounts
                        .filter((a) => a.type === "funded")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                  {accounts.filter((a) => a.type !== "funded").length > 0 && (
                    <optgroup label="👤 Cuentas Personales">
                      {accounts
                        .filter((a) => a.type !== "funded")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                  {accountStrategies.length > 0 && (
                    <optgroup label="⚡ Estrategias">
                      {accountStrategies.map((s) => (
                        <option key={s.id} value={`strategy:${s.id}`}>
                          Estrategia: {s.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            {/* Derecha: Píldoras de Rango Temporal */}
            <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/20 p-1">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => {
                    setRange(r.key);
                    setSelectedCalendarDate(null);
                  }}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                    range === r.key && !selectedCalendarDate
                      ? "bg-foreground text-background shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}
                >
                  {r.label}
                </button>
              ))}

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => {
                      setRange("custom");
                      setSelectedCalendarDate(null);
                    }}
                    className={cn(
                      "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                      range === "custom" && !selectedCalendarDate
                        ? "bg-foreground text-background shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                    )}
                  >
                    <CalendarIcon className="size-3.5" />
                    Fechas
                    {(customRange.from || customRange.to) && (
                      <span className="text-[10px] font-mono">
                        {customRange.from ? format(customRange.from, "dd/MM") : "…"}–
                        {customRange.to ? format(customRange.to, "dd/MM") : "…"}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-3 pointer-events-auto">
                    <Calendar
                      mode="range"
                      numberOfMonths={1}
                      selected={
                        customRange.from && customRange.to
                          ? { from: customRange.from, to: customRange.to }
                          : customRange.from
                            ? { from: customRange.from }
                            : undefined
                      }
                      onSelect={(sel) => {
                        setSelectedCalendarDate(null);
                        if (!sel) {
                          setCustomRange({ from: undefined, to: undefined });
                          return;
                        }
                        setCustomRange({ from: sel.from, to: "to" in sel ? sel.to : undefined });
                      }}
                    />
                    <div className="flex items-center justify-between gap-2 px-1 pt-2 border-t border-border mt-2">
                      <span className="text-xs text-muted-foreground">
                        {customRange.from ? format(customRange.from, "dd/MM/yyyy") : "Inicio"}
                        {" → "}
                        {customRange.to ? format(customRange.to, "dd/MM/yyyy") : "Fin"}
                      </span>
                      <button
                        onClick={() => {
                          setCustomRange({ from: undefined, to: undefined });
                          setSelectedCalendarDate(null);
                        }}
                        className="text-xs font-bold text-brand hover:underline cursor-pointer"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </section>

        {/* Banner interactivo de día filtrado por el calendario */}
        {selectedCalendarDate && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/60 bg-brand/10 p-3.5 text-xs shadow-xs animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-full bg-brand text-primary-foreground font-bold">
                📅
              </span>
              <div>
                <p className="font-bold text-foreground text-sm">
                  Mostrando exclusivamente el día{" "}
                  {selectedCalendarDate.split("-").reverse().join("/")}
                </p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  {trades.length} operación{trades.length === 1 ? "" : "es"} registradas · PnL neto
                  del día:{" "}
                  <strong
                    className={cn("num font-bold", fusionPnl >= 0 ? "text-profit" : "text-loss")}
                  >
                    {fusionPnl >= 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(fusionPnl), false)}
                  </strong>
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedCalendarDate(null)}
              className="inline-flex items-center gap-1.5 rounded-md bg-card px-3 py-1.5 font-bold text-foreground border border-border hover:bg-accent hover:border-foreground/40 transition-all cursor-pointer shadow-xs"
            >
              <X className="size-3.5" />
              Ver periodo completo
            </button>
          </div>
        )}



        {/* ========================================================================= */}
        {/* BLOQUE 1: RESUMEN DE CAPITAL Y ESTADO DE CUENTAS                          */}
        {/* ========================================================================= */}
        {accountFilter === "all" && !isStrategy ? (
          <section className="grid gap-3 sm:grid-cols-3">
            {SCOPES.map((s) => {
              const pnl = scopePnl(s.key);
              const Icon = s.icon;
              const isSelectedScope = scope === s.key;
              const count =
                s.key === "funded"
                  ? fundedAccounts.length
                  : s.key === "real"
                    ? realAccounts.length
                    : selectedAccounts.length;

              return (
                <button
                  key={s.key}
                  onClick={() => setScope(s.key)}
                  className={cn(
                    "panel p-4 text-left transition-all cursor-pointer relative overflow-hidden group",
                    isSelectedScope
                      ? "border-brand bg-brand/10 ring-1 ring-brand shadow-xs"
                      : "hover:border-foreground/30 hover:bg-accent/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <Icon
                        className={cn(
                          "size-4",
                          isSelectedScope ? "text-brand" : "text-muted-foreground",
                        )}
                      />
                      {s.label}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {count} {count === 1 ? "cuenta" : "cuentas"}
                    </span>
                  </div>

                  <p className="num mt-2 text-2xl font-black tracking-tight text-foreground">
                    {formatCurrency(scopeValue(s.key))}
                  </p>

                  <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2 text-xs">
                    <span className="text-muted-foreground text-[11px]">Resultado periodo:</span>
                    <span
                      className={cn(
                        "num font-bold tabular-nums",
                        pnl >= 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      {pnl >= 0 ? "+" : "−"} {formatCurrency(Math.abs(pnl), false)}
                    </span>
                  </div>
                </button>
              );
            })}
          </section>
        ) : (
          <section className="panel p-4 sm:p-5 bg-card shadow-xs rounded-2xl border border-border/80 space-y-4">
            {/* Cabecera de la Estrategia / Cuenta */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3.5">
              <div className="flex items-center gap-3">
                {isStrategy ? (
                  <div
                    className="size-5 rounded-full shadow-sm shrink-0 ring-2 ring-background ring-offset-2 ring-offset-brand/20"
                    style={{
                      backgroundColor:
                        selectedStrategy?.color ?? "var(--color-brand)",
                    }}
                  />
                ) : (
                  <div className="p-2 rounded-xl bg-brand/10 border border-brand/20">
                    <Building2 className="size-4 text-brand shrink-0" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold font-display tracking-wide uppercase leading-none">
                      {isStrategy
                        ? `Estrategia: ${selectedStrategy?.name ?? "Estrategia"}`
                        : (accounts.find((a) => a.id === accountFilter)?.name ?? "Cuenta")}
                    </h2>
                    {isStrategy && selectedStrategy?.mainSymbol && (
                      <span className="rounded-md bg-brand/10 border border-brand/25 px-2 py-0.5 text-[10px] font-bold text-brand uppercase tracking-wider">
                        {selectedStrategy.mainSymbol}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isStrategy
                      ? activeStrategyAccountIds.length === strategyAccounts.length
                        ? `Rendimiento consolidado en las ${strategyAccounts.length} cuentas vinculadas`
                        : activeStrategyAccountIds.length === 1
                          ? `Filtrando exclusivamente por la cuenta ${strategyAccounts.find((a) => a.id === activeStrategyAccountIds[0])?.name}`
                          : activeStrategyAccountIds.length === 0
                            ? "Sin cuentas seleccionadas"
                            : `Filtrando por ${activeStrategyAccountIds.length} de ${strategyAccounts.length} cuentas seleccionadas`
                      : "Supervisión detallada de cuenta"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {fundedTarget && <PhaseChip phase={fundedTarget.phase} />}
                <span className="rounded-full bg-muted/80 border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {isStrategy
                    ? activeStrategyAccountIds.length === 1
                      ? strategyAccounts.find((a) => a.id === activeStrategyAccountIds[0])?.type === "funded"
                        ? "Cuenta de Fondeo"
                        : "Cuenta Personal"
                      : `${activeStrategyAccountIds.length}/${strategyAccounts.length} cuentas activas`
                    : accounts.find((a) => a.id === accountFilter)?.type === "funded"
                      ? "Fondeo"
                      : "Personal"}
                </span>
              </div>
            </div>

            {/* Selector Interactivo de Cuentas: Todas / Deseleccionar arriba + Cuadrícula atractiva sin scroll lateral */}
            {isStrategy && strategyAccounts.length > 0 && (
              <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs space-y-3.5">
                {/* Fila superior: Botones 'Todas' y 'Deseleccionar' */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-brand/10 border border-brand/20">
                      <Wallet className="size-3.5 text-brand" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Cuentas vinculadas a esta estrategia
                      </span>
                      <span className="rounded-full bg-muted border border-border/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {activeStrategyAccountIds.length} de {strategyAccounts.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllStrategyAccounts}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all border cursor-pointer select-none",
                        activeStrategyAccountIds.length === strategyAccounts.length
                          ? "bg-brand text-brand-foreground border-brand shadow-xs shadow-brand/20 font-bold"
                          : "bg-muted/60 hover:bg-muted text-foreground border-border/80 hover:border-border font-medium",
                      )}
                    >
                      <CheckCheck className="size-3.5" />
                      Todas
                    </button>

                    <button
                      type="button"
                      onClick={handleDeselectAllStrategyAccounts}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all border cursor-pointer select-none",
                        activeStrategyAccountIds.length === 0
                          ? "bg-foreground/10 text-foreground border-border font-bold ring-1 ring-border"
                          : "bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground border-border/80 hover:border-border font-medium",
                      )}
                    >
                      <X className="size-3.5" />
                      Deseleccionar
                    </button>
                  </div>
                </div>

                {/* Cuadrícula de cuentas con diseño atractivo y sin solapamientos */}
                <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
                  {strategyAccounts.map((acc) => {
                    const isSelected = activeStrategyAccountIds.includes(acc.id);
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleToggleStrategyAccount(acc.id)}
                        className={cn(
                          "group relative flex items-center justify-between px-4 py-2.5 rounded-xl text-xs transition-all duration-200 border cursor-pointer select-none w-full min-h-[44px]",
                          isSelected
                            ? "bg-brand/15 border-brand text-foreground font-bold shadow-xs ring-2 ring-brand/30"
                            : "bg-muted/30 hover:bg-muted/70 text-foreground/85 hover:text-foreground border-border/80 hover:border-border font-semibold hover:shadow-2xs",
                        )}
                      >
                        <span className="font-semibold tracking-tight whitespace-nowrap text-foreground">
                          {acc.name}
                        </span>
                        <div
                          className={cn(
                            "size-4 rounded-full flex items-center justify-center transition-all shrink-0 ml-2 border",
                            isSelected
                              ? "bg-brand border-brand text-brand-foreground shadow-xs"
                              : "border-border/80 bg-background/80 group-hover:border-foreground/40",
                          )}
                        >
                          {isSelected && <Check className="size-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cuadrícula de Métricas de la Estrategia / Cuenta */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-muted/20 border border-border/60 p-3.5 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Resultado en Periodo
                </p>
                <p
                  className={cn(
                    "num text-2xl font-black tabular-nums",
                    fusionPnl >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {fusionPnl >= 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(fusionPnl), false)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {range === "all"
                    ? "Periodo completo"
                    : `En rango seleccionado (${trades.length} ops)`}
                </p>
              </div>

              <div className="rounded-xl bg-muted/20 border border-border/60 p-3.5 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {isStrategy
                    ? activeStrategyAccountIds.length === 1
                      ? "PnL de la Cuenta"
                      : "PnL Total Histórico"
                    : "Capital Actual"}
                </p>
                <p
                  className={cn(
                    "num text-2xl font-black tracking-tight",
                    isStrategy
                      ? strategyTotalPnl >= 0
                        ? "text-profit"
                        : "text-loss"
                      : "text-foreground",
                  )}
                >
                  {isStrategy
                    ? `${strategyTotalPnl >= 0 ? "+" : "−"}${formatCurrency(Math.abs(strategyTotalPnl), false)}`
                    : formatCurrency(fusionEquity)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isStrategy
                    ? `${scopedTrades.length} ops registradas en total`
                    : `${fusionAccounts.length} cuenta(s)`}
                </p>
              </div>

              <div className="rounded-xl bg-muted/20 border border-border/60 p-3.5 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tasa de Acierto (Win Rate)
                </p>
                <p className="num text-2xl font-black text-foreground">
                  {trades.length > 0
                    ? `${((trades.filter((t) => t.pnl > 0).length / trades.length) * 100).toFixed(0)}%`
                    : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {trades.length > 0
                    ? `${trades.filter((t) => t.pnl > 0).length}W / ${trades.filter((t) => t.pnl < 0).length}L`
                    : "Sin operaciones"}
                </p>
              </div>

              <div className="rounded-xl bg-muted/20 border border-border/60 p-3.5 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Profit Factor
                </p>
                <p className="num text-2xl font-black text-foreground">
                  {strategyProfitFactor === Infinity
                    ? "∞"
                    : strategyProfitFactor > 0
                      ? strategyProfitFactor.toFixed(2)
                      : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Ratio Ganancias / Pérdidas
                </p>
              </div>
            </div>

            {(fundedTarget || fundedDrawdown) && (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 pt-1">
                {fundedTarget && <TargetProgress status={fundedTarget} />}
                {fundedDrawdown && (
                  <DrawdownProgress status={fundedDrawdown} threshold={600} />
                )}
              </div>
            )}
          </section>
        )}

        {/* ========================================================================= */}
        {/* BLOQUE 2: ANÁLISIS DE RENDIMIENTO Y CALIDAD DE TRADING                     */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold font-display uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="size-4 text-brand" /> Calidad y Métricas de Rendimiento
            </h2>
            <span className="text-xs text-muted-foreground">
              {trades.length} operación{trades.length === 1 ? "" : "es"} evaluadas
            </span>
          </div>
          <PerformanceAnalysis trades={trades} />
        </section>

        {/* ========================================================================= */}
        {/* BLOQUE 3: EVOLUCIÓN TEMPORAL - CURVA DE CAPITAL Y MATRIZ PNL               */}
        {/* ========================================================================= */}
        <div className="space-y-5">
          {/* 3.1 Curva de Capital */}
          <section className="panel p-4 bg-card shadow-xs">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
              <div>
                <h2 className="text-xl font-display uppercase tracking-wide leading-none">
                  Curva de {isStrategy ? "rentabilidad" : "capital"}{" "}
                  <span className="text-sm font-medium text-muted-foreground font-sans lowercase">
                    ·{" "}
                    {selectedCalendarDate
                      ? `día ${selectedCalendarDate.split("-").reverse().join("/")}`
                      : isStrategy
                        ? `estrategia ${selectedStrategy?.name ?? ""}`
                        : scope === "funded"
                          ? "fondeo"
                          : scope === "real"
                            ? "personal"
                            : "consolidado"}
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedCalendarDate
                    ? `Evolución intradía del día ${selectedCalendarDate.split("-").reverse().join("/")}`
                    : isStrategy
                      ? `Evolución acumulada de la estrategia ${selectedStrategy?.name ?? ""}`
                      : "Evolución cronológica del balance de cuentas"}
                </p>
              </div>

              {/* Etiqueta de balance actual */}
              <div className="flex items-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-xs">
                  {isStrategy ? (
                    <>
                      <span
                        className="size-2 rounded-full"
                        style={{
                          backgroundColor:
                            selectedStrategy?.color ?? "var(--color-brand)",
                        }}
                      />
                      <span>
                        {selectedStrategy?.name ?? "Estrategia"}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span
                        className={cn(
                          "num font-black",
                          fusionPnl >= 0 ? "text-profit" : "text-loss",
                        )}
                      >
                        {fusionPnl >= 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(fusionPnl), false)}
                      </span>
                    </>
                  ) : accountFilter !== "all" ? (
                    <>
                      <Building2 className="size-3.5 text-muted-foreground" />
                      <span>{accounts.find((a) => a.id === accountFilter)?.name ?? "Cuenta"}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="num font-black text-foreground">
                        {formatCurrency(fusionEquity)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Layers className="size-3.5 text-muted-foreground" />
                      <span>
                        {scope === "funded" ? "Fondeo" : scope === "real" ? "Personal" : "Total"}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="num font-black text-foreground">
                        {formatCurrency(fusionEquity)}
                      </span>
                    </>
                  )}
                </span>
              </div>
            </div>

            <EquityChart data={curve} />
          </section>

          {/* 3.2 Matriz Diaria PnL */}
          <PnlCalendar
            trades={calendarTrades}
            selectedDate={selectedCalendarDate}
            onSelectDate={setSelectedCalendarDate}
          />
        </div>

        {/* ========================================================================= */}
        {/* BLOQUE 4: REGISTRO DE OPERACIONES DEL PERIODO                             */}
        {/* ========================================================================= */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
            <div>
              <h2 className="text-lg font-display uppercase tracking-wide font-bold">
                {selectedCalendarDate
                  ? `Operaciones del día ${selectedCalendarDate.split("-").reverse().join("/")}`
                  : "Registro de Operaciones del Periodo"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {trades.length} operación{trades.length === 1 ? "" : "es"} listadas
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedCalendarDate ? (
                <button
                  onClick={() => setSelectedCalendarDate(null)}
                  className="text-xs font-bold text-brand hover:underline cursor-pointer"
                >
                  Ver todas las fechas
                </button>
              ) : trades.length > 15 ? (
                <button
                  type="button"
                  onClick={() => setShowAllTrades(!showAllTrades)}
                  className="text-xs font-bold text-brand hover:underline cursor-pointer"
                >
                  {showAllTrades
                    ? "Mostrar solo las 15 más recientes"
                    : `Consultar todas las ${trades.length} operaciones`}
                </button>
              ) : null}
            </div>
          </div>

          <TradesTable
            trades={trades}
            accounts={accounts}
            strategies={strategies}
            strategyPeriods={strategyPeriods}
            readOnly={!canEdit}
            limit={showAllTrades || selectedCalendarDate ? undefined : 15}
          />
        </section>
      </div>
    </AppShell>
  );
}
