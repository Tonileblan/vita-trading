import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Pencil, Plus, Trash2, User } from "lucide-react";
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
import { accountBalance, accountResult, computeMetrics, formatCurrency, accountDrawdown } from "@/lib/metrics";
import { PROP_FIRMS, BROKERS, type Account, type AccountType, DRAWDOWN_TYPES, type DrawdownType } from "@/lib/types";
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

function AccountDialog({ account, trigger }: { account?: Account; trigger: React.ReactNode }) {
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
    }
  };

  const submit = () => {
    if (!name.trim()) {
      toast.error("Añade un nombre de cuenta");
      return;
    }
    const payload = {
      name: name.trim(),
      type,
      firm: type === "funded" ? firm : undefined,
      broker: type === "personal" ? broker : undefined,
      initialBalance: Number(initial) || 0,
      currentBalance: Number(current) || 0,
      drawdownLimit: type === "funded" ? Number(dd) || 0 : undefined,
      drawdownType: type === "funded" ? ddType : undefined,
      currency: account?.currency ?? "USD",
    };
    if (account) {
      updateAccount(account.id, payload);
      toast.success("Cuenta actualizada");
    } else {
      addAccount(payload);
      toast.success("Cuenta creada");
      setName("");
    }
    setOpen(false);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cuenta" : "Crear cuenta"}</DialogTitle>
          <DialogDescription>Elige el tipo y define los parámetros de riesgo.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
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
                  "flex items-center gap-2 rounded-md border px-3 py-3 text-sm font-medium transition-colors",
                  type === opt.key
                    ? "border-brand bg-brand/10 text-brand-soft"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <opt.icon className="size-4" />
                {opt.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Nombre de la cuenta</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Apex 100K — Eval"
            />
          </div>

          {type === "funded" && (
            <div className="space-y-2">
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
              <div className="flex gap-2">
                <Input
                  value={newFirm}
                  onChange={(e) => setNewFirm(e.target.value)}
                  placeholder="Añadir otra prop firm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddFirm();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddFirm}>
                  Añadir
                </Button>
              </div>
              {customFirms.includes(firm) && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
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
            <div className="space-y-2">
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
              <div className="flex gap-2">
                <Input
                  value={newBroker}
                  onChange={(e) => setNewBroker(e.target.value)}
                  placeholder="Añadir otro broker"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddBroker();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddBroker}>
                  Añadir
                </Button>
              </div>
              {customBrokers.includes(broker) && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
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
            <div className="space-y-2">
              <Label>Balance inicial</Label>
              <Input
                value={initial}
                onChange={(e) => {
                  setInitial(e.target.value);
                  if (!editing) setCurrent(e.target.value);
                }}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label>Balance actual</Label>
              <Input value={current} onChange={(e) => setCurrent(e.target.value)} inputMode="decimal" />
            </div>
          </div>


          {type === "funded" && (
            <>
              <div className="space-y-2">
                <Label>Límite de drawdown</Label>
                <Input value={dd} onChange={(e) => setDd(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de drawdown</Label>
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
                <p className="text-xs text-muted-foreground">
                  {DRAWDOWN_TYPES.find((d) => d.key === ddType)?.help}
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {editing ? (
            <Button variant="destructive" onClick={remove}>
              <Trash2 className="size-4" /> Eliminar
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
  const { accounts, trades, withdrawals } = useJournal();
  const funded = accounts.filter((a) => a.type === "funded");
  const personal = accounts.filter((a) => a.type === "personal");

  const Card = ({ id }: { id: string }) => {
    const acc = accounts.find((a) => a.id === id)!;
    const accTrades = trades.filter((t) => t.accountId === id);
    const m = computeMetrics(accTrades);
    const result = accountResult(acc, trades, withdrawals);
    const balance = accountBalance(acc, trades, withdrawals);
    const dd = accountDrawdown(acc, trades, withdrawals);

    return (
      <div className="panel p-4">
        <div className="flex items-start justify-between gap-3">
          <Link
            to="/cuenta/$accountId"
            params={{ accountId: acc.id }}
            className="min-w-0 flex-1 group"
          >
            <h3 className="truncate font-semibold group-hover:text-brand">{acc.name}</h3>
              <p className="text-xs text-muted-foreground">
                {acc.type === "funded"
                  ? (acc.firm ?? "Prop firm")
                  : (acc.broker ?? "Cuenta personal")}{" "}
                · {acc.currency}
              </p>
          </Link>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "num rounded-md px-2 py-1 text-sm font-bold",
                 result >= 0 ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
              )}
            >
               {formatCurrency(result, true)}
            </span>
            <AccountDialog
              account={acc}
              trigger={
                <Button variant="ghost" size="icon" aria-label={`Editar ${acc.name}`}>
                  <Pencil className="size-4" />
                </Button>
              }
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Inicial</p>
            <p className="num font-semibold">{formatCurrency(acc.initialBalance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Actual</p>
            <p className="num font-semibold">{formatCurrency(balance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Win rate</p>
            <p className="num font-semibold">{m.winRate.toFixed(1)}%</p>
          </div>
        </div>

        {dd && (
          <div className="mt-4">
            <div className="flex flex-wrap justify-between gap-x-2 text-xs text-muted-foreground">
              <span>Drawdown {dd.label.toLowerCase()}</span>
              <span className="num">
                {formatCurrency(dd.used)} / {formatCurrency(dd.limit)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full", dd.pct > 70 ? "bg-loss" : "bg-brand")}
                style={{ width: `${dd.pct}%` }}
              />
            </div>
            <p
              className={cn(
                "mt-1 text-xs",
                dd.breached ? "font-semibold text-loss" : "text-muted-foreground",
              )}
            >
              {dd.breached
                ? `Cuenta rota: límite en ${formatCurrency(dd.floor)}`
                : `Puedes perder ${formatCurrency(dd.remaining)} más (suelo ${formatCurrency(dd.floor)})`}
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {m.total} operaciones · Profit factor{" "}
            <span className="num">
              {Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "∞"}
            </span>
          </span>
          <Link
            to="/cuenta/$accountId"
            params={{ accountId: acc.id }}
            className="font-semibold text-brand hover:underline"
          >
            Ver cuenta →
          </Link>
        </div>
      </div>
    );
  };

  const sum = (list: typeof accounts) => ({
    initial: list.reduce((s, a) => s + a.initialBalance, 0),
    current: list.reduce((s, a) => s + accountBalance(a, trades, withdrawals), 0),
  });
  const fundedTotals = sum(funded);
  const realTotals = sum(personal);

  const CapitalBlock = ({
    label,
    icon,
    totals,
    count,
  }: {
    label: string;
    icon: React.ReactNode;
    totals: { initial: number; current: number };
    count: number;
  }) => (
    <div className="panel p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label} · {count}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Capital inicial</p>
          <p className="num font-semibold">{formatCurrency(totals.initial)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Capital total</p>
          <p className="num font-semibold">{formatCurrency(totals.current)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Resultado</p>
          <p
            className={cn(
              "num font-semibold",
              totals.current - totals.initial >= 0 ? "text-profit" : "text-loss",
            )}
          >
            {formatCurrency(totals.current - totals.initial, true)}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <AppShell
      title="Gestión de Cuentas"
      subtitle="Cuentas de fondeo y personales"
      actions={
        <AccountDialog
          trigger={
            <Button>
              <Plus className="size-4" /> Nueva cuenta
            </Button>
          }
        />
      }
    >
      <div className="space-y-8">
        <section className="grid gap-3 md:grid-cols-2">
          <CapitalBlock
            label="Capital fondeo"
            icon={<Building2 className="size-4" />}
            totals={fundedTotals}
            count={funded.length}
          />
          <CapitalBlock
            label="Capital real"
            icon={<User className="size-4" />}
            totals={realTotals}
            count={personal.length}
          />
        </section>


        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Building2 className="size-4" /> Cuentas de fondeo
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {funded.map((a) => (
              <Card key={a.id} id={a.id} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <User className="size-4" /> Cuentas personales
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {personal.map((a) => (
              <Card key={a.id} id={a.id} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
