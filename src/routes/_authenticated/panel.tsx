import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EquityChart } from "@/components/equity-chart";
import { KpiCards } from "@/components/kpi-cards";
import { TradeFormDialog } from "@/components/trade-form-dialog";
import { TradesTable } from "@/components/trades-table";
import { useJournal } from "@/lib/journal-store";
import {
  accountsStartBalance,
  buildEquityCurve,
  computeMetrics,
  filterByRange,
  formatCurrency,
} from "@/lib/metrics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — TONITRADING Journal" },
      {
        name: "description",
        content:
          "Dashboard de bitácora de trading: win rate, PnL, profit factor y curva de capital por cuenta.",
      },
      { property: "og:title", content: "Overview — TONITRADING Journal" },
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

function Overview() {
  const { visibleTrades, accounts, selectedAccountIds } = useJournal();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("all");

  const trades = useMemo(() => filterByRange(visibleTrades, range), [visibleTrades, range]);
  const metrics = useMemo(() => computeMetrics(trades), [trades]);
  const selectedAccounts = accounts.filter((a) => selectedAccountIds.includes(a.id));
  const curve = useMemo(
    () => buildEquityCurve(trades, accountsStartBalance(selectedAccounts)),
    [trades, selectedAccounts],
  );
  const equity = selectedAccounts.reduce((s, a) => s + a.currentBalance, 0);

  return (
    <AppShell
      title="Global Overview"
      subtitle={`${selectedAccounts.length} cuenta(s) seleccionadas · Capital ${formatCurrency(equity)}`}
      actions={<TradeFormDialog />}
    >
      <div className="space-y-5">
        <KpiCards metrics={metrics} />

        <section className="panel p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Equity Curve</h2>
              <p className="text-xs text-muted-foreground">
                Curva consolidada de las cuentas activas en el panel lateral
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
