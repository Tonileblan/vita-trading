import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { useJournal } from "@/lib/journal-store";
import { computeStrategyStats, formatCurrency, monthlyNet } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/estrategias")({
  head: () => ({
    meta: [
      { title: "Estrategias y portafolio — Bitácora de trading" },
      {
        name: "description",
        content:
          "Compara el rendimiento de cada estrategia: capital, neto, retiros, efectividad, profit factor y neto mensual combinado.",
      },
      { property: "og:title", content: "Estrategias y portafolio" },
      {
        property: "og:description",
        content: "Cada estrategia con su capital y riesgo propio, más la comparativa global.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EstrategiasPage,
});

function pct(v: number) {
  return `${v.toFixed(1)}%`;
}

function EstrategiasPage() {
  const { strategies, trades, withdrawals } = useJournal();

  const stats = useMemo(
    () => strategies.map((s) => computeStrategyStats(s, trades, withdrawals)),
    [strategies, trades, withdrawals],
  );

  const totals = useMemo(() => {
    const initial = stats.reduce((s, x) => s + x.strategy.initialCapital, 0);
    const net = stats.reduce((s, x) => s + x.net, 0);
    const withdrawn = stats.reduce((s, x) => s + x.withdrawn, 0);
    const ops = stats.reduce((s, x) => s + x.trades, 0);
    return { initial, net, withdrawn, ops, current: initial + net - withdrawn };
  }, [stats]);

  const months = useMemo(() => monthlyNet(trades, totals.initial), [trades, totals.initial]);

  return (
    <AppShell
      title="Estrategias y portafolio"
      subtitle="Cada estrategia con su propio capital y riesgo · comparativa global"
      showAccountPanel={false}
    >
      <div className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Capital inicial total", value: formatCurrency(totals.initial) },
            { label: "Capital actual total", value: formatCurrency(totals.current) },
            { label: "Neto total (P&L)", value: formatCurrency(totals.net, true) },
            { label: "Retiros totales", value: formatCurrency(totals.withdrawn) },
          ].map((k) => (
            <div key={k.label} className="panel p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{k.value}</p>
            </div>
          ))}
        </section>

        <section className="panel overflow-x-auto p-4">
          <h2 className="mb-3 text-base font-semibold">Comparativa por estrategia</h2>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 text-left">Estrategia</th>
                <th className="py-2 text-right">Cap. inicial</th>
                <th className="py-2 text-right">Neto</th>
                <th className="py-2 text-right">Retiros</th>
                <th className="py-2 text-right">Cap. actual</th>
                <th className="py-2 text-right">#Oper.</th>
                <th className="py-2 text-right">Efect.</th>
                <th className="py-2 text-right">PF</th>
                <th className="py-2 text-right">Riesgo/op.</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.strategy.id} className="border-b border-border/60">
                  <td className="py-2 font-medium">
                    {s.strategy.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {s.strategy.mainSymbol} · {(s.strategy.riskPct * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCurrency(s.strategy.initialCapital)}
                  </td>
                  <td
                    className={cn(
                      "py-2 text-right font-semibold tabular-nums",
                      s.net >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {formatCurrency(s.net, true)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(s.withdrawn)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCurrency(s.currentCapital)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{s.trades}</td>
                  <td className="py-2 text-right tabular-nums">{pct(s.winRate)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : "∞"}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCurrency(s.riskPerTrade)}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2">TOTAL</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(totals.initial)}</td>
                <td
                  className={cn(
                    "py-2 text-right tabular-nums",
                    totals.net >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {formatCurrency(totals.net, true)}
                </td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(totals.withdrawn)}</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(totals.current)}</td>
                <td className="py-2 text-right tabular-nums">{totals.ops}</td>
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </section>

        <section className="panel overflow-x-auto p-4">
          <h2 className="mb-3 text-base font-semibold">Neto mensual combinado</h2>
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 text-left">Mes</th>
                <th className="py-2 text-right">Neto</th>
                <th className="py-2 text-right">Acumulado</th>
                <th className="py-2 text-right">Capital</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month} className="border-b border-border/60">
                  <td className="py-2">{m.month}</td>
                  <td
                    className={cn(
                      "py-2 text-right tabular-nums",
                      m.net > 0 ? "text-profit" : m.net < 0 ? "text-loss" : "text-muted-foreground",
                    )}
                  >
                    {m.net ? formatCurrency(m.net, true) : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(m.acc, true)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(m.capital)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
