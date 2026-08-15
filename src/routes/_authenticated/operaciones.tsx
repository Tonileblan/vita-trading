import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { TradeFormDialog } from "@/components/trade-form-dialog";
import { TradesTable } from "@/components/trades-table";
import { useJournal } from "@/lib/journal-store";
import { computeMetrics, formatCurrency } from "@/lib/metrics";
import { STRATEGY_TAGS } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/operaciones")({
  head: () => ({
    meta: [
      { title: "Operaciones — TONITRADING Journal" },
      {
        name: "description",
        content: "Historial completo de operaciones con filtros por activo, estrategia y cuenta.",
      },
      { property: "og:title", content: "Operaciones — TONITRADING Journal" },
      {
        property: "og:description",
        content: "Registra y revisa cada ejecución con evidencia gráfica y notas de análisis.",
      },
    ],
  }),
  component: TradesPage,
});

function TradesPage() {
  const { visibleTrades, accounts } = useJournal();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      visibleTrades.filter(
        (t) =>
          (!tag || t.tags.includes(tag)) &&
          (!query || t.symbol.toLowerCase().includes(query.toLowerCase())),
      ),
    [visibleTrades, query, tag],
  );
  const m = computeMetrics(filtered);

  return (
    <AppShell
      title="Registro de Operaciones"
      subtitle={`${filtered.length} operaciones · PnL ${formatCurrency(m.totalPnl, true)}`}
      actions={<TradeFormDialog />}
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
          <div className="flex flex-wrap gap-2">
            {STRATEGY_TAGS.map((t) => (
              <button
                key={t}
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

        <TradesTable trades={filtered} accounts={accounts} />
      </div>
    </AppShell>
  );
}
