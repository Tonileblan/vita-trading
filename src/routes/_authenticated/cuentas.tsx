import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Plus, User } from "lucide-react";
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
import { computeMetrics, formatCurrency } from "@/lib/metrics";
import { PROP_FIRMS, type AccountType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cuentas")({
  head: () => ({
    meta: [
      { title: "Gestión de cuentas — TONITRADING" },
      {
        name: "description",
        content: "Administra cuentas de fondeo y personales: balance, drawdown y rendimiento.",
      },
      { property: "og:title", content: "Gestión de cuentas — TONITRADING" },
      {
        property: "og:description",
        content: "Cuentas de prop firm y personales con control de drawdown en tiempo real.",
      },
    ],
  }),
  component: AccountsPage,
});

function NewAccountDialog() {
  const { addAccount } = useJournal();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AccountType>("funded");
  const [name, setName] = useState("");
  const [firm, setFirm] = useState(PROP_FIRMS[0]!);
  const [initial, setInitial] = useState("50000");
  const [current, setCurrent] = useState("50000");
  const [dd, setDd] = useState("2500");

  const submit = () => {
    if (!name.trim()) {
      toast.error("Añade un nombre de cuenta");
      return;
    }
    addAccount({
      name: name.trim(),
      type,
      firm: type === "funded" ? firm : undefined,
      initialBalance: Number(initial) || 0,
      currentBalance: Number(current) || Number(initial) || 0,
      drawdownLimit: type === "funded" ? Number(dd) || 0 : undefined,
      currency: "USD",
    });
    toast.success("Cuenta creada");
    setOpen(false);
    setName("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nueva cuenta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear cuenta</DialogTitle>
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
                <SelectContent>
                  {PROP_FIRMS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Balance inicial</Label>
              <Input value={initial} onChange={(e) => setInitial(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-2">
              <Label>Balance actual</Label>
              <Input value={current} onChange={(e) => setCurrent(e.target.value)} inputMode="decimal" />
            </div>
          </div>

          {type === "funded" && (
            <div className="space-y-2">
              <Label>Límite de drawdown</Label>
              <Input value={dd} onChange={(e) => setDd(e.target.value)} inputMode="decimal" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Crear cuenta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountsPage() {
  const { accounts, trades } = useJournal();
  const funded = accounts.filter((a) => a.type === "funded");
  const personal = accounts.filter((a) => a.type === "personal");

  const Card = ({ id }: { id: string }) => {
    const acc = accounts.find((a) => a.id === id)!;
    const accTrades = trades.filter((t) => t.accountId === id);
    const m = computeMetrics(accTrades);
    const pnl = acc.currentBalance - acc.initialBalance;
    const ddUsed =
      acc.drawdownLimit && pnl < 0 ? Math.min(100, (Math.abs(pnl) / acc.drawdownLimit) * 100) : 0;

    return (
      <div className="panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{acc.name}</h3>
            <p className="text-xs text-muted-foreground">
              {acc.firm ?? "Cuenta personal"} · {acc.currency}
            </p>
          </div>
          <span
            className={cn(
              "num rounded-md px-2 py-1 text-sm font-bold",
              pnl >= 0 ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
            )}
          >
            {formatCurrency(pnl, true)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Inicial</p>
            <p className="num font-semibold">{formatCurrency(acc.initialBalance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Actual</p>
            <p className="num font-semibold">{formatCurrency(acc.currentBalance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Win rate</p>
            <p className="num font-semibold">{m.winRate.toFixed(1)}%</p>
          </div>
        </div>

        {acc.drawdownLimit && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Drawdown usado</span>
              <span className="num">
                {formatCurrency(Math.max(0, -pnl))} / {formatCurrency(acc.drawdownLimit)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full", ddUsed > 70 ? "bg-loss" : "bg-brand")}
                style={{ width: `${ddUsed}%` }}
              />
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          {m.total} operaciones · Profit factor{" "}
          <span className="num">{Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "∞"}</span>
        </p>
      </div>
    );
  };

  return (
    <AppShell
      title="Gestión de Cuentas"
      subtitle="Cuentas de fondeo y personales"
      actions={<NewAccountDialog />}
    >
      <div className="space-y-8">
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
