import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  History as HistoryIcon,
  List as ListIcon,
  Percent,
  Plus,
  Scale,
  Search,
  TrendingUp,
  Trash2,
  Undo2,
  Upload,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { TradeFormDialog } from "@/components/trade-form-dialog";
import { TradeImportDialog } from "@/components/trade-import-dialog";
import { TradesTable } from "@/components/trades-table";
import { useJournal } from "@/lib/journal-store";
import { computeMetrics, effectiveStrategyId, formatCurrency, formatDateTime } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operaciones")({
  head: () => ({
    meta: [
      { title: "Operaciones — Vita-Trading Journal" },
      {
        name: "description",
        content: "Historial completo de operaciones con filtros por activo, estrategia y cuenta.",
      },
      { property: "og:title", content: "Operaciones — Vita-Trading Journal" },
      {
        property: "og:description",
        content: "Registra y revisa cada ejecución con evidencia gráfica y notas de análisis.",
      },
    ],
  }),
  component: TradesPage,
});

type Pending =
  | { kind: "trades"; ids: string[]; label: string }
  | { kind: "batch"; id: string; label: string };

function TradesPage() {
  const { visibleTrades, accounts, strategies, strategyPeriods, importBatches, removeTrades, removeImportBatch } =
    useJournal();
  const [query, setQuery] = useState("");
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [working, setWorking] = useState(false);
  const [sortBy, setSortBy] = useState<"created" | "closed">("closed");
  const [tab, setTab] = useState<"operaciones" | "importaciones">("operaciones");

  const filtered = useMemo(
    () =>
      visibleTrades
        .filter((t) => {
          // Filtro por estrategia (usa effectiveStrategyId para coincidir con la estrategia directa, de tramo o de cuenta)
          if (selectedStrategyId) {
            const stratId = effectiveStrategyId(t, accounts, strategyPeriods);
            if (stratId !== selectedStrategyId && t.strategyId !== selectedStrategyId) {
              return false;
            }
          }

          // Búsqueda por texto (símbolo, notas, nombre de cuenta o etiquetas)
          if (query) {
            const q = query.toLowerCase();
            const matchesSymbol = t.symbol.toLowerCase().includes(q);
            const matchesNotes = t.notes?.toLowerCase().includes(q) ?? false;
            const matchesTags = t.tags.some((tag) => tag.toLowerCase().includes(q));
            const accName = accounts.find((a) => a.id === t.accountId)?.name.toLowerCase() ?? "";
            const matchesAccount = accName.includes(q);
            if (!matchesSymbol && !matchesNotes && !matchesTags && !matchesAccount) {
              return false;
            }
          }

          return true;
        })
        .sort((a, b) => {
          if (sortBy === "created") {
            const aDate = a.createdAt ?? a.openedAt ?? a.closedAt;
            const bDate = b.createdAt ?? b.openedAt ?? b.closedAt;
            return bDate.localeCompare(aDate);
          }
          const aDate = a.openedAt || a.closedAt;
          const bDate = b.openedAt || b.closedAt;
          return bDate.localeCompare(aDate);
        }),
    [visibleTrades, accounts, strategyPeriods, query, selectedStrategyId, sortBy],
  );

  const m = useMemo(() => computeMetrics(filtered), [filtered]);

  const confirm = async () => {
    if (!pending) return;
    setWorking(true);
    try {
      if (pending.kind === "trades") {
        await removeTrades(pending.ids);
        setSelected((prev) => prev.filter((id) => !pending.ids.includes(id)));
        toast.success(
          pending.ids.length === 1
            ? "Operación eliminada"
            : `${pending.ids.length} operaciones eliminadas`,
        );
      } else {
        await removeImportBatch(pending.id);
        toast.success("Importación deshecha correctamente");
      }
      setPending(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setWorking(false);
    }
  };

  return (
    <AppShell
      title="Registro de Operaciones"
      subtitle="Supervisa cada trade registrado, clasifícalo por estrategia e importa ejecuciones masivas"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <TradeImportDialog />
          <TradeFormDialog />
        </div>
      }
    >
      <div className="space-y-6">
        {/* KPI Hero Counters */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <ListIcon className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Operaciones Mostradas</p>
              <p className="text-xl font-bold">{filtered.length}</p>
            </div>
          </div>

          <div className="panel flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">PnL Neto Total</p>
              <p
                className={cn(
                  "num text-xl font-bold",
                  m.totalPnl >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {formatCurrency(m.totalPnl, true)}
              </p>
            </div>
          </div>

          <div className="panel flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Percent className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Win Rate (Tasa de Acierto)</p>
              <p className="num text-xl font-bold">
                {m.winRate.toFixed(1)}%{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({m.wins}W / {m.losses}L)
                </span>
              </p>
            </div>
          </div>

          <div className="panel flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
              <Scale className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Profit Factor</p>
              <p className="num text-xl font-bold">
                {Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setTab("operaciones")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all",
              tab === "operaciones"
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <ListIcon className="size-4" />
            <span>Operaciones</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {filtered.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("importaciones")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all",
              tab === "importaciones"
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <HistoryIcon className="size-4" />
            <span>Historial de Importaciones</span>
            {importBatches.length > 0 && (
              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-bold text-brand">
                {importBatches.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: OPERACIONES */}
        {tab === "operaciones" && (
          <div className="space-y-4">
            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 h-9 text-xs"
                    placeholder="Buscar activo (NQ, EURUSD, BTC…)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 text-xs"
                  onClick={() => setSortBy((s) => (s === "created" ? "closed" : "created"))}
                >
                  <ArrowUpDown className="size-3.5" />
                  {sortBy === "closed" ? "Orden: Fecha Apertura" : "Orden: Creación/Registro"}
                </Button>
              </div>

              {/* Strategy Pills */}
              {strategies.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedStrategyId(null)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      selectedStrategyId === null
                        ? "bg-brand text-brand-foreground shadow-xs"
                        : "border border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Todas ({visibleTrades.length})
                  </button>
                  {strategies.map((s) => {
                    const count = visibleTrades.filter(
                      (t) =>
                        effectiveStrategyId(t, accounts, strategyPeriods) === s.id ||
                        t.strategyId === s.id,
                    ).length;
                    const isSelected = selectedStrategyId === s.id;

                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          setSelectedStrategyId(isSelected ? null : s.id)
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all",
                          isSelected
                            ? "bg-brand text-brand-foreground shadow-xs"
                            : "border border-border text-muted-foreground hover:text-foreground",
                        )}
                        style={
                          isSelected
                            ? undefined
                            : {
                                borderColor: s.color ? `${s.color}60` : undefined,
                              }
                        }
                      >
                        {s.color && (
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{
                              backgroundColor: isSelected ? "currentColor" : s.color,
                            }}
                          />
                        )}
                        <span>{s.name}</span>
                        <span
                          className={cn(
                            "ml-0.5 rounded-full px-1.5 py-0.2 text-[10px]",
                            isSelected
                              ? "bg-brand-foreground/20 text-brand-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bulk Selection Bar */}
            {selected.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand/5 p-3 text-sm">
                <span className="font-semibold text-foreground">
                  {selected.length} {selected.length === 1 ? "operación seleccionada" : "operaciones seleccionadas"}
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                    Desmarcar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() =>
                      setPending({
                        kind: "trades",
                        ids: selected,
                        label: `Se eliminarán permanentemente las ${selected.length} operaciones seleccionadas y se recalcularán los balances.`,
                      })
                    }
                  >
                    <Trash2 className="size-4" /> Eliminar seleccionadas
                  </Button>
                </div>
              </div>
            )}

            {/* Trades Table */}
            <TradesTable
              trades={filtered}
              accounts={accounts}
              strategies={strategies}
              selectedIds={selected}
              onToggleSelect={(id) =>
                setSelected((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                )
              }
              onDelete={(t) =>
                setPending({
                  kind: "trades",
                  ids: [t.id],
                  label: `Se eliminará la operación de ${t.symbol} (${formatCurrency(t.pnl, true)}) y se recalculará el balance.`,
                })
              }
            />
          </div>
        )}

        {/* TAB 2: IMPORTACIONES */}
        {tab === "importaciones" && (
          <div className="panel space-y-4 p-5">
            <div>
              <h3 className="text-base font-bold">Lotes e Historial de Importación</h3>
              <p className="text-xs text-muted-foreground">
                Revisa las importaciones realizadas por captura, CSV o manual y deshazlas si necesitas revertir los datos.
              </p>
            </div>

            {importBatches.length === 0 ? (
              <div className="rounded-xl border border-border/80 bg-muted/20 p-8 text-center space-y-3">
                <p className="text-sm text-muted-foreground">Aún no hay importaciones registradas.</p>
                <TradeImportDialog />
              </div>
            ) : (
              <div className="grid gap-3">
                {importBatches.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-foreground/20"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="num text-xs font-semibold text-foreground">
                          {formatDateTime(b.createdAt)}
                        </span>
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand uppercase">
                          {b.source === "captura" ? "Captura IA" : "CSV / Manual"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · {b.count} {b.count === 1 ? "operación" : "operaciones"}
                        </span>
                        <span
                          className={cn(
                            "num text-xs font-bold px-2 py-0.5 rounded-md",
                            b.pnl >= 0 ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
                          )}
                        >
                          {formatCurrency(b.pnl, true)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Símbolos detectados:{" "}
                        <strong className="text-foreground">
                          {b.symbols.slice(0, 6).join(", ") || "—"}
                        </strong>
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() =>
                        setPending({
                          kind: "batch",
                          id: b.id,
                          label: `Se eliminarán las ${b.count} operaciones importadas en este lote y se revertirán los balances.`,
                        })
                      }
                    >
                      <Undo2 className="size-3.5" /> Deshacer lote
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete / Revert Confirmation Dialog */}
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
                void confirm();
              }}
            >
              {working ? "Eliminando…" : "Confirmar eliminación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
