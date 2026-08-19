import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, ArrowLeft, Building2, User } from "lucide-react";
import { AccountCostCard } from "@/components/account-cost-card";
import { AppShell } from "@/components/app-shell";
import { EquityChart } from "@/components/equity-chart";
import { KpiCards } from "@/components/kpi-cards";
import { TradesTable } from "@/components/trades-table";
import { useJournal } from "@/lib/journal-store";
import {
  accountBalance,
  accountCurveStart,
  accountPnl,
  accountResult,
  buildEquityCurve,
  computeMetrics,
  effectiveStrategyId,
  formatCurrency,
  accountDrawdown,
  accountTarget,
} from "@/lib/metrics";
import { TargetProgress, PhaseChip } from "@/components/target-progress";
import { DrawdownCornerAlert } from "@/components/drawdown-corner-alert";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cuenta/$accountId")({
  head: () => ({
    meta: [
      { title: "Detalle de cuenta — Vita-Trading" },
      {
        name: "description",
        content:
          "Evolución de una cuenta concreta: balance, drawdown, métricas y todas sus operaciones.",
      },
      { property: "og:title", content: "Detalle de cuenta — Vita-Trading" },
      {
        property: "og:description",
        content: "Sigue el rendimiento real de cada cuenta con su curva de capital y operaciones.",
      },
    ],
  }),
  component: AccountDetail,
});

