import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ExpenseBreakdown } from "@/components/expense-breakdown";
import { ExpenseFormDialog } from "@/components/expense-form-dialog";
import { ExpensesTable } from "@/components/expenses-table";
import { WithdrawalFormDialog } from "@/components/withdrawal-form-dialog";
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
import type { Withdrawal } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({
    meta: [
      { title: "Conta: retiros y gastos — Vita-Trading" },
      {
        name: "description",
        content:
          "Contabilidad de la operativa: retiros de capital y control de gastos (PropFirm, software, hardware, impuestos) con resultado neto.",
      },
      { property: "og:title", content: "Conta: retiros y gastos" },
      {
        property: "og:description",
        content: "Retiros de capital y costos de la operativa en un solo lugar, con rentabilidad neta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContaPage,
});

type Tab = "retiros" | "gastos";
type Scope = "all" | "journal" | "general";

function ContaPage() {
  const [tab, setTab] = useState<Tab>("retiros");
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [editingWithdrawal, setEditingWithdrawal] = useState<Withdrawal | null>(null);
  const { activeJournalId } = useJournal();

  return (
    <AppShell
      bareHeader
      title={
        <div
          className="flex gap-1 border-b border-border"
          role="tablist"
          aria-label="Sección de conta"
        >
          {(
            [
              ["retiros", "Retiros"],
              ["gastos", "Gastos"],
            ] as [Tab, string][]
          ).map(([key, label]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                className={cn(
                  "relative -mb-px rounded-t-lg border border-b-0 px-5 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "border-border bg-card text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                {active && (
                  <span className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-card" />
                )}
              </button>
            );
          })}
        </div>
      }
      showAccountPanel={false}
      actions={
        tab === "gastos" ? (
          <Button
            onClick={() => {
              setEditingExpense(null);
              setExpenseDialogOpen(true);
            }}
          >
            <Plus className="mr-1 size-4" /> Nuevo gasto
          </Button>
        ) : (
          <Button
            onClick={() => {
              setEditingWithdrawal(null);
              setWithdrawalDialogOpen(true);
            }}
          >
            <Plus className="mr-1 size-4" /> Nuevo retiro
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {tab === "retiros" ? (
          <WithdrawalsSection
            openEdit={(w) => {
              setEditingWithdrawal(w);
              setWithdrawalDialogOpen(true);
            }}
          />
        ) : (
          <ExpensesSection
            openEdit={(e) => {
              setEditingExpense(e);
              setExpenseDialogOpen(true);
            }}
          />
        )}
      </div>

      <ExpenseFormDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        editing={editingExpense}
        defaultJournalId={activeJournalId}
      />
      <WithdrawalFormDialog
        open={withdrawalDialogOpen}
        onOpenChange={setWithdrawalDialogOpen}
        editing={editingWithdrawal}
      />
    </AppShell>
  );
}

function WithdrawalsSection({ openEdit }: { openEdit: (w: Withdrawal) => void }) {
  const { accounts, allWithdrawals, updateWithdrawal, removeWithdrawal } = useJournal();

  const approved = useMemo(
    () => allWithdrawals.filter((w) => w.status === "approved"),
    [allWithdrawals],
  );
  const pending = useMemo(
    () => allWithdrawals.filter((w) => w.status === "pending"),
    [allWithdrawals],
  );
  const total = approved.reduce((s, w) => s + w.amount, 0);
  const pendingTotal = pending.reduce((s, w) => s + w.amount, 0);

  const accName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? "—";

  const byAccount = useMemo(
    () =>
      accounts.map((a) => ({
        account: a,
        total: approved
          .filter((w) => w.accountId === a.id)
          .reduce((acc, w) => acc + w.amount, 0),
      })),
    [accounts, approved],
  );

  const approve = async (id: string) => {
    try {
      await updateWithdrawal(id, { status: "approved" });
      toast.success("Retiro aprobado");
    } catch {
      toast.error("No se pudo aprobar");
    }
  };

  const reject = async (id: string) => {
    try {
      await removeWithdrawal(id);
      toast.success("Solicitud eliminada");
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <section className="panel min-w-0 overflow-x-auto p-4">
          <h2 className="mb-3 text-base font-semibold">
            Solicitudes pendientes{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (no se contabilizan)
            </span>
          </h2>
          <ul className="space-y-2 text-sm">
            {pending.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2"
              >
                <span className="tabular-nums text-muted-foreground">
                  {new Date(w.date).toLocaleDateString("es-ES", { timeZone: "UTC" })}
                </span>
                <span className="min-w-0 flex-1 truncate">{accName(w.accountId)}</span>
                <span className="tabular-nums font-medium">{formatCurrency(w.amount)}</span>
                <span className="flex gap-2">
                  <Button size="sm" onClick={() => approve(w.id)}>
                    Aprobado
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => reject(w.id)}>
                    Descartar
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel min-w-0 overflow-x-auto p-4">
        <h2 className="mb-3 text-base font-semibold">Registro de retiros</h2>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 text-left">Fecha</th>
              <th className="py-2 text-left">Cuenta</th>
              <th className="py-2 text-right">Monto</th>
              <th className="py-2 text-left">Estado</th>
              <th className="py-2 text-left">Motivo</th>
              <th className="py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {allWithdrawals.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  Todavía no hay retiros registrados.
                </td>
              </tr>
            )}
            {allWithdrawals.map((w) => (
              <tr key={w.id} className="border-b border-border/60">
                <td className="py-2 tabular-nums">
                  {new Date(w.date).toLocaleDateString("es-ES", { timeZone: "UTC" })}
                </td>
                <td className="py-2">{accName(w.accountId)}</td>
                <td
                  className={cn(
                    "py-2 text-right tabular-nums",
                    w.status !== "approved" && "text-muted-foreground",
                  )}
                >
                  {formatCurrency(w.amount)}
                </td>
                <td className="py-2">
                  {w.status === "approved" ? (
                    <span className="text-profit">Aprobado</span>
                  ) : (
                    <button
                      className="text-muted-foreground underline underline-offset-2"
                      onClick={() => approve(w.id)}
                    >
                      Pendiente
                    </button>
                  )}
                </td>
                <td className="py-2 text-muted-foreground">{w.reason ?? "—"}</td>
                <td className="py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(w)}>
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
          <span>Total aprobado</span>
          <span className="tabular-nums">{formatCurrency(total)}</span>
        </div>
        {pendingTotal > 0 && (
          <div className="mt-1 flex justify-between text-sm text-muted-foreground">
            <span>Pendiente</span>
            <span className="tabular-nums">{formatCurrency(pendingTotal)}</span>
          </div>
        )}
      </section>
    </div>
  );
}

function ExpensesSection({ openEdit }: { openEdit: (e: Expense) => void }) {
  const { accounts, visibleTrades, withdrawals, activeJournalId } = useJournal();
  const { data: expenses = [], isLoading } = useExpenses();
  const remove = useDeleteExpense();
  const [scope, setScope] = useState<Scope>("all");

  const filtered = useMemo(() => {
    if (scope === "journal") return expenses.filter((e) => e.journal_id === activeJournalId);
    if (scope === "general") return expenses.filter((e) => !e.journal_id);
    return expenses.filter((e) => !e.journal_id || e.journal_id === activeJournalId);
  }, [expenses, scope, activeJournalId]);

  const occurrences = useMemo(() => expand(filtered), [filtered]);

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

  const onDelete = async (e: Expense) => {
    try {
      await remove.mutateAsync(e.id);
      toast.success("Costo eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-10 flex gap-2">
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
              "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
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
          onEdit={openEdit}
          onDelete={onDelete}
        />
      )}
    </div>
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
