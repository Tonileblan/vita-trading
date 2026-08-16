import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { accountTarget, formatCurrency } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type { Withdrawal, WithdrawalStatus } from "@/lib/types";

export function WithdrawalFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Withdrawal | null;
}) {
  const { accounts, trades, withdrawals, addWithdrawal, updateWithdrawal } = useJournal();

  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<WithdrawalStatus>("pending");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setAccountId(editing.accountId ?? "");
      setDate(editing.date.slice(0, 10));
      setAmount(String(editing.amount));
      setReason(editing.reason ?? "");
      setStatus(editing.status);
    } else {
      setAccountId(accounts[0]?.id ?? "");
      setDate(new Date().toISOString().slice(0, 10));
      setAmount("");
      setReason("");
      setStatus("pending");
    }
  }, [open, editing, accounts]);

  async function submit() {
    const value = Number(amount);
    if (!accountId || !value || value <= 0) {
      toast.error("Indica cuenta y un importe válido");
      return;
    }
    try {
      const now = new Date().toISOString();
      if (editing) {
        await updateWithdrawal(editing.id, {
          accountId,
          date: new Date(`${date}T12:00:00`).toISOString(),
          amount: value,
          reason: reason || undefined,
          status,
          approvedAt: status === "approved" ? now : undefined,
        });
        toast.success("Retiro actualizado");
      } else {
        await addWithdrawal({
          accountId,
          date: new Date(`${date}T12:00:00`).toISOString(),
          amount: value,
          reason: reason || undefined,
          status,
          requestedAt: status === "pending" ? now : undefined,
          approvedAt: status === "approved" ? now : undefined,
        });
        toast.success(status === "pending" ? "Retiro solicitado (pendiente)" : "Retiro registrado");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el retiro");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar retiro" : "Nuevo retiro"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
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

          {(() => {
            const acc = accounts.find((a) => a.id === accountId);
            const status = acc ? accountTarget(acc, trades, withdrawals) : null;
            if (!status || status.phase !== "live" || status.reached) return null;
            return (
              <p className="rounded-md border border-border bg-accent px-3 py-2 text-xs text-muted-foreground">
                Esta cuenta aún no alcanza el objetivo de retiro: faltan{" "}
                <span className="num font-semibold">{formatCurrency(status.remaining)}</span>.
              </p>
            );
          })()}

          <div className="space-y-2">
            <Label>Estado</Label>
            <div className="flex gap-2">
              {(
                [
                  ["pending", "Solicitado"],
                  ["approved", "Aprobado"],
                ] as [WithdrawalStatus, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors",
                    status === key
                      ? "border-brand bg-brand/15 text-brand-soft"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="w-date">Fecha</Label>
              <Input
                id="w-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="w-amount">Monto ($)</Label>
              <Input
                id="w-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="w-reason">Motivo</Label>
            <Input
              id="w-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Payout, gastos…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>
            {status === "pending" ? "Solicitar retiro" : "Registrar retiro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
