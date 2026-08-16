import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Trash2, Undo2 } from "lucide-react";
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
import { computeMetrics, formatCurrency, formatDateTime } from "@/lib/metrics";

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
  const { visibleTrades, accounts, strategies, importBatches, removeTrades, removeImportBatch } =
    useJournal();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [working, setWorking] = useState(false);
  const [sortBy, setSortBy] = useState<"created" | "closed">("created");

  const filtered = useMemo(
    () =>
      visibleTrades
        .filter(
          (t) =>
            (!tag || t.tags.includes(tag)) &&
            (!query || t.symbol.toLowerCase().includes(query.toLowerCase())),
        )
        .sort((a, b) =>
          sortBy === "created"
            ? (b.createdAt ?? b.closedAt).localeCompare(a.createdAt ?? a.closedAt)
            : b.closedAt.localeCompare(a.closedAt),
        ),
    [visibleTrades, query, tag, sortBy],
  );

  const m = computeMetrics(filtered);

  const confirm = async () => {
    if (!pending) return;
    setWorking(true);
    try {
      if (pending.kind === "trades") {
        await removeTrades(pending.ids);
        setSelected((prev) => prev.filter((id) => !pending.ids.includes(id)));
        toast.success(
          pending.ids.length === 1 ? "Operación eliminada" : `${pending.ids.length} operaciones eliminadas`,
        );
      } else {
        await removeImportBatch(pending.id);
        toast.success("Importación deshecha");
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
      subtitle={`${filtered.length} operaciones · PnL ${formatCurrency(m.totalPnl, true)}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <TradeImportDialog />
          <TradeFormDialog />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar activo (NQ, EURUSD…)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSortBy((s) => (s === "created" ? "closed" : "created"))}
          >
            <ArrowUpDown className="size-4" />
            {sortBy === "created" ? "Orden: introducción" : "Orden: fecha operación"}
          </Button>

          <div className="flex flex-wrap gap-2">
            {strategies.map(({ id, name: t }) => (
              <button
                key={id}
                onClick={() => setTag(tag === t ? null : t)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  tag === t
                    ? "border-brand bg-brand/15 text-brand-soft"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {importBatches.length > 0 && (
          <div className="panel space-y-2 p-4">
            <p className="font-display text-lg">Historial de importaciones</p>
            <div className="space-y-2">
              {importBatches.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="num text-muted-foreground">{formatDateTime(b.createdAt)}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {b.source === "captura" ? "Captura" : "Manual"}
                    </span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span>
                      {b.count} {b.count === 1 ? "operación" : "operaciones"}
                    </span>
                    <span
                      className={cn("num ml-2 font-semibold", b.pnl >= 0 ? "text-profit" : "text-loss")}
                    >
                      {formatCurrency(b.pnl, true)}
                    </span>
                    <span className="ml-2 truncate text-xs text-muted-foreground">
                      {b.symbols.slice(0, 4).join(", ")}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPending({
                        kind: "batch",
                        id: b.id,
                        label: `Se eliminarán las ${b.count} operaciones de este registro y se ajustarán los balances.`,
                      })
                    }
                  >
                    <Undo2 className="size-4" /> Deshacer
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}


        {selected.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-accent/30 px-3 py-2 text-sm">
            <span>{selected.length} seleccionadas</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() =>
                  setPending({
                    kind: "trades",
                    ids: selected,
                    label: `Se eliminarán ${selected.length} operaciones y se ajustarán los balances.`,
                  })
                }
              >
                <Trash2 className="size-4" /> Eliminar seleccionadas
              </Button>
            </div>
          </div>
        )}

        <TradesTable
          trades={filtered}
          accounts={accounts}
          selectedIds={selected}
          onToggleSelect={(id) =>
            setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
          onDelete={(t) =>
            setPending({
              kind: "trades",
              ids: [t.id],
              label: `Se eliminará la operación de ${t.symbol} (${formatCurrency(t.pnl, true)}) y se ajustará el balance.`,
            })
          }
        />
      </div>

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
              onClick={(e) => {
                e.preventDefault();
                void confirm();
              }}
            >
              {working ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
