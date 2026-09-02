import { Check, Trash2, ArrowRight, Building2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Account, Strategy } from "@/lib/types";

export interface PreviewTradeRow {
  selected: boolean;
  symbol: string;
  direction: "long" | "short";
  entryPrice?: number | undefined;
  exitPrice?: number | undefined;
  size?: number | undefined;
  pnl: number;
  accountName?: string | undefined;
  accountFirm?: string | undefined;
  detectedAccountKey: string;
  assignedAccountId: string;
  assignedStrategyId: string;
  detectedAt?: string | null | undefined;
  customDate?: string | undefined;
  customTime?: string | undefined;
  confidence?: number | undefined;
}

export interface AccountMapping {
  targetAccountId: string;
  targetStrategyId: string;
}

interface TradeImportPreviewTableProps {
  rows: PreviewTradeRow[];
  accounts: Account[];
  strategies: Strategy[];
  accountMappings: Record<string, AccountMapping>;
  onToggleSelectRow: (index: number) => void;
  onToggleSelectAll: () => void;
  onUpdateRow: (index: number, updates: Partial<PreviewTradeRow>) => void;
  onDeleteRow: (index: number) => void;
  onUpdateGroupAccount: (groupKey: string, accountId: string) => void;
  onUpdateGroupStrategy: (groupKey: string, strategyId: string) => void;
}

export function TradeImportPreviewTable({
  rows,
  accounts,
  strategies,
  accountMappings,
  onToggleSelectRow,
  onToggleSelectAll,
  onUpdateRow,
  onDeleteRow,
  onUpdateGroupAccount,
  onUpdateGroupStrategy,
}: TradeImportPreviewTableProps) {
  const allSelected = rows.length > 0 && rows.every((r) => r.selected);
  const selectedCount = rows.filter((r) => r.selected).length;
  const selectedPnl = rows.filter((r) => r.selected).reduce((s, r) => s + r.pnl, 0);

  // Grupos únicos detectados
  const detectedGroupList = Array.from(
    rows.reduce((map, r) => {
      map.set(r.detectedAccountKey, (map.get(r.detectedAccountKey) ?? 0) + 1);
      return map;
    }, new Map<string, number>()).entries(),
  ).map(([key, count]) => ({
    groupKey: key,
    count,
    mapping: accountMappings[key],
  }));

  return (
    <div className="space-y-4">
      {/* Mapeo Masivo por Grupos Detectados */}
      {detectedGroupList.length > 0 && (
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-3.5 text-brand" /> Asignación Rápida por Cuenta Detectada
            </span>
            <span className="text-[11px] text-muted-foreground">
              {detectedGroupList.length} {detectedGroupList.length === 1 ? "cuenta identificada" : "cuentas identificadas"}
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {detectedGroupList.map((g) => (
              <div
                key={g.groupKey}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5 text-xs shadow-xs"
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="truncate max-w-[14rem] text-foreground">{g.groupKey}</span>
                  <span className="rounded-full bg-brand/10 px-2 py-0.2 text-[10px] text-brand font-bold">
                    {g.count} {g.count === 1 ? "trade" : "trades"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Cuenta Destino</label>
                    <Select
                      value={g.mapping?.targetAccountId || accounts[0]?.id || ""}
                      onValueChange={(val) => onUpdateGroupAccount(g.groupKey, val)}
                    >
                      <SelectTrigger className="h-7 text-xs mt-0.5">
                        <SelectValue placeholder="Cuenta..." />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id} className="text-xs">
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">Estrategia</label>
                    <Select
                      value={g.mapping?.targetStrategyId || strategies[0]?.id || ""}
                      onValueChange={(val) => onUpdateGroupStrategy(g.groupKey, val)}
                    >
                      <SelectTrigger className="h-7 text-xs mt-0.5">
                        <SelectValue placeholder="Estrategia..." />
                      </SelectTrigger>
                      <SelectContent>
                        {strategies.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="text-xs">
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumen de selección */}
      <div className="flex items-center justify-between px-1 text-xs">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleSelectAll}
            className="h-7 px-2 text-xs font-semibold"
          >
            {allSelected ? "Desmarcar todos" : "Seleccionar todos"}
          </Button>
          <span className="text-muted-foreground">
            {selectedCount} de {rows.length} seleccionados
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-bold">
          <span>PnL Total:</span>
          <span
            className={cn(
              "rounded-md px-2 py-0.5 font-mono text-xs",
              selectedPnl >= 0 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-destructive/15 text-destructive",
            )}
          >
            {formatCurrency(selectedPnl, true)}
          </span>
        </div>
      </div>

      {/* Tabla detallada de previsualización */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-display text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2.5 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-border"
                />
              </th>
              <th className="p-2.5">Símbolo</th>
              <th className="p-2.5">Tipo</th>
              <th className="p-2.5">Hora</th>
              <th className="p-2.5">PnL ($)</th>
              <th className="p-2.5">Cuenta Asignada</th>
              <th className="p-2.5">Estrategia</th>
              <th className="p-2.5 text-right w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className={cn("hover:bg-muted/30 transition-colors", !r.selected && "opacity-50")}>
                <td className="p-2.5">
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={() => onToggleSelectRow(i)}
                    className="rounded border-border cursor-pointer"
                  />
                </td>

                <td className="p-2.5 font-bold">
                  <Input
                    value={r.symbol}
                    onChange={(e) => onUpdateRow(i, { symbol: e.target.value.toUpperCase() })}
                    className="h-7 w-20 text-xs font-mono font-bold uppercase"
                  />
                </td>

                <td className="p-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateRow(i, { direction: r.direction === "long" ? "short" : "long" })
                    }
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
                      r.direction === "long"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {r.direction}
                  </button>
                </td>

                <td className="p-2.5">
                  <Input
                    type="time"
                    value={r.customTime || "15:30"}
                    onChange={(e) => onUpdateRow(i, { customTime: e.target.value })}
                    className="h-7 w-24 text-xs font-mono"
                  />
                </td>

                <td className="p-2.5">
                  <Input
                    type="number"
                    step="0.01"
                    value={r.pnl}
                    onChange={(e) => onUpdateRow(i, { pnl: Number(e.target.value) || 0 })}
                    className={cn(
                      "h-7 w-24 text-xs font-mono font-bold",
                      r.pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                    )}
                  />
                </td>

                <td className="p-2.5">
                  <Select
                    value={r.assignedAccountId}
                    onValueChange={(val) => onUpdateRow(i, { assignedAccountId: val })}
                  >
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue placeholder="Cuenta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="text-xs">
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>

                <td className="p-2.5">
                  <Select
                    value={r.assignedStrategyId}
                    onValueChange={(val) => onUpdateRow(i, { assignedStrategyId: val })}
                  >
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue placeholder="Estrategia..." />
                    </SelectTrigger>
                    <SelectContent>
                      {strategies.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>

                <td className="p-2.5 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteRow(i)}
                    className="h-7 px-2 text-destructive hover:bg-destructive/10"
                    title="Eliminar fila"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
