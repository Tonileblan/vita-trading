import { accountCost } from "@/lib/expense-metrics";
import { useExpenses } from "@/lib/expenses";
import { formatCurrency } from "@/lib/metrics";
import { cn } from "@/lib/utils";

/** Coste invertido en una cuenta frente al beneficio que ha generado. */
export function AccountCostCard({ accountId, pnl }: { accountId: string; pnl: number }) {
  const { data: expenses = [] } = useExpenses();
  const cost = accountCost(expenses, accountId);
  if (cost === 0) return null;

  const net = pnl - cost;
  const amortized = net >= 0;

  return (
    <section className="panel p-4">
      <h2 className="text-xl leading-none">Coste de la cuenta</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Invertido</p>
          <p className="num mt-1 text-lg font-semibold text-loss">−{formatCurrency(cost)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Beneficio</p>
          <p className={cn("num mt-1 text-lg font-semibold", pnl >= 0 ? "text-profit" : "text-loss")}>
            {formatCurrency(pnl, true)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Neto</p>
          <p
            className={cn(
              "num mt-1 text-lg font-semibold",
              amortized ? "text-profit" : "text-loss",
            )}
          >
            {formatCurrency(net, true)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {amortized
          ? "Cuenta amortizada: ya cubre lo que te costó."
          : `Faltan ${formatCurrency(Math.abs(net))} para amortizarla.`}
      </p>
    </section>
  );
}
