import { Building2, User, Wallet } from "lucide-react";
import type { Account, Trade } from "@/lib/types";
import { accountBalance, formatCurrency } from "@/lib/metrics";
import { cn } from "@/lib/utils";

interface Totals {
  initial: number;
  current: number;
  count: number;
}

function sum(
  list: Account[],
  trades: Trade[],
  withdrawals: { accountId?: string | undefined; amount: number }[] = [],
): Totals {
  return {
    initial: list.reduce((s, a) => s + a.initialBalance, 0),
    current: list.reduce((s, a) => s + accountBalance(a, trades, withdrawals), 0),
    count: list.length,
  };
}


function Block({
  label,
  icon,
  totals,
}: {
  label: string;
  icon: React.ReactNode;
  totals: Totals;
}) {
  const diff = totals.current - totals.initial;
  return (
    <div className="panel p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label} · {totals.count}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Inicial</p>
          <p className="num font-semibold">{formatCurrency(totals.initial)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Actual</p>
          <p className="num font-semibold">{formatCurrency(totals.current)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Resultado</p>
          <p className={cn("num font-semibold", diff >= 0 ? "text-profit" : "text-loss")}>
            {formatCurrency(diff, true)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CapitalSplit({
  accounts,
  trades,
}: {
  accounts: Account[];
  trades: Trade[];
}) {
  const funded = accounts.filter((a) => a.type === "funded");
  const personal = accounts.filter((a) => a.type !== "funded");

  return (
    <section className="grid gap-3 md:grid-cols-3">
      <Block
        label="Capital combinado"
        icon={<Wallet className="size-4" />}
        totals={sum(accounts, trades)}
      />
      <Block
        label="Capital fondeo"
        icon={<Building2 className="size-4" />}
        totals={sum(funded, trades)}
      />
      <Block
        label="Capital real"
        icon={<User className="size-4" />}
        totals={sum(personal, trades)}
      />
    </section>
  );
}
