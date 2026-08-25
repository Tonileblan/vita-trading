import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Building2, ExternalLink, LayoutDashboard, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { AccountCostCard } from "@/components/account-cost-card";
import { AppShell } from "@/components/app-shell";
import { EquityChart } from "@/components/equity-chart";
import { KpiCards } from "@/components/kpi-cards";
import { TradesTable } from "@/components/trades-table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useJournal } from "@/lib/journal-store";
import { getFirmWebsite } from "@/lib/prop-firms";
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
import { DrawdownProgress } from "@/components/drawdown-progress";
import { DrawdownAlertButton } from "@/components/drawdown-corner-alert";
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
  const { accounts, trades, strategies, withdrawals, strategyPeriods, removeTrades, loading } = useJournal();
  const account = accounts.find((a) => a.id === accountId);

  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<{ ids: string[]; label: string } | null>(null);
  const [working, setWorking] = useState(false);

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

  const handleConfirmDelete = async () => {
    if (!pending) return;
    setWorking(true);
    try {
      await removeTrades(pending.ids);
      setSelected((prev) => prev.filter((id) => !pending.ids.includes(id)));
      toast.success(
        pending.ids.length === 1
          ? "Operación eliminada correctamente"
          : `${pending.ids.length} operaciones eliminadas correctamente`,
      );
      setPending(null);
    } catch (err) {
      console.error("Error al eliminar operaciones:", err);
      toast.error("No se pudieron eliminar las operaciones seleccionadas");
    } finally {
      setWorking(false);
    }
  };

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
      title={
        <div className="flex items-center gap-2.5 flex-wrap">
          <span>{account.name}</span>
          {account.type === "funded" && <PhaseChip phase={account.phase ?? "eval"} />}
          {isLowDrawdown && (
            <DrawdownAlertButton
              remaining={dd?.remaining ?? 0}
              isFunded={account.type === "funded" && Boolean(account.drawdownLimit)}
              breached={dd?.breached ?? false}
              threshold={600}
            />
          )}
        </div>
      }
      subtitle={
        account.type === "funded" ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            {(() => {
              const firmName = account.firm || "Prop firm";
              const firmUrl = getFirmWebsite(firmName);
              if (firmUrl) {
                return (
                  <a
                    href={firmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand hover:underline inline-flex items-center gap-0.5 transition-colors font-medium text-foreground/85 cursor-pointer"
                    title={`Visitar web oficial de ${firmName}`}
                  >
                    <span>{firmName}</span>
                    <ExternalLink className="size-3 opacity-60 ml-0.5" />
                  </a>
                );
              }
              return <span>{firmName}</span>;
            })()}
            <span>—</span>
            <span className="font-mono">{formatCurrency(account.initialBalance)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {(() => {
              const brokerName = account.broker || "Cuenta personal";
              const brokerUrl = getFirmWebsite(brokerName);
              if (brokerUrl) {
                return (
                  <a
                    href={brokerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand hover:underline inline-flex items-center gap-0.5 transition-colors font-medium text-foreground/85 cursor-pointer"
                    title={`Visitar web oficial de ${brokerName}`}
                  >
                    <span>{brokerName}</span>
                    <ExternalLink className="size-3 opacity-60 ml-0.5" />
                  </a>
                );
              }
              return <span>{brokerName}</span>;
            })()}
            <span>—</span>
            <span>{account.currency}</span>
          </div>
        )
      }
      actions={
        <div className="flex items-center gap-3">
          <Link
            to="/panel"
            search={{ account: account.id }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border bg-card hover:border-brand/40 hover:text-brand transition-colors"
            title={`Ver métricas de ${account.name} en el Resumen`}
          >
            <LayoutDashboard className="size-3.5" /> Ver en Resumen
          </Link>
          <Link
            to="/cuentas"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
          >
            <ArrowLeft className="size-4" /> Cuentas
          </Link>
        </div>
      }
    >
      <div className="space-y-5">
        <section
          className={cn(
            "panel grid grid-cols-2 gap-4 p-4 md:grid-cols-4",
            isLowDrawdown && "border-loss/40",
          )}
        >
          <div>
            <p className="text-xs text-muted-foreground">Balance inicial</p>
            <p className="num text-lg font-bold font-mono">{formatCurrency(account.initialBalance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Balance actual</p>
            <p className="num text-lg font-bold font-mono">{formatCurrency(balance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Resultado de cuenta</p>
            <p
              className={cn("num text-lg font-bold font-mono", result >= 0 ? "text-profit" : "text-loss")}
            >
              {formatCurrency(result, true)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tipo de Cuenta</p>
            <p className="flex items-center gap-2 text-base font-semibold mt-0.5">
              {account.type === "funded" ? (
                <>
                  <Building2 className="size-4 text-brand-soft" /> Fondeo ({account.phase === "live" ? "Live" : "Eval"})
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
          return <TargetProgress status={target} />;
        })()}

        <AccountCostCard accountId={account.id} pnl={pnl} />

        {dd ? <DrawdownProgress status={dd} threshold={600} variant="detail" /> : null}

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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-base font-semibold">Operaciones de la cuenta</h2>
            <span className="text-xs text-muted-foreground font-mono">
              {accTrades.length} {accTrades.length === 1 ? "operación" : "operaciones"}
            </span>
          </div>

          {/* Barra de acciones masivas */}
          {selected.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent/60 p-2.5 px-4 text-xs font-semibold text-foreground">
              <span>{selected.length} operación(es) seleccionada(s)</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setSelected([])}
                >
                  Deseleccionar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 gap-1 text-xs"
                  onClick={() =>
                    setPending({
                      ids: selected,
                      label: `Se eliminarán permanentemente las ${selected.length} operaciones seleccionadas de esta cuenta y se recalcularán todos los balances.`,
                    })
                  }
                >
                  <Trash2 className="size-3.5" /> Eliminar seleccionadas
                </Button>
              </div>
            </div>
          )}

          {loading && accTrades.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : accTrades.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay operaciones.</p>
          ) : (
            <TradesTable
              trades={accTrades}
              accounts={accounts}
              strategies={strategies}
              strategyPeriods={strategyPeriods}
              selectedIds={selected}
              onToggleSelect={(id) =>
                setSelected((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                )
              }
              onDelete={(t) =>
                setPending({
                  ids: [t.id],
                  label: `Se eliminará la operación de ${t.symbol} (${formatCurrency(t.pnl, true)}) de esta cuenta y se recalcularán los balances.`,
                })
              }
            />
          )}
        </section>
      </div>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmas la eliminación?</AlertDialogTitle>
            <AlertDialogDescription>{pending?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
            >
              {working ? "Eliminando…" : "Eliminar definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
