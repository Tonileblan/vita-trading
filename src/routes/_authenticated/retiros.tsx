import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
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
import { formatCurrency } from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/retiros")({
  head: () => ({
    meta: [
      { title: "Retiros — Bitácora de trading" },
      {
        name: "description",
        content:
          "Registra los retiros de capital por estrategia. Restan del capital pero no cuentan como pérdida operativa.",
      },
      { property: "og:title", content: "Retiros de capital" },
      {
        property: "og:description",
        content: "Control de payouts y retiros por estrategia, separados del resultado operativo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RetirosPage,
});

function RetirosPage() {
  const { accounts, withdrawals, addWithdrawal } = useJournal();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const total = withdrawals.reduce((s, w) => s + w.amount, 0);

  const submit = () => {
    const value = Number(amount);
    if (!accountId || !value || value <= 0) {
      toast.error("Indica cuenta y un importe válido");
      return;
    }
    addWithdrawal({
      accountId,
      date: new Date(date).toISOString(),
      amount: value,
      reason: reason || undefined,
    });
    setAmount("");
    setReason("");
    toast.success("Retiro registrado");
  };

  const accName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? "—";

  const byAccount = useMemo(
    () =>
      accounts.map((a) => ({
        account: a,
        total: withdrawals
          .filter((w) => w.accountId === a.id)
          .reduce((acc, w) => acc + w.amount, 0),
      })),
    [accounts, withdrawals],
  );

  return (
    <AppShell
      title="Retiros"
      subtitle="Se restan del capital pero NO cuentan como pérdida operativa"
      showAccountPanel={false}
    >
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="panel min-w-0 overflow-x-auto p-4">
          <h2 className="mb-3 text-base font-semibold">Registro de retiros</h2>
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 text-left">Fecha</th>
                <th className="py-2 text-left">Cuenta</th>
                <th className="py-2 text-left">Estrategia</th>
                <th className="py-2 text-right">Monto</th>
                <th className="py-2 text-left">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    Todavía no hay retiros registrados.
                  </td>
                </tr>
              )}
              {withdrawals.map((w) => (
                <tr key={w.id} className="border-b border-border/60">
                  <td className="py-2 tabular-nums">
                    {new Date(w.date).toLocaleDateString("es-ES", { timeZone: "UTC" })}
                  </td>
                  <td className="py-2">{accName(w.accountId)}</td>
                  <td className="py-2">{name(w.strategyId)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(w.amount)}</td>
                  <td className="py-2 text-muted-foreground">{w.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="space-y-5">
          <section className="panel space-y-3 p-4">
            <h2 className="text-base font-semibold">Nuevo retiro</h2>
            <div className="space-y-2">
              <Label>Cuenta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estrategia</Label>
              <Select value={strategyId} onValueChange={setStrategyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {strategies.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Monto ($)</Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="1000"
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Payout, gastos…"
              />
            </div>
            <Button className="w-full" onClick={submit}>
              Registrar retiro
            </Button>
          </section>

          <section className="panel p-4">
            <h2 className="mb-3 text-base font-semibold">Resumen por cuenta</h2>
            <ul className="mb-4 space-y-2 text-sm">
              {byAccount.map((x) => (
                <li key={x.account.id} className="flex justify-between">
                  <span className="text-muted-foreground">{x.account.name}</span>
                  <span className="tabular-nums">{formatCurrency(x.total)}</span>
                </li>
              ))}
            </ul>
            <h2 className="mb-3 text-base font-semibold">Resumen por estrategia</h2>
            <ul className="space-y-2 text-sm">
              {byStrategy.map((x) => (
                <li key={x.strategy.id} className="flex justify-between">
                  <span className="text-muted-foreground">{x.strategy.name}</span>
                  <span className="tabular-nums">{formatCurrency(x.total)}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(total)}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
