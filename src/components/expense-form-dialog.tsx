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
import { Textarea } from "@/components/ui/textarea";
import { useJournal } from "@/lib/journal-store";
import {
  EXPENSE_CATEGORIES,
  RECURRENCES,
  useSaveExpense,
  type Expense,
  type ExpenseCategory,
  type Recurrence,
} from "@/lib/expenses";
import { cn } from "@/lib/utils";

const toInput = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export function ExpenseFormDialog({
  open,
  onOpenChange,
  editing,
  defaultJournalId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Expense | null;
  defaultJournalId: string;
}) {
  const { accounts } = useJournal();
  const save = useSaveExpense();

  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("subscription");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [recurrenceEnd, setRecurrenceEnd] = useState("");
  const [scope, setScope] = useState<"journal" | "general">("journal");
  const [accountId, setAccountId] = useState("");
  const [paid, setPaid] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setConcept(editing.concept);
      setAmount(String(editing.amount));
      setCategory(editing.category);
      setDate(toInput(editing.date));
      setRecurrence(editing.recurrence);
      setRecurrenceEnd(editing.recurrence_end ? toInput(editing.recurrence_end) : "");
      setScope(editing.journal_id ? "journal" : "general");
      setAccountId(editing.account_id ?? "");
      setPaid(editing.paid);
      setNotes(editing.notes ?? "");
    } else {
      setConcept("");
      setAmount("");
      setCategory("subscription");
      setDate(new Date().toISOString().slice(0, 10));
      setRecurrence("none");
      setRecurrenceEnd("");
      setScope("journal");
      setAccountId("");
      setPaid(true);
      setNotes("");
    }
  }, [open, editing]);

  async function submit() {
    if (!concept.trim() || !amount) {
      toast.error("Completa concepto e importe");
      return;
    }
    try {
      await save.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        concept: concept.trim(),
        amount: Math.abs(Number(amount)) || 0,
        category,
        currency: "EUR",
        date: new Date(`${date}T12:00:00`).toISOString(),
        recurrence,
        recurrence_end: recurrenceEnd ? new Date(`${recurrenceEnd}T12:00:00`).toISOString() : null,
        journal_id: scope === "journal" ? defaultJournalId || null : null,
        account_id: accountId || null,
        paid,
        notes: notes.trim() || null,
      });
      toast.success(editing ? "Costo actualizado" : "Costo registrado");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el costo");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar costo" : "Nuevo costo"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Categoría</Label>
            <div className="flex flex-wrap gap-2">
              {EXPENSE_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  title={c.help}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    category === c.key
                      ? "border-brand bg-brand/15 text-brand-soft"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="x-concept">Concepto</Label>
            <Input
              id="x-concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Evaluación 50K Topstep, TradingView Pro…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="x-amount">Importe (€)</Label>
            <Input
              id="x-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="49.90"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="x-date">Fecha</Label>
            <Input
              id="x-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Periodicidad</Label>
            <div className="flex gap-2">
              {RECURRENCES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRecurrence(r.key)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors",
                    recurrence === r.key
                      ? "border-brand bg-brand/15 text-brand-soft"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="x-end">Hasta (opcional)</Label>
            <Input
              id="x-end"
              type="date"
              disabled={recurrence === "none"}
              value={recurrenceEnd}
              onChange={(e) => setRecurrenceEnd(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Ámbito</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScope("journal")}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors",
                  scope === "journal"
                    ? "border-brand bg-brand/15 text-brand-soft"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                Este diario
              </button>
              <button
                type="button"
                onClick={() => {
                  setScope("general");
                  setAccountId("");
                }}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors",
                  scope === "general"
                    ? "border-brand bg-brand/15 text-brand-soft"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                General
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="x-account">Cuenta enlazada</Label>
            <select
              id="x-account"
              disabled={scope === "general"}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm disabled:opacity-50"
            >
              <option value="">Sin cuenta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Estado</Label>
            <Button
              type="button"
              variant={paid ? "default" : "outline"}
              className="w-full"
              onClick={() => setPaid(!paid)}
            >
              {paid ? "Pagado" : "Previsto"}
            </Button>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="x-notes">Notas</Label>
            <Textarea
              id="x-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
