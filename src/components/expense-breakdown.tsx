import { byCategory, monthlySeries, type Occurrence } from "@/lib/expense-metrics";
import { categoryColor, categoryLabel } from "@/lib/expenses";
import { formatCurrency } from "@/lib/metrics";

export function ExpenseBreakdown({ occurrences }: { occurrences: Occurrence[] }) {
  const cats = byCategory(occurrences);
  const totalAmount = cats.reduce((s, c) => s + c.amount, 0);
  const series = monthlySeries(occurrences, 12);
  const max = Math.max(...series.map((s) => s.amount), 1);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="panel p-4">
        <h2 className="text-xl leading-none">Gastos por mes</h2>
        <div className="mt-4 flex h-40 items-end gap-1.5">
          {series.map((m) => (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
              <span className="num text-[9px] text-muted-foreground">
                {m.amount ? Math.round(m.amount) : ""}
              </span>
              <div
                className="w-full rounded-t bg-loss/70"
                style={{ height: `${Math.max((m.amount / max) * 100, m.amount ? 4 : 0)}%` }}
                title={`${m.label}: ${formatCurrency(m.amount)}`}
              />
              <span className="text-[10px] uppercase text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
      </section>

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
    </div>
  );
}
