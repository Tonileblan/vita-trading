import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  Eye,
  Filter,
  History as HistoryIcon,
  Layers,
  List as ListIcon,
  Percent,
  Plus,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Trash2,
  Undo2,
  Upload,
  User,
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
import { TradesTable, type SortDirection, type TradeSortField } from "@/components/trades-table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSupervisorFilter } from "@/hooks/use-supervisor-filter";
import {
  useJournal,
  toAccount,
  toStrategy,
  toTrade,
  toWithdrawal,
  toPeriod,
} from "@/lib/journal-store";
import { computeMetrics, effectiveStrategyId, formatCurrency, formatDateTime } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operaciones")({
  head: () => ({
    meta: [
      { title: "Operaciones — Vita-Trading" },
      {
        name: "description",
        content:
          "Registro detallado de operaciones de Vita-Trading con filtrado, estadísticas y análisis por estrategia.",
      },
      { property: "og:title", content: "Operaciones — Vita-Trading" },
      {
        property: "og:description",
        content:
          "Consulta, filtra y categoriza todas las ejecuciones registradas en tus cuentas de fondeo y personales.",
      },
    ],
  }),
  component: TradesPage,
});

type Pending =
  { kind: "trades"; ids: string[]; label: string } | { kind: "batch"; id: string; label: string };

