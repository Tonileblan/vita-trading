import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EquityChart } from "@/components/equity-chart";
import { KpiCards } from "@/components/kpi-cards";
import { RiskAlerts } from "@/components/risk-alerts";
import { EmotionHighlights } from "@/components/emotion-stats";
import { PnlCalendar } from "@/components/pnl-calendar";
import { PerformanceAnalysis } from "@/components/performance-analysis";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";


import { TradesTable } from "@/components/trades-table";
import { useJournal } from "@/lib/journal-store";
import {
  accountBalance,
  accountResult,
  accountsCurveStart,
  buildEquityCurve,
  computeMetrics,
  effectiveStrategyId,
  filterByRange,
  formatCurrency,
} from "@/lib/metrics";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Overview — Vita-Trading Journal" },
      {
        name: "description",
        content:
          "Dashboard de bitácora de trading: win rate, PnL, profit factor y curva de capital por cuenta.",
      },
      { property: "og:title", content: "Overview — Vita-Trading Journal" },
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

type DateRange = { from?: Date; to?: Date };

const SCOPES = [
  { key: "all", label: "Capital total" },
  { key: "funded", label: "Capital fondeo" },
  { key: "real", label: "Capital real" },
] as const;

type Scope = (typeof SCOPES)[number]["key"];

function Overview() {
  const { visibleTrades, accounts, strategies, selectedAccountIds, withdrawals } = useJournal();
  const [range, setRange] = useState<RangeKey>("all");
  const [customRange, setCustomRange] = useState<DateRange>({});
  const [scope, setScope] = useState<Scope>("all");
  // Unified filter: "all" | account.id | `strategy:${strategyId}`
  const [filter, setFilter] = useState<string>("all");

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
          scopedIds.has(t.accountId) &&
          (strategyFilter === "all" || effectiveStrategyId(t, accounts) === strategyFilter),
      ),
    [visibleTrades, scopedIds, strategyFilter, accounts],
  );

  const accountStrategies = useMemo(() => {
    if (accountFilter === "all") return strategies;
    const used = new Set(
      visibleTrades
        .filter((t) => t.accountId === accountFilter)
        .map((t) => effectiveStrategyId(t, accounts)),
    );
    const filtered = strategies.filter((s) => used.has(s.id));
    return filtered.length ? filtered : strategies;
  }, [strategies, visibleTrades, accountFilter, accounts]);


  const trades = useMemo(() => {
    if (range === "custom") {
      const from = customRange.from;
      const to = customRange.to;
      if (!from && !to) return scopedTrades;
      return scopedTrades.filter((t) => {
        const ts = new Date(t.closedAt).getTime();
        if (from && ts < from.getTime()) return false;
        if (to && ts > new Date(to.getTime() + 86400000).getTime()) return false;
        return true;
      });
    }
    return filterByRange(scopedTrades, range);
  }, [scopedTrades, range, customRange]);
  const isAllRange = range === "all";
  const metrics = useMemo(() => {
    const operationMetrics = computeMetrics(trades);
    const balanceResult = scopedAccounts.reduce(
      (sum, account) => sum + accountResult(account, scopedTrades, withdrawals),
      0,
    );
    return {
      ...operationMetrics,
      totalPnl: isAllRange ? balanceResult : operationMetrics.totalPnl,
    };
  }, [trades, scopedAccounts, scopedTrades, withdrawals, isAllRange]);
  const curve = useMemo(
    () => buildEquityCurve(trades, accountsCurveStart(scopedAccounts, trades, withdrawals)),
    [trades, scopedAccounts, withdrawals],
  );
  const fundedEquity = selectedAccounts
    .filter((a) => a.type === "funded")
    .reduce((s, a) => s + accountBalance(a, visibleTrades, withdrawals), 0);
  const realEquity = selectedAccounts
    .filter((a) => a.type !== "funded")
    .reduce((s, a) => s + accountBalance(a, visibleTrades, withdrawals), 0);


  const scopeValue = (key: Scope) => {
    if (key === "funded") return fundedEquity;
    if (key === "real") return realEquity;
    return fundedEquity + realEquity;
  };

  return (
    <AppShell
      title={
        <span className="flex flex-wrap items-center gap-3 w-full">
          <span>Resumen</span>
          <div className="flex gap-1 rounded-md border border-border p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={cn(
                  "rounded px-2 py-1 text-xs font-semibold transition-colors",
                  range === r.key
                    ? "bg-brand text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button
                onClick={() => setRange("custom")}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold transition-colors",
                  range === "custom"
                    ? "border-brand bg-brand/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                Fechas
                {(customRange.from || customRange.to) && (
                  <span className="text-[10px] text-muted-foreground">
                    {customRange.from ? format(customRange.from, "dd/MM") : "…"}–
                    {customRange.to ? format(customRange.to, "dd/MM") : "…"}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
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
                    if (!sel) {
                      setCustomRange({});
                      return;
                    }
                    setCustomRange({ from: sel.from, to: "to" in sel ? sel.to : undefined });
                  }}
                />
                <div className="flex items-center justify-between gap-2 px-1 pt-2">
                  <span className="text-xs text-muted-foreground">
                    {customRange.from
                      ? format(customRange.from, "dd/MM/yyyy")
                      : "Inicio"}
                    {" → "}
                    {customRange.to ? format(customRange.to, "dd/MM/yyyy") : "Fin"}
                  </span>
                  <button
                    onClick={() => setCustomRange({})}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="ml-auto h-9 rounded-md border border-border bg-card px-2 text-sm font-sans"
            aria-label="Cuenta o estrategia"
          >
            <option value="all">GENERAL</option>
            <optgroup label="Cuentas">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Estrategias">
              {accountStrategies.map((s) => (
                <option key={s.id} value={`strategy:${s.id}`}>
                  Estrategia-{s.name}
                </option>
              ))}
            </optgroup>
          </select>
        </span>
      }
      subtitle={`${selectedAccounts.length} cuenta(s) · Fondeo ${formatCurrency(fundedEquity)} · Real ${formatCurrency(realEquity)}`}
    >
      <div className="space-y-5">
        <RiskAlerts />
        {accountFilter === "all" && !isStrategy && (
          <section className="grid gap-3 sm:grid-cols-3">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                onClick={() => setScope(s.key)}
                className={cn(
                  "panel p-4 text-left transition-colors",
                  scope === s.key
                    ? "border-brand bg-brand/10"
                    : "hover:border-foreground/30",
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </p>
                <p className="num mt-1 text-lg font-semibold">{formatCurrency(scopeValue(s.key))}</p>
              </button>
            ))}
          </section>
        )}
        <KpiCards metrics={metrics} scope={scope} trades={scopedTrades} />
        <PerformanceAnalysis trades={trades} />
        <EmotionHighlights trades={scopedTrades} />
        <PnlCalendar trades={scopedTrades} />




        <section className="panel p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl leading-none">
                Curva de capital{" "}
                <span className="text-sm font-medium text-muted-foreground">
                  ·{" "}
                  {scope === "funded"
                    ? "Fondeo"
                    : scope === "real"
                      ? "Real"
                      : "Total"}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Consolidada de las cuentas activas
              </p>
            </div>
          </div>
          <EquityChart data={curve} />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Últimas operaciones</h2>
          <TradesTable trades={trades} accounts={accounts} limit={12} />
        </section>
      </div>
    </AppShell>
  );
}
