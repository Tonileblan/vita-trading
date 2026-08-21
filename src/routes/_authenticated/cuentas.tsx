import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Building2,
  DollarSign,
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
import { usePropFirms } from "@/lib/prop-firms";
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

function parseMoneyInput(value: string) {
  const normalized = value.trim().replace(/\s/g, "");
  if (!normalized) return Number.NaN;

  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    const thousands = decimal === "," ? /\./g : /,/g;
    return Number(normalized.replace(thousands, "").replace(decimal, "."));
  }

  const separator = comma >= 0 ? "," : dot >= 0 ? "." : null;
  if (!separator) return Number(normalized);
  const parts = normalized.split(separator);
  if (parts.length > 2 || parts.some((part) => part === "")) return Number.NaN;
  const digitsAfter = parts[1]?.length ?? 0;
  return Number(digitsAfter === 3 ? parts.join("") : parts.join("."));
}

function AccountDialog({
  account,
  trigger,
}: {
  account?: Account | undefined;
  trigger: React.ReactNode;
}) {
  const { addAccount, updateAccount, removeAccount } = useJournal();
  const editing = Boolean(account);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AccountType>(account?.type ?? "funded");
  const [name, setName] = useState(account?.name ?? "");
  const { firms, customFirms, addFirm, removeFirm } = usePropFirms();
  const [newFirm, setNewFirm] = useState("");
  const [firm, setFirm] = useState(account?.firm ?? PROP_FIRMS[0]!);
  const handleAddFirm = () => {
    const added = addFirm(newFirm);
    if (!added) return;
    setFirm(added);
    setNewFirm("");
  };
  const { brokers, customBrokers, addBroker, removeBroker } = useBrokers();
  const [newBroker, setNewBroker] = useState("");
  const [broker, setBroker] = useState(account?.broker ?? BROKERS[0]!);
  const handleAddBroker = () => {
    const added = addBroker(newBroker);
    if (!added) return;
    setBroker(added);
    setNewBroker("");
  };
  const [initial, setInitial] = useState(String(account?.initialBalance ?? 50000));
  const [current, setCurrent] = useState(String(account?.currentBalance ?? 50000));

  const [dd, setDd] = useState(String(account?.drawdownLimit ?? 2500));
  const [ddType, setDdType] = useState<DrawdownType>(account?.drawdownType ?? "static");
  const [phase, setPhase] = useState<AccountPhase>(account?.phase ?? "eval");
  const [target, setTarget] = useState(account?.profitTarget ? String(account.profitTarget) : "");

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v && account) {
      setType(account.type);
      setName(account.name);
      setFirm(account.firm ?? PROP_FIRMS[0]!);
      setBroker(account.broker ?? BROKERS[0]!);
      setInitial(String(account.initialBalance));
      setCurrent(String(account.currentBalance));

      setDd(String(account.drawdownLimit ?? 0));
      setDdType(account.drawdownType ?? "static");
      setPhase(account.phase ?? "eval");
      setTarget(account.profitTarget ? String(account.profitTarget) : "");
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Añade un nombre de cuenta");
      return;
    }
    const initialBalance = parseMoneyInput(initial);
    const currentBalance = parseMoneyInput(current);
    if (!Number.isFinite(initialBalance) || !Number.isFinite(currentBalance)) {
      toast.error("Revisa los balances introducidos");
      return;
    }

    const payload = {
      name: name.trim(),
      type,
      firm: type === "funded" ? firm : undefined,
      broker: type === "personal" ? broker : undefined,
      initialBalance,
      currentBalance,
      drawdownLimit: type === "funded" ? Number(dd) || 0 : undefined,
      drawdownType: type === "funded" ? ddType : undefined,
      phase: type === "funded" ? phase : undefined,
      profitTarget:
        type === "funded" && Number.isFinite(parseMoneyInput(target)) && parseMoneyInput(target) > 0
          ? parseMoneyInput(target)
          : undefined,
      currency: account?.currency ?? "USD",
    };
    try {
      if (account) {
        await updateAccount(account.id, payload);
        toast.success("Cuenta actualizada");
      } else {
        await addAccount(payload);
        toast.success("Cuenta creada");
        setName("");
      }
      setOpen(false);
    } catch {
      toast.error("No se pudo guardar la cuenta");
    }
  };

  const remove = () => {
    if (!account) return;
    removeAccount(account.id);
    toast.success("Cuenta eliminada");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cuenta" : "Crear nueva cuenta"}</DialogTitle>
          <DialogDescription>
            Configura el tipo de cuenta, capital inicial y límites de riesgo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: "funded", label: "Cuenta de Fondeo", icon: Building2 },
                { key: "personal", label: "Cuenta Personal", icon: User },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setType(opt.key)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all",
                  type === opt.key
                    ? "border-brand bg-brand/10 text-brand shadow-xs"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <opt.icon className="size-4" />
                {opt.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="acc-name">Nombre de la cuenta</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Apex 50K PA / FTMO 100K Eval"
            />
          </div>

          {type === "funded" && (
            <div className="space-y-1.5">
              <Label>Prop Firm</Label>
              <Select value={firm} onValueChange={setFirm}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {firms.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 pt-1">
                <Input
                  value={newFirm}
                  onChange={(e) => setNewFirm(e.target.value)}
                  placeholder="Otra prop firm personalizada"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddFirm();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddFirm}>
                  Añadir
                </Button>
              </div>
              {customFirms.includes(firm) && (
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => {
                    removeFirm(firm);
                    setFirm(PROP_FIRMS[0]!);
                  }}
                >
                  Eliminar "{firm}" de la lista
                </button>
              )}
            </div>
          )}

          {type === "personal" && (
            <div className="space-y-1.5">
              <Label>Broker</Label>
              <Select value={broker} onValueChange={setBroker}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {brokers.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 pt-1">
                <Input
                  value={newBroker}
                  onChange={(e) => setNewBroker(e.target.value)}
                  placeholder="Otro broker personalizado"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddBroker();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddBroker}>
                  Añadir
                </Button>
              </div>
              {customBrokers.includes(broker) && (
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => {
                    removeBroker(broker);
                    setBroker(BROKERS[0]!);
                  }}
                >
                  Eliminar "{broker}" de la lista
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-init">Balance inicial</Label>
              <Input
                id="acc-init"
                value={initial}
                onChange={(e) => {
                  setInitial(e.target.value);
                  if (!editing) setCurrent(e.target.value);
                }}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-curr">Balance actual</Label>
              <Input
                id="acc-curr"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>

          {type === "funded" && (
            <>
              <div className="space-y-1.5">
                <Label>Fase de la cuenta</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ACCOUNT_PHASES.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPhase(p.key)}
                      className={cn(
                        "rounded-xl border p-2.5 text-xs font-semibold transition-all",
                        phase === p.key
                          ? "border-brand bg-brand/10 text-brand shadow-xs"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="acc-target">
                  {phase === "live" ? "Objetivo para retiro ($)" : "Objetivo de evaluación ($)"}
                </Label>
                <Input
                  id="acc-target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ej. 53000"
                />
                <p className="text-[11px] text-muted-foreground">
                  {ACCOUNT_PHASES.find((p) => p.key === phase)?.help}
                  {(() => {
                    const t = parseMoneyInput(target);
                    const base = parseMoneyInput(initial);
                    if (!Number.isFinite(t) || !Number.isFinite(base) || !base || t <= base)
                      return null;
                    return ` (+${(((t - base) / base) * 100).toFixed(1)}% sobre el inicial)`;
                  })()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="acc-dd">Límite de Drawdown ($)</Label>
                  <Input
                    id="acc-dd"
                    value={dd}
                    onChange={(e) => setDd(e.target.value)}
                    inputMode="decimal"
                    placeholder="2500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de Drawdown</Label>
                  <Select value={ddType} onValueChange={(v) => setDdType(v as DrawdownType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DRAWDOWN_TYPES.map((d) => (
                        <SelectItem key={d.key} value={d.key}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-between pt-2">
          {editing ? (
            <Button variant="destructive" onClick={remove} className="gap-1.5">
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit}>{editing ? "Guardar cambios" : "Crear cuenta"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountsPage() {
  const { accounts = [], trades = [], withdrawals = [] } = useJournal();
  const [filterType, setFilterType] = useState<"all" | "funded" | "personal">("all");

  const safeAccounts = accounts || [];
  const safeTrades = trades || [];
  const safeWithdrawals = withdrawals || [];

  const funded = useMemo(() => safeAccounts.filter((a) => a.type === "funded"), [safeAccounts]);
  const personal = useMemo(() => safeAccounts.filter((a) => a.type === "personal"), [safeAccounts]);

  const displayedAccounts = useMemo(() => {
    if (filterType === "funded") return funded;
    if (filterType === "personal") return personal;
    return safeAccounts;
  }, [safeAccounts, funded, personal, filterType]);

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

  const AccountCard = ({ acc }: { acc: Account }) => {
    const accTrades = safeTrades.filter((t) => t.accountId === acc.id);
    const m = computeMetrics(accTrades);
    const result = accountResult(acc, safeTrades, safeWithdrawals);
    const balance = accountBalance(acc, safeTrades, safeWithdrawals);
    const dd = accountDrawdown(acc, safeTrades, safeWithdrawals);
    const target = accountTarget(acc, safeTrades, safeWithdrawals);

    const isLowDrawdown =
      acc.type === "funded" &&
      Boolean(acc.drawdownLimit) &&
      dd !== null &&
      (dd.remaining < 600 || dd.breached);

    return (
      <article
        className={cn(
          "panel flex flex-col justify-between p-5 transition-all hover:border-foreground/20",
          isLowDrawdown && "border-loss/40 hover:border-loss/60 shadow-xs",
        )}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <Link
              to="/cuenta/$accountId"
              params={{ accountId: acc.id }}
              className="min-w-0 flex-1 group"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold group-hover:text-brand transition-colors break-words">
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
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                {acc.type === "funded"
                  ? `${acc.firm ?? "Prop firm"} — ${formatCurrency(acc.initialBalance)}`
                  : `${acc.broker ?? "Cuenta personal"} — ${formatCurrency(acc.initialBalance)}`}
              </p>
            </Link>

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
                  "num rounded-lg px-2.5 py-0.5 text-xs font-bold font-mono whitespace-nowrap",
                  result >= 0
                    ? "bg-profit/15 text-profit border border-profit/20"
                    : "bg-loss/15 text-loss border border-loss/20",
                )}
              >
                {formatCurrency(result, true)}
              </span>
            </div>
          </div>

          {/* 3 Metric Grid */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/80 bg-muted/30 p-2.5 text-center">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Inicial</p>
              <p className="num text-xs font-bold font-mono text-foreground">
                {formatCurrency(acc.initialBalance)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Actual</p>
              <p className="num text-xs font-bold font-mono text-foreground">{formatCurrency(balance)}</p>
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
          <Link
            to="/cuenta/$accountId"
            params={{ accountId: acc.id }}
            className="font-bold text-brand hover:underline"
          >
            Ver cuenta →
          </Link>
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
            <Button className="gap-1.5">
              <Plus className="size-4" /> Nueva cuenta
            </Button>
          }
        />
      }
    >
      <div className="space-y-6">
        {/* KPI Hero Counters */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel flex items-center gap-3 p-4">
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

          <div className="panel flex items-center gap-3 p-4">
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

          <div className="panel flex items-center gap-3 p-4">
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

          <div className="panel flex items-center gap-3 p-4">
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

        {/* Filter Pills Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
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
        </div>

        {/* Account Cards Grid */}
        {displayedAccounts.length === 0 ? (
          <div className="panel p-10 text-center space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <Wallet className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold">No hay cuentas para mostrar</h3>
              <p className="text-sm text-muted-foreground">
                Crea una cuenta de fondeo o personal para comenzar a registrar tus operaciones y
                controlar el drawdown.
              </p>
            </div>
            <div className="pt-2">
              <AccountDialog
                trigger={
                  <Button className="gap-1.5">
                    <Plus className="size-4" /> Crear mi primera cuenta
                  </Button>
                }
              />
            </div>
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
