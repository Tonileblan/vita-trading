import { Pencil, Repeat, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/metrics";
import {
  categoryColor,
  categoryLabel,
  recurrenceLabel,
  type Expense,
} from "@/lib/expenses";
import { cn } from "@/lib/utils";

function Chip({ category }: { category: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      style={{ color: categoryColor(category) }}
    >
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: categoryColor(category) }}
      />
      {categoryLabel(category)}
    </span>
  );
}

export function ExpensesTable({
  expenses,
  accountName,
  onEdit,
  onDelete,
}: {
  expenses: Expense[];
  accountName: (id: string | null) => string | null;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}) {
  if (expenses.length === 0) {
    return (
      <div className="panel p-8 text-center text-sm text-muted-foreground">
        No hay gastos registrados con estos filtros.
      </div>
    );
  }

  return (
    <>
      {/* Escritorio */}
      <div className="panel hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Concepto</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2">Ámbito</th>
              <th className="px-3 py-2 text-right">Importe</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-border/60 last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {new Date(e.date).toLocaleDateString("es-ES")}
                </td>
                <td className="px-3 py-2">
                  <span className="font-medium">{e.concept}</span>
                  {e.recurrence !== "none" && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Repeat className="size-3" /> {recurrenceLabel(e.recurrence)}
                    </span>
                  )}
                  {!e.paid && (
                    <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Previsto
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Chip category={e.category} />
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {e.journal_id ? (accountName(e.account_id) ?? "Diario") : "General"}
                </td>
                <td className={cn("num px-3 py-2 text-right font-semibold text-loss")}>
                  −{formatCurrency(e.amount)}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    aria-label="Editar"
                    className="p-1 text-muted-foreground hover:text-foreground"
                    onClick={() => onEdit(e)}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Eliminar"
                    className="p-1 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(e)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil */}
      <div className="space-y-2 md:hidden">
        {expenses.map((e) => (
          <article key={e.id} className="panel space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{e.concept}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.date).toLocaleDateString("es-ES")} ·{" "}
                  {e.journal_id ? (accountName(e.account_id) ?? "Diario") : "General"}
                </p>
              </div>
              <span className="num shrink-0 font-semibold text-loss">
                −{formatCurrency(e.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Chip category={e.category} />
              <div>
                <button
                  type="button"
                  aria-label="Editar"
                  className="p-1 text-muted-foreground"
                  onClick={() => onEdit(e)}
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Eliminar"
                  className="p-1 text-muted-foreground"
                  onClick={() => onDelete(e)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
