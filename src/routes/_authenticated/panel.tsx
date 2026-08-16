import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EquityChart } from "@/components/equity-chart";

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
  accountTarget,
  accountResult,
  accountsCurveStart,
  buildEquityCurve,
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

type DateRange = { from: Date | undefined; to: Date | undefined };

const SCOPES = [
  { key: "all", label: "Capital total" },
  { key: "funded", label: "Capital fondeo" },
  { key: "real", label: "Capital real" },
] as const;

type Scope = (typeof SCOPES)[number]["key"];

function Overview() {
  const { visibleTrades, accounts, strategies, selectedAccountIds, withdrawals, strategyPeriods } =
    useJournal();
  const [range, setRange] = useState<RangeKey>("all");
  const [customRange, setCustomRange] = useState<DateRange>({ from: undefined, to: undefined });
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
          (strategyFilter === "all" || effectiveStrategyId(t, accounts, strategyPeriods) === strategyFilter),
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
    () => fusionAccounts.reduce((sum, account) => sum + accountBalance(account, visibleTrades, withdrawals), 0),
    [fusionAccounts, visibleTrades, withdrawals],
  );


  // Cuenta de fondeo concreta seleccionada → progreso hacia objetivo (eval / retiro).
  const fundedTarget = useMemo(() => {
    if (isStrategy || accountFilter === "all") return null;
    const account = selectedAccounts[0];
    if (!account || account.type !== "funded") return null;
    return accountTarget(account, visibleTrades, withdrawals);
  }, [isStrategy, accountFilter, selectedAccounts, visibleTrades, withdrawals]);

  const curveAccounts = isStrategy ? strategyAccounts : scopedAccounts;
  const curve = useMemo(
    () => buildEquityCurve(trades, accountsCurveStart(curveAccounts, trades, withdrawals)),
    [trades, curveAccounts, withdrawals],
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
  // PnL del recuadro: estrategia o rango concreto → PnL de las operaciones filtradas.
  const fusionPnl =
    isStrategy || range !== "all"
      ? trades.reduce((s, t) => s + t.pnl, 0)
      : fusionAccounts.reduce((s, a) => s + accountResult(a, visibleTrades, withdrawals), 0);


  const scopeValue = (key: Scope) => {
    if (key === "funded") return fundedEquity;
    if (key === "real") return realEquity;
    return fundedEquity + realEquity;
  };
  const scopePnl = (key: Scope) => {
    if (key === "funded") return fundedPnl;
    if (key === "real") return realPnl;
    return fundedPnl + realPnl;
  };

  return (
    <AppShell
      title={
        <span className="flex flex-wrap items-center gap-3 w-full">
          <span>Resumen</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-7 rounded-md border border-border bg-card px-2 text-xs font-semibold"
            aria-label="Cuenta o estrategia"
          >
            <option value="all">Todo</option>
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
          <div className="ml-auto flex flex-wrap gap-1 rounded-md border border-border p-1">
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
            <Popover>
              <PopoverTrigger asChild>
                <button
                  onClick={() => setRange("custom")}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded px-2 text-xs font-semibold transition-colors",
                    range === "custom"
                      ? "bg-brand text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Fechas
                  {(customRange.from || customRange.to) && (
                    <span className="text-[10px]">
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
                        setCustomRange({ from: undefined, to: undefined });
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
                      onClick={() => setCustomRange({ from: undefined, to: undefined })}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </span>
      }
      subtitle={`${selectedAccounts.length} cuenta(s) · Fondeo ${formatCurrency(fundedEquity)} · Real ${formatCurrency(realEquity)}`}
    >
      <div className="space-y-5">
        <RiskAlerts />
        {accountFilter === "all" && !isStrategy ? (
          <section className="grid gap-3 sm:grid-cols-3">
            {SCOPES.map((s) => {
              const pnl = scopePnl(s.key);
              return (
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
                  <p className="num mt-1 text-lg font-semibold">
                    {formatCurrency(scopeValue(s.key))}
                  </p>
                  <p
                    className={cn(
                      "num mt-1 text-sm font-semibold tabular-nums",
                      pnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {pnl >= 0 ? "+" : "−"} {formatCurrency(Math.abs(pnl), false)}
                  </p>
                </button>
              );
            })}
          </section>
        ) : (
          <section className="panel p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isStrategy ? "Estrategia" : "Cuenta"}
              </p>
              {fundedTarget && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    fundedTarget.phase === "live"
                      ? "bg-profit/15 text-profit"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                  )}
                >
                  {fundedTarget.phase === "live" ? "Live" : "Eval"}
                </span>
              )}
            </div>
            <p className="num mt-1 text-lg font-semibold">
              {formatCurrency(fusionEquity)}
            </p>
            <p
              className={cn(
                "num mt-1 text-sm font-semibold tabular-nums",
                fusionPnl >= 0 ? "text-profit" : "text-loss",
              )}
            >
              {fusionPnl >= 0 ? "+" : "−"} {formatCurrency(Math.abs(fusionPnl), false)}
            </p>
            {fundedTarget && (
              <div className="mt-3 border-t border-border pt-3">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">{fundedTarget.label}</span>
                  <span className="num font-bold">{fundedTarget.pct.toFixed(0)}%</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full", fundedTarget.reached ? "bg-profit" : "bg-amber-500")}
                    style={{ width: `${Math.min(100, fundedTarget.pct)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {fundedTarget.reached ? (
                      <span className="font-semibold text-profit">
                        {fundedTarget.phase === "live" ? "Listo para retirar" : "Evaluación superada"}
                      </span>
                    ) : (
                      <>
                        Faltan{" "}
                        <span className="num font-semibold text-foreground">
                          {formatCurrency(fundedTarget.remaining)}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="num">
                    {formatCurrency(fundedTarget.balance)} / {formatCurrency(fundedTarget.target)}
                  </span>
                </div>
              </div>
            )}
          </section>
        )}
        <PerformanceAnalysis trades={trades} />
        <EmotionHighlights trades={trades} />




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

        <PnlCalendar trades={scopedTrades} />

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Últimas operaciones</h2>
          <TradesTable trades={trades} accounts={accounts} limit={12} />
        </section>
      </div>
    </AppShell>
  );
}
