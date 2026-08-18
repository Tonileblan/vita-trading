import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Layers, Pencil, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MarketHours } from "@/components/market-hours";
import { AccountStrategyCalendar } from "@/components/account-strategy-calendar";
import { StrategyDialog } from "@/components/strategy-dialog";
import { Button } from "@/components/ui/button";
import { useJournal } from "@/lib/journal-store";
import { computeStrategyStats, formatCurrency } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/estrategias")({
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
  const { strategies, trades, withdrawals, accounts, strategyPeriods } =
    useJournal();

  const stats = useMemo(
    () => strategies.map((s) => computeStrategyStats(s, trades, withdrawals, accounts, strategyPeriods)),
    [strategies, trades, withdrawals, accounts, strategyPeriods],
  );

  const [calendarAccountIds, setCalendarAccountIds] = useState<string[]>([]);

  const statById = useMemo(
    () => new Map(stats.map((s) => [s.strategy.id, s])),
    [stats],
  );

  const totals = useMemo(() => {
    const initial = stats.reduce((s, x) => s + x.initialCapital, 0);
    const net = stats.reduce((s, x) => s + x.net, 0);
    const withdrawn = stats.reduce((s, x) => s + x.withdrawn, 0);
    const ops = stats.reduce((s, x) => s + x.trades, 0);
    const current = stats.reduce((s, x) => s + x.currentCapital, 0);
    return { initial, net, withdrawn, ops, current };
  }, [stats]);



  return (
    <AppShell
      title="Estrategias y portafolio"
      subtitle="Cada estrategia con su propio capital y riesgo · comparativa global"
      showAccountPanel={false}
      actions={
        <StrategyDialog
          trigger={
            <Button>
              <Plus className="size-4" /> Nueva estrategia
            </Button>
          }
        />
      }
    >
      <div className="space-y-5">
        <MarketHours />
        {strategies.length === 0 ? (
          <div className="panel flex flex-col items-center gap-3 p-8 text-center">
            <Layers className="size-8 text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold">No hay estrategias en este diario</p>
              <p className="text-sm text-muted-foreground">
                Crea una nueva estrategia personalizada para tu operativa.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <StrategyDialog
                trigger={
                  <Button>
                    <Plus className="size-4" /> Nueva estrategia
                  </Button>
                }
              />
            </div>
          </div>
        ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {strategies.map((s) => (
            <div key={s.id} className="panel p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-lg font-semibold">{s.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.mainSymbol} · riesgo {(s.riskPct * 100).toFixed(1)}% ·{" "}
                    {statById.get(s.id)?.accounts.length
                      ? formatCurrency(statById.get(s.id)!.currentCapital)
                      : "sin cuentas asignadas"}
                  </p>
                </div>
                <StrategyDialog
                  strategy={s}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={`Editar ${s.name}`}>
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
              </div>
              <dl className="mt-3 space-y-1 text-xs">
                {(
                  [
                    ["Mercado", s.market],
                    ["Gráfico", s.chart],
                    ["Días", s.days],
                    ["Horario", s.schedule],
                    ["Operación", s.execution],
                    ["Configuración", s.setup],
                    ["Gestión", s.management],
                    ["Contratos", s.contracts],
                  ] as const
                )
                  .filter(([, v]) => Boolean(v))
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="shrink-0 uppercase tracking-wide text-muted-foreground">
                        {k}
                      </dt>
                      <dd className="min-w-0">{v}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          ))}
        </section>
        )}

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
                    <span className="inline-flex items-center gap-1.5">
                      {s.strategy.name}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {s.strategy.mainSymbol} · {(s.strategy.riskPct * 100).toFixed(1)}%
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {s.accounts.length
                        ? s.accounts.map((a) => a.name).join(", ")
                        : "sin cuentas asignadas"}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCurrency(s.initialCapital)}
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

        <section className="panel p-4">
          <h2 className="text-xl leading-none">Calendario</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Elige una o varias cuentas y asigna la estrategia que usaste en cada tramo de fechas.
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {accounts.map((a) => {
              const active = calendarAccountIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() =>
                    setCalendarAccountIds((prev) =>
                      prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id],
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {a.name}
                </button>
              );
            })}
            {accounts.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setCalendarAccountIds((prev) =>
                    prev.length === accounts.length ? [] : accounts.map((a) => a.id),
                  )
                }
                className="rounded-full border border-dashed border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {calendarAccountIds.length === accounts.length ? "Ninguna" : "Todas"}
              </button>
            )}
            {accounts.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay cuentas todavía.</p>
            )}
          </div>
          {calendarAccountIds.length > 0 ? (
            <AccountStrategyCalendar
              key={calendarAccountIds.join(",")}
              accountIds={calendarAccountIds}
            />
          ) : accounts.length > 0 ? (
            <p className="text-sm text-muted-foreground">Selecciona una o varias cuentas para ver el calendario.</p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
