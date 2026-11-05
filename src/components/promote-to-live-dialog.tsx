import { useState } from "react";
import {
  Trophy,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJournal } from "@/lib/journal-store";
import { parseMoneyInput } from "@/lib/money";
import { accountBalance, accountTarget, formatCurrency } from "@/lib/metrics";
import { DRAWDOWN_TYPES, type Account, type DrawdownType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PromoteToLiveDialogProps {
  account: Account;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PromoteToLiveDialog({
  account,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: PromoteToLiveDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const { updateAccount, trades, withdrawals } = useJournal();

  const realBalance = accountBalance(account, trades, withdrawals);
  const targetInfo = accountTarget(account, trades, withdrawals);

  // Sugerencia inteligente de nombre para Live / PA
  const suggestLiveName = (currName: string): string => {
    if (/\beval\b/i.test(currName)) return currName.replace(/\beval\b/gi, "Live");
    if (/\bevaluaci[oó]n\b/i.test(currName)) return currName.replace(/\bevaluaci[oó]n\b/gi, "Live");
    if (/\bprueba\b/i.test(currName)) return currName.replace(/\bprueba\b/gi, "Live");
    if (/\bchallenge\b/i.test(currName)) return currName.replace(/\bchallenge\b/gi, "Live");
    if (/\btest\b/i.test(currName)) return currName.replace(/\btest\b/gi, "Live");
    return `${currName} (Live)`;
  };

  const [name, setName] = useState(suggestLiveName(account.name));
  const [balanceOption, setBalanceOption] = useState<"reset" | "keep" | "custom">("reset");
  const [customInitBalance, setCustomInitBalance] = useState(String(account.initialBalance));
  const [customCurrBalance, setCustomCurrBalance] = useState(String(account.initialBalance));

  const [maxLoss, setMaxLoss] = useState(
    String(account.maxLossLimit ?? account.drawdownLimit ?? 2500),
  );
  const [ddType, setDdType] = useState<DrawdownType>(account.drawdownType ?? "eod");
  const [dailyLoss, setDailyLoss] = useState(
    account.dailyLossLimit != null ? String(account.dailyLossLimit) : "",
  );

  // En Live el objetivo es llegar al umbral de retiro (Payout threshold)
  // Sugerimos por defecto el balance base + colchón de retiro típico (ej. $52,600 para 50k con colchón de 2600)
  const defaultPayoutTarget = account.initialBalance + (account.maxLossLimit ?? 2500) + 100;
  const [withdrawalTarget, setWithdrawalTarget] = useState(
    String(account.profitTarget && account.profitTarget > account.initialBalance ? account.profitTarget : defaultPayoutTarget),
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (v) {
      // Re-sincronizar valores cada vez que se abre el modal
      setName(suggestLiveName(account.name));
      setBalanceOption("reset");
      setCustomInitBalance(String(account.initialBalance));
      setCustomCurrBalance(String(account.initialBalance));
      setMaxLoss(String(account.maxLossLimit ?? account.drawdownLimit ?? 2500));
      setDdType(account.drawdownType ?? "eod");
      setDailyLoss(account.dailyLossLimit != null ? String(account.dailyLossLimit) : "");
      setWithdrawalTarget(
        String(account.profitTarget && account.profitTarget > account.initialBalance ? account.profitTarget : defaultPayoutTarget),
      );
    }
    setOpen(v);
  };

  const handleConfirmPromotion = async () => {
    if (!name.trim()) {
      toast.error("El nombre de la cuenta no puede estar vacío");
      return;
    }

    const parsedMaxLoss = parseMoneyInput(maxLoss);
    if (!Number.isFinite(parsedMaxLoss) || parsedMaxLoss <= 0) {
      toast.error("Introduce un Límite Total de Pérdida (Drawdown) válido");
      return;
    }

    const parsedDailyLoss = dailyLoss.trim() ? parseMoneyInput(dailyLoss) : undefined;
    const parsedWithdrawalTarget = withdrawalTarget.trim() ? parseMoneyInput(withdrawalTarget) : undefined;

    let finalInitialBalance = account.initialBalance;
    let finalCurrentBalance = realBalance;

    if (balanceOption === "reset") {
      finalInitialBalance = account.initialBalance;
      finalCurrentBalance = account.initialBalance;
    } else if (balanceOption === "keep") {
      finalInitialBalance = account.initialBalance;
      finalCurrentBalance = realBalance;
    } else if (balanceOption === "custom") {
      const pInit = parseMoneyInput(customInitBalance);
      const pCurr = parseMoneyInput(customCurrBalance);
      if (!Number.isFinite(pInit) || !Number.isFinite(pCurr)) {
        toast.error("Revisa los balances personalizados introducidos");
        return;
      }
      finalInitialBalance = pInit;
      finalCurrentBalance = pCurr;
    }

    setIsSubmitting(true);
    try {
      await updateAccount(account.id, {
        name: name.trim(),
        phase: "live",
        initialBalance: finalInitialBalance,
        currentBalance: finalCurrentBalance,
        highWatermark: Math.max(finalInitialBalance, finalCurrentBalance),
        startOfDayBalance: finalCurrentBalance,
        maxLossLimit: parsedMaxLoss,
        drawdownLimit: parsedMaxLoss,
        drawdownType: ddType,
        dailyLossLimit:
          parsedDailyLoss !== undefined && Number.isFinite(parsedDailyLoss) && parsedDailyLoss > 0
            ? parsedDailyLoss
            : undefined,
        profitTarget:
          parsedWithdrawalTarget !== undefined && Number.isFinite(parsedWithdrawalTarget) && parsedWithdrawalTarget > 0
            ? parsedWithdrawalTarget
            : undefined,
      });

      toast.success(
        `🎉 ¡Cuenta "${name.trim()}" activada en Fase Live! Ahora el objetivo es alcanzar los retiros de fondos.`,
      );
      setOpen(false);
    } catch (err) {
      console.error("Error al promocionar cuenta a Live:", err);
      toast.error("No se pudo actualizar la cuenta a Fase Live");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30">
              <Trophy className="size-5" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Paso a Fase Financiada
              </span>
              <DialogTitle className="text-lg font-bold text-foreground">
                ¡Objetivo de Evaluación Cumplido!
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            La cuenta <strong className="text-foreground">{account.name}</strong> ha alcanzado exitosamente
            el balance meta de{" "}
            <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCurrency(targetInfo?.target ?? account.profitTarget ?? 0)}
            </strong>{" "}
            (balance actual: <span className="font-mono">{formatCurrency(realBalance)}</span>).
            Revisa y confirma los parámetros para pasarla a <strong>Fase Live</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Tarjeta de Resumen de Transición */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 flex items-center justify-between text-xs">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Fase Actual</p>
            <p className="font-bold text-sky-500 flex items-center gap-1">
              <TrendingUp className="size-3.5" /> Evaluación
            </p>
          </div>
          <ArrowRight className="size-4 text-emerald-500" />
          <div className="space-y-0.5 text-right">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Nueva Fase</p>
            <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
              <Sparkles className="size-3.5" /> Live (Retiros)
            </p>
          </div>
        </div>

        {/* Formulario de Ajustes para Fase Live */}
        <div className="space-y-4 pt-1 text-xs">
          {/* Nombre de la cuenta */}
          <div className="space-y-1.5">
            <Label htmlFor="live-name" className="text-xs font-semibold">
              Nombre de la cuenta en Live
            </Label>
            <Input
              id="live-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Apex 50k Live #1"
              className="text-xs font-medium"
            />
            <p className="text-[11px] text-muted-foreground">
              Puedes renombrarla para identificar que ya es una cuenta fondeada / PA activa.
            </p>
          </div>

          {/* Configuración de Balance al pasar a Live */}
          <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <DollarSign className="size-3.5 text-brand" /> Política de balance para la cuenta Live
            </Label>
            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-2.5 p-2 rounded-lg border border-border/60 bg-background cursor-pointer hover:border-brand/40 transition-colors">
                <input
                  type="radio"
                  name="balanceOption"
                  checked={balanceOption === "reset"}
                  onChange={() => setBalanceOption("reset")}
                  className="mt-0.5 accent-brand"
                />
                <div className="text-xs">
                  <span className="font-semibold text-foreground">
                    Resetear al balance base inicial ({formatCurrency(account.initialBalance)})
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Estándar de la mayoría de firmas de fondeo (Apex, Topstep, Bulenox, etc.), donde la cuenta financiada arranca limpia con el capital nominal.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded-lg border border-border/60 bg-background cursor-pointer hover:border-brand/40 transition-colors">
                <input
                  type="radio"
                  name="balanceOption"
                  checked={balanceOption === "keep"}
                  onChange={() => setBalanceOption("keep")}
                  className="mt-0.5 accent-brand"
                />
                <div className="text-xs">
                  <span className="font-semibold text-foreground">
                    Mantener balance acumulado ({formatCurrency(realBalance)})
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Para firmas o modalidades donde conservas los beneficios generados en la fase de evaluación.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded-lg border border-border/60 bg-background cursor-pointer hover:border-brand/40 transition-colors">
                <input
                  type="radio"
                  name="balanceOption"
                  checked={balanceOption === "custom"}
                  onChange={() => setBalanceOption("custom")}
                  className="mt-0.5 accent-brand"
                />
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Personalizar balance inicial / actual</span>
                  <p className="text-[11px] text-muted-foreground">
                    Si la firma descuenta comisiones de activación o asigna un saldo diferente.
                  </p>
                </div>
              </label>
            </div>

            {balanceOption === "custom" && (
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <div className="space-y-1">
                  <Label htmlFor="custom-init" className="text-[11px]">Balance inicial ($)</Label>
                  <Input
                    id="custom-init"
                    value={customInitBalance}
                    onChange={(e) => setCustomInitBalance(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="custom-curr" className="text-[11px]">Balance actual ($)</Label>
                  <Input
                    id="custom-curr"
                    value={customCurrBalance}
                    onChange={(e) => setCustomCurrBalance(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Parámetros de Drawdown en Live */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="live-max-loss" className="text-xs font-semibold flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-brand" /> Drawdown Máximo en Live ($)
              </Label>
              <Input
                id="live-max-loss"
                value={maxLoss}
                onChange={(e) => setMaxLoss(e.target.value)}
                inputMode="decimal"
                className="text-xs font-mono font-medium"
              />
              <p className="text-[10px] text-muted-foreground">
                Límite total de pérdida permitido antes de quemar la cuenta.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tipo de Drawdown en Live</Label>
              <Select value={ddType} onValueChange={(v) => setDdType(v as DrawdownType)}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DRAWDOWN_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {DRAWDOWN_TYPES.find((t) => t.key === ddType)?.help}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Límite diario opcional */}
            <div className="space-y-1.5">
              <Label htmlFor="live-daily-loss" className="text-xs font-semibold">
                Límite Diario de Pérdida ($ opcional)
              </Label>
              <Input
                id="live-daily-loss"
                value={dailyLoss}
                onChange={(e) => setDailyLoss(e.target.value)}
                placeholder="Sin límite diario"
                inputMode="decimal"
                className="text-xs font-mono"
              />
            </div>

            {/* Objetivo de retiro en Live */}
            <div className="space-y-1.5">
              <Label htmlFor="live-withdrawal-target" className="text-xs font-semibold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <DollarSign className="size-3.5" /> Objetivo para Retiro ($)
              </Label>
              <Input
                id="live-withdrawal-target"
                value={withdrawalTarget}
                onChange={(e) => setWithdrawalTarget(e.target.value)}
                inputMode="decimal"
                className="text-xs font-mono font-semibold border-emerald-500/40 focus-visible:ring-emerald-500"
              />
              <p className="text-[10px] text-muted-foreground">
                Umbral mínimo de balance exigido por tu firma para solicitar el primer retiro.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300">
            <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>
              Al confirmar, la cuenta pasará inmediatamente a <strong>Fase Live</strong>. El objetivo visual cambiará a seguimiento de retiros de fondos.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
            className="text-xs"
          >
            Mantener en Evaluación
          </Button>
          <Button
            type="button"
            onClick={handleConfirmPromotion}
            disabled={isSubmitting}
            className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
          >
            <Sparkles className="size-3.5" />
            {isSubmitting ? "Activando..." : "Confirmar y Activar Fase Live"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
