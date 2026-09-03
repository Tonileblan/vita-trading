import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Building2,
  DollarSign,
  ExternalLink,
  Pencil,
  Percent,
  Plus,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  User,
  Wallet,
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
} from "@/lib/metrics";
import { PhaseChip, TargetProgress } from "@/components/target-progress";
import { DrawdownProgress } from "@/components/drawdown-progress";
import { DrawdownAlertButton } from "@/components/drawdown-corner-alert";
import {
  ACCOUNT_PHASES,
  BROKERS,
  DRAWDOWN_TYPES,
  PROP_FIRMS,
  type Account,
  type AccountPhase,
  type AccountType,
  type DrawdownType,
} from "@/lib/types";
import { getFirmWebsite, usePropFirms } from "@/lib/prop-firms";
import { useBrokers } from "@/lib/brokers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cuentas")({
  head: () => ({
    meta: [
      { title: "Gestión de cuentas — Vita-Trading" },
      {
        name: "description",
        content: "Administra cuentas de fondeo y personales: balance, drawdown y rendimiento.",
      },
      { property: "og:title", content: "Gestión de cuentas — Vita-Trading" },
      {
        property: "og:description",
        content: "Cuentas de prop firm y personales con control de drawdown en tiempo real.",
      },
    ],
  }),
  component: AccountsPage,
});

import { AccountFormDialog as AccountDialog } from "@/components/account-form-dialog";
import { parseMoneyInput } from "@/lib/money";

