import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckSquare,
  Clock,
  Layers,
  LineChart,
  Lock,
  Plus,
  Rocket,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoCockpit } from "@/components/go/go-cockpit";
import { GoWeeklyMatrix } from "@/components/go/go-weekly-matrix";
import { GoRiskBudget } from "@/components/go/go-risk-budget";
import { GoCompliance } from "@/components/go/go-compliance";
import { GoCheatSheet } from "@/components/go/go-cheat-sheet";
import { TradeFormDialog } from "@/components/trade-form-dialog";
import { useAuth } from "@/lib/auth-context";
import { useJournal } from "@/lib/journal-store";
import {
  DEFAULT_PLAN_SETTINGS,
  useTradingPlan,
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
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { activeJournalId, accounts, strategies } = useJournal();

  // Cargar plan y slots
  const { data: planData, isLoading: isLoadingPlan } = useTradingPlan(activeJournalId);
  const plan: TradingPlan = useMemo(() => {
    if (planData) return planData;
    return {
      id: "default-plan",
      journal_id: activeJournalId || "",
      user_id: "",
      ...DEFAULT_PLAN_SETTINGS,
    };
  }, [planData, activeJournalId]);

  const { data: slots = [] } = useTradingPlanSlots(plan.id === "default-plan" ? undefined : plan.id);

  // Pestaña activa dentro de GO
  const [activeTab, setActiveTab] = useState<string>("cockpit");

  // Estado para abrir modal de nuevo trade precargado
  const [tradeFormOpen, setTradeFormOpen] = useState(false);
  const [initialAccountId, setInitialAccountId] = useState<string | undefined>(undefined);
  const [initialStrategyId, setInitialStrategyId] = useState<string | undefined>(undefined);

  const handleOpenTradeForSlot = (accId?: string, stratId?: string) => {
    setInitialAccountId(accId);
    setInitialStrategyId(stratId);
    setTradeFormOpen(true);
  };

  // Si no es admin, pantalla de aviso / restricción
  if (!isAdmin) {
    return (
      <AppShell
        title="GO — Módulo Operativo"
        subtitle="Acceso restringido"
        showAccountPanel={false}
      >
        <div className="mx-auto max-w-md py-16 text-center space-y-4">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
            <Lock className="size-7" />
          </div>
          <h2 className="font-display text-xl font-semibold">Acceso Exclusivo para Administrador</h2>
          <p className="text-xs text-muted-foreground">
            El módulo GO (Diseñador y Gestor de Planing) se encuentra actualmente en fase de calibración para la cuenta de administración.
          </p>
          <Button onClick={() => navigate({ to: "/panel" })} className="gap-1.5 text-xs">
            Volver al Resumen
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background font-bold text-xs tracking-wider">
            GO
          </span>
          <span>Planing & Cockpit Operativo</span>
          <Badge variant="secondary" className="text-[10px] font-mono tracking-widest uppercase">
            Admin Lab
          </Badge>
        </div>
      }
      subtitle="Orquesta tus cuentas, estrategias, horarios semanales (L-V) y gestión de riesgo en un solo centro de mando"
      showAccountPanel={false}
      actions={
        <div className="flex items-center gap-2">
          <TradeFormDialog
            open={tradeFormOpen}
            onOpenChange={setTradeFormOpen}
            trigger={
              <Button size="sm" className="gap-1.5 shadow-xs">
                <Plus className="size-3.5" /> Nueva Operación
              </Button>
            }
          />
        </div>
      }
    >
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1 bg-muted/60">
            <TabsTrigger value="cockpit" className="gap-1.5 py-2 text-xs">
              <Zap className="size-3.5 text-amber-500" />
              <span>Cockpit Hoy</span>
            </TabsTrigger>

            <TabsTrigger value="matrix" className="gap-1.5 py-2 text-xs">
              <CalendarDays className="size-3.5 text-brand" />
              <span>Matriz Semanal (L-V)</span>
            </TabsTrigger>

            <TabsTrigger value="risk" className="gap-1.5 py-2 text-xs">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>Presupuesto & Riesgo</span>
            </TabsTrigger>

            <TabsTrigger value="compliance" className="gap-1.5 py-2 text-xs">
              <LineChart className="size-3.5 text-indigo-500" />
              <span>Cumplimiento</span>
            </TabsTrigger>

            <TabsTrigger value="cheatsheet" className="gap-1.5 py-2 text-xs">
              <CheckSquare className="size-3.5 text-purple-500" />
              <span>Cheat Sheet</span>
            </TabsTrigger>
          </TabsList>

          {/* 1. COCKPIT HOY */}
          <TabsContent value="cockpit" className="space-y-6 m-0">
            <GoCockpit
              plan={plan}
              slots={slots}
              onOpenTradeForm={handleOpenTradeForSlot}
              onNavigateToMatrix={() => setActiveTab("matrix")}
            />
          </TabsContent>

          {/* 2. MATRIZ SEMANAL L-V */}
          <TabsContent value="matrix" className="space-y-6 m-0">
            <GoWeeklyMatrix plan={plan} slots={slots} />
          </TabsContent>

          {/* 3. GESTIÓN DE RIESGO & CIRCUIT BREAKERS */}
          <TabsContent value="risk" className="space-y-6 m-0">
            <GoRiskBudget plan={plan} />
          </TabsContent>

          {/* 4. CUMPLIMIENTO & AUDITORÍA */}
          <TabsContent value="compliance" className="space-y-6 m-0">
            <GoCompliance plan={plan} slots={slots} />
          </TabsContent>

          {/* 5. CHEAT SHEET IMPRIMIBLE */}
          <TabsContent value="cheatsheet" className="space-y-6 m-0">
            <GoCheatSheet plan={plan} slots={slots} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
