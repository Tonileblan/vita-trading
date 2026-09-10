import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Archive,
  Building2,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Flame,
  Info,
  Pencil,
  Percent,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useJournal } from "@/lib/journal-store";
import {
  accountBalance,
  accountDrawdown,
  accountResult,
  accountTarget,
  computeMetrics,
  formatCurrency,
  isTradeOfAccount,
} from "@/lib/metrics";
import { PhaseChip, TargetProgress } from "@/components/target-progress";
import { DrawdownProgress } from "@/components/drawdown-progress";
import { DrawdownAlertButton } from "@/components/drawdown-corner-alert";
import {
  ACCOUNT_PHASES,
  ACCOUNT_STATUSES,
  BROKERS,
  DRAWDOWN_TYPES,
  PROP_FIRMS,
  type Account,
  type AccountPhase,
  type AccountStatus,
  type AccountType,
  type DrawdownType,
} from "@/lib/types";
import { getFirmWebsite, usePropFirms } from "@/lib/prop-firms";
import { useBrokers } from "@/lib/brokers";
import { cn } from "@/lib/utils";
import { AccountFormDialog as AccountDialog } from "@/components/account-form-dialog";
import { parseMoneyInput } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/cuentas")({
  head: () => ({
    meta: [
      { title: "Gestión de cuentas — Vita-Trading" },
      {
        name: "description",
        content: "Administra cuentas de fondeo, personales y cuentas quemadas: balance, drawdown y rendimiento.",
      },
      { property: "og:title", content: "Gestión de cuentas — Vita-Trading" },
      {
        property: "og:description",
        content: "Cuentas de prop firm y personales con control de drawdown e historial de cuentas quemadas.",
      },
    ],
  }),
  component: AccountsPage,
});

type FilterType = "active" | "funded" | "personal" | "burned" | "all";