function AccountsPage() {
  const { accounts = [], trades = [], withdrawals = [] } = useJournal();
  const [filterType, setFilterType] = useState<"all" | "funded" | "personal">("all");
  const [viewMode, setViewMode] = useState<"horizontal" | "grid">("horizontal");
  const [searchQuery, setSearchQuery] = useState("");

  const safeAccounts = accounts || [];
  const safeTrades = trades || [];
  const safeWithdrawals = withdrawals || [];

  const funded = useMemo(() => safeAccounts.filter((a) => a.type === "funded"), [safeAccounts]);
  const personal = useMemo(() => safeAccounts.filter((a) => a.type === "personal"), [safeAccounts]);

  const displayedAccounts = useMemo(() => {
    let list = safeAccounts;
    if (filterType === "funded") list = funded;
    if (filterType === "personal") list = personal;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.firm && a.firm.toLowerCase().includes(q)) ||
          (a.broker && a.broker.toLowerCase().includes(q)),
      );
    }

    // Priorizar arriba las cuentas con alertas activas de Drawdown
    return [...list].sort((a, b) => {
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
  }, [safeAccounts, funded, personal, filterType, searchQuery, safeTrades, safeWithdrawals]);

  const sumTotals = (list: typeof safeAccounts) => {
    const initial = list.reduce((s, a) => s + (a.initialBalance || 0), 0);
    const current = list.reduce((s, a) => s + accountBalance(a, safeTrades, safeWithdrawals), 0);
    const result = current - initial;
    const pnlPct = initial > 0 ? (result / initial) * 100 : 0;
    return { initial, current, result, pnlPct };
  };

  const grandTotals = useMemo(() => sumTotals(safeAccounts), [safeAccounts, safeTrades, safeWithdrawals]);
  const fundedTotals = useMemo(() => sumTotals(funded), [funded, safeTrades, safeWithdrawals]);
  const personalTotals = useMemo(() => sumTotals(personal), [personal, safeTrades, safeWithdrawals]);

  const liveFundedCount = funded.filter((a) => a.phase === "live").length;
  const evalFundedCount = funded.filter((a) => a.phase === "eval").length;

  // ==========================================
  // FILA HORIZONTAL PANORÁMICA DE CUENTA
  // ==========================================
  const AccountHorizontalRow = ({ acc }: { acc: Account }) => {
    const accTrades = safeTrades.filter((t) => t.accountId === acc.id);
    const m = computeMetrics(accTrades);
    const result = accountResult(acc, safeTrades, safeWithdrawals);
    const balance = accountBalance(acc, safeTrades, safeWithdrawals);
    const dd = accountDrawdown(acc, safeTrades, safeWithdrawals);
    const target = accountTarget(acc, safeTrades, safeWithdrawals);
    const pnlPct = acc.initialBalance > 0 ? (result / acc.initialBalance) * 100 : 0;

    const isLowDrawdown =
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
        )}
      >
        {/* FRANJA DIAGONAL DE ALERTA DD DE FONDO EN LA ESQUINA SUPERIOR IZQUIERDA (DOBLE DE ANCHA) */}
        {isLowDrawdown && (
          <div className="absolute top-0 left-0 size-36 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[26px] -left-[42px] w-[180px] -rotate-45 bg-loss/12 text-loss/50 text-[10px] font-black uppercase tracking-wider text-center py-2.5 border-y border-loss/15 select-none">
              DD
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
                      acc.type === "funded"
                        ? "text-brand border border-brand/35 hover:bg-brand/15 hover:border-brand"
                        : "text-purple-500 border border-purple-500/35 hover:bg-purple-500/15 hover:border-purple-500",
                    )}
                    aria-label="Métricas"
                    title="Métricas"
                  >
                    {acc.type === "funded" ? <Building2 className="size-5" /> : <Wallet className="size-5" />}
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
                        className="font-extrabold text-base sm:text-lg text-foreground hover:text-brand transition-colors truncate"
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
                {acc.type === "funded" && <PhaseChip phase={acc.phase ?? "eval"} />}
                {isLowDrawdown && (
                  <DrawdownAlertButton
                    remaining={dd?.remaining ?? 0}
                    isFunded={acc.type === "funded" && Boolean(acc.drawdownLimit)}
                    breached={dd?.breached ?? false}
                    threshold={600}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5">
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
                <span className="font-mono">
                  {acc.initialBalance.toLocaleString("en-US")}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
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
          </div>
        </div>

        {/* CUERPO: GRID ESPACIOSO DE MÉTRICAS Y CONTROLES (6 MÓDULOS OPACOS) */}
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {/* 1. BALANCE ACTUAL */}
          <div className="rounded-xl bg-card border border-border/70 p-3 flex flex-col justify-between min-h-[84px] shadow-xs">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Balance Actual
            </span>
            <div className="my-0.5">
              <span className="num text-base sm:text-lg font-black font-mono text-foreground block">
                {formatCurrency(balance)}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {formatCurrency(acc.initialBalance)}
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
                isLowDrawdown
                  ? "border border-loss/50 bg-loss/8 animate-drawdown-border shadow-xs"
                  : "bg-muted/30 border border-border/70",
              )}
            >
              <div className="flex items-center justify-between text-xs">
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1",
                    isLowDrawdown ? "text-loss" : "text-muted-foreground",
                  )}
                >
                  <ShieldAlert
                    className={cn(
                      "size-3.5",
                      isLowDrawdown ? "text-loss" : "text-muted-foreground",
                    )}
                  />{" "}
                  {dd.type === "trailing" ? "Trailing" : dd.type === "eod" ? "EOD" : "Estático"}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-mono font-bold",
                    isLowDrawdown ? "text-loss" : "text-muted-foreground",
                  )}
                >
                  {dd.healthPct.toFixed(0)}%
                </span>
              </div>

              <div className="my-0.5">
                <div className="flex items-baseline justify-between">
                  <span
                    className={cn(
                      "num font-mono font-black text-base sm:text-lg tracking-tight",
                      isLowDrawdown ? "text-loss font-black" : "text-profit",
                    )}
                  >
                    {formatCurrency(dd.remaining)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80 mt-1">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      isLowDrawdown ? "bg-loss" : "bg-profit",
                    )}
                    style={{
                      width: `${Math.min(100, Math.max(0, dd.healthPct))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span title="Límite de liquidación en el que se quema la cuenta">Suelo: {formatCurrency(drawdownFloor)}</span>
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
    const accTrades = safeTrades.filter((t) => t.accountId === acc.id);
    const m = computeMetrics(accTrades);
    const result = accountResult(acc, safeTrades, safeWithdrawals);
    const balance = accountBalance(acc, safeTrades, safeWithdrawals);
    const dd = accountDrawdown(acc, safeTrades, safeWithdrawals);
    const target = accountTarget(acc, safeTrades, safeWithdrawals);

    const isLowDrawdown =
      acc.type === "funded" &&
      Boolean(acc.maxLossLimit ?? acc.drawdownLimit ?? acc.dailyLossLimit) &&
      dd !== null &&
      (dd.remaining < 600 || dd.breached || (dd.hasDailyLimit && ((dd.dailyRemaining ?? 9999) < 300 || dd.dailyBreached)));

    return (
      <article
        className={cn(
          "panel flex flex-col justify-between p-5 transition-all hover:border-foreground/20 rounded-2xl relative overflow-hidden",
          isLowDrawdown && "border-loss/40",
        )}
      >
        {/* FRANJA DIAGONAL DE ALERTA DD DE FONDO EN LA ESQUINA SUPERIOR IZQUIERDA (DOBLE DE ANCHA) */}
        {isLowDrawdown && (
          <div className="absolute top-0 left-0 size-32 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[22px] -left-[38px] w-[160px] -rotate-45 bg-loss/12 text-loss/50 text-[9px] font-black uppercase tracking-wider text-center py-2 border-y border-loss/15 select-none">
              DD
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
                        acc.type === "funded"
                          ? "text-brand border border-brand/35 hover:bg-brand/15 hover:border-brand"
                          : "text-purple-500 border border-purple-500/35 hover:bg-purple-500/15 hover:border-purple-500",
                      )}
                      aria-label="Métricas"
                      title="Métricas"
                    >
                      {acc.type === "funded" ? <Building2 className="size-4" /> : <Wallet className="size-4" />}
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
                          <h3 className="text-base font-bold group-hover/title:text-brand transition-colors break-words">
                            {acc.name}
                          </h3>
                          {acc.type === "funded" && <PhaseChip phase={acc.phase ?? "eval"} />}
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

          {/* Target Progress */}
          {target && <TargetProgress status={target} />}

          {/* Drawdown Progress */}
          {dd && <DrawdownProgress status={dd} threshold={600} />}
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
      subtitle="Supervisa el capital, control de drawdown y evolución de tus cuentas de fondeo y personales"
      actions={
        <AccountDialog
          trigger={
            <Button className="gap-1.5 shadow-xs">
              <Plus className="size-4" /> Nueva cuenta
            </Button>
          }
        />
      }
    >
      <div className="space-y-6">
        {/* KPI Hero Counters */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel flex items-center gap-3 p-4 rounded-2xl">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Capital Total Gestionado</p>
              <p className="num text-lg font-bold">{formatCurrency(grandTotals.current)}</p>
              <p className="text-[11px] text-muted-foreground">
                Base inicial: {formatCurrency(grandTotals.initial)}
              </p>
            </div>
          </div>

          <div className="panel flex items-center gap-3 p-4 rounded-2xl">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Resultado Global PnL</p>
              <p
                className={cn(
                  "num text-lg font-bold",
                  grandTotals.result >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {formatCurrency(grandTotals.result, true)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Rentabilidad: {grandTotals.pnlPct >= 0 ? "+" : ""}
                {grandTotals.pnlPct.toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="panel flex items-center gap-3 p-4 rounded-2xl">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Building2 className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cuentas de Fondeo</p>
              <p className="text-lg font-bold">
                {funded.length}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({liveFundedCount} live / {evalFundedCount} eval)
                </span>
              </p>
              <p className="num text-[11px] text-muted-foreground">
                Cap: {formatCurrency(fundedTotals.current)}
              </p>
            </div>
          </div>

          <div className="panel flex items-center gap-3 p-4 rounded-2xl">
            <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
              <User className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cuentas Personales</p>
              <p className="text-lg font-bold">{personal.length}</p>
              <p className="num text-[11px] text-muted-foreground">
                Cap: {formatCurrency(personalTotals.current)}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Pills & View Mode Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
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
              Todas ({accounts.length})
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
              Fondeo ({funded.length})
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
              Personales ({personal.length})
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

        {/* Account Cards Presentation */}
        {displayedAccounts.length === 0 ? (
          <div className="panel p-10 text-center space-y-4 rounded-2xl">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <Wallet className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold">No hay cuentas para mostrar</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "No se encontraron cuentas que coincidan con tu búsqueda."
                  : "Crea una cuenta de fondeo o personal para comenzar a registrar tus operaciones y controlar el drawdown."}
              </p>
            </div>
            <div className="pt-2">
              <AccountDialog
                trigger={
                  <Button className="gap-1.5 shadow-xs">
                    <Plus className="size-4" /> Crear mi primera cuenta
                  </Button>
                }
              />
            </div>
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
    </AppShell>
  );
}
