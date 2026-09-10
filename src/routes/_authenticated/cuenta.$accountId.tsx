import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Building2, ExternalLink, Flame, LayoutDashboard, RotateCcw, Trash2, User } from "lucide-react";
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
  isTradeOfAccount,
} from "@/lib/metrics";
import { TargetProgress, PhaseChip } from "@/components/target-progress";
import { DrawdownProgress } from "@/components/drawdown-progress";
import { DrawdownAlertButton } from "@/components/drawdown-corner-alert";
import { PnlCalendar } from "@/components/pnl-calendar";
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
  const {
    accounts,
    trades,
    strategies,
    withdrawals,
    strategyPeriods,
    removeTrades,
    reactivateAccount,
    markAccountBurned,
    loading,
  } = useJournal();
  const account = accounts.find((a) => a.id === accountId);

  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<{ ids: string[]; label: string } | null>(null);
  const [working, setWorking] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  const accTrades = useMemo(
    () => trades.filter((t) => isTradeOfAccount(t, { id: accountId, name: account?.name })),
    [trades, accountId, account?.name],
  );

  const displayTrades = useMemo(() => {
    if (!selectedCalendarDate) return accTrades;
    return accTrades.filter((t) => {
      const d = new Date(t.openedAt || t.closedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return key === selectedCalendarDate;
    });
  }, [accTrades, selectedCalendarDate]);

  const metrics = useMemo(() => computeMetrics(accTrades), [accTrades]);
  const curve = useMemo(
    () =>
      buildEquityCurve(
        accTrades,
        account ? accountCurveStart(account, accTrades, withdrawals) : 0,
        account,
        accTrades,
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

  const handleReactivateAccount = async () => {
    if (!account) return;
    try {
      await reactivateAccount(account.id);
      toast.success(`Cuenta "${account.name}" reactivada con éxito.`);
    } catch (err) {
      toast.error("No se pudo reactivar la cuenta");
    }
  };

  const handleMarkBurnedAccount = async () => {
    if (!account) return;
    try {
      await markAccountBurned(account.id, "Límite total de pérdida superado (Max Loss)");
      toast.success(`Cuenta "${account.name}" marcada como Cuenta Quemada.`);
    } catch (err) {
      toast.error("No se pudo marcar la cuenta como quemada");
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

  const isBurned = account.status === "burned";
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
    !isBurned &&
    account.type === "funded" &&
    Boolean(account.maxLossLimit ?? account.drawdownLimit ?? account.dailyLossLimit) &&
    dd !== null &&
    (dd.remaining < 600 || dd.breached || (dd.hasDailyLimit && ((dd.dailyRemaining ?? 9999) < 300 || dd.dailyBreached)));

  return (
    <AppShell
      title={
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={cn(isBurned && "line-through opacity-85")}>{account.name}</span>
          {isBurned ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-loss/10 border border-loss/30 px-2.5 py-0.5 text-xs font-bold text-loss">
              <Flame className="size-3.5" /> Quemada / Perdida
            </span>
          ) : (
            account.type === "funded" && <PhaseChip phase={account.phase ?? "eval"} />
          )}
          {isLowDrawdown && (
            <DrawdownAlertButton
              remaining={dd?.remaining ?? 0}
              isFunded={account.type === "funded" && Boolean(account.maxLossLimit ?? account.drawdownLimit ?? account.dailyLossLimit)}
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
        <div className="flex items-center gap-2">
          {isBurned && (
            <Button
              size="sm"
              onClick={handleReactivateAccount}
              className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <RotateCcw className="size-3.5" />
              Reactivar cuenta
            </Button>
          )}
          <Link
            to="/panel"
            search={{ account: account.id }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border bg-card hover:border-brand/40 hover:text-brand transition-colors shadow-xs"
            title={`Ver métricas de ${account.name}`}
          >
            <LayoutDashboard className="size-3.5" /> Métricas
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
        {/* BANNER INFORMATIVO SI ESTÁ MARCADA COMO QUEMADA */}
        {isBurned && (
          <div className="rounded-2xl border border-loss/30 bg-loss/8 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-loss/15 text-loss">
                <Flame className="size-5" />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-loss">
                    Esta cuenta se encuentra en el historial de Cuentas Quemadas / Perdidas
                  </h4>
                  <span className="rounded-full bg-loss/15 px-2 py-0.5 text-[10px] font-bold text-loss">
                    Archivada
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {account.burnedReason ? <span><strong>Causa:</strong> {account.burnedReason}. </span> : null}
                  {account.burnedAt ? (
                    <span>
                      <strong>Fecha de registro:</strong>{" "}
                      {new Date(account.burnedAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}.{" "}
                    </span>
                  ) : null}
                  Se conservan todas las estadísticas y operaciones registradas para que puedas estudiar tus patrones de riesgo.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleReactivateAccount}
              className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 self-end sm:self-auto shadow-xs"
            >
              <RotateCcw className="size-3.5" />
              Reactivar cuenta
            </Button>
          </div>
        )}

        {/* ALERTA SI LA CUENTA NO ESTÁ QUEMADA PERO ROMPIÓ DRAWDOWN */}
        {!isBurned && (dd?.breached || dd?.dailyBreached) && (
          <div className="rounded-2xl border border-loss/40 bg-loss/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="size-5 text-loss shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-loss">Límite de Drawdown Superado</p>
                <p className="text-muted-foreground">
                  Esta cuenta ha violado el límite máximo de pérdida. Puedes moverla a la sección de Cuentas Quemadas para registrarla ordenadamente.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleMarkBurnedAccount}
              className="text-xs gap-1.5 shrink-0 self-end sm:self-auto font-semibold"
            >
              <Flame className="size-3.5" />
              Marcar como Cuenta Quemada
            </Button>
          </div>
        )}

        <section
          className={cn(
            "panel grid grid-cols-2 gap-4 p-4 md:grid-cols-4 rounded-2xl",
            isLowDrawdown && "border-loss/40",
            isBurned && "border-loss/30 bg-loss/[0.02]",
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

        {/* Calendario de Rendimiento PnL con selector de vistas: Mes / Trimestral / Anual */}
        <PnlCalendar
          trades={accTrades}
          selectedDate={selectedCalendarDate}
          onSelectDate={setSelectedCalendarDate}
        />

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Operaciones de la cuenta</h2>
              {selectedCalendarDate && (
                <span className="rounded-full bg-brand/15 border border-brand/40 px-2.5 py-0.5 text-xs text-brand font-semibold">
                  Día: {selectedCalendarDate.split("-").reverse().join("/")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedCalendarDate && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-brand hover:text-foreground"
                  onClick={() => setSelectedCalendarDate(null)}
                >
                  Ver todas ({accTrades.length})
                </Button>
              )}
              <span className="text-xs text-muted-foreground font-mono">
                {displayTrades.length} {displayTrades.length === 1 ? "operación" : "operaciones"}
              </span>
            </div>
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
          ) : displayTrades.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {selectedCalendarDate
                ? "No hay operaciones registradas en el día seleccionado."
                : "Todavía no hay operaciones."}
            </p>
          ) : (
            <TradesTable
              trades={displayTrades}
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
