import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EquityChart } from "@/components/equity-chart";
import { KpiCards } from "@/components/kpi-cards";
import { RiskAlerts } from "@/components/risk-alerts";
import { EmotionHighlights } from "@/components/emotion-stats";

import { TradesTable } from "@/components/trades-table";
import { useJournal } from "@/lib/journal-store";
import {
  accountBalance,
  accountsCurveStart,
  buildEquityCurve,
  computeMetrics,
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
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "all", label: "Todo" },
] as const;

const SCOPES = [
  { key: "all", label: "Capital total" },
  { key: "funded", label: "Capital fondeo" },
  { key: "real", label: "Capital real" },
] as const;

type Scope = (typeof SCOPES)[number]["key"];

function Overview() {
  const { visibleTrades, accounts, selectedAccountIds, withdrawals } = useJournal();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("all");
  const [scope, setScope] = useState<Scope>("all");

  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selectedAccountIds.includes(a.id)),
    [accounts, selectedAccountIds],
  );
  const scopedAccounts = useMemo(
    () =>
      selectedAccounts.filter((a) =>
        scope === "all" ? true : scope === "funded" ? a.type === "funded" : a.type !== "funded",
      ),
    [selectedAccounts, scope],
  );
  const scopedIds = useMemo(() => new Set(scopedAccounts.map((a) => a.id)), [scopedAccounts]);
  const scopedTrades = useMemo(
    () => visibleTrades.filter((t) => scopedIds.has(t.accountId)),
    [visibleTrades, scopedIds],
  );

  const trades = useMemo(() => filterByRange(scopedTrades, range), [scopedTrades, range]);
  const metrics = useMemo(() => computeMetrics(trades), [trades]);
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
      title="Resumen"
      subtitle={`${selectedAccounts.length} cuenta(s) · Fondeo ${formatCurrency(fundedEquity)} · Real ${formatCurrency(realEquity)}`}
    >
      <div className="space-y-5">
        <RiskAlerts />
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
        <KpiCards metrics={metrics} scope={scope} trades={scopedTrades} />
        <EmotionHighlights trades={scopedTrades} />



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
            <div className="flex gap-1 rounded-md border border-border p-1">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={cn(
                    "rounded px-3 py-1 text-xs font-semibold transition-colors",
                    range === r.key
                      ? "bg-brand text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r.label}
                </button>
              ))}
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
