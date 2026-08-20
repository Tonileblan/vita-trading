import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  HelpCircle,
  Percent,
  PieChart,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useJournal } from "@/lib/journal-store";
import {
  computePlanCompliance,
  type TradingPlan,
  type TradingPlanSlot,
} from "@/lib/planing";
import { formatCurrency } from "@/lib/metrics";
import { cn } from "@/lib/utils";

interface GoComplianceProps {
  plan: TradingPlan;
  slots: TradingPlanSlot[];
}

export function GoCompliance({ plan, slots }: GoComplianceProps) {
  const { trades, accounts, strategies } = useJournal();

  const compliance = useMemo(
    () => computePlanCompliance(trades, slots, plan, accounts, strategies),
    [trades, slots, plan, accounts, strategies],
  );

  const adherencePct = Math.round(compliance.adherenceRate);

  return (
    <div className="space-y-6">
      {/* 1. SCORE GENERAL DE ADHERENCIA AL PLAN */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-xs md:col-span-1">
          <CardHeader className="p-5 pb-3">
            <CardDescription className="text-xs">Índice de Disciplina y Adherencia</CardDescription>
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "font-display text-4xl font-bold tracking-tight",
                  adherencePct >= 80
                    ? "text-emerald-600 dark:text-emerald-400"
                    : adherencePct >= 50
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400",
                )}
              >
                {adherencePct}%
              </span>
              <span className="text-xs text-muted-foreground">de cumplimiento</span>
            </div>
            <Progress
              value={adherencePct}
              className={cn(
                "h-2 mt-2",
                adherencePct >= 80 ? "[&>div]:bg-emerald-500" : adherencePct >= 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-rose-500",
              )}
            />
          </CardHeader>
          <CardContent className="p-5 pt-0 text-xs text-muted-foreground">
            {compliance.onPlanTrades} de {compliance.totalTrades} operaciones se ejecutaron respetando exactamente los horarios, días y cuentas del planing.
          </CardContent>
        </Card>

        {/* COMPARATIVA PNL DENTRO VS FUERA */}
        <Card className="border-border/80 shadow-xs md:col-span-2">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-display text-base">Impacto Financiero: Plan vs No-Plan</CardTitle>
                <CardDescription className="text-xs">
                  Comparativa de resultados al operar dentro de tu horario y reglas vs salirte del plan.
                </CardDescription>
              </div>
              <Scale className="size-5 text-muted-foreground" />
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* DENTRO DE PLAN */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 gap-1 text-xs">
                    <ShieldCheck className="size-3" /> Dentro de Planing
                  </Badge>
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {compliance.onPlanTrades} trades ({compliance.onPlanWinRate.toFixed(1)}% WR)
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xs text-muted-foreground">PnL Neto:</span>
                  <span
                    className={cn(
                      "font-mono text-xl font-bold",
                      compliance.onPlanPnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                    )}
                  >
                    {compliance.onPlanPnl >= 0 ? "+" : ""}
                    {formatCurrency(compliance.onPlanPnl)}
                  </span>
                </div>
              </div>

              {/* FUERA DE PLAN */}
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="border-rose-500/30 text-rose-600 dark:text-rose-400 gap-1 text-xs">
                    <ShieldAlert className="size-3" /> Fuera de Planing
                  </Badge>
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {compliance.offPlanTrades} trades ({compliance.offPlanWinRate.toFixed(1)}% WR)
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xs text-muted-foreground">PnL Neto:</span>
                  <span
                    className={cn(
                      "font-mono text-xl font-bold",
                      compliance.offPlanPnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                    )}
                  >
                    {compliance.offPlanPnl >= 0 ? "+" : ""}
                    {formatCurrency(compliance.offPlanPnl)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. REGISTRO DE DESVIACIONES / INFRACCIONES DETECTADAS */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              <CardTitle className="font-display text-base">
                Infracciones y Desviaciones Detectadas ({compliance.infractions.length})
              </CardTitle>
            </div>
            {compliance.infractions.length > 0 && (
              <Badge variant="secondary" className="text-xs font-mono">
                {compliance.infractions.length} anomalías
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            Operaciones que se ejecutaron fuera de los días u horarios programados, en cuentas no autorizadas o con exceso de trades.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 pt-0">
          {compliance.infractions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <span className="font-display text-sm font-semibold">¡100% de Disciplina!</span>
              <p className="text-xs text-muted-foreground max-w-sm">
                No se han detectado operaciones fuera de tu horario semanal ni en cuentas desalineadas.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {compliance.infractions.slice(0, 15).map(({ trade, accountName, strategyName, reasons }, idx) => {
                const dateStr = trade.openedAt ? new Date(trade.openedAt).toLocaleString("es-ES", {
                  dateStyle: "short",
                  timeStyle: "short",
                }) : "—";

                return (
                  <div key={trade.id || idx} className="py-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{trade.symbol}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {accountName}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {strategyName}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground font-mono">{dateStr}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {reasons.map((r, rIdx) => (
                          <span
                            key={rIdx}
                            className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300"
                          >
                            ⚠️ {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={cn(
                          "font-mono text-xs font-bold block",
                          trade.pnl > 0 ? "text-emerald-600 dark:text-emerald-400" : trade.pnl < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
                        )}
                      >
                        {trade.pnl > 0 ? "+" : ""}
                        {formatCurrency(trade.pnl)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
