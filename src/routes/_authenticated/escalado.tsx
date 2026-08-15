import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Lock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useJournal } from "@/lib/journal-store";
import { computeStrategyStats, formatCurrency, scalingPlan } from "@/lib/metrics";
import { FUTURES_SPECS } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/escalado")({
  head: () => ({
    meta: [
      { title: "Plan de escalado — Bitácora de trading" },
      {
        name: "description",
        content:
          "Calcula cuándo subir de 1 a 2, 3 o más contratos manteniendo intacto tu porcentaje de riesgo por operación.",
      },
      { property: "og:title", content: "Plan de escalado de contratos" },
      {
        property: "og:description",
        content: "Escala tamaño de posición según capital, stop medio y riesgo permitido.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EscaladoPage,
});

function EscaladoPage() {
  const { strategies, trades, withdrawals } = useJournal();
  const [symbol, setSymbol] = useState("MNQ");
  const [stopPoints, setStopPoints] = useState("50");
  const [riskPct, setRiskPct] = useState("2.5");
  const [capital, setCapital] = useState("10000");

  const pointValue = FUTURES_SPECS.find((f) => f.symbol === symbol)?.pointValue ?? 2;
  const rows = useMemo(
    () =>
      scalingPlan(
        Number(capital) || 0,
        (Number(riskPct) || 0) / 100,
        Number(stopPoints) || 1,
        pointValue,
      ),
    [capital, riskPct, stopPoints, pointValue],
  );

  const stats = strategies.map((s) => computeStrategyStats(s, trades, withdrawals));

  return (
    <AppShell
      title="Plan de escalado"
      subtitle="Cuándo subir de 1 → 2 → 3… contratos manteniendo tu % de riesgo"
      showAccountPanel={false}
    >
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <section className="panel space-y-3 p-4">
          <h2 className="text-base font-semibold">Parámetros</h2>
          <div className="space-y-2">
            <Label>Capital actual ($)</Label>
            <Input value={capital} onChange={(e) => setCapital(e.target.value)} inputMode="decimal" />
          </div>
          <div className="space-y-2">
            <Label>Activo (valor por punto)</Label>
            <div className="flex flex-wrap gap-2">
              {FUTURES_SPECS.map((f) => (
                <button
                  key={f.symbol}
                  type="button"
                  onClick={() => setSymbol(f.symbol)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    symbol === f.symbol
                      ? "border-brand bg-brand/15 text-brand-soft"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.symbol} · ${f.pointValue}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Stop promedio (puntos)</Label>
            <Input
              value={stopPoints}
              onChange={(e) => setStopPoints(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="space-y-2">
            <Label>Riesgo por operación (%)</Label>
            <Input value={riskPct} onChange={(e) => setRiskPct(e.target.value)} inputMode="decimal" />
          </div>
          <p className="text-xs text-muted-foreground">
            Riesgo por contrato: {formatCurrency((Number(stopPoints) || 0) * pointValue)}
          </p>
        </section>

        <div className="space-y-5">
          <section className="panel overflow-x-auto p-4">
            <h2 className="mb-3 text-base font-semibold">Niveles de contratos</h2>
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-left">Contratos</th>
                  <th className="py-2 text-right">Capital necesario</th>
                  <th className="py-2 text-right">Riesgo por op.</th>
                  <th className="py-2 text-right">Falta</th>
                  <th className="py-2 text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.contracts} className="border-b border-border/60">
                    <td className="py-2 font-semibold">{r.contracts}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(r.capitalNeeded)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(r.riskAmount)}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {r.missing ? formatCurrency(r.missing) : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                          r.unlocked
                            ? "bg-profit/15 text-profit"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {r.unlocked ? <Check className="size-3" /> : <Lock className="size-3" />}
                        {r.unlocked ? "Disponible" : "Bloqueado"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel p-4">
            <h2 className="mb-3 text-base font-semibold">Capital actual por estrategia</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {stats.map((s) => (
                <button
                  key={s.strategy.id}
                  type="button"
                  onClick={() => {
                    setCapital(String(Math.round(s.currentCapital)));
                    setRiskPct(String(s.strategy.riskPct * 100));
                    setSymbol(s.strategy.mainSymbol);
                  }}
                  className="rounded-lg border border-border p-3 text-left transition-colors hover:border-brand/60"
                >
                  <p className="text-sm font-medium">{s.strategy.name}</p>
                  <p className="text-lg font-bold tabular-nums">
                    {formatCurrency(s.currentCapital)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Usar estos valores en la calculadora
                  </p>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
