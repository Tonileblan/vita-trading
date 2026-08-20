import { useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  DollarSign,
  Flame,
  Info,
  Lock,
  Save,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/lib/journal-store";
import { useSaveTradingPlan, type TradingPlan } from "@/lib/planing";
import { formatCurrency } from "@/lib/metrics";

interface GoRiskBudgetProps {
  plan: TradingPlan;
}

export function GoRiskBudget({ plan }: GoRiskBudgetProps) {
  const { accounts, activeJournalId } = useJournal();
  const savePlanMutation = useSaveTradingPlan(activeJournalId);

  // Estados locales editables
  const [weeklyBudget, setWeeklyBudget] = useState(String(plan.weekly_risk_budget));
  const [dailyBudget, setDailyBudget] = useState(String(plan.daily_risk_budget));
  const [maxTrades, setMaxTrades] = useState(String(plan.max_daily_trades));
  const [maxLossStreak, setMaxLossStreak] = useState(String(plan.max_loss_streak));
  const [profitLock, setProfitLock] = useState(plan.profit_lock_target ? String(plan.profit_lock_target) : "600");
  const [notes, setNotes] = useState(plan.notes || "");

  // Cálculos de capacidad de cuentas
  const totalDrawdownCapacity = accounts.reduce((acc, a) => acc + (a.drawdownLimit || a.initialBalance * 0.05 || 0), 0);
  const totalBalance = accounts.reduce((acc, a) => acc + a.currentBalance, 0);

  const handleSave = () => {
    const payload: Partial<TradingPlan> = {
      weekly_risk_budget: Math.max(10, parseFloat(weeklyBudget) || 1500),
      daily_risk_budget: Math.max(10, parseFloat(dailyBudget) || 400),
      max_daily_trades: Math.max(1, parseInt(maxTrades, 10) || 1),
      max_loss_streak: Math.max(1, parseInt(maxLossStreak, 10) || 2),
      profit_lock_target: profitLock ? parseFloat(profitLock) : null,
      notes: notes.trim() || null,
    };

    savePlanMutation.mutate(payload, {
      onSuccess: () => toast.success("Presupuesto y reglas de riesgo guardadas"),
      onError: (err: any) => toast.error("Error al guardar reglas: " + err.message),
    });
  };

  const dailyNum = parseFloat(dailyBudget) || 400;
  const weeklyNum = parseFloat(weeklyBudget) || 1500;
  const daysOfSafety = dailyNum > 0 ? (weeklyNum / dailyNum).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* TARJETAS RESUMEN DE CAPACIDAD */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Drawdown Global en Cuentas</CardDescription>
            <CardTitle className="font-mono text-xl text-foreground font-semibold">
              {formatCurrency(totalDrawdownCapacity)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted-foreground">
              Colchón de seguridad total entre tus {accounts.length} cuenta(s).
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Presupuesto Diario de Riesgo</CardDescription>
            <CardTitle className="font-mono text-xl text-brand font-semibold">
              {formatCurrency(dailyNum)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted-foreground">
              Equivale a ~{maxTrades} operaciones arriesgando ~{formatCurrency(dailyNum / (parseInt(maxTrades, 10) || 1))} por trade.
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Margen de Resistencia Semanal</CardDescription>
            <CardTitle className="font-mono text-xl text-emerald-600 dark:text-emerald-400 font-semibold">
              {daysOfSafety} días
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted-foreground">
              Días completos de pérdida máxima permitidos antes de agotar la semana.
            </span>
          </CardContent>
        </Card>
      </div>

      {/* FORMULARIO DE CALIBRACIÓN DE REGLAS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-border/80 shadow-xs lg:col-span-2">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-brand" />
              <div>
                <CardTitle className="font-display text-base">Calibrador de Presupuesto y Reglas GO</CardTitle>
                <CardDescription className="text-xs">
                  Define los límites monetarios y de frecuencia operativa que gobernarán tus sesiones.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-2 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Presupuesto de Riesgo Semanal ($)</Label>
                <Input
                  type="number"
                  value={weeklyBudget}
                  onChange={(e) => setWeeklyBudget(e.target.value)}
                  className="font-mono text-xs"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Pérdida máxima acumulada en los 5 días de la semana.
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Pérdida Máxima Diaria ($)</Label>
                <Input
                  type="number"
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(e.target.value)}
                  className="font-mono text-xs"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Cierre forzoso de terminales al tocar este nivel en una jornada.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Máx Operaciones / Día</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={maxTrades}
                  onChange={(e) => setMaxTrades(e.target.value)}
                  className="font-mono text-xs"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Protección contra overtrading.
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Pérdidas Seguidas (Stop Racha)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={maxLossStreak}
                  onChange={(e) => setMaxLossStreak(e.target.value)}
                  className="font-mono text-xs"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Pausa obligatoria tras $N$ pérdidas consecutivas.
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Target Lock Diario ($)</Label>
                <Input
                  type="number"
                  value={profitLock}
                  onChange={(e) => setProfitLock(e.target.value)}
                  placeholder="600"
                  className="font-mono text-xs"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Avisar para asegurar ganancias y no devolverlas.
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Contrato / Notas de Disciplina del Plan</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Respetar los slots de NY, nunca promediar a la baja, 1:2 R:R..."
                className="text-xs"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={savePlanMutation.isPending}
                className="gap-1.5 text-xs shadow-xs"
              >
                <Save className="size-3.5" /> Guardar Parámetros de Riesgo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* COLUMNA DE CONSEJOS INSTITUCIONALES */}
        <Card className="border-border/80 shadow-xs bg-muted/20">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-brand" />
              <CardTitle className="font-display text-sm">Protocolos Circuit Breaker</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-3 text-xs text-muted-foreground">
            <div className="rounded-lg border border-border/70 bg-card p-2.5 space-y-1">
              <strong className="text-foreground block font-medium">Regla de las 2 Balas</strong>
              <p className="text-[11px]">
                Si tus 2 primeros trades del día son negativos, tu lectura de mercado hoy no está sincronizada. No intentes recuperar (*Revenge trading*).
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-card p-2.5 space-y-1">
              <strong className="text-foreground block font-medium">Target Lock & Bloqueo</strong>
              <p className="text-[11px]">
                Cuando alcances tu objetivo de +{formatCurrency(parseFloat(profitLock) || 600)}, apaga las pantallas. El 80% del drawdown en cuentas ocurre tras una sesión ganadora sobreoperada.
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-card p-2.5 space-y-1">
              <strong className="text-foreground block font-medium">Viernes de Capitalización</strong>
              <p className="text-[11px]">
                Si tu semana ya va en positivo, reduce el riesgo al 50% el viernes para proteger el cierre semanal y asegurar el payout.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