function TradesPage() {
  const { isSupervisor, isAdmin, user, canEditOtherUsers } = useAuth();
  const journalStore = useJournal();
  const {
    importBatches,
    removeTrades,
    removeImportBatch,
    selectAll,
  } = journalStore;

  const {
    selectedUserFilter: supervisorUserFilter,
    setSelectedUserFilter: setSupervisorUserFilter,
    availableUsers: svProfiles,
    isSupervisingOther: isSupervisedView,
    isReadOnly,
  } = useSupervisorFilter();

  const { data: svData } = useQuery({
    queryKey: ["sv-operaciones-data", supervisorUserFilter],
    enabled: (isSupervisor || isAdmin) && supervisorUserFilter !== "mine",
    queryFn: async () => {
      const targetUserId = supervisorUserFilter;
      const [accs, trds, strats, wds, pers] = await Promise.all([
        supabase.from("accounts").select("*").eq("user_id", targetUserId),
        supabase
          .from("trades")
          .select("*")
          .eq("user_id", targetUserId)
          .order("closed_at", { ascending: false }),
        supabase.from("strategies").select("*").eq("user_id", targetUserId),
        supabase
          .from("withdrawals")
          .select("*")
          .eq("user_id", targetUserId)
          .order("date", { ascending: false }),
        supabase
          .from("account_strategy_periods")
          .select("*")
          .eq("user_id", targetUserId)
          .order("start_date", { ascending: true }),
      ]);
      return {
        accounts: (accs.data ?? []).map((r) => toAccount(r as Record<string, unknown>)),
        trades: (trds.data ?? []).map((r) => toTrade(r as Record<string, unknown>)),
        strategies: (strats.data ?? []).map((r) => toStrategy(r as Record<string, unknown>)),
        withdrawals: (wds.data ?? [])
          .map((r) => toWithdrawal(r as Record<string, unknown>))
          .filter((w) => w.status === "approved"),
        strategyPeriods: (pers.data ?? []).map((r) => toPeriod(r as Record<string, unknown>)),
      };
    },
  });

  const canEdit = !isReadOnly;

  const accounts = useMemo(
    () => (isSupervisedView ? (svData?.accounts ?? []) : (journalStore.accounts ?? [])),
    [isSupervisedView, svData?.accounts, journalStore.accounts],
  );
  const strategies = useMemo(
    () => (isSupervisedView ? (svData?.strategies ?? []) : (journalStore.strategies ?? [])),
    [isSupervisedView, svData?.strategies, journalStore.strategies],
  );
  const allTrades = useMemo(
    () => (isSupervisedView ? (svData?.trades ?? []) : (journalStore.trades ?? [])),
    [isSupervisedView, svData?.trades, journalStore.trades],
  );
  const visibleTrades = useMemo(
    () => (isSupervisedView ? allTrades : (journalStore.visibleTrades ?? allTrades)),
    [isSupervisedView, allTrades, journalStore.visibleTrades],
  );
  const strategyPeriods = useMemo(
    () => (isSupervisedView ? (svData?.strategyPeriods ?? []) : (journalStore.strategyPeriods ?? [])),
    [isSupervisedView, svData?.strategyPeriods, journalStore.strategyPeriods],
  );
  const selectedAccountIds = useMemo(
    () => (isSupervisedView ? accounts.map((a) => a.id) : (journalStore.selectedAccountIds ?? [])),
    [isSupervisedView, accounts, journalStore.selectedAccountIds],
  );

  const [query, setQuery] = useState("");
  // Filtro unificado idéntico a Resumen: "all" | account.id | `strategy:${strategyId}`
  const [filter, setFilter] = useState<string>("all");
  const isStrategy = filter.startsWith("strategy:");
  const accountFilter = isStrategy ? "all" : filter;
  const strategyFilter = isStrategy ? filter.slice("strategy:".length) : "all";

  const selectedAccounts = useMemo(
    () =>
      accounts.filter((a) =>
        accountFilter === "all" ? selectedAccountIds.includes(a.id) : a.id === accountFilter,
      ),
    [accounts, selectedAccountIds, accountFilter],
  );
  const scopedIds = useMemo(() => new Set(selectedAccounts.map((a) => a.id)), [selectedAccounts]);

  const accountStrategies = useMemo(() => {
    if (accountFilter === "all") return strategies;
    const used = new Set(
      visibleTrades
        .filter((t) => t.accountId === accountFilter)
        .map((t) => effectiveStrategyId(t, accounts, strategyPeriods)),
    );
    const filtered = strategies.filter((s) => used.has(s.id));
    return filtered.length ? filtered : strategies;
  }, [strategies, visibleTrades, accountFilter, accounts, strategyPeriods]);

  const scopedTrades = useMemo(
    () =>
      visibleTrades.filter(
        (t) =>
          (scopedIds.size === 0 || scopedIds.has(t.accountId) || !t.accountId) &&
          (strategyFilter === "all" ||
            effectiveStrategyId(t, accounts, strategyPeriods) === strategyFilter ||
            t.strategyId === strategyFilter),
      ),
    [visibleTrades, scopedIds, strategyFilter, accounts, strategyPeriods],
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [working, setWorking] = useState(false);
  const [sortField, setSortField] = useState<TradeSortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [tab, setTab] = useState<"operaciones" | "importaciones">("operaciones");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filtered = useMemo(
    () =>
      scopedTrades
        .filter((t) => {
          // Búsqueda por texto (símbolo, notas, nombre de cuenta o etiquetas)
          if (query && query.trim()) {
            const q = query.toLowerCase().trim();
            const matchesSymbol = (t.symbol || "").toLowerCase().includes(q);
            const matchesNotes = (t.notes || "").toLowerCase().includes(q);
            const matchesTags = (t.tags || []).some((tag) => tag.toLowerCase().includes(q));
            const accName = accounts.find((a) => a.id === t.accountId)?.name.toLowerCase() ?? "";
            const matchesAccount = accName.includes(q);
            if (!matchesSymbol && !matchesNotes && !matchesTags && !matchesAccount) {
              return false;
            }
          }

          return true;
        })
        .sort((a, b) => {
          let cmp = 0;
          if (sortField === "date") {
            const aTime = new Date(a.openedAt || a.closedAt || a.createdAt || "").getTime() || 0;
            const bTime = new Date(b.openedAt || b.closedAt || b.createdAt || "").getTime() || 0;
            cmp = aTime - bTime;
          } else if (sortField === "strategy") {
            const aStratId = effectiveStrategyId(a, accounts, strategyPeriods) || a.strategyId;
            const bStratId = effectiveStrategyId(b, accounts, strategyPeriods) || b.strategyId;
            const aStrat = strategies.find((s) => s.id === aStratId)?.name || "";
            const bStrat = strategies.find((s) => s.id === bStratId)?.name || "";
            if (!aStrat && bStrat) return 1;
            if (aStrat && !bStrat) return -1;
            cmp = aStrat.localeCompare(bStrat, "es", { sensitivity: "base" });
          } else if (sortField === "pnl") {
            cmp = (a.pnl ?? 0) - (b.pnl ?? 0);
          } else if (sortField === "account") {
            const aName = accounts.find((acc) => acc.id === a.accountId)?.name ?? "";
            const bName = accounts.find((acc) => acc.id === b.accountId)?.name ?? "";
            cmp = aName.localeCompare(bName, "es", { sensitivity: "base" });
          } else if (sortField === "symbol") {
            cmp = (a.symbol || "").localeCompare(b.symbol || "", "es", { sensitivity: "base" });
          }
          return sortDirection === "asc" ? cmp : -cmp;
        }),
    [scopedTrades, accounts, strategies, strategyPeriods, query, sortField, sortDirection],
  );

  const handleSortChange = (field: TradeSortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedTrades = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const m = useMemo(() => computeMetrics(filtered), [filtered]);

  const confirm = async () => {
    if (!pending || !canEdit) return;
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
      subtitle={
        isSupervisedView
          ? `Supervisando a ${svProfiles.find((p) => p.id === supervisorUserFilter)?.display_name ?? "usuario"} · ${accounts.length} cuenta(s) · ${filtered.length} operación(es)`
          : "Supervisa cada trade registrado, clasifícalo por estrategia e importa ejecuciones masivas"
      }
      actions={
        canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <TradeImportDialog />
            <TradeFormDialog />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full border-2 border-sky-600/40 bg-sky-500/15 px-3 py-1 text-xs font-bold text-sky-900 dark:text-sky-100 shadow-xs">
            <ShieldCheck className="size-4 text-sky-600 dark:text-sky-400" />
            <span>Modo Supervisión: Solo Lectura</span>
          </div>
        )
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
            {/* Banner informativo de supervisión */}
            {isSupervisedView && (
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 px-4 py-2.5 text-xs font-medium shadow-xs",
                  canEdit
                    ? "border-amber-500/50 bg-amber-500/15 text-amber-950 dark:text-amber-100"
                    : "border-sky-600/50 bg-sky-500/15 text-sky-950 dark:text-sky-100",
                )}
              >
                <div className="flex items-center gap-2">
                  {canEdit ? (
                    <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <ShieldCheck className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
                  )}
                  <span className="font-semibold">
                    {canEdit
                      ? "Modo edición de supervisión activo: Las modificaciones y eliminaciones afectarán directamente a los datos de este usuario."
                      : "Modo supervisión (Solo lectura): No se pueden editar ni eliminar datos de otros usuarios."}
                  </span>
                </div>
                {!canEdit && isAdmin && (
                  <span className="text-[11px] text-muted-foreground">
                    (Puedes habilitar la edición desde tu Perfil de Administrador)
                  </span>
                )}
              </div>
            )}

            {/* Banner informativo de filtro lateral activo */}
            {!isSupervisedView &&
              selectedAccountIds.length < accounts.length &&
              accountFilter === "all" && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                    <span>
                      Filtro lateral activo: se muestran solo {visibleTrades.length} operaciones de{" "}
                      {selectedAccountIds.length} de {accounts.length} cuentas.
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-500/40 text-amber-100 hover:bg-amber-500/20"
                    onClick={selectAll}
                  >
                    Mostrar todas las cuentas
                  </Button>
                </div>
              )}

            {/* Filter Toolbar */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* Izquierda: Selectores de Diario y Entidad (TODO / Cuentas / Estrategias) */}
              <div className="flex flex-wrap items-center gap-2">
              {(isSupervisor || isAdmin) && svProfiles.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border-2 border-brand/70 bg-brand/10 px-2.5 py-1.5 shadow-xs transition-colors hover:border-brand">
                  <User className="size-4 text-brand shrink-0" />
                  <select
                    value={supervisorUserFilter}
                    onChange={(e) => {
                      setSupervisorUserFilter(e.target.value);
                      setFilter("all");
                      setPage(1);
                    }}
                    className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer [&>option]:bg-popover [&>option]:text-popover-foreground [&>optgroup]:bg-popover [&>optgroup]:text-muted-foreground"
                    aria-label="Ver operaciones de usuario"
                  >
                    <option value="mine">📖 Mi diario personal</option>
                    <optgroup label="Usuarios registrados">
                      {svProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.display_name ?? `Usuario ${p.id.slice(0, 6)}`}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-lg border-2 border-border/90 bg-muted/60 dark:bg-muted/30 px-2.5 py-1.5 shadow-xs transition-colors hover:border-foreground/40">
                <Filter className="size-4 text-brand shrink-0" />
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer [&>option]:bg-popover [&>option]:text-popover-foreground [&>optgroup]:bg-popover [&>optgroup]:text-muted-foreground"
                  aria-label="Cuenta o estrategia"
                >
                  <option value="all">🌐 Todas las cuentas y estrategias</option>
                  {accounts.filter((a) => a.type === "funded").length > 0 && (
                    <optgroup label="🏢 Cuentas de Fondeo">
                      {accounts
                        .filter((a) => a.type === "funded")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                  {accounts.filter((a) => a.type !== "funded").length > 0 && (
                    <optgroup label="👤 Cuentas Personales">
                      {accounts
                        .filter((a) => a.type !== "funded")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                  {accountStrategies.length > 0 && (
                    <optgroup label="⚡ Estrategias">
                      {accountStrategies.map((s) => (
                        <option key={s.id} value={`strategy:${s.id}`}>
                          Estrategia: {s.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

              {/* Derecha: Buscador y Botón de Ordenación */}
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px] md:justify-end">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 h-9 text-xs"
                    placeholder="Buscar activo (NQ, EURUSD, BTC…)"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 text-xs"
                  onClick={() => {
                    if (sortField === "date") {
                      setSortDirection((d) => (d === "desc" ? "asc" : "desc"));
                    } else {
                      setSortField("date");
                      setSortDirection("desc");
                    }
                    setPage(1);
                  }}
                  title="Alternar orden"
                >
                  <ArrowUpDown className="size-3.5" />
                  {sortField === "date"
                    ? sortDirection === "desc"
                      ? "Fecha: Más recientes"
                      : "Fecha: Más antiguas"
                    : sortField === "strategy"
                      ? sortDirection === "asc"
                        ? "Estrategia: A → Z"
                        : "Estrategia: Z → A"
                      : sortField === "pnl"
                        ? sortDirection === "desc"
                          ? "PnL: Mayor a menor"
                          : "PnL: Menor a mayor"
                        : sortField === "account"
                          ? sortDirection === "asc"
                            ? "Cuenta: A → Z"
                            : "Cuenta: Z → A"
                          : "Orden: " + sortField}
                </Button>
              </div>
            </div>

            {/* Bulk Selection Bar */}
            {canEdit && selected.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand/5 p-3 text-sm">
                <span className="font-semibold text-foreground">
                  {selected.length}{" "}
                  {selected.length === 1 ? "operación seleccionada" : "operaciones seleccionadas"}
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
              trades={paginatedTrades}
              accounts={accounts}
              strategies={strategies}
              strategyPeriods={strategyPeriods}
              selectedIds={selected}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
              readOnly={!canEdit}
              onToggleSelect={
                canEdit
                  ? (id) =>
                      setSelected((prev) =>
                        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                      )
                  : undefined
              }
              onDelete={
                canEdit
                  ? (t) =>
                      setPending({
                        kind: "trades",
                        ids: [t.id],
                        label: `Se eliminará la operación de ${t.symbol} (${formatCurrency(t.pnl, true)}) y se recalculará el balance.`,
                      })
                  : undefined
              }
            />

            {/* Paginación de Operaciones */}
            {filtered.length > pageSize && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>
                    Mostrando {(page - 1) * pageSize + 1}–
                    {Math.min(page * pageSize, filtered.length)} de {filtered.length} operaciones
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-7 rounded border border-border bg-card px-1.5 text-xs text-foreground"
                  >
                    <option value={25}>25 / pág.</option>
                    <option value={50}>50 / pág.</option>
                    <option value={100}>100 / pág.</option>
                    <option value={200}>200 / pág.</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="px-2 font-medium text-foreground">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: IMPORTACIONES */}
        {tab === "importaciones" && (
          <div className="panel space-y-4 p-5">
            <div>
              <h3 className="text-base font-bold">Lotes e Historial de Importación</h3>
              <p className="text-xs text-muted-foreground">
                Revisa las importaciones realizadas por captura, CSV o manual y deshazlas si
                necesitas revertir los datos.
              </p>
            </div>

            {importBatches.length === 0 ? (
              <div className="rounded-xl border border-border/80 bg-muted/20 p-8 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Aún no hay importaciones registradas.
                </p>
                {canEdit && <TradeImportDialog />}
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

                    {canEdit && (
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
                    )}
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
