import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  Building2,
  CalendarIcon,
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
  accountDrawdown,
  accountTarget,
  accountResult,
  accountsCurveStart,
  buildEquityCurve,
  effectiveStrategyId,
  filterByRange,
  formatCurrency,
} from "@/lib/metrics";
import { tradeDayKey } from "@/lib/emotions";
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

  // Filtro de usuario para supervisores: "mine" (mi diario) o userId específico
  const [supervisorUserFilter, setSupervisorUserFilter] = useState<string>("mine");

  // Filtro por clic en un día concreto del calendario (YYYY-MM-DD)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [showAllTrades, setShowAllTrades] = useState(false);

  const { data: svProfiles = [] } = useQuery({
    queryKey: ["sv-profiles", user?.id],
    enabled: isSupervisor || isAdmin,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, created_at, is_private")
          .order("created_at", { ascending: true });

        if (error) throw error;
        return (data ?? []).filter((p) => p.id !== user?.id && !p.is_private) as {
          id: string;
          display_name: string | null;
          created_at: string;
        }[];
      } catch (e) {
        console.warn("Error al cargar perfiles para supervisión:", e);
        return [];
      }
    },
  });

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

  const isSupervisedView = (isSupervisor || isAdmin) && supervisorUserFilter !== "mine";
  const canEdit = !isSupervisedView || canEditOtherUsers;
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
  // Unified filter: "all" | account.id | `strategy:${strategyId}`
  const [filter, setFilter] = useState<string>(() => searchParams.account || searchParams.filter || "all");

  useEffect(() => {
    if (searchParams.account) {
      setFilter(searchParams.account);
    } else if (searchParams.filter) {
      setFilter(searchParams.filter);
    }
  }, [searchParams.account, searchParams.filter]);

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
  const scopedTrades = useMemo(
    () =>
      visibleTrades.filter(
        (t) =>
          (scopedIds.size === 0 || scopedIds.has(t.accountId) || !t.accountId) &&
          (strategyFilter === "all" ||
            effectiveStrategyId(t, accounts, strategyPeriods) === strategyFilter ||
            t.strategyId === strategyFilter),
      ),
    [visibleTrades, scopedIds, strategyFilter, accounts, strategyPeriods],
  );

  const accountStrategies = useMemo(() => {
    if (accountFilter === "all") return strategies;
    const used = new Set(
      visibleTrades
        .filter((t) => t.accountId === accountFilter)
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
        const ts = new Date(t.openedAt || t.closedAt).getTime();
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

  // Accounts (capital + PnL) of the selected account/strategy.
  const strategyAccounts = useMemo(() => {
    if (!isStrategy) return [];
    const ids = new Set<string>();
    for (const a of selectedAccounts) {
      if (a.strategyId === strategyFilter) ids.add(a.id);
    }
    for (const p of strategyPeriods) {
      if (p.strategyId === strategyFilter) ids.add(p.accountId);
    }
    for (const t of scopedTrades) {
      if (t.accountId) ids.add(t.accountId);
    }
    return selectedAccounts.filter((a) => ids.has(a.id));
  }, [isStrategy, strategyFilter, selectedAccounts, strategyPeriods, scopedTrades]);

  const fusionAccounts = useMemo(
    () => (isStrategy ? strategyAccounts : scopedAccounts),
    [isStrategy, strategyAccounts, scopedAccounts],
  );
  const fusionEquity = useMemo(
    () =>
      fusionAccounts.reduce(
        (sum, account) => sum + accountBalance(account, visibleTrades, withdrawals),
        0,
      ),
    [fusionAccounts, visibleTrades, withdrawals],
  );

  // Calendario: muestra exclusivamente las operaciones de la estrategia o cuenta seleccionada
  const calendarTrades = scopedTrades;

  // Cuenta de fondeo concreta seleccionada → progreso hacia objetivo (eval / retiro) y drawdown
  const selectedFundedAccount = useMemo(() => {
    if (isStrategy) return null;
    if (accountFilter !== "all") {
      const acc = accounts.find((a) => a.id === accountFilter);
      return acc?.type === "funded" ? acc : null;
    }
    const fundedAccs = scopedAccounts.filter((a) => a.type === "funded");
    if (fundedAccs.length === 1) {
      return fundedAccs[0];
    }
    if (fundedAccs.length > 1 && scope === "funded") {
      const totalInitial = fundedAccs.reduce((s, a) => s + a.initialBalance, 0);
      const totalLimit = fundedAccs.reduce((s, a) => s + (a.drawdownLimit ?? 0), 0);
      if (totalLimit > 0) {
        return {
          id: "combined-funded",
          name: "Fondeo Combinado",
          type: "funded" as const,
          initialBalance: totalInitial,
          currentBalance: fundedAccs.reduce((s, a) => s + a.currentBalance, 0),
          drawdownLimit: totalLimit,
          drawdownType: "trailing" as const,
          currency: fundedAccs[0]?.currency ?? "USD",
        };
      }
    }
    return null;
  }, [isStrategy, accountFilter, accounts, scopedAccounts, scope]);

  const fundedTarget = useMemo(() => {
    if (!selectedFundedAccount) return null;
    return accountTarget(selectedFundedAccount, visibleTrades, withdrawals);
  }, [selectedFundedAccount, visibleTrades, withdrawals]);

  const fundedDrawdown = useMemo(() => {
    if (!selectedFundedAccount) return null;
    return accountDrawdown(selectedFundedAccount, visibleTrades, withdrawals);
  }, [selectedFundedAccount, visibleTrades, withdrawals]);

  const curveAccounts = isStrategy ? strategyAccounts : scopedAccounts;
  const curve = useMemo(() => {
    if (isStrategy) {
      // Para una estrategia, la curva muestra la evolución del PnL acumulado de esa estrategia
      return buildEquityCurve(trades, 0, null);
    }
    return buildEquityCurve(
      trades,
      accountsCurveStart(curveAccounts, trades, withdrawals),
      selectedFundedAccount,
    );
  }, [isStrategy, trades, curveAccounts, withdrawals, selectedFundedAccount]);

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
          <section className="panel p-4 bg-card shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                {isStrategy ? (
                  <span
                    className="size-4 rounded-full shadow-xs shrink-0"
                    style={{
                      backgroundColor:
                        selectedStrategy?.color ?? "var(--color-brand)",
                    }}
                  />
                ) : (
                  <Building2 className="size-4 text-brand shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold font-display tracking-wide uppercase leading-none">
                      {isStrategy
                        ? `Estrategia: ${selectedStrategy?.name ?? "Estrategia"}`
                        : (accounts.find((a) => a.id === accountFilter)?.name ?? "Cuenta")}
                    </h2>
                    {isStrategy && selectedStrategy?.mainSymbol && (
                      <span className="rounded bg-brand/10 border border-brand/25 px-1.5 py-0.2 text-[10px] font-bold text-brand uppercase">
                        {selectedStrategy.mainSymbol}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isStrategy
                      ? `Rendimiento exclusivo de la estrategia ${selectedStrategy?.name ?? ""}`
                      : "Supervisión detallada de cuenta"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {fundedTarget && <PhaseChip phase={fundedTarget.phase} />}
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {isStrategy
                    ? `${strategyAccounts.length} ${strategyAccounts.length === 1 ? "cuenta vinculada" : "cuentas vinculadas"}`
                    : accounts.find((a) => a.id === accountFilter)?.type === "funded"
                      ? "Fondeo"
                      : "Personal"}
                </span>
              </div>
            </div>

            {/* Cuadrícula de Métricas de la Estrategia / Cuenta */}
            <div className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-muted/20 border border-border/60 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Resultado en Periodo
                </p>
                <p
                  className={cn(
                    "num text-2xl font-black tabular-nums mt-1",
                    fusionPnl >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {fusionPnl >= 0 ? "+" : "−"}{formatCurrency(Math.abs(fusionPnl), false)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {range === "all" ? "Periodo completo" : `En rango seleccionado (${trades.length} ops)`}
                </p>
              </div>

              <div className="rounded-lg bg-muted/20 border border-border/60 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {isStrategy ? "PnL Total Histórico" : "Capital Actual"}
                </p>
                <p
                  className={cn(
                    "num text-2xl font-black tracking-tight mt-1",
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
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {isStrategy ? `${scopedTrades.length} ops registradas en total` : `${fusionAccounts.length} cuenta(s)`}
                </p>
              </div>

              <div className="rounded-lg bg-muted/20 border border-border/60 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tasa de Acierto (Win Rate)
                </p>
                <p className="num text-2xl font-black text-foreground mt-1">
                  {trades.length > 0
                    ? `${((trades.filter((t) => t.pnl > 0).length / trades.length) * 100).toFixed(0)}%`
                    : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {trades.length > 0
                    ? `${trades.filter((t) => t.pnl > 0).length}W / ${trades.filter((t) => t.pnl < 0).length}L`
                    : "Sin operaciones"}
                </p>
              </div>

              <div className="rounded-lg bg-muted/20 border border-border/60 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Profit Factor
                </p>
                <p className="num text-2xl font-black text-foreground mt-1">
                  {strategyProfitFactor === Infinity
                    ? "∞"
                    : strategyProfitFactor > 0
                      ? strategyProfitFactor.toFixed(2)
                      : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Ratio Ganancias / Pérdidas
                </p>
              </div>
            </div>

            {/* Cuentas donde se ejecuta esta estrategia */}
            {isStrategy && strategyAccounts.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-muted-foreground font-semibold">Cuentas con esta estrategia:</span>
                {strategyAccounts.map((acc) => (
                  <span
                    key={acc.id}
                    className="inline-flex items-center gap-1 rounded bg-muted/70 border border-border px-2 py-0.5 text-[11px] font-medium text-foreground"
                  >
                    <Wallet className="size-3 text-brand" />
                    {acc.name} {acc.firm ? `(${acc.firm})` : ""}
                  </span>
                ))}
              </div>
            )}

            {(fundedTarget || fundedDrawdown) && (
              <div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-2">
                {fundedTarget && <TargetProgress status={fundedTarget} />}
                {fundedDrawdown && <DrawdownProgress status={fundedDrawdown} threshold={600} />}
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
