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
import { TargetProgress } from "@/components/target-progress";
import { DrawdownCornerAlert } from "@/components/drawdown-corner-alert";
import { cn } from "@/lib/utils";

export function AccountSidePanel() {
  const { accounts, trades, withdrawals, selectedAccountIds, toggleAccount, selectAll } =
    useJournal();

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
      <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {accounts.map((acc) => {
          const active = selectedAccountIds.includes(acc.id);
          const result = accountResult(acc, trades, withdrawals);
          const balance = accountBalance(acc, trades, withdrawals);
          const target = accountTarget(acc, trades, withdrawals);
          const dd = accountDrawdown(acc, trades, withdrawals);
          const isLowDrawdown =
            acc.type === "funded" &&
            Boolean(acc.drawdownLimit) &&
            dd !== null &&
            (dd.remaining < 600 || dd.breached);

          return (
            <button
              key={acc.id}
              onClick={() => toggleAccount(acc.id)}
              className={cn(
                "relative overflow-hidden w-full rounded-md border px-3 py-2 text-left transition-colors",
                isLowDrawdown && "border-loss/40",
                active
                  ? "border-brand/50 bg-sidebar-accent"
                  : "border-transparent opacity-55 hover:opacity-90",
              )}
            >
              <DrawdownCornerAlert
                size="sm"
                remaining={dd?.remaining ?? 0}
                isFunded={acc.type === "funded" && Boolean(acc.drawdownLimit)}
                breached={dd?.breached ?? false}
                threshold={600}
              />
              <div className="flex items-center gap-2">
                {acc.type === "funded" ? (
                  <Building2 className="size-3.5 text-brand-soft" />
                ) : (
                  <User className="size-3.5 text-muted-foreground" />
                )}
                <span className="truncate text-sm font-medium">{acc.name}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="num text-xs text-muted-foreground">{formatCurrency(balance)}</span>

                <span
                  className={cn(
                    "num text-xs font-semibold",
                    result >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {formatCurrency(result, true)}
                </span>
              </div>
              {target && <TargetProgress status={target} compact />}
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
