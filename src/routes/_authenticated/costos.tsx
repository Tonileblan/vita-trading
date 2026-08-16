import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ExpenseBreakdown } from "@/components/expense-breakdown";
import { ExpenseFormDialog } from "@/components/expense-form-dialog";
import { ExpensesTable } from "@/components/expenses-table";
import { useJournal } from "@/lib/journal-store";
import { formatCurrency } from "@/lib/metrics";
import {
  expand,
  fixedMonthlyCost,
  inMonth,
  inYear,
  total as sumOcc,
} from "@/lib/expense-metrics";
import { useDeleteExpense, useExpenses, type Expense } from "@/lib/expenses";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/costos")({
  head: () => ({
    meta: [
      { title: "Costos y rentabilidad neta — Vita-Trading" },
      {
        name: "description",
        content:
          "Controla el gasto real de tu operativa: cuentas PropFirm, suscripciones, hardware e impuestos, y calcula tu rentabilidad neta.",
      },
      { property: "og:title", content: "Costos y rentabilidad neta" },
      {
        property: "og:description",
        content: "Gastos de la operativa frente al PnL bruto: resultado neto, punto de equilibrio y ROI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CostosPage,
});

type Scope = "all" | "journal" | "general";

function CostosPage() {
  const { accounts, visibleTrades, withdrawals, activeJournalId } = useJournal();
  const { data: expenses = [], isLoading } = useExpenses();
  const remove = useDeleteExpense();

  const [scope, setScope] = useState<Scope>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const filtered = useMemo(() => {
    if (scope === "journal") return expenses.filter((e) => e.journal_id === activeJournalId);
    if (scope === "general") return expenses.filter((e) => !e.journal_id);
    return expenses.filter((e) => !e.journal_id || e.journal_id === activeJournalId);
  }, [expenses, scope, activeJournalId]);

  const occurrences = useMemo(() => expand(filtered), [filtered]);

  // Ingreso real: de las cuentas de fondeo solo cuenta el dinero retirado (payouts);
  // de las cuentas reales cuentan las ganancias de la operativa.
  const fundedIds = useMemo(
    () => new Set(accounts.filter((a) => a.type === "funded").map((a) => a.id)),
    [accounts],
  );
  const realIds = useMemo(
    () => new Set(accounts.filter((a) => a.type === "personal").map((a) => a.id)),
    [accounts],
  );

  const payouts = useMemo(
    () =>
      withdrawals
        .filter((w) => w.accountId && fundedIds.has(w.accountId))
        .reduce((s, w) => s + w.amount, 0),
    [withdrawals, fundedIds],
  );
  const realPnl = useMemo(
    () =>
      visibleTrades
        .filter((t) => t.accountId && realIds.has(t.accountId))
        .reduce((s, t) => s + t.pnl, 0),
    [visibleTrades, realIds],
  );

  const income = payouts + realPnl;
  const totalCost = sumOcc(occurrences);
  const monthCost = sumOcc(inMonth(occurrences));
  const yearCost = sumOcc(inYear(occurrences));
  const fixedMonthly = fixedMonthlyCost(filtered);
  const net = income - totalCost;
  const roi = totalCost > 0 ? (net / totalCost) * 100 : 0;

  const accountName = (id: string | null) =>
    id ? (accounts.find((a) => a.id === id)?.name ?? null) : null;

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const onDelete = async (e: Expense) => {
    try {
      await remove.mutateAsync(e.id);
      toast.success("Costo eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  };

  return (
    <AppShell
      title="Costos"
      subtitle="Lo que te cuesta operar y cuánto queda de verdad."
      actions={
        <Button onClick={openNew}>
          <Plus className="mr-1 size-4" /> Nuevo costo
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          {(
            [
              ["all", "Todos"],
              ["journal", "Este diario"],
              ["general", "General"],
            ] as [Scope, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setScope(key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                scope === key
                  ? "border-brand bg-brand/15 text-brand-soft"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Costos este mes" value={`−${formatCurrency(monthCost)}`} tone="loss" />
          <Kpi label="Costos este año" value={`−${formatCurrency(yearCost)}`} tone="loss" />
          <Kpi
            label="Coste fijo mensual"
            value={formatCurrency(fixedMonthly)}
            hint="Punto de equilibrio mensual"
          />
          <Kpi
            label="Resultado neto"
            value={formatCurrency(net, true)}
            tone={net >= 0 ? "profit" : "loss"}
            hint={`Retiros fondeo ${formatCurrency(payouts)} + real ${formatCurrency(realPnl, true)} · ROI ${roi.toFixed(0)}%`}
          />
        </section>

        <ExpenseBreakdown occurrences={occurrences} />

        {isLoading ? (
          <div className="panel p-8 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <ExpensesTable
            expenses={filtered}
            accountName={accountName}
            onEdit={(e) => {
              setEditing(e);
              setDialogOpen(true);
            }}
            onDelete={onDelete}
          />
        )}
      </div>

      <ExpenseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        defaultJournalId={activeJournalId}
      />
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "profit" | "loss";
}) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "num mt-1 text-2xl font-semibold",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
