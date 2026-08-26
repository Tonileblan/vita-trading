import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, User } from "lucide-react";
import { useJournal } from "@/lib/journal-store";
import {
  accountBalance,
  accountDrawdown,
  accountResult,
  accountTarget,
  formatCurrency,
} from "@/lib/metrics";
import { PhaseChip, TargetProgress } from "@/components/target-progress";
import { DrawdownProgress } from "@/components/drawdown-progress";
import { DrawdownAlertButton } from "@/components/drawdown-corner-alert";
import { cn } from "@/lib/utils";

export function AccountSidePanel() {
  const { accounts, trades, withdrawals, selectedAccountIds, toggleAccount, selectAll } =
    useJournal();

  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      const ddA =
        a.type === "funded" && Boolean(a.maxLossLimit ?? a.drawdownLimit ?? a.dailyLossLimit)
          ? accountDrawdown(a, trades, withdrawals)
          : null;
      const ddB =
        b.type === "funded" && Boolean(b.maxLossLimit ?? b.drawdownLimit ?? b.dailyLossLimit)
          ? accountDrawdown(b, trades, withdrawals)
          : null;

      const isAlertA = Boolean(
        ddA && (ddA.remaining < 600 || ddA.breached || (ddA.hasDailyLimit && ((ddA.dailyRemaining ?? 9999) < 300 || ddA.dailyBreached))),
      );
      const isAlertB = Boolean(
        ddB && (ddB.remaining < 600 || ddB.breached || (ddB.hasDailyLimit && ((ddB.dailyRemaining ?? 9999) < 300 || ddB.dailyBreached))),
      );

      if (isAlertA && !isAlertB) return -1;
      if (!isAlertA && isAlertB) return 1;

      if (isAlertA && isAlertB && ddA && ddB) {
        if (ddA.breached && !ddB.breached) return -1;
        if (!ddA.breached && ddB.breached) return 1;
        return ddA.remaining - ddB.remaining;
      }

      return 0;
    });
  }, [accounts, trades, withdrawals]);

  return (
    <div className="mt-6 flex min-h-0 flex-1 flex-col border-t border-sidebar-border pt-4">
      <div className="flex items-center justify-between px-5 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Cuentas
        </span>
        <button onClick={selectAll} className="text-xs font-medium text-brand hover:underline">
          Todas
        </button>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-4">
        {sortedAccounts.map((acc) => {
          const active = selectedAccountIds.includes(acc.id);
          const result = accountResult(acc, trades, withdrawals);
          const balance = accountBalance(acc, trades, withdrawals);
          const target = accountTarget(acc, trades, withdrawals);
          const dd = accountDrawdown(acc, trades, withdrawals);
          const isLowDrawdown =
            acc.type === "funded" &&
            Boolean(acc.maxLossLimit ?? acc.drawdownLimit ?? acc.dailyLossLimit) &&
            dd !== null &&
            (dd.remaining < 600 || dd.breached || (dd.hasDailyLimit && ((dd.dailyRemaining ?? 9999) < 300 || dd.dailyBreached)));

          return (
            <button
              key={acc.id}
              onClick={() => toggleAccount(acc.id)}
              className={cn(
                "w-full rounded-lg border p-2.5 text-left transition-colors",
                isLowDrawdown && "border-rose-500/40 bg-rose-500/5",
                active
                  ? "border-brand/50 bg-sidebar-accent"
                  : "border-transparent opacity-65 hover:opacity-95 hover:bg-muted/30",
              )}
            >
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {acc.type === "funded" ? (
                    <Building2 className="size-3.5 shrink-0 text-brand-soft" />
                  ) : (
                    <User className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate text-xs font-bold">{acc.name}</span>
                  {acc.type === "funded" && <PhaseChip phase={acc.phase ?? "eval"} />}
                </div>
                {isLowDrawdown && (
                  <DrawdownAlertButton
                    size="sm"
                    remaining={dd?.remaining ?? 0}
                    isFunded={acc.type === "funded" && Boolean(acc.maxLossLimit ?? acc.drawdownLimit ?? acc.dailyLossLimit)}
                    breached={dd?.breached ?? false}
                    threshold={600}
                  />
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="num text-xs font-mono font-medium text-muted-foreground">
                  {formatCurrency(balance)}
                </span>

                <span
                  className={cn(
                    "num text-xs font-mono font-bold",
                    result >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {formatCurrency(result, true)}
                </span>
              </div>
              {target && <TargetProgress status={target} compact />}
              {dd && <DrawdownProgress status={dd} variant="compact" className="mt-1" />}
            </button>
          );
        })}
      </div>
      <Link
        to="/cuentas"
        className="mx-3 mb-4 rounded-md border border-dashed border-sidebar-border px-3 py-2 text-center text-xs font-medium text-muted-foreground hover:border-brand hover:text-brand"
      >
        + Gestionar cuentas
      </Link>
    </div>
  );
}
