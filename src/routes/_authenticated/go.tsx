import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckSquare,
  Edit2,
  FolderKanban,
  Layers,
  LineChart,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoAccountPlanManager } from "@/components/go/go-account-plan-manager";
import { GoCockpit } from "@/components/go/go-cockpit";
import { GoWeeklyMatrix } from "@/components/go/go-weekly-matrix";
import { GoCompliance } from "@/components/go/go-compliance";
import { GoCheatSheet } from "@/components/go/go-cheat-sheet";
import { useJournal } from "@/lib/journal-store";
import {
  DEFAULT_PLAN_SETTINGS,
  generateRecommendedPlanName,
  useDeleteTradingPlan,
  useSaveTradingPlan,
  useTradingPlans,
  useTradingPlanSlots,
  type TradingPlan,
} from "@/lib/planing";

export const Route = createFileRoute("/_authenticated/go")({
  head: () => ({
    meta: [
      { title: "GO — Diseñador & Gestor de Planing | Vita-Trading" },
      {
        name: "description",
        content:
          "Centro de mando operativo de trading: orquestación de cuentas, estrategias, horarios semanales (L-V), reglas de riesgo y checklist diario.",
      },
    ],
  }),
  component: GoPage,
});

function GoPage() {
  const { activeJournalId } = useJournal();

  // 1. Cargar lista de planes del Journal
  const { data: plans = [], isLoading: isLoadingPlans } = useTradingPlans(activeJournalId);
  const savePlanMutation = useSaveTradingPlan(activeJournalId);
  const deletePlanMutation = useDeleteTradingPlan(activeJournalId);

  // 2. Estado de Plan Seleccionado
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Inicializar o sincronizar el plan activo
  useEffect(() => {
    if (plans.length > 0) {
      if (!selectedPlanId || !plans.some((p) => p.id === selectedPlanId)) {
        const preferred = plans.find((p) => p.name?.toLowerCase().includes("oro") || p.name?.toLowerCase().includes("uvi"));
        setSelectedPlanId(preferred ? preferred.id : plans[0]!.id);
      }
    }
  }, [plans, selectedPlanId]);

  const activePlan: TradingPlan = useMemo(() => {
    if (plans.length > 0) {
      const match = plans.find((p) => p.id === selectedPlanId);
      if (match) return match;
      return plans[0]!;
    }
    return {
      id: "default-plan",
      journal_id: activeJournalId || "",
      user_id: "",
      ...DEFAULT_PLAN_SETTINGS,
    };
  }, [plans, selectedPlanId, activeJournalId]);

  // Cargar slots del plan activo
  const { data: slots = [] } = useTradingPlanSlots(
    activePlan.id === "default-plan" ? undefined : activePlan.id,
  );

  // Pestaña activa dentro de GO (por defecto Cockpit Hoy)
  const [activeTab, setActiveTab] = useState<string>("cockpit");

  // Modo configuración de cuentas / planing
  const [isConfiguringAccounts, setIsConfiguringAccounts] = useState(false);

  // Diálogo Nuevo Plan
  const [newPlanDialogOpen, setNewPlanDialogOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");

  // Diálogo Renombrar Plan
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamePlanName, setRenamePlanName] = useState("");

  const handleOpenNewPlanDialog = () => {
    setNewPlanName(generateRecommendedPlanName());
    setNewPlanDialogOpen(true);
  };

  const handleCreateNewPlan = async () => {
    const trimmed = newPlanName.trim();
    if (!trimmed) {
      toast.error("El nombre del plan no puede estar vacío");
      return;
    }
    try {
      const created = await savePlanMutation.mutateAsync({
        ...DEFAULT_PLAN_SETTINGS,
        name: trimmed,
      });
      if (created?.id) {
        setSelectedPlanId(created.id);
      }
      setNewPlanDialogOpen(false);
      setIsConfiguringAccounts(true);
      toast.success(`Plan "${trimmed}" creado. Selecciona ahora las cuentas y horarios.`);
    } catch (err: any) {
      toast.error("Error al crear plan: " + (err.message || ""));
    }
  };

  const handleOpenRenameDialog = () => {
    setRenamePlanName(activePlan.name);
    setRenameDialogOpen(true);
  };

  const handleSaveRenamePlan = async () => {
    if (!renamePlanName.trim()) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    try {
      await savePlanMutation.mutateAsync({
        ...activePlan,
        name: renamePlanName.trim(),
      });
      setRenameDialogOpen(false);
      toast.success("Nombre del plan actualizado");
    } catch (err: any) {
      toast.error("Error al renombrar plan: " + (err.message || ""));
    }
  };

  const handleDeletePlan = async () => {
    if (plans.length <= 1) {
      toast.error("Debes mantener al menos un plan activo");
      return;
    }
    const name = activePlan.name;
    try {
      await deletePlanMutation.mutateAsync(activePlan.id);
      toast.success(`Plan "${name}" eliminado`);
    } catch (err: any) {
      toast.error("Error al eliminar plan: " + (err.message || ""));
    }
  };

  return (
    <AppShell
      title={
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background font-bold text-xs tracking-wider">
            GO
          </span>
          <span>Planing & Gestor Operativo</span>
          <Badge variant="secondary" className="text-[10px] font-mono tracking-widest uppercase">
            Módulo Operativo
          </Badge>
        </div>
      }
      subtitle="Centro de mando operativo: control en vivo, cumplimiento, matriz semanal (L-V) y reglas de disciplina"
      showAccountPanel={false}
    >
      <div className="space-y-6">
        {/* BARRA SUPERIOR: SELECTOR Y GESTOR DE PLANES */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <FolderKanban className="size-4 text-brand shrink-0" />
              <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                Plan Activo:
              </span>
            </div>

            {plans.length > 0 ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select
                  value={activePlan.id}
                  onValueChange={(val) => {
                    setSelectedPlanId(val);
                    setIsConfiguringAccounts(false);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs font-bold w-full sm:w-[260px] bg-background border-2 border-border/80 text-foreground shadow-xs hover:border-foreground/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        <div className="flex items-center justify-between gap-3 w-full">
                          <span>{p.name}</span>
                          {p.created_at && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({new Date(p.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenRenameDialog}
                  title="Cambiar nombre del plan"
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="size-3.5" />
                </Button>

                {plans.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeletePlan}
                    title="Eliminar este plan"
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            ) : (
              <span className="text-xs font-semibold text-foreground">
                {activePlan.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isConfiguringAccounts ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsConfiguringAccounts((prev) => !prev)}
              className="h-8 text-xs gap-1.5 font-medium"
            >
              <Layers className="size-3.5 text-brand" />
              <span>{isConfiguringAccounts ? "Ver Cockpit" : "Configurar Cuentas"}</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleOpenNewPlanDialog}
              className="h-8 text-xs gap-1.5 font-medium shadow-xs"
            >
              <Plus className="size-3.5" />
              <span>Nuevo Plan</span>
            </Button>
          </div>
        </div>

        {/* DIÁLOGO: CREAR NUEVO PLAN */}
        <Dialog open={newPlanDialogOpen} onOpenChange={setNewPlanDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-display">
                <Sparkles className="size-4 text-brand" />
                Crear Nuevo Plan de Trading
              </DialogTitle>
              <DialogDescription className="text-xs">
                Asigna un nombre a tu nuevo plan. Puedes usar la sugerencia automática o personalizarlo como prefieras.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="plan-name" className="text-xs font-medium">
                  Nombre del Plan
                </Label>
                <Input
                  id="plan-name"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="Ej: Plan Fondeo Apex Q3 2026"
                  className="h-9 text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Sugerencia generada según trimestre y mes actual.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewPlanDialogOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleCreateNewPlan}
                disabled={savePlanMutation.isPending}
                className="gap-1.5 text-xs shadow-xs"
              >
                <Check className="size-3.5" />
                Crear y Configurar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIÁLOGO: RENOMBRAR PLAN */}
        <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-display">
                Editar Nombre del Plan
              </DialogTitle>
              <DialogDescription className="text-xs">
                Modifica el nombre del plan seleccionado actualmente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="rename-plan" className="text-xs font-medium">
                  Nombre
                </Label>
                <Input
                  id="rename-plan"
                  value={renamePlanName}
                  onChange={(e) => setRenamePlanName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRenameDialogOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveRenamePlan}
                disabled={savePlanMutation.isPending}
                className="text-xs"
              >
                Guardar Cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* VISTA CONDICIONAL: CONFIGURAR CUENTAS / PLANING O TABS PRINCIPALES */}
        {isConfiguringAccounts ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-muted/40 p-3 rounded-xl border border-border/80">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-brand" />
                <span className="text-xs font-semibold text-foreground">
                  Configurando cuentas y operativa para: <strong>{activePlan.name}</strong>
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfiguringAccounts(false)}
                className="text-xs h-7"
              >
                Volver al Cockpit
              </Button>
            </div>
            <GoAccountPlanManager
              plan={activePlan}
              slots={slots}
              onSaved={() => setIsConfiguringAccounts(false)}
            />
          </div>
        ) : (
          /* PESTAÑAS OPERATIVAS DEL PLAN SELECCIONADO */
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-1 bg-muted/60">
              <TabsTrigger value="cockpit" className="gap-1.5 py-2 text-xs">
                <Zap className="size-3.5 text-amber-500" />
                <span>Cockpit Hoy</span>
              </TabsTrigger>

              <TabsTrigger value="matrix" className="gap-1.5 py-2 text-xs">
                <CalendarDays className="size-3.5 text-indigo-500" />
                <span>Matriz Semanal (L-V)</span>
              </TabsTrigger>

              <TabsTrigger value="compliance" className="gap-1.5 py-2 text-xs">
                <LineChart className="size-3.5 text-emerald-500" />
                <span>Cumplimiento</span>
              </TabsTrigger>

              <TabsTrigger value="cheatsheet" className="gap-1.5 py-2 text-xs">
                <CheckSquare className="size-3.5 text-purple-500" />
                <span>Cheat Sheet</span>
              </TabsTrigger>
            </TabsList>

            {/* 1. COCKPIT HOY (PANEL PRINCIPAL) */}
            <TabsContent value="cockpit" className="space-y-6 m-0">
              <GoCockpit
                plan={activePlan}
                slots={slots}
                onNavigateToMatrix={() => setActiveTab("matrix")}
              />
            </TabsContent>

            {/* 2. MATRIZ SEMANAL L-V */}
            <TabsContent value="matrix" className="space-y-6 m-0">
              <GoWeeklyMatrix plan={activePlan} slots={slots} />
            </TabsContent>

            {/* 3. CUMPLIMIENTO & AUDITORÍA */}
            <TabsContent value="compliance" className="space-y-6 m-0">
              <GoCompliance plan={activePlan} slots={slots} />
            </TabsContent>

            {/* 4. CHEAT SHEET IMPRIMIBLE */}
            <TabsContent value="cheatsheet" className="space-y-6 m-0">
              <GoCheatSheet plan={activePlan} slots={slots} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
