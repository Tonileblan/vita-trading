import { byCategory, type Occurrence } from "@/lib/expense-metrics";
import { categoryColor, categoryLabel } from "@/lib/expenses";
import { formatCurrency } from "@/lib/metrics";

export function ExpenseBreakdown({ occurrences }: { occurrences: Occurrence[] }) {
  const cats = byCategory(occurrences);
  const totalAmount = cats.reduce((s, c) => s + c.amount, 0);

  return (
    <section className="panel space-y-3 p-4">
      <h2 className="text-xl leading-none">Desglose por categoría</h2>
      {cats.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin gastos en este periodo.</p>
      ) : (
        <ul className="space-y-2.5">
          {cats.map((c) => {
            const pct = totalAmount ? (c.amount / totalAmount) * 100 : 0;
            return (
              <li key={c.category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{categoryLabel(c.category)}</span>
                  <span className="num text-muted-foreground">
                    {formatCurrency(c.amount)} · {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: categoryColor(c.category) }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