function AccountDetail() {
  const { accountId } = Route.useParams();
  const { accounts, trades, strategies, withdrawals, strategyPeriods, loading } = useJournal();
  const account = accounts.find((a) => a.id === accountId);

  const accTrades = useMemo(
    () => trades.filter((t) => t.accountId === accountId),
    [trades, accountId],
  );
  const metrics = useMemo(() => computeMetrics(accTrades), [accTrades]);
  const curve = useMemo(
    () =>
      buildEquityCurve(
        accTrades,
        account ? accountCurveStart(account, accTrades, withdrawals) : 0,
        account,
      ),
    [accTrades, account, withdrawals],
  );

  if (!account) {
    return (
      <AppShell title="Cuenta no encontrada" subtitle="Puede que se haya eliminado">
        <Link to="/cuentas" className="text-brand hover:underline">
          ← Volver a cuentas
        </Link>
      </AppShell>
    );
  }

  const pnl = accountPnl(trades, account.id);
  const balance = accountBalance(account, trades, withdrawals);
  const result = accountResult(account, trades, withdrawals);
  const dd = accountDrawdown(account, trades, withdrawals);

  const byStrategy = strategies
    .map((s) => {
      const own = accTrades.filter(
        (t) => effectiveStrategyId(t, accounts, strategyPeriods) === s.id,
      );
      return { name: s.name, count: own.length, net: own.reduce((sum, t) => sum + t.pnl, 0) };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.net - a.net);

  const isLowDrawdown =
    account.type === "funded" &&
    Boolean(account.drawdownLimit) &&
    dd !== null &&
    (dd.remaining < 600 || dd.breached);

  return (
    <AppShell
      title={account.name}
      subtitle={`${account.firm ?? "Cuenta personal"} · ${account.currency}`}
      actions={
        <Link
          to="/cuentas"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
        >
          <ArrowLeft className="size-4" /> Cuentas
        </Link>
      }
    >
      <div className="space-y-5">
        <section
          className={cn(
            "panel relative overflow-hidden grid grid-cols-2 gap-4 p-4 md:grid-cols-4",
            isLowDrawdown && "border-loss/40",
          )}
        >
          <DrawdownCornerAlert
            remaining={dd?.remaining ?? 0}
            isFunded={account.type === "funded" && Boolean(account.drawdownLimit)}
            breached={dd?.breached ?? false}
            threshold={600}
          />
          <div>
            <p className="text-xs text-muted-foreground">Balance inicial</p>
            <p className="num text-lg font-semibold">{formatCurrency(account.initialBalance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Balance actual</p>
            <p className="num text-lg font-semibold">{formatCurrency(balance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Resultado de cuenta</p>
            <p
              className={cn("num text-lg font-semibold", result >= 0 ? "text-profit" : "text-loss")}
            >
              {formatCurrency(result, true)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tipo</p>
            <p className="flex items-center gap-2 text-lg font-semibold">
              {account.type === "funded" ? (
                <>
                  <Building2 className="size-4 text-brand-soft" /> Fondeo
                </>
              ) : (
                <>
                  <User className="size-4 text-muted-foreground" /> Personal
                </>
              )}
            </p>
          </div>
        </section>

        {(() => {
          const target = accountTarget(account, trades, withdrawals);
          if (!target) return null;
          return (
            <section className="panel p-4">
              <div className="flex items-center gap-2">
                <PhaseChip phase={target.phase} />
                <h2 className="text-base font-semibold">{target.label}</h2>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Inicial</p>
                  <p className="num font-semibold">{formatCurrency(account.initialBalance)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Actual</p>
                  <p className="num font-semibold">{formatCurrency(target.balance)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Objetivo</p>
                  <p className="num font-semibold">{formatCurrency(target.target)}</p>
                </div>
              </div>
              <TargetProgress status={target} />
            </section>
          );
        })()}

        <AccountCostCard accountId={account.id} pnl={pnl} />

        {dd ? (
          <section
            className={cn(
              "panel relative overflow-hidden space-y-2.5 p-4",
              isLowDrawdown && "border-loss/40 bg-loss/5",
            )}
          >
            <DrawdownCornerAlert
              remaining={dd.remaining}
              isFunded={account.type === "funded" && Boolean(account.drawdownLimit)}
              breached={dd.breached}
              threshold={600}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className={cn("font-semibold", isLowDrawdown && "text-loss")}>
                Drawdown · {dd.label}
                {dd.frozen ? " · suelo congelado" : ""}
                {isLowDrawdown && !dd.breached && " · Crítico (< 600 $)"}
              </span>
              <span className="num text-muted-foreground">
                {formatCurrency(dd.used)} / {formatCurrency(dd.limit)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full", dd.pct > 70 || isLowDrawdown ? "bg-loss" : "bg-brand")}
                style={{ width: `${dd.pct}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground md:grid-cols-4">
              <div>
                <p>Referencia</p>
                <p className="num font-semibold text-foreground">{formatCurrency(dd.reference)}</p>
              </div>
              <div>
                <p>Suelo</p>
                <p className="num font-semibold text-foreground">{formatCurrency(dd.floor)}</p>
              </div>
              <div>
                <p>Margen restante</p>
                <p
                  className={cn(
                    "num font-semibold",
                    isLowDrawdown ? "text-loss font-bold" : "text-foreground",
                  )}
                >
                  {formatCurrency(dd.remaining)}
                </p>
              </div>
              <div>
                <p>Estado</p>
                <p
                  className={cn(
                    "font-semibold",
                    dd.breached || isLowDrawdown ? "text-loss font-bold" : "text-profit",
                  )}
                >
                  {dd.breached
                    ? "Cuenta rota"
                    : isLowDrawdown
                      ? "Riesgo alto (< 600 $)"
                      : "En regla"}
                </p>
              </div>
            </div>
            {dd.breachedAt && !dd.breached ? (
              <p className="text-xs text-muted-foreground">
                Aviso: cierre por debajo del suelo el{" "}
                {new Date(dd.breachedAt).toLocaleDateString("es-ES")} (recuperada)
              </p>
            ) : null}
          </section>
        ) : null}

        <KpiCards metrics={metrics} trades={accTrades} />

        <section className="panel p-4">
          <h2 className="text-xl leading-none">Curva de capital</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Ajustada al balance actual registrado
          </p>
          <EquityChart data={curve} />
        </section>

        {byStrategy.length > 0 && (
          <section className="panel p-4">
            <h2 className="mb-3 text-xl leading-none">Por estrategia</h2>
            <div className="space-y-2">
              {byStrategy.map((r) => (
                <div key={r.name} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    {r.name} <span className="text-muted-foreground">· {r.count} ops</span>
                  </span>
                  <span
                    className={cn("num font-semibold", r.net >= 0 ? "text-profit" : "text-loss")}
                  >
                    {formatCurrency(r.net, true)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Operaciones de la cuenta</h2>
          {loading && accTrades.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : accTrades.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay operaciones.</p>
          ) : (
            <TradesTable trades={accTrades} accounts={accounts} strategies={strategies} />
          )}
        </section>
      </div>
    </AppShell>
  );
}
