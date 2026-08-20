import { useState } from "react";
import {
  Calendar,
  Clock,
  Edit2,
  Layers,
  MoreVertical,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/lib/journal-store";
import {
  DEFAULT_SESSIONS,
  generateDefaultSlotsFromJournal,
  OPERATING_DAYS,
  useDeletePlanSlot,
  useSavePlanSlot,
  useSeedPlanSlots,
  type TradingPlan,
  type TradingPlanSlot,
} from "@/lib/planing";
import { formatCurrency } from "@/lib/metrics";
import { cn } from "@/lib/utils";

interface GoWeeklyMatrixProps {
  plan: TradingPlan;
  slots: TradingPlanSlot[];
}

export function GoWeeklyMatrix({ plan, slots }: GoWeeklyMatrixProps) {
  const { accounts, strategies, activeJournalId, user } = useJournal();

  const saveSlotMutation = useSavePlanSlot(plan.id, activeJournalId);
  const deleteSlotMutation = useDeletePlanSlot(plan.id);
  const seedSlotsMutation = useSeedPlanSlots(plan.id, activeJournalId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TradingPlanSlot | null>(null);

  // Estado del formulario
  const [formDay, setFormDay] = useState<number>(1);
  const [formSessionName, setFormSessionName] = useState<string>("NY Apertura");
  const [formStartTime, setFormStartTime] = useState<string>("15:30");
  const [formEndTime, setFormEndTime] = useState<string>("17:30");
  const [formAccountId, setFormAccountId] = useState<string>("none");
  const [formStrategyId, setFormStrategyId] = useState<string>("none");
  const [formMaxTrades, setFormMaxTrades] = useState<string>("2");
  const [formRiskAmount, setFormRiskAmount] = useState<string>("250");
  const [formRiskPct, setFormRiskPct] = useState<string>("1.0");
  const [formSymbols, setFormSymbols] = useState<string>("MNQ, NQ");
  const [formSetupNotes, setFormSetupNotes] = useState<string>("");

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const strategyMap = new Map(strategies.map((s) => [s.id, s]));

  const openNewSlotDialog = (dayOfWeek: number = 1) => {
    setEditingSlot(null);
    setFormDay(dayOfWeek);
    setFormSessionName("NY Apertura");
    setFormStartTime("15:30");
    setFormEndTime("17:30");
    setFormAccountId(accounts[0]?.id || "none");
    setFormStrategyId(strategies[0]?.id || "none");
    setFormMaxTrades("2");
    setFormRiskAmount("250");
    setFormRiskPct("1.0");
    setFormSymbols(strategies[0]?.mainSymbol || "MNQ, NQ");
    setFormSetupNotes(strategies[0]?.setup || "");
    setDialogOpen(true);
  };

  const openEditSlotDialog = (slot: TradingPlanSlot) => {
    setEditingSlot(slot);
    setFormDay(slot.day_of_week);
    setFormSessionName(slot.session_name);
    setFormStartTime(slot.start_time);
    setFormEndTime(slot.end_time);
    setFormAccountId(slot.account_id || "none");
    setFormStrategyId(slot.strategy_id || "none");
    setFormMaxTrades(String(slot.max_trades || 2));
    setFormRiskAmount(slot.risk_amount ? String(slot.risk_amount) : "250");
    setFormRiskPct(slot.risk_pct ? String(slot.risk_pct * 100) : "1.0");
    setFormSymbols(slot.allowed_symbols || "MNQ, NQ");
    setFormSetupNotes(slot.setup_notes || "");
    setDialogOpen(true);
  };

  const handleStrategyChange = (stratId: string) => {
    setFormStrategyId(stratId);
    if (stratId !== "none") {
      const s = strategyMap.get(stratId);
      if (s) {
        if (s.mainSymbol) setFormSymbols(s.mainSymbol);
        if (s.setup) setFormSetupNotes(s.setup);
        if (s.riskPct) setFormRiskPct(String((s.riskPct * 100).toFixed(1)));
      }
    }
  };

  const handleQuickSessionPick = (sessionPreset: (typeof DEFAULT_SESSIONS)[number]) => {
    setFormSessionName(sessionPreset.name);
    setFormStartTime(sessionPreset.start);
    setFormEndTime(sessionPreset.end);
    setFormSymbols(sessionPreset.defaultSymbols);
  };

  const handleSubmit = () => {
    if (!formSessionName.trim()) {
      toast.error("Añade un nombre a la sesión");
      return;
    }

    const payload: Partial<TradingPlanSlot> = {
      ...(editingSlot ? { id: editingSlot.id } : {}),
      day_of_week: formDay,
      session_name: formSessionName.trim(),
      start_time: formStartTime.trim() || "15:30",
      end_time: formEndTime.trim() || "17:30",
      account_id: formAccountId === "none" ? null : formAccountId,
      strategy_id: formStrategyId === "none" ? null : formStrategyId,
      max_trades: Math.max(1, parseInt(formMaxTrades, 10) || 2),
      risk_amount: formRiskAmount ? parseFloat(formRiskAmount) : null,
      risk_pct: formRiskPct ? parseFloat(formRiskPct) / 100 : null,
      allowed_symbols: formSymbols.trim() || null,
      setup_notes: formSetupNotes.trim() || null,
      is_active: true,
    };

    saveSlotMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(editingSlot ? "Slot actualizado" : "Slot creado en el horario");
        setDialogOpen(false);
      },
      onError: (err: any) => {
        toast.error("Error al guardar slot: " + (err.message || ""));
      },
    });
  };

  const handleDelete = (slotId: string) => {
    deleteSlotMutation.mutate(slotId, {
      onSuccess: () => toast.success("Slot eliminado del horario"),
      onError: (err: any) => toast.error("Error al eliminar: " + err.message),
    });
  };

  const handleAutoSeed = () => {
    if (!activeJournalId || !user?.id) return;
    if (!strategies.length) {
      toast.error("No tienes estrategias creadas en este diario");
      return;
    }

    const generated = generateDefaultSlotsFromJournal(
      plan.id,
      activeJournalId,
      user.id,
      strategies,
      accounts,
    );

    seedSlotsMutation.mutate(generated, {
      onSuccess: () => {
        toast.success(`Se han generado ${generated.length} slots automáticos de Lunes a Viernes`);
      },
      onError: (err: any) => {
        toast.error("Error al generar slots: " + err.message);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* CABECERA CON ACCIONES */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Matriz Semanal Operativa (Lunes a Viernes)
          </h3>
          <p className="text-xs text-muted-foreground">
            Diseña tu semana de trading: asigna cuentas, estrategias y límites de riesgo para cada día y franja horaria.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoSeed}
            disabled={seedSlotsMutation.isPending || strategies.length === 0}
            className="gap-1.5 text-xs"
          >
            <Sparkles className="size-3.5 text-brand" /> Generar Planing Automático
          </Button>
          <Button
            size="sm"
            onClick={() => openNewSlotDialog(1)}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Plus className="size-3.5" /> Añadir Bloque / Slot
          </Button>
        </div>
      </div>

      {/* GRID SEMANAL DE LUNES A VIERNES */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {OPERATING_DAYS.map((day) => {
          const daySlots = slots.filter((s) => s.day_of_week === day.day && s.is_active);

          return (
            <div
              key={day.day}
              className="flex flex-col rounded-xl border border-border/80 bg-card/60 shadow-xs min-h-[380px]"
            >
              {/* Cabecera del Día */}
              <div className="flex items-center justify-between border-b border-border/70 p-3 bg-muted/30 rounded-t-xl">
                <div>
                  <span className="font-display text-sm font-semibold tracking-tight block">
                    {day.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{day.desc}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openNewSlotDialog(day.day)}
                  className="size-7 text-muted-foreground hover:text-foreground"
                  title={`Añadir slot para ${day.label}`}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>

              {/* Lista de Slots para este día */}
              <div className="flex-1 p-2.5 space-y-2.5">
                {daySlots.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 p-4 text-center">
                    <span className="text-[11px] text-muted-foreground">Sin slots</span>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => openNewSlotDialog(day.day)}
                      className="text-[11px] h-auto p-0 mt-1 text-brand"
                    >
                      + Añadir sesión
                    </Button>
                  </div>
                ) : (
                  daySlots.map((slot) => {
                    const strategy = slot.strategy_id ? strategyMap.get(slot.strategy_id) : null;
                    const account = slot.account_id ? accountMap.get(slot.account_id) : null;

                    return (
                      <div
                        key={slot.id}
                        className="group relative rounded-lg border border-border/80 bg-card p-3 shadow-2xs transition-all hover:border-brand/40 hover:shadow-xs"
                      >
                        {/* Borde de color de estrategia */}
                        <div
                          className="absolute top-0 bottom-0 left-0 w-1 rounded-l-lg"
                          style={{ backgroundColor: strategy?.color || "var(--brand)" }}
                        />

                        <div className="pl-1.5 space-y-2">
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-display text-xs font-semibold leading-tight line-clamp-1">
                              {strategy?.name || slot.session_name}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                                >
                                  <MoreVertical className="size-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-xs">
                                <DropdownMenuItem onClick={() => openEditSlotDialog(slot)}>
                                  <Edit2 className="size-3.5 mr-1.5" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(slot.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="size-3.5 mr-1.5" /> Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Horario */}
                          <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                            <Clock className="size-3" />
                            <span>
                              {slot.start_time} - {slot.end_time}
                            </span>
                          </div>

                          {/* Cuenta */}
                          {account && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                              <Wallet className="size-3 shrink-0" />
                              <span className="truncate">{account.name}</span>
                            </div>
                          )}

                          {/* Chips de Reglas */}
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-mono">
                              Máx {slot.max_trades} trades
                            </Badge>
                            {slot.risk_amount ? (
                              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                                {formatCurrency(slot.risk_amount)}
                              </Badge>
                            ) : slot.risk_pct ? (
                              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                                {(slot.risk_pct * 100).toFixed(1)}%
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DIÁLOGO PARA CREAR / EDITAR SLOT */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {editingSlot ? "Editar Bloque de Sesión" : "Nuevo Bloque Operativo"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configura el día, horario, cuenta, estrategia y riesgo para este bloque.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Presets Rápidos */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Plantillas de Sesión Rápida</Label>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_SESSIONS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleQuickSessionPick(p)}
                    className="rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-[11px] hover:bg-accent hover:text-foreground transition-colors"
                  >
                    {p.name} ({p.start}-{p.end})
                  </button>
                ))}
              </div>
            </div>

            {/* Día y Nombre */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Día Operativo</Label>
                <Select
                  value={String(formDay)}
                  onValueChange={(v) => setFormDay(parseInt(v, 10))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATING_DAYS.map((d) => (
                      <SelectItem key={d.day} value={String(d.day)} className="text-xs">
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Nombre de Sesión</Label>
                <Input
                  value={formSessionName}
                  onChange={(e) => setFormSessionName(e.target.value)}
                  placeholder="Ej: NY Apertura NQ"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Horario */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Hora Inicio</Label>
                <Input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hora Fin</Label>
                <Input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* Estrategia y Cuenta */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Estrategia Asignada</Label>
                <Select value={formStrategyId} onValueChange={handleStrategyChange}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecciona estrategia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      Sin estrategia fija
                    </SelectItem>
                    {strategies.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Cuenta Asignada</Label>
                <Select value={formAccountId} onValueChange={setFormAccountId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecciona cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      Cualquier cuenta
                    </SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.name} ({a.firm || a.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cupo de Trades y Riesgo */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Máx Trades</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={formMaxTrades}
                  onChange={(e) => setFormMaxTrades(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Riesgo ($)</Label>
                <Input
                  type="number"
                  value={formRiskAmount}
                  onChange={(e) => setFormRiskAmount(e.target.value)}
                  placeholder="250"
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Riesgo (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formRiskPct}
                  onChange={(e) => setFormRiskPct(e.target.value)}
                  placeholder="1.0"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* Símbolos permitidos y Notas de Setup */}
            <div className="space-y-1.5">
              <Label className="text-xs">Símbolos Autorizados</Label>
              <Input
                value={formSymbols}
                onChange={(e) => setFormSymbols(e.target.value)}
                placeholder="MNQ, NQ, ES..."
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Instrucciones / Setup para esta Sesión</Label>
              <Input
                value={formSetupNotes}
                onChange={(e) => setFormSetupNotes(e.target.value)}
                placeholder="Ej: Ruptura de rango inicial con confirmación de volumen..."
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saveSlotMutation.isPending}>
              {editingSlot ? "Guardar Cambios" : "Crear Slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
