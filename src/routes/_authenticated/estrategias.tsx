import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  Calendar as CalendarIcon,
  Coins,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MarketHours } from "@/components/market-hours";
import { AccountStrategyCalendar } from "@/components/account-strategy-calendar";
import { StrategyDialog } from "@/components/strategy-dialog";
import { Button } from "@/components/ui/button";
import { useJournal } from "@/lib/journal-store";
import { computeStrategyStats, formatCurrency } from "@/lib/metrics";
import { tradeDayKey } from "@/lib/emotions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/estrategias")({
  head: () => ({
    meta: [
      { title: "Estrategias y portafolio — Vita-Trading" },
      {
        name: "description",
        content:
          "Compara el rendimiento de cada estrategia: capital, neto, retiros, efectividad, profit factor y matriz operativa.",
      },
    ],
  }),
  component: EstrategiasPage,
});

function pct(v: number) {
  return `${v.toFixed(1)}%`;
}

function EstrategiasPage() {
  const { strategies, trades, withdrawals, accounts, strategyPeriods } = useJournal();

  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [calendarAccountIds, setCalendarAccountIds] = useState<string[]>([]);

  const stats = useMemo(
    () =>
      strategies.map((s) =>
        computeStrategyStats(s, trades, withdrawals, accounts, strategyPeriods),
      ),
    [strategies, trades, withdrawals, accounts, strategyPeriods],
  );

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
    const winningTrades = trades.filter((t) => t.pnl > 0).length;
    const totalTrades = trades.length;
    const globalWinRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const grossProfit = trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
    const globalPf = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const returnPct = initial > 0 ? (net / initial) * 100 : 0;
    const totalDaysOperated = new Set(trades.map((t) => tradeDayKey(t)).filter(Boolean)).size;

    return {
      initial,
      net,
      withdrawn,
      ops,
      current,
      globalWinRate,
      globalPf,
      returnPct,
      totalDaysOperated,
    };
  }, [stats, trades]);

  const handleClearFilters = () => {
    setSelectedStrategyId(null);
    setCalendarAccountIds([]);
  };

  const hasActiveFilters = Boolean(
    selectedStrategyId ||
      (calendarAccountIds.length > 0 && calendarAccountIds.length < accounts.length),
  );

  return (
    <AppShell
      title="Estrategias y Portafolio"
      subtitle="Supervisa el rendimiento de cada sistema de trading, distribución de capital y matriz comparativa"
      showAccountPanel={false}
      actions={
        <StrategyDialog
          trigger={
            <Button className="gap-1.5 shadow-xs">
              <Plus className="size-4" /> Nueva estrategia
            </Button>
          }
        />
      }
    >
      <div className="space-y-6">
        {/* Horarios de Mercado */}
        <MarketHours />

        {/* ========================================================================= */}
        {/* BLOQUE 1: KPIs GLOBALES DEL PORTAFOLIO                                    */}
        {/* ========================================================================= */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Capital Total */}
          <div className="panel p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Wallet className="size-3.5 text-brand" /> Capital Gestionado
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground num">
                {accounts.length} {accounts.length === 1 ? "cuenta" : "cuentas"}
              </span>
            </div>
            <div>
              <p className="num text-2xl font-black text-foreground">
                {formatCurrency(totals.current)}
              </p>
              <p className="num text-xs text-muted-foreground mt-0.5">
                Inicial: {formatCurrency(totals.initial)}
              </p>
            </div>
          </div>

          {/* 2. PnL Neto */}
          <div className="panel p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="size-3.5 text-brand" /> PnL Neto Total
              </span>
              <span
                className={cn(
                  "num rounded px-1.5 py-0.5 text-[10px] font-bold",
                  totals.net >= 0 ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
                )}
              >
                {totals.returnPct >= 0 ? "+" : ""}
                {totals.returnPct.toFixed(1)}% ROI
              </span>
            </div>
            <div>
              <p
                className={cn(
                  "num text-2xl font-black",
                  totals.net >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {totals.net >= 0 ? "+" : ""}
                {formatCurrency(totals.net, true)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totals.ops} operaciones registradas
              </p>
            </div>
          </div>

          {/* 3. Retiros */}
          <div className="panel p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Coins className="size-3.5 text-brand" /> Retiros Totales
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Payouts
              </span>
            </div>
            <div>
              <p className="num text-2xl font-black text-foreground">
                {formatCurrency(totals.withdrawn)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Beneficios asegurados</p>
            </div>
          </div>

          {/* 4. Rendimiento Operativo */}
          <div className="panel p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Award className="size-3.5 text-brand" /> Efectividad Global
              </span>
              <span className="num rounded bg-brand/15 text-brand px-1.5 py-0.5 text-[10px] font-bold">
                PF {Number.isFinite(totals.globalPf) ? totals.globalPf.toFixed(2) : "—"}
              </span>
            </div>
            <div>
              <p className="num text-2xl font-black text-foreground">
                {totals.globalWinRate.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Tasa de acierto combinada</p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* BLOQUE 2: FICHAS DE ESTRATEGIAS                                           */}
        {/* ========================================================================= */}
        {strategies.length === 0 ? (
          <div className="panel flex flex-col items-center gap-3 p-8 text-center">
            <Layers className="size-8 text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold">No hay estrategias configuradas</p>
              <p className="text-sm text-muted-foreground">
                Crea tus estrategias con sus reglas operativas, activos y límites de riesgo.
              </p>
            </div>
            <StrategyDialog
              trigger={
                <Button className="mt-2">
                  <Plus className="size-4" /> Crear primera estrategia
                </Button>
              }
            />
          </div>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold font-display uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-4 text-brand" /> Sistemas y Fichas Operativas ({strategies.length})
              </h2>
            </div>

            <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {strategies.map((s) => {
                const st = statById.get(s.id);
                const isSelected = selectedStrategyId === s.id;

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedStrategyId(isSelected ? null : s.id)}
                    className={cn(
                      "panel p-4 flex flex-col justify-between space-y-3 transition-all cursor-pointer relative",
                      isSelected
                        ? "border-brand ring-2 ring-brand/80 bg-brand/[0.04] shadow-sm"
                        : "hover:border-foreground/30 hover:bg-accent/20",
                    )}
                  >
                    <div>
                      {/* Header de la tarjeta */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="size-3 rounded-full shrink-0"
                              style={{ backgroundColor: s.color || "var(--color-brand)" }}
                            />
                            <h3 className="truncate text-base font-bold text-foreground">
                              {s.name}
                            </h3>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                              {s.mainSymbol}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Riesgo:{" "}
                            <strong className="text-foreground num">
                              {(s.riskPct * 100).toFixed(1)}%
                            </strong>{" "}
                            ·{" "}
                            <span className="font-semibold text-foreground">
                              Días: {s.days || "Lun - Vie"}
                            </span>{" "}
                            ·{" "}
                            {st?.accounts.length
                              ? `${st.accounts.length} ${st.accounts.length === 1 ? "cuenta" : "cuentas"}`
                              : "Sin cuentas fijas"}
                          </p>
                        </div>

                        <div
                          className="shrink-0 -mr-1 -mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <StrategyDialog
                            strategy={s}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-foreground"
                                aria-label={`Editar ${s.name}`}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            }
                          />
                        </div>
                      </div>

                      {/* Barra de métricas rápidas con Días Operados */}
                      {st && (
                        <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg border border-border/70 bg-muted/30 p-2 text-center text-xs">
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Neto</span>
                            <span
                              className={cn(
                                "num font-bold",
                                st.net >= 0 ? "text-profit" : "text-loss",
                              )}
                            >
                              {st.net >= 0 ? "+" : ""}
                              {formatCurrency(st.net, true)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Win Rate</span>
                            <span className="num font-bold text-foreground">
                              {pct(st.winRate)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">PF</span>
                            <span className="num font-bold text-foreground">
                              {Number.isFinite(st.profitFactor) ? st.profitFactor.toFixed(2) : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Días Op.</span>
                            <span className="num font-bold text-brand">
                              {st.daysOperated} {st.daysOperated === 1 ? "día" : "días"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Parámetros Operativos (Badges con Días Operativos destacados) */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {[
                          s.days && { label: "Días", val: s.days, highlight: true },
                          s.market && { label: "Mercado", val: s.market },
                          s.chart && { label: "TF", val: s.chart },
                          s.schedule && { label: "Horario", val: s.schedule },
                          s.execution && { label: "Operación", val: s.execution },
                          s.setup && { label: "Setup", val: s.setup },
                          s.management && { label: "Gestión", val: s.management },
                          s.contracts && { label: "Contratos", val: s.contracts },
                        ]
                          .filter((x): x is { label: string; val: string; highlight?: boolean } => Boolean(x))
                          .map((item, idx) => (
                            <span
                              key={idx}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]",
                                item!.highlight
                                  ? "bg-brand/10 border-brand/40 text-brand font-semibold"
                                  : "bg-muted/60 border-border/50 text-foreground/80",
                              )}
                            >
                              <strong className="font-semibold text-muted-foreground text-[10px]">
                                {item!.label}:
                              </strong>{" "}
                              {item!.val}
                            </span>
                          ))}
                      </div>
                    </div>

                    {/* Footer de la tarjeta con acción de filtrado */}
                    <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-muted-foreground">
                        {st?.trades ?? 0} trades ejecutados ({st?.daysOperated ?? 0} días)
                      </span>
                      <span
                        className={cn(
                          "font-bold text-xs transition-colors",
                          isSelected ? "text-brand" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {isSelected ? "✓ Filtrando calendario" : "Ver en calendario →"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* BLOQUE 3: MATRIZ COMPARATIVA DE ESTRATEGIAS (REDiseñada)                   */}
        {/* ========================================================================= */}
        <section className="panel overflow-hidden">
          <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-display uppercase tracking-wide font-bold flex items-center gap-2">
                <BarChart3 className="size-4 text-brand" /> Matriz Comparativa de Estrategias
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Desglose analítico de rendimiento, efectividad y distribución de capital por sistema
              </p>
            </div>

            {selectedStrategyId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="gap-1.5 text-xs font-bold text-brand hover:text-brand"
              >
                <RotateCcw className="size-3.5" /> Mostrar todas las estrategias
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-4 text-left">Estrategia</th>
                  <th className="py-2.5 px-3 text-center">Días Operativos</th>
                  <th className="py-2.5 px-3 text-right">Cap. Inicial</th>
                  <th className="py-2.5 px-3 text-right">Cap. Actual</th>
                  <th className="py-2.5 px-3 text-right">Neto (P&L)</th>
                  <th className="py-2.5 px-3 text-right">Retiros</th>
                  <th className="py-2.5 px-3 text-center">Trades</th>
                  <th className="py-2.5 px-4 text-left">Win Rate</th>
                  <th className="py-2.5 px-3 text-center">Profit Factor</th>
                  <th className="py-2.5 px-4 text-right">Riesgo / Trade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {stats.map((s) => {
                  const isSelected = selectedStrategyId === s.strategy.id;

                  return (
                    <tr
                      key={s.strategy.id}
                      onClick={() =>
                        setSelectedStrategyId(isSelected ? null : s.strategy.id)
                      }
                      className={cn(
                        "transition-colors cursor-pointer group",
                        isSelected
                          ? "bg-brand/10 font-medium"
                          : "hover:bg-accent/40",
                      )}
                    >
                      {/* Estrategia */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="size-3 rounded-full shrink-0 shadow-xs"
                            style={{
                              backgroundColor:
                                s.strategy.color || "var(--color-brand)",
                            }}
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground group-hover:text-brand transition-colors">
                                {s.strategy.name}
                              </span>
                              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-bold text-muted-foreground uppercase">
                                {s.strategy.mainSymbol}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground block">
                              {s.accounts.length
                                ? `${s.accounts.length} ${s.accounts.length === 1 ? "cuenta" : "cuentas"} asignadas`
                                : "Sin cuentas fijas"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Días Operativos */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-foreground text-xs block">
                          {s.strategy.days || "Lun - Vie"}
                        </span>
                        <span className="text-[10px] text-muted-foreground num block">
                          {s.daysOperated} {s.daysOperated === 1 ? "día con ops" : "días con ops"}
                        </span>
                      </td>

                      {/* Cap Inicial */}
                      <td className="py-3 px-3 text-right num text-muted-foreground">
                        {formatCurrency(s.initialCapital)}
                      </td>

                      {/* Cap Actual */}
                      <td className="py-3 px-3 text-right num font-semibold text-foreground">
                        {formatCurrency(s.currentCapital)}
                      </td>

                      {/* Neto PnL */}
                      <td
                        className={cn(
                          "py-3 px-3 text-right num font-black text-sm",
                          s.net >= 0 ? "text-profit" : "text-loss",
                        )}
                      >
                        <div className="flex flex-col items-end">
                          <span>
                            {s.net >= 0 ? "+" : ""}
                            {formatCurrency(s.net, true)}
                          </span>
                          {s.initialCapital > 0 && (
                            <span className="text-[10px] font-normal opacity-85">
                              {s.returnPct >= 0 ? "+" : ""}
                              {s.returnPct.toFixed(1)}% ROI
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Retiros */}
                      <td className="py-3 px-3 text-right num text-muted-foreground">
                        {s.withdrawn > 0 ? formatCurrency(s.withdrawn) : "—"}
                      </td>

                      {/* Trades */}
                      <td className="py-3 px-3 text-center num font-bold">
                        {s.trades}
                      </td>

                      {/* Win Rate */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs num">
                            <span className="font-bold text-foreground">
                              {pct(s.winRate)}
                            </span>
                          </div>
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                s.winRate >= 50 ? "bg-profit" : "bg-loss",
                              )}
                              style={{ width: `${s.winRate}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Profit Factor */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={cn(
                            "num rounded-md px-2 py-0.5 text-xs font-bold tabular-nums inline-block",
                            s.profitFactor >= 1.5
                              ? "bg-profit/15 text-profit border border-profit/25"
                              : s.profitFactor >= 1.0
                                ? "bg-brand/15 text-brand border border-brand/25"
                                : "bg-loss/15 text-loss border border-loss/25",
                          )}
                        >
                          {Number.isFinite(s.profitFactor)
                            ? s.profitFactor.toFixed(2)
                            : s.trades > 0
                              ? "∞"
                              : "—"}
                        </span>
                      </td>

                      {/* Riesgo / Trade */}
                      <td className="py-3 px-4 text-right num text-muted-foreground text-xs">
                        {formatCurrency(s.riskPerTrade)}
                        <span className="text-[10px] block opacity-75">
                          ({(s.strategy.riskPct * 100).toFixed(1)}%)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Fila TOTAL Consolidada */}
              <tfoot className="border-t-2 border-border bg-muted/40 font-bold">
                <tr>
                  <td className="py-3 px-4 text-foreground uppercase tracking-wider text-xs">
                    Total Portafolio
                  </td>
                  <td className="py-3 px-3 text-center num text-xs text-muted-foreground">
                    {totals.totalDaysOperated} {totals.totalDaysOperated === 1 ? "día operado" : "días operados"}
                  </td>
                  <td className="py-3 px-3 text-right num">
                    {formatCurrency(totals.initial)}
                  </td>
                  <td className="py-3 px-3 text-right num text-foreground font-black">
                    {formatCurrency(totals.current)}
                  </td>
                  <td
                    className={cn(
                      "py-3 px-3 text-right num font-black text-sm",
                      totals.net >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {totals.net >= 0 ? "+" : ""}
                    {formatCurrency(totals.net, true)}
                  </td>
                  <td className="py-3 px-3 text-right num">
                    {formatCurrency(totals.withdrawn)}
                  </td>
                  <td className="py-3 px-3 text-center num text-foreground">
                    {totals.ops}
                  </td>
                  <td className="py-3 px-4 num text-xs">
                    {totals.globalWinRate.toFixed(1)}% promedio
                  </td>
                  <td className="py-3 px-3 text-center num text-xs">
                    {Number.isFinite(totals.globalPf)
                      ? totals.globalPf.toFixed(2)
                      : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                    —
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* BLOQUE 4: CALENDARIO DE ASIGNACIÓN Y OPERATIVA                           */}
        {/* ========================================================================= */}
        <section className="panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <h2 className="text-xl font-display uppercase tracking-wide font-bold flex items-center gap-2">
                <CalendarIcon className="size-5 text-brand" /> Calendario de Estrategias y Tramos
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visualiza el resultado diario por estrategia y asigna qué estrategia operaste en cada periodo.
              </p>
            </div>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="gap-1.5 text-xs font-bold text-brand hover:text-brand border-brand/40 bg-brand/5 cursor-pointer"
              >
                <RotateCcw className="size-3.5" /> Deseleccionar todo (Ver todas)
              </Button>
            )}
          </div>

          {/* Barra de Filtros interactiva: Estrategias y Cuentas */}
          <div className="space-y-2.5 rounded-xl border border-border/70 bg-muted/20 p-3">
            {/* Filtro por Estrategia */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0 mr-1">
                Estrategia:
              </span>

              {strategies.map((s) => {
                const active = selectedStrategyId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStrategyId(active ? null : s.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer border",
                      active
                        ? "border-brand bg-brand text-primary-foreground font-bold shadow-xs scale-[1.02]"
                        : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/40",
                    )}
                  >
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: active ? "currentColor" : s.color || "var(--color-brand)",
                      }}
                    />
                    {s.name}
                  </button>
                );
              })}
            </div>

            {/* Filtro por Cuenta */}
            {accounts.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0 mr-1">
                  Cuentas:
                </span>

                {accounts.map((a) => {
                  const active = calendarAccountIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        setCalendarAccountIds((prev) =>
                          prev.includes(a.id)
                            ? prev.filter((id) => id !== a.id)
                            : [...prev, a.id],
                        )
                      }
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer border",
                        active
                          ? "border-brand bg-brand text-primary-foreground font-bold shadow-xs scale-[1.02]"
                          : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/40",
                      )}
                    >
                      {a.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* El calendario se muestra SIEMPRE (con o sin selección) */}
          <AccountStrategyCalendar
            key={`${calendarAccountIds.join(",")}-${selectedStrategyId ?? "all"}`}
            accountIds={calendarAccountIds}
            selectedStrategyId={selectedStrategyId}
            onClearSelection={handleClearFilters}
          />
        </section>
      </div>
    </AppShell>
  );
}
