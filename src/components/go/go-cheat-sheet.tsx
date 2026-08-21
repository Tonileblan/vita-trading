import { useState } from "react";
import { Copy, Check, Printer, Sparkles, Target, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/lib/journal-store";
import { useJournals } from "@/lib/journals";
import { OPERATING_DAYS, getEffectiveSlotSchedule, type TradingPlan, type TradingPlanSlot } from "@/lib/planing";
import { formatCurrency } from "@/lib/metrics";

interface GoCheatSheetProps {
  plan: TradingPlan;
  slots: TradingPlanSlot[];
}

export function GoCheatSheet({ plan, slots }: GoCheatSheetProps) {
  const { accounts, strategies, activeJournalId } = useJournal();
  const { data: journals = [] } = useJournals();
  const activeJournal = journals.find((j) => j.id === activeJournalId);
  const [copied, setCopied] = useState(false);

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const strategyMap = new Map(strategies.map((s) => [s.id, s]));

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    let text = `========================================\n`;
    text += `📋 PLAN OPERATIVO GO — ${activeJournal?.name || "Vita-Trading"}\n`;
    text += `========================================\n\n`;
    text += `🛡️ PARÁMETROS DE RIESGO:\n`;
    text += `• Presupuesto Semanal: ${formatCurrency(plan.weekly_risk_budget)}\n`;
    text += `• Límite Diario: ${formatCurrency(plan.daily_risk_budget)}\n`;
    text += `• Máx Trades/Día: ${plan.max_daily_trades}\n`;
    text += `• Stop tras Racha de Pérdidas: ${plan.max_loss_streak} seguidas\n`;
    if (plan.profit_lock_target) {
      text += `• Target Lock: +${formatCurrency(plan.profit_lock_target)}\n`;
    }
    text += `\n📅 HORARIO SEMANAL (LUNES A VIERNES):\n`;

    OPERATING_DAYS.forEach((day) => {
      const daySlots = slots.filter((s) => s.day_of_week === day.day && s.is_active);
      text += `\n[${day.label.toUpperCase()}]\n`;
      if (daySlots.length === 0) {
        text += `  - Sin sesiones programadas (Día de descanso)\n`;
      } else {
        daySlots.forEach((s) => {
          const stratObj = s.strategy_id ? strategyMap.get(s.strategy_id) : null;
          const eff = getEffectiveSlotSchedule(s, stratObj);
          const strat = stratObj?.name || "Sin estrategia";
          const acc = s.account_id ? accountMap.get(s.account_id)?.name : "Cualquier cuenta";
          const riskStr = s.risk_amount ? formatCurrency(s.risk_amount) : s.risk_pct ? `${(s.risk_pct * 100).toFixed(1)}%` : "0.5%";
          text += `  • ${eff.startTime} - ${eff.endTime} | ${eff.sessionName} (${strat}) | Cta: ${acc} | Máx: ${s.max_trades} trades | Riesgo: ${riskStr}\n`;
          if (s.setup_notes) text += `    Setup: ${s.setup_notes}\n`;
        });
      }
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Resumen de Planing copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* BARRA DE ACCIONES */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Trading Plan Cheat Sheet
          </h3>
          <p className="text-xs text-muted-foreground">
            Ficha condensada de tu plan de trading lista para imprimir o tener en pantalla.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            Copiar Texto
          </Button>
          <Button size="sm" onClick={handlePrint} className="gap-1.5 text-xs shadow-xs">
            <Printer className="size-3.5" /> Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENTO CHEAT SHEET IMPRIMIBLE */}
      <Card className="border-border/80 shadow-sm print:border-none print:shadow-none bg-card">
        <CardHeader className="border-b border-border/60 p-6 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background font-bold">
                GO
              </div>
              <div>
                <CardTitle className="font-display text-xl tracking-tight">
                  PLAN OPERATIVO DE TRADING
                </CardTitle>
                <CardDescription className="text-xs font-mono">
                  {activeJournal?.name || "Diario Principal"} · Vita-Trading
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                Riesgo Día: {formatCurrency(plan.daily_risk_budget)}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                Riesgo Semanal: {formatCurrency(plan.weekly_risk_budget)}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                Máx {plan.max_daily_trades} trades/día
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* TABLA HORARIO SEMANAL LUNES A VIERNES */}
          <div className="space-y-3">
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              1. Horario Semanal y Asignación (Lunes a Viernes)
            </h4>
            <div className="overflow-x-auto rounded-lg border border-border/80">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 font-medium text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="p-2.5 text-left">Día</th>
                    <th className="p-2.5 text-left">Horario</th>
                    <th className="p-2.5 text-left">Sesión / Estrategia</th>
                    <th className="p-2.5 text-left">Cuenta</th>
                    <th className="p-2.5 text-left">Cupo</th>
                    <th className="p-2.5 text-left">Riesgo</th>
                    <th className="p-2.5 text-left">Setup & Reglas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono">
                  {OPERATING_DAYS.map((day) => {
                    const daySlots = slots.filter((s) => s.day_of_week === day.day && s.is_active);

                    if (daySlots.length === 0) {
                      return (
                        <tr key={day.day} className="text-muted-foreground bg-muted/10">
                          <td className="p-2.5 font-bold font-sans">{day.label}</td>
                          <td colSpan={6} className="p-2.5 italic text-muted-foreground/70 font-sans">
                            Sin sesiones programadas (Día de descanso o análisis)
                          </td>
                        </tr>
                      );
                    }

                    return daySlots.map((slot, sIdx) => {
                      const strategy = slot.strategy_id ? strategyMap.get(slot.strategy_id) : null;
                      const account = slot.account_id ? accountMap.get(slot.account_id) : null;

                      const eff = getEffectiveSlotSchedule(slot, strategy);

                      return (
                        <tr key={slot.id} className="hover:bg-muted/30">
                          {sIdx === 0 ? (
                            <td
                              rowSpan={daySlots.length}
                              className="p-2.5 font-bold font-sans align-top border-r border-border/40"
                            >
                              {day.label}
                            </td>
                          ) : null}
                          <td className="p-2.5 whitespace-nowrap font-mono font-medium">
                            {eff.startTime} - {eff.endTime}
                          </td>
                          <td className="p-2.5 font-sans font-medium">
                            <span
                              className="inline-block size-2 rounded-full mr-1.5 align-middle"
                              style={{ backgroundColor: strategy?.color || "var(--brand)" }}
                            />
                            {eff.sessionName}
                          </td>
                          <td className="p-2.5 font-sans">{account?.name || "Cualquiera"}</td>
                          <td className="p-2.5">Máx {slot.max_trades}</td>
                          <td className="p-2.5">
                            {slot.risk_amount
                              ? formatCurrency(slot.risk_amount)
                              : slot.risk_pct
                                ? `${(slot.risk_pct * 100).toFixed(1)}%`
                                : "0.5%"}
                          </td>
                          <td className="p-2.5 font-sans text-muted-foreground">
                            {slot.setup_notes || "Respetar ratio R:R"}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* REGLAS DE ORO DE RIESGO */}
          <div className="space-y-3">
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              2. Reglas Innegociables de Disciplina
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-lg border border-border/80 p-3 space-y-1 bg-muted/10">
                <strong className="text-foreground block font-medium">1. Límite de Pérdida Diaria</strong>
                <p className="text-muted-foreground text-[11px]">
                  Si el balance del día toca -{formatCurrency(plan.daily_risk_budget)}, el trading finaliza inmediatamente sin excepciones.
                </p>
              </div>

              <div className="rounded-lg border border-border/80 p-3 space-y-1 bg-muted/10">
                <strong className="text-foreground block font-medium">2. Racha de Pérdidas (Stop Breaker)</strong>
                <p className="text-muted-foreground text-[11px]">
                  Tras {plan.max_loss_streak} pérdidas consecutivas en una sesión, se aplica una pausa forzada para evitar revenge trading.
                </p>
              </div>

              <div className="rounded-lg border border-border/80 p-3 space-y-1 bg-muted/10">
                <strong className="text-foreground block font-medium">3. Solo Setups Planificados</strong>
                <p className="text-muted-foreground text-[11px]">
                  No se ejecutan entradas fuera de las franjas horarias marcadas ni en cuentas que no correspondan.
                </p>
              </div>

              <div className="rounded-lg border border-border/80 p-3 space-y-1 bg-muted/10">
                <strong className="text-foreground block font-medium">4. Pre-Flight Obligatorio</strong>
                <p className="text-muted-foreground text-[11px]">
                  Validar noticias de impacto, niveles técnicos y cálculo de lotaje antes de disparar la primera orden.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