function AccountsPage() {
  const {
    accounts = [],
    trades = [],
    withdrawals = [],
    reactivateAccount,
    restoreFundedNextAccount,
    removeAccount,
  } = useJournal();

  const [filterType, setFilterType] = useState<FilterType>("active");
  const [viewMode, setViewMode] = useState<"horizontal" | "grid">("horizontal");
  const [searchQuery, setSearchQuery] = useState("");
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  // Modal de recuperación personalizada de FundedNext
  const [showFundedNextModal, setShowFundedNextModal] = useState(false);
  const [fnSize, setFnSize] = useState("50000");
  const [fnName, setFnName] = useState("FundedNext 50K — Futures");
  const [fnCurrentBalance, setFnCurrentBalance] = useState("50000");
  const [fnMaxLoss, setFnMaxLoss] = useState("2500");
  const [fnDailyLoss, setFnDailyLoss] = useState("1500");
  const [fnProfitTarget, setFnProfitTarget] = useState("53000");
  const [fnPhase, setFnPhase] = useState<AccountPhase>("eval");
  const [fnDdType, setFnDdType] = useState<DrawdownType>("eod");

  const safeAccounts = accounts || [];
  const safeTrades = trades || [];
  const safeWithdrawals = withdrawals || [];

  const activeAccounts = useMemo(
    () => safeAccounts.filter((a) => (a.status ?? "active") === "active"),
    [safeAccounts],
  );
  const burnedAccounts = useMemo(
    () => safeAccounts.filter((a) => a.status === "burned"),
    [safeAccounts],
  );
  const fundedActive = useMemo(
    () => activeAccounts.filter((a) => a.type === "funded"),
    [activeAccounts],
  );
  const personalActive = useMemo(
    () => activeAccounts.filter((a) => a.type === "personal"),
    [activeAccounts],
  );

  const hasFundedNextAccount = useMemo(() => {
    return safeAccounts.some(
      (a) =>
        (a.firm && (a.firm.toLowerCase().includes("fundednext") || a.firm.toLowerCase().includes("funded next"))) ||
        a.name.toLowerCase().includes("fundednext") ||
        a.name.toLowerCase().includes("funded next"),
    );
  }, [safeAccounts]);

  const displayedAccounts = useMemo(() => {
    let list = safeAccounts;
    if (filterType === "active") list = activeAccounts;
    else if (filterType === "funded") list = fundedActive;
    else if (filterType === "personal") list = personalActive;
    else if (filterType === "burned") list = burnedAccounts;
    else if (filterType === "all") list = safeAccounts;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.firm && a.firm.toLowerCase().includes(q)) ||
          (a.broker && a.broker.toLowerCase().includes(q)) ||
          (a.burnedReason && a.burnedReason.toLowerCase().includes(q)),
      );
    }

    // Priorizar arriba las cuentas con alertas activas de Drawdown
    return [...list].sort((a, b) => {
      // Cuentas quemadas al final si vemos todas
      if (filterType === "all") {
        if (a.status === "burned" && b.status !== "burned") return 1;
        if (a.status !== "burned" && b.status === "burned") return -1;
      }

      const ddA =
        a.type === "funded" && Boolean(a.maxLossLimit ?? a.drawdownLimit ?? a.dailyLossLimit)
          ? accountDrawdown(a, safeTrades, safeWithdrawals)
          : null;
      const ddB =
        b.type === "funded" && Boolean(b.maxLossLimit ?? b.drawdownLimit ?? b.dailyLossLimit)
          ? accountDrawdown(b, safeTrades, safeWithdrawals)
          : null;

      const isAlertA = Boolean(
        ddA && (ddA.remaining < 600 || ddA.breached || (ddA.hasDailyLimit && ((ddA.dailyRemaining ?? 9999) < 300 || ddA.dailyBreached))),
      );
      const isAlertB = Boolean(
        ddB && (ddB.remaining < 600 || ddB.breached || (ddB.hasDailyLimit && ((ddB.dailyRemaining ?? 9999) < 300 || ddB.dailyBreached))),
      );

      // Cuentas con alerta primero
      if (isAlertA && !isAlertB) return -1;
      if (!isAlertA && isAlertB) return 1;

      // Si ambas tienen alerta: primero las rotas, luego las que tengan menor margen restante
      if (isAlertA && isAlertB && ddA && ddB) {
        if (ddA.breached && !ddB.breached) return -1;
        if (!ddA.breached && ddB.breached) return 1;
        return ddA.remaining - ddB.remaining;
      }

      return 0;
    });
  }, [safeAccounts, activeAccounts, fundedActive, personalActive, burnedAccounts, filterType, searchQuery, safeTrades, safeWithdrawals]);

  const sumTotals = (list: typeof safeAccounts) => {
    const initial = list.reduce((s, a) => s + (a.initialBalance || 0), 0);
    const current = list.reduce((s, a) => s + accountBalance(a, safeTrades, safeWithdrawals), 0);
    const result = current - initial;
    const pnlPct = initial > 0 ? (result / initial) * 100 : 0;
    return { initial, current, result, pnlPct };
  };

  const activeTotals = useMemo(() => sumTotals(activeAccounts), [activeAccounts, safeTrades, safeWithdrawals]);
  const fundedTotals = useMemo(() => sumTotals(fundedActive), [fundedActive, safeTrades, safeWithdrawals]);
  const personalTotals = useMemo(() => sumTotals(personalActive), [personalActive, safeTrades, safeWithdrawals]);

  const burnedTotalCapital = useMemo(() => {
    return burnedAccounts.reduce((s, a) => s + (a.initialBalance || 0), 0);
  }, [burnedAccounts]);

  const liveFundedCount = fundedActive.filter((a) => a.phase === "live").length;
  const evalFundedCount = fundedActive.filter((a) => a.phase === "eval").length;

  const handleApplyPreset = (size: number) => {
    setFnSize(String(size));
    setFnCurrentBalance(String(size));
    const k = size >= 1000 ? `${size / 1000}K` : `${size}`;
    setFnName(`FundedNext ${k} — Futures`);
    setFnMaxLoss(String(size * 0.05));
    setFnDailyLoss(String(size * 0.03));
    setFnProfitTarget(String(size * 1.06));
  };

  const handleReactivate = async (acc: Account, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await reactivateAccount(acc.id);
      toast.success(`Cuenta "${acc.name}" reactivada con éxito.`);
    } catch (err) {
      toast.error("No se pudo reactivar la cuenta");
    }
  };

  const handleRecoverFundedNext = async () => {
    try {
      await restoreFundedNextAccount();
      toast.success("¡Cuenta de FundedNext 50K recuperada y agregada a tu diario!");
    } catch (err) {
      toast.error("No se pudo recuperar la cuenta de FundedNext");
    }
  };

  const handleCustomRestoreFundedNext = async () => {
    try {
      const initBal = parseMoneyInput(fnSize) || 50000;
      const currBal = parseMoneyInput(fnCurrentBalance) || initBal;
      const maxLoss = parseMoneyInput(fnMaxLoss) || initBal * 0.05;
      const dailyLoss = fnDailyLoss.trim() ? parseMoneyInput(fnDailyLoss) : undefined;
      const target = fnProfitTarget.trim() ? parseMoneyInput(fnProfitTarget) : undefined;

      await restoreFundedNextAccount({
        name: fnName.trim() || `FundedNext ${initBal / 1000}K — Futures`,
        type: "funded",
        status: "active",
        firm: "FundedNext Futures",
        initialBalance: initBal,
        currentBalance: currBal,
        maxLossLimit: maxLoss,
        drawdownLimit: maxLoss,
        dailyLossLimit: dailyLoss,
        highWatermark: Math.max(initBal, currBal),
        startOfDayBalance: initBal,
        profitTarget: target,
        phase: fnPhase,
        drawdownType: fnDdType,
      });

      toast.success(`¡Cuenta "${fnName}" recuperada con éxito en tu diario!`);
      setShowFundedNextModal(false);
    } catch (err) {
      toast.error("No se pudo restaurar la cuenta de FundedNext");
    }
  };

  const handleConfirmDelete = () => {
    if (!accountToDelete) return;
    removeAccount(accountToDelete.id);
    toast.success(`Cuenta "${accountToDelete.name}" eliminada permanentemente.`);
    setAccountToDelete(null);
  };

  // ==========================================
  // FILA HORIZONTAL PANORÁMICA DE CUENTA
  // ==========================================
  const AccountHorizontalRow = ({ acc }: { acc: Account }) => {
    const accTrades = safeTrades.filter((t) => isTradeOfAccount(t, acc));
    const m = computeMetrics(accTrades);
    const result = accountResult(acc, safeTrades, safeWithdrawals);
    const balance = accountBalance(acc, safeTrades, safeWithdrawals);
    const dd = accountDrawdown(acc, safeTrades, safeWithdrawals);
    const target = accountTarget(acc, safeTrades, safeWithdrawals);
    const pnlPct = acc.initialBalance > 0 ? (result / acc.initialBalance) * 100 : 0;

    const isBurned = acc.status === "burned";

    const isLowDrawdown =
      !isBurned &&
      acc.type === "funded" &&
      Boolean(acc.maxLossLimit ?? acc.drawdownLimit ?? acc.dailyLossLimit) &&
      dd !== null &&
      (dd.remaining < 600 || dd.breached || (dd.hasDailyLimit && ((dd.dailyRemaining ?? 9999) < 300 || dd.dailyBreached)));

    const drawdownFloor = dd && Number.isFinite(dd.floor)
      ? dd.floor
      : acc.initialBalance - (acc.maxLossLimit ?? acc.drawdownLimit ?? 0);

    return (
      <article
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 sm:p-5 transition-all duration-200 hover:border-brand/40 hover:shadow-md space-y-3.5",
          isLowDrawdown && "border-loss/40",
          isBurned && "border-rose-500/35 bg-rose-500/[0.02] hover:border-rose-500/50",
        )}
      >
        {/* FRANJA DIAGONAL DE ALERTA DD O QUEMADA */}
        {isLowDrawdown && (
          <div className="absolute top-0 left-0 size-36 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[26px] -left-[42px] w-[180px] -rotate-45 bg-loss/12 text-loss/50 text-[10px] font-black uppercase tracking-wider text-center py-2.5 border-y border-loss/15 select-none">
              DD
            </div>
          </div>
        )}

        {isBurned && (
          <div className="absolute top-0 left-0 size-36 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[26px] -left-[42px] w-[180px] -rotate-45 bg-rose-500/15 text-rose-500/70 text-[9px] font-black uppercase tracking-wider text-center py-2.5 border-y border-rose-500/25 select-none">
              QUEMADA
            </div>
          </div>
        )}

        {/* CABECERA: IDENTIDAD DE CUENTA + ACCIONES */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-3 min-w-0">
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/panel"
                    search={{ account: acc.id }}
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm shadow-xs bg-card transition-all duration-200 hover:scale-105 hover:shadow-md cursor-pointer",
                      isBurned
                        ? "text-rose-500 border border-rose-500/35 hover:bg-rose-500/15 hover:border-rose-500"
                        : acc.type === "funded"
                          ? "text-brand border border-brand/35 hover:bg-brand/15 hover:border-brand"
                          : "text-purple-500 border border-purple-500/35 hover:bg-purple-500/15 hover:border-purple-500",
                    )}
                    aria-label="Métricas"
                    title="Métricas"
                  >
                    {isBurned ? (
                      <Flame className="size-5" />
                    ) : acc.type === "funded" ? (
                      <Building2 className="size-5" />
                    ) : (
                      <Wallet className="size-5" />
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-semibold text-xs py-1.5 px-3">
                  Métricas
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <TooltipProvider delayDuration={120}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to="/cuenta/$accountId"
                        params={{ accountId: acc.id }}
                        className={cn(
                          "font-extrabold text-base sm:text-lg text-foreground hover:text-brand transition-colors truncate",
                          isBurned && "line-through opacity-85",
                        )}
                        title="Ver cuenta"
                        aria-label={`Ver cuenta ${acc.name}`}
                      >
                        {acc.name}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="font-semibold text-xs py-1.5 px-3">
                      Ver cuenta
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {isBurned ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    <Flame className="size-3" /> Quemada / Perdida
                  </span>
                ) : (
                  acc.type === "funded" && <PhaseChip phase={acc.phase ?? "eval"} />
                )}

                {isLowDrawdown && (
                  <DrawdownAlertButton
                    remaining={dd?.remaining ?? 0}
                    isFunded={acc.type === "funded" && Boolean(acc.drawdownLimit)}
                    breached={dd?.breached ?? false}
                    threshold={600}
                  />
                )}
              </div>

              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5 flex-wrap">
                {(() => {
                  const firmName = acc.type === "funded" ? acc.firm || "Prop Firm" : acc.broker || "Broker";
                  const firmUrl = getFirmWebsite(firmName);
                  if (firmUrl) {
                    return (
                      <a
                        href={firmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-foreground/90 hover:text-brand hover:underline inline-flex items-center gap-0.5 transition-colors cursor-pointer"
                        title={`Visitar web oficial de ${firmName}`}
                      >
                        <span>{firmName}</span>
                        <ExternalLink className="size-2.5 opacity-60 ml-0.5" />
                      </a>
                    );
                  }
                  return <span className="font-semibold text-foreground/90">{firmName}</span>;
                })()}
                <span>•</span>
                <span className="font-mono">{formatCurrency(acc.initialBalance)}</span>

                {isBurned && acc.burnedReason && (
                  <>
                    <span>•</span>
                    <span className="text-rose-500 font-medium text-[11px]">
                      Causa: {acc.burnedReason}
                    </span>
                  </>
                )}

                {isBurned && acc.burnedAt && (
                  <>
                    <span>•</span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(acc.burnedAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ACCIONES DE LA FILA */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {isBurned ? (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handleReactivate(acc, e)}
                className="h-8 px-2.5 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1.5 rounded-lg font-semibold"
                title="Reactivar esta cuenta para que vuelva a estar operativa"
              >
                <RotateCcw className="size-3.5" />
                <span>Reactivar cuenta</span>
              </Button>
            ) : null}

            <AccountDialog
              account={acc}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-lg"
                  aria-label={`Editar ${acc.name}`}
                >
                  <Pencil className="size-3.5" />
                  <span>Editar</span>
                </Button>
              }
            />

            <Link to="/cuenta/$accountId" params={{ accountId: acc.id }}>
              <Button size="sm" variant="secondary" className="h-8 px-3 text-xs gap-1 font-semibold">
                <span>Detalle</span>
                <span className="text-xs">→</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* CUERPO: GRID DE MÉTRICAS */}
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {/* 1. BALANCE ACTUAL */}
          <div className="rounded-xl bg-card border border-border/70 p-3 flex flex-col justify-between min-h-[84px] shadow-xs">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Balance Final
            </span>
            <div className="my-0.5">
              <span className="num text-base sm:text-lg font-black font-mono text-foreground block">
                {formatCurrency(balance)}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Inicial: {formatCurrency(acc.initialBalance)}
            </span>
          </div>

          {/* 2. RESULTADO PNL */}
          <div className="rounded-xl bg-card border border-border/70 p-3 flex flex-col justify-between min-h-[84px] shadow-xs">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Resultado PnL
            </span>
            <div className="my-0.5">
              <span
                className={cn(
                  "num text-base sm:text-lg font-black font-mono block",
                  result >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {formatCurrency(result, true)}
              </span>
            </div>
            <span
              className={cn(
                "text-[10px] font-bold font-mono",
                pnlPct >= 0 ? "text-profit" : "text-loss",
              )}
            >
              {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}% ROI
            </span>
          </div>

          {/* 3. WIN RATE */}
          <div className="rounded-xl bg-card border border-border/70 p-3 flex flex-col justify-between min-h-[84px] shadow-xs">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Win Rate
            </span>
            <div className="my-0.5">
              <span className="num text-base sm:text-lg font-black font-mono text-foreground block">
                {m.winRate.toFixed(1)}%
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {m.wins}W · {m.losses}L ({m.total} ops)
            </span>
          </div>

          {/* 4. PROFIT FACTOR */}
          <div className="rounded-xl bg-card border border-border/70 p-3 flex flex-col justify-between min-h-[84px] shadow-xs">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Profit Factor
            </span>
            <div className="my-0.5">
              <span className="num text-base sm:text-lg font-black font-mono text-foreground block">
                {Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "—"}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {m.total > 0 ? "Rendimiento operativo" : "Sin trades aún"}
            </span>
          </div>

          {/* 5. DRAWDOWN GAUGE */}
          {dd ? (
            <div
              className={cn(
                "col-span-2 md:col-span-2 lg:col-span-1 rounded-xl p-3 flex flex-col justify-between min-h-[84px] space-y-1.5 transition-all duration-300",
                isBurned
                  ? "bg-rose-500/10 border border-rose-500/30"
                  : isLowDrawdown
                    ? "border border-loss/50 bg-loss/8 animate-drawdown-border shadow-xs"
                    : "bg-muted/30 border border-border/70",
              )}
            >
              <div className="flex items-center justify-between text-xs">
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1",
                    isBurned || isLowDrawdown ? "text-loss" : "text-muted-foreground",
                  )}
                >
                  <ShieldAlert
                    className={cn(
                      "size-3.5",
                      isBurned || isLowDrawdown ? "text-loss" : "text-muted-foreground",
                    )}
                  />{" "}
                  {isBurned ? "Drawdown Violado" : dd.type === "trailing" ? "Trailing" : dd.type === "eod" ? "EOD" : "Estático"}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-mono font-bold",
                    isBurned || isLowDrawdown ? "text-loss" : "text-muted-foreground",
                  )}
                >
                  {isBurned ? "0%" : `${dd.healthPct.toFixed(0)}%`}
                </span>
              </div>

              <div className="my-0.5">
                <div className="flex items-baseline justify-between">
                  <span
                    className={cn(
                      "num font-mono font-black text-base sm:text-lg tracking-tight",
                      isBurned || isLowDrawdown ? "text-loss font-black" : "text-profit",
                    )}
                  >
                    {formatCurrency(isBurned ? 0 : dd.remaining)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80 mt-1">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      isBurned ? "bg-rose-500" : isLowDrawdown ? "bg-loss" : "bg-profit",
                    )}
                    style={{
                      width: isBurned ? "0%" : `${Math.min(100, Math.max(0, dd.healthPct))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span title="Límite de liquidación">Suelo: {formatCurrency(drawdownFloor)}</span>
                <span>Max: {formatCurrency(dd.highWatermark)}</span>
              </div>
            </div>
          ) : (
            <div className="col-span-2 md:col-span-2 lg:col-span-1 rounded-xl bg-card border border-border/60 p-3 flex flex-col justify-between min-h-[84px] shadow-xs">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Estado
              </span>
              <p className="text-sm font-bold text-foreground my-0.5">Personal</p>
              <span className="text-[10px] text-muted-foreground">Sin límite forzado</span>
            </div>
          )}

          {/* 6. TARGET GAUGE */}
          {target ? (
            <div className="col-span-2 md:col-span-2 lg:col-span-1 rounded-xl bg-card border border-border/70 p-3 flex flex-col justify-between min-h-[84px] space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="size-3.5 text-sky-500" /> {acc.phase === "live" ? "Retiro" : "Target"}
                </span>
                <span className="num font-mono font-bold text-xs sm:text-sm text-sky-600 dark:text-sky-400">
                  {Math.min(100, Math.max(0, target.pct)).toFixed(0)}%
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80 my-0.5">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    target.reached ? "bg-emerald-500" : "bg-sky-500",
                  )}
                  style={{
                    width: `${Math.min(100, Math.max(0, target.pct))}%`,
                  }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>Meta: {formatCurrency(target.target)}</span>
                <span className={target.reached ? "text-emerald-500 font-bold" : ""}>
                  {target.reached ? "¡Superado!" : `Falta ${formatCurrency(Math.max(0, target.target - target.balance))}`}
                </span>
              </div>
            </div>
          ) : (
            <div className="col-span-2 md:col-span-2 lg:col-span-1 rounded-xl bg-muted/20 border border-border/60 p-3 flex flex-col justify-between min-h-[84px]">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Objetivo
              </span>
              <p className="text-sm font-bold text-foreground my-0.5">Operativa libre</p>
              <span className="text-[10px] text-muted-foreground">Sin meta fijada</span>
            </div>
          )}
        </div>
      </article>
    );
  };

  // ==========================================
  // TARJETA VERTICAL CLÁSICA (OPCIÓN GRID)
  // ==========================================
  const AccountCard = ({ acc }: { acc: Account }) => {
    const accTrades = safeTrades.filter((t) => isTradeOfAccount(t, acc));
    const m = computeMetrics(accTrades);
    const result = accountResult(acc, safeTrades, safeWithdrawals);
    const balance = accountBalance(acc, safeTrades, safeWithdrawals);
    const dd = accountDrawdown(acc, safeTrades, safeWithdrawals);
    const target = accountTarget(acc, safeTrades, safeWithdrawals);

    const isBurned = acc.status === "burned";

    const isLowDrawdown =
      !isBurned &&
      acc.type === "funded" &&
      Boolean(acc.maxLossLimit ?? acc.drawdownLimit ?? acc.dailyLossLimit) &&
      dd !== null &&
      (dd.remaining < 600 || dd.breached || (dd.hasDailyLimit && ((dd.dailyRemaining ?? 9999) < 300 || dd.dailyBreached)));

    return (
      <article
        className={cn(
          "panel flex flex-col justify-between p-5 transition-all hover:border-foreground/20 rounded-2xl relative overflow-hidden",
          isLowDrawdown && "border-loss/40",
          isBurned && "border-rose-500/35 bg-rose-500/[0.02]",
        )}
      >
        {isLowDrawdown && (
          <div className="absolute top-0 left-0 size-32 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[22px] -left-[38px] w-[160px] -rotate-45 bg-loss/12 text-loss/50 text-[9px] font-black uppercase tracking-wider text-center py-2 border-y border-loss/15 select-none">
              DD
            </div>
          </div>
        )}

        {isBurned && (
          <div className="absolute top-0 left-0 size-32 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[22px] -left-[38px] w-[160px] -rotate-45 bg-rose-500/15 text-rose-500/70 text-[8px] font-black uppercase tracking-wider text-center py-2 border-y border-rose-500/25 select-none">
              QUEMADA
            </div>
          </div>
        )}

        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <TooltipProvider delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/panel"
                      search={{ account: acc.id }}
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl font-bold text-xs shadow-xs bg-card transition-all duration-200 hover:scale-105 hover:shadow-md cursor-pointer mt-0.5",
                        isBurned
                          ? "text-rose-500 border border-rose-500/35 hover:bg-rose-500/15 hover:border-rose-500"
                          : acc.type === "funded"
                            ? "text-brand border border-brand/35 hover:bg-brand/15 hover:border-brand"
                            : "text-purple-500 border border-purple-500/35 hover:bg-purple-500/15 hover:border-purple-500",
                      )}
                      aria-label="Métricas"
                      title="Métricas"
                    >
                      {isBurned ? (
                        <Flame className="size-4" />
                      ) : acc.type === "funded" ? (
                        <Building2 className="size-4" />
                      ) : (
                        <Wallet className="size-4" />
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="font-semibold text-xs py-1.5 px-3">
                    Métricas
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="min-w-0 flex-1">
                <TooltipProvider delayDuration={120}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to="/cuenta/$accountId"
                        params={{ accountId: acc.id }}
                        className="group/title block"
                        title="Ver cuenta"
                        aria-label={`Ver cuenta ${acc.name}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={cn(
                              "text-base font-bold group-hover/title:text-brand transition-colors break-words",
                              isBurned && "line-through opacity-85",
                            )}
                          >
                            {acc.name}
                          </h3>
                          {isBurned ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              <Flame className="size-2.5" /> Quemada
                            </span>
                          ) : (
                            acc.type === "funded" && <PhaseChip phase={acc.phase ?? "eval"} />
                          )}
                          {isLowDrawdown && (
                            <DrawdownAlertButton
                              remaining={dd?.remaining ?? 0}
                              isFunded={acc.type === "funded" && Boolean(acc.drawdownLimit)}
                              breached={dd?.breached ?? false}
                              threshold={600}
                            />
                          )}
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="font-semibold text-xs py-1.5 px-3">
                      Ver cuenta
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className="text-xs text-muted-foreground mt-1 font-medium flex items-center gap-1 flex-wrap">
                  {(() => {
                    const firmName = acc.type === "funded" ? acc.firm || "Prop firm" : acc.broker || "Cuenta personal";
                    const firmUrl = getFirmWebsite(firmName);
                    if (firmUrl) {
                      return (
                        <a
                          href={firmUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-brand hover:underline inline-flex items-center gap-0.5 transition-colors cursor-pointer text-foreground/80 font-medium"
                          title={`Visitar web oficial de ${firmName}`}
                        >
                          <span>{firmName}</span>
                          <ExternalLink className="size-2.5 opacity-60 ml-0.5" />
                        </a>
                      );
                    }
                    return <span>{firmName}</span>;
                  })()}
                  <span>—</span>
                  <span>{formatCurrency(acc.initialBalance)}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <AccountDialog
                account={acc}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 -mr-1 text-muted-foreground hover:text-foreground"
                    aria-label={`Editar ${acc.name}`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                }
              />
              <span
                className={cn(
                  "num rounded-lg px-2.5 py-0.5 text-xs font-bold font-mono whitespace-nowrap bg-card",
                  result >= 0
                    ? "text-profit border border-profit/20"
                    : "text-loss border border-loss/20",
                )}
              >
                {formatCurrency(result, true)}
              </span>
            </div>
          </div>

          {/* 3 Metric Grid */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/80 bg-card p-2.5 text-center shadow-xs">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Balance</p>
              <p className="num text-xs font-bold font-mono text-foreground">{formatCurrency(balance)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Resultado</p>
              <p
                className={cn(
                  "num text-xs font-bold font-mono",
                  result >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {formatCurrency(result, true)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Win Rate</p>
              <p className="num text-xs font-bold font-mono text-foreground">{m.winRate.toFixed(1)}%</p>
            </div>
          </div>

          {isBurned && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5 text-xs space-y-1">
              <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <Flame className="size-3 shrink-0" />
                <span>Motivo: {acc.burnedReason || "Pérdida de cuenta"}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handleReactivate(acc, e)}
                className="w-full text-xs h-7 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1 mt-1 font-semibold"
              >
                <RotateCcw className="size-3" /> Reactivar cuenta
              </Button>
            </div>
          )}

          {/* Target Progress */}
          {!isBurned && target && <TargetProgress status={target} />}

          {/* Drawdown Progress */}
          {!isBurned && dd && <DrawdownProgress status={dd} threshold={600} />}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between pt-3 border-t border-border/60 text-xs text-muted-foreground">
          <span>
            {m.total} trades · PF:{" "}
            <strong className="num text-foreground">
              {Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "—"}
            </strong>
          </span>
          <span className="text-[11px] text-muted-foreground">
            {m.wins}W · {m.losses}L
          </span>
        </div>
      </article>
    );
  };

  return (
    <AppShell
      title="Gestión de Cuentas"
      subtitle="Supervisa el capital, control de drawdown, cuentas activas e historial de cuentas quemadas"
      actions={
        <div className="flex items-center gap-2">
          {!hasFundedNextAccount && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFundedNextModal(true)}
                className="gap-1.5 border-brand/40 text-brand hover:bg-brand/10 shadow-xs text-xs font-semibold"
                title="Personalizar y recuperar la cuenta de FundedNext"
              >
                <Zap className="size-3.5" />
                Recuperar FundedNext
              </Button>
            </div>
          )}

          <AccountDialog
            trigger={
              <Button className="gap-1.5 shadow-xs">
                <Plus className="size-4" /> Nueva cuenta
              </Button>
            }
          />
        </div>
      }
    >
      <div className="space-y-6">
        {/* BANNER DE RECUPERACIÓN DE FUNDEDNEXT SI NO EXISTE EN EL DIARIO */}
        {!hasFundedNextAccount && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-brand/35 bg-brand/5 p-4 sm:p-5 shadow-xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
                <Zap className="size-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-foreground">
                  ¿Buscabas tu cuenta de FundedNext eliminada?
                </h4>
                <p className="text-xs text-muted-foreground">
                  Recupérala con sus valores exactos previos a la eliminación (capital inicial, balance actual, drawdown y límites).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFundedNextModal(true)}
                className="gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Pencil className="size-3.5" />
                Ajustar valores exactos
              </Button>
              <Button
                size="sm"
                onClick={handleRecoverFundedNext}
                className="gap-1.5 text-xs font-bold shadow-xs"
              >
                <RotateCcw className="size-3.5" />
                Recuperar 50K al instante
              </Button>
            </div>
          </div>
        )}

        {/* KPI Hero Counters */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel flex items-center gap-3 p-4 rounded-2xl">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Capital Activo Gestionado</p>
              <p className="num text-lg font-bold">{formatCurrency(activeTotals.current)}</p>
              <p className="text-[11px] text-muted-foreground">
                Base inicial: {formatCurrency(activeTotals.initial)}
              </p>
            </div>
          </div>

          <div className="panel flex items-center gap-3 p-4 rounded-2xl">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Resultado Global Activo</p>
              <p
                className={cn(
                  "num text-lg font-bold",
                  activeTotals.result >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {formatCurrency(activeTotals.result, true)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Rentabilidad: {activeTotals.pnlPct >= 0 ? "+" : ""}
                {activeTotals.pnlPct.toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="panel flex items-center gap-3 p-4 rounded-2xl">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Building2 className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cuentas Fondeo Activas</p>
              <p className="text-lg font-bold">
                {fundedActive.length}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({liveFundedCount} live / {evalFundedCount} eval)
                </span>
              </p>
              <p className="num text-[11px] text-muted-foreground">
                Cap: {formatCurrency(fundedTotals.current)}
              </p>
            </div>
          </div>

          <div
            onClick={() => setFilterType("burned")}
            className={cn(
              "panel flex items-center gap-3 p-4 rounded-2xl transition-all cursor-pointer hover:border-rose-500/40",
              filterType === "burned" && "border-rose-500/50 bg-rose-500/5 ring-1 ring-rose-500/30",
            )}
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <Flame className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span>Cuentas Quemadas / Perdidas</span>
              </p>
              <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                {burnedAccounts.length} {burnedAccounts.length === 1 ? "cuenta" : "cuentas"}
              </p>
              <p className="num text-[11px] text-muted-foreground">
                Historial guardado: {formatCurrency(burnedTotalCapital)}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Pills & View Mode Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterType("active")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                filterType === "active"
                  ? "bg-brand text-brand-foreground shadow-xs"
                  : "border border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Activas ({activeAccounts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("funded")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                filterType === "funded"
                  ? "bg-brand text-brand-foreground shadow-xs"
                  : "border border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Fondeo ({fundedActive.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("personal")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                filterType === "personal"
                  ? "bg-brand text-brand-foreground shadow-xs"
                  : "border border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Personales ({personalActive.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("burned")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5",
                filterType === "burned"
                  ? "bg-rose-500 text-white shadow-xs font-bold"
                  : "border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10",
              )}
            >
              <Flame className="size-3.5" />
              <span>Quemadas / Perdidas ({burnedAccounts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                filterType === "all"
                  ? "bg-brand text-brand-foreground shadow-xs"
                  : "border border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Todas ({safeAccounts.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                type="text"
                placeholder="Buscar cuenta o firma..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs w-48 sm:w-56 rounded-xl"
              />
            </div>

            <div className="flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("horizontal")}
                title="Vista Horizontal Panorámica"
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-all flex items-center gap-1.5",
                  viewMode === "horizontal"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>Horizontal</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Vista Cuadrícula"
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-all flex items-center gap-1.5",
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>Cuadrícula</span>
              </button>
            </div>
          </div>
        </div>

        {/* MENSAJE EXPLICATIVO SI SE ESTÁ EN LA PESTAÑA DE CUENTAS QUEMADAS */}
        {filterType === "burned" && (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.04] p-4 flex items-start gap-3">
            <Flame className="size-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-foreground">Historial y Archivo de Cuentas Quemadas</p>
              <p className="text-muted-foreground">
                Aquí se conservan las cuentas de fondeo que sufrieron una violación de drawdown o expiración. Puedes consultar sus operaciones pasadas para analizar los errores de gestión o <strong>reactivarlas en cualquier momento</strong> si compraste un reset o restablecimiento de cuenta.
              </p>
            </div>
          </div>
        )}

        {/* Account Cards Presentation */}
        {displayedAccounts.length === 0 ? (
          <div className="panel p-10 text-center space-y-4 rounded-2xl">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              {filterType === "burned" ? <Flame className="size-6 text-rose-500" /> : <Wallet className="size-6" />}
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold">
                {filterType === "burned"
                  ? "No hay cuentas quemadas registradas"
                  : "No hay cuentas para mostrar"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "No se encontraron cuentas que coincidan con tu búsqueda."
                  : filterType === "burned"
                    ? "¡Excelente trabajo en tu gestión de riesgo! Ninguna cuenta ha sido marcada como quemada."
                    : "Crea una cuenta de fondeo o personal para comenzar a registrar tus operaciones y controlar el drawdown."}
              </p>
            </div>
            {filterType !== "burned" && (
              <div className="pt-2">
                <AccountDialog
                  trigger={
                    <Button className="gap-1.5 shadow-xs">
                      <Plus className="size-4" /> Crear mi primera cuenta
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        ) : viewMode === "horizontal" ? (
          <div className="space-y-3">
            {displayedAccounts.map((a) => (
              <AccountHorizontalRow key={a.id} acc={a} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {displayedAccounts.map((a) => (
              <AccountCard key={a.id} acc={a} />
            ))}
          </div>
        )}
      </div>

      {/* DIÁLOGO DE ELIMINACIÓN PERMANENTE */}
      <AlertDialog open={Boolean(accountToDelete)} onOpenChange={(open) => !open && setAccountToDelete(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-destructive">
              ¿Eliminar cuenta permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Esta acción eliminará la cuenta <strong>"{accountToDelete?.name}"</strong> y todas las operaciones vinculadas a ella. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              className="text-xs"
            >
              Eliminar definitivamente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* DIÁLOGO DE RECUPERACIÓN PERSONALIZADA DE FUNDEDNEXT */}
      <Dialog open={showFundedNextModal} onOpenChange={setShowFundedNextModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-display">
              <Zap className="size-4 text-brand" />
              Recuperar Cuenta FundedNext
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ajusta los parámetros exactos que tenía tu cuenta antes de eliminarla para restaurarla fielmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* PRESETS DE CAPITAL */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tamaño de cuenta (Presets rápidos)</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {[25000, 50000, 100000, 200000].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handleApplyPreset(size)}
                    className={cn(
                      "rounded-xl border p-2 text-center text-xs font-bold transition-all",
                      fnSize === String(size)
                        ? "border-brand bg-brand/10 text-brand ring-1 ring-brand/40 shadow-xs"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30",
                    )}
                  >
                    ${size >= 1000 ? `${size / 1000}K` : size}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fn-name" className="text-xs">Nombre de la cuenta</Label>
              <Input
                id="fn-name"
                value={fnName}
                onChange={(e) => setFnName(e.target.value)}
                className="text-xs h-8"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="fn-init" className="text-xs">Capital inicial ($)</Label>
                <Input
                  id="fn-init"
                  value={fnSize}
                  onChange={(e) => setFnSize(e.target.value)}
                  className="text-xs h-8 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fn-curr" className="text-xs">Balance antes de borrar ($)</Label>
                <Input
                  id="fn-curr"
                  value={fnCurrentBalance}
                  onChange={(e) => setFnCurrentBalance(e.target.value)}
                  className="text-xs h-8 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="fn-max-loss" className="text-xs">Límite Max Loss ($)</Label>
                <Input
                  id="fn-max-loss"
                  value={fnMaxLoss}
                  onChange={(e) => setFnMaxLoss(e.target.value)}
                  className="text-xs h-8 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fn-daily-loss" className="text-xs">Límite Diario ($)</Label>
                <Input
                  id="fn-daily-loss"
                  value={fnDailyLoss}
                  onChange={(e) => setFnDailyLoss(e.target.value)}
                  className="text-xs h-8 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="fn-target" className="text-xs">Objetivo Profit ($)</Label>
                <Input
                  id="fn-target"
                  value={fnProfitTarget}
                  onChange={(e) => setFnProfitTarget(e.target.value)}
                  className="text-xs h-8 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo Drawdown</Label>
                <Select value={fnDdType} onValueChange={(v) => setFnDdType(v as DrawdownType)}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DRAWDOWN_TYPES.map((d) => (
                      <SelectItem key={d.key} value={d.key} className="text-xs">
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowFundedNextModal(false)} className="text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCustomRestoreFundedNext} className="text-xs font-semibold gap-1.5">
              <RotateCcw className="size-3.5" />
              Restaurar cuenta ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
