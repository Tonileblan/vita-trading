import { useState, useMemo, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  Sparkles,
  AlertTriangle,
  FileText,
  MessageSquare,
  Bot,
  User,
  Send,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Target,
  Flame,
  ArrowRight,
  TrendingDown,
  Brain,
  Sliders,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/lib/journal-store";
import { useCheckins, useJournalRules, DEFAULT_RULES } from "@/lib/mood";
import { todayKey } from "@/lib/emotions";
import {
  computeAuditorStatus,
  formatAuditorContextForPrompt,
  type AuditorContextData,
} from "@/lib/ai-auditor-context";
import { runAiAuditorServerFn } from "@/lib/ai-auditor.functions";
import {
  getActiveAiProvider,
  getAiApiKey,
  setAiApiKey,
  getAiModel,
  AI_PROVIDERS,
} from "@/lib/ai-providers";
import { setLocalGoogleAiKey } from "@/lib/google-ai";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export function MarkdownContent({ content }: { content: string }) {
  // Parser ligero de Markdown para renderizar títulos, negritas, listas y bloques
  const lines = content.split("\n");

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="pt-2 font-display text-base font-semibold tracking-wide text-foreground">
              {trimmed.replace(/^###\s+/, "")}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="border-b border-border/40 pb-1 pt-3 font-display text-lg font-bold text-foreground">
              {trimmed.replace(/^##\s+/, "")}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} className="border-b border-border pb-1 pt-3 font-display text-xl font-bold text-foreground">
              {trimmed.replace(/^#\s+/, "")}
            </h2>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const text = trimmed.replace(/^[-*]\s+/, "");
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
              <div
                className="flex-1"
                dangerouslySetInnerHTML={{
                  __html: formatInlineMarkdown(text),
                }}
              />
            </div>
          );
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const num = trimmed.match(/^(\d+)\.\s+/)?.[1] || "1";
          const text = trimmed.replace(/^\d+\.\s+/, "");
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="font-semibold text-brand">{num}.</span>
              <div
                className="flex-1"
                dangerouslySetInnerHTML={{
                  __html: formatInlineMarkdown(text),
                }}
              />
            </div>
          );
        }
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-brand bg-accent/40 px-3 py-1.5 text-xs italic text-muted-foreground"
              dangerouslySetInnerHTML={{
                __html: formatInlineMarkdown(trimmed.replace(/^>\s+/, "")),
              }}
            />
          );
        }
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        return (
          <p
            key={idx}
            dangerouslySetInnerHTML={{
              __html: formatInlineMarkdown(trimmed),
            }}
          />
        );
      })}
    </div>
  );
}

function formatInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-brand">$1</code>');
}

export function AiAuditorPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { strategies, accounts, trades, activeJournalId } = useJournal();
  const { data: rules = DEFAULT_RULES } = useJournalRules(activeJournalId);
  const { data: checkins = [] } = useCheckins(activeJournalId);

  const runAuditorFn = useServerFn(runAiAuditorServerFn);

  const today = todayKey();
  const todayCheckin = checkins.find((c) => c.date === today) || null;

  // Compilar contexto
  const ctxData: AuditorContextData = useMemo(
    () => ({
      strategies,
      accounts,
      trades,
      rules,
      todayCheckin,
    }),
    [strategies, accounts, trades, rules, todayCheckin],
  );

  const statusSummary = useMemo(() => computeAuditorStatus(ctxData), [ctxData]);
  const contextPrompt = useMemo(() => formatAuditorContextForPrompt(ctxData), [ctxData]);

  const [activeTab, setActiveTab] = useState<"audit" | "plan" | "chat">("audit");
  const [loading, setLoading] = useState(false);
  const [auditReport, setAuditReport] = useState<string | null>(null);

  // Formulario de Solicitud de Plan
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [planType, setPlanType] = useState<string>("pre_session");
  const [marketContext, setMarketContext] = useState<string>("");
  const [psychologicalState, setPsychologicalState] = useState<string>("neutral");
  const [specificGoal, setSpecificGoal] = useState<string>("");
  const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hola. Soy tu **Auditor de Trading y Coach Cuantitativo**. Conozco tus estrategias, cuentas y reglas del diario. ¿En qué te puedo ayudar hoy con tu operativa o gestión de riesgo?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current && activeTab === "chat") {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  // Selección por defecto
  useEffect(() => {
    if (strategies.length > 0 && !selectedStrategyId) {
      setSelectedStrategyId(strategies[0]!.id);
    }
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0]!.id);
    }
  }, [strategies, accounts, selectedStrategyId, selectedAccountId]);

  // Obtener proveedor de IA activo del usuario
  const providerId = getActiveAiProvider();
  const providerConfig = AI_PROVIDERS[providerId];
  const [userApiKey, setUserApiKey] = useState(() => getAiApiKey(providerId));
  const userModel = getAiModel(providerId);

  const [showInlineKeySetup, setShowInlineKeySetup] = useState(false);
  const [inlineKeyInput, setInlineKeyInput] = useState("");

  useEffect(() => {
    setUserApiKey(getAiApiKey(providerId));
  }, [providerId, open]);

  const handleSaveInlineKey = () => {
    if (!inlineKeyInput.trim()) {
      toast.error("Introduce una clave API válida");
      return;
    }
    setLocalGoogleAiKey(inlineKeyInput.trim());
    setAiApiKey(inlineKeyInput.trim(), "google");
    setUserApiKey(inlineKeyInput.trim());
    setShowInlineKeySetup(false);
    toast.success("Clave de Google Gemini guardada y sincronizada en todos tus dispositivos");
  };

  // Ejecutar Auditoría
  const handleRunAudit = async () => {
    setLoading(true);
    try {
      const res = await runAuditorFn({
        data: {
          mode: "audit_session",
          contextText: contextPrompt,
          provider: providerId,
          apiKey: userApiKey,
          model: userModel,
        },
      });
      if (res.success && res.content) {
        setAuditReport(res.content);
        toast.success("Auditoría de sesión completada");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al ejecutar la auditoría");
    } finally {
      setLoading(false);
    }
  };

  // Generar Plan de Trading
  const handleGeneratePlan = async () => {
    setLoading(true);
    try {
      const strat = strategies.find((s) => s.id === selectedStrategyId);
      const acc = accounts.find((a) => a.id === selectedAccountId);

      const planGoalText =
        planType === "pre_session"
          ? "Plan Pre-Sesión de Trading detallado"
          : planType === "risk_reduction"
            ? "Plan de Reducción de Riesgo y Control de Racha"
            : planType === "recovery"
              ? "Plan de Recuperación de Drawdown / Fondeo"
              : specificGoal || "Plan de operativa personalizada";

      const res = await runAuditorFn({
        data: {
          mode: "generate_plan",
          contextText: contextPrompt,
          planRequest: {
            strategyId: strat?.id,
            strategyName: strat?.name,
            accountId: acc?.id,
            accountName: acc?.name,
            marketContext: marketContext.trim() || undefined,
            psychologicalState,
            specificGoal: planGoalText + (specificGoal ? ` · Detalle: ${specificGoal}` : ""),
          },
          provider: providerId,
          apiKey: userApiKey,
          model: userModel,
        },
      });

      if (res.success && res.content) {
        setGeneratedPlan(res.content);
        toast.success("Plan generado correctamente");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al generar el plan de trading");
    } finally {
      setLoading(false);
    }
  };

  // Enviar mensaje en Chat
  const handleSendMessage = async (customText?: string) => {
    const text = (customText || inputQuery).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setLoading(true);

    try {
      const history = chatMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const res = await runAuditorFn({
        data: {
          mode: "chat",
          contextText: contextPrompt,
          userPrompt: text,
          history,
          provider: providerId,
          apiKey: userApiKey,
          model: userModel,
        },
      });

      if (res.success && res.content) {
        const assistantMsg: Message = {
          id: String(Date.now() + 1),
          role: "assistant",
          content: res.content,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al obtener respuesta de la IA");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-[100dvh] max-h-[100dvh] w-full flex-col border-l border-border bg-card p-0 sm:max-w-xl md:max-w-2xl overscroll-contain"
      >
        {/* CABECERA */}
        <SheetHeader className="border-b border-border px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-md",
                  statusSummary.status === "danger"
                    ? "bg-loss/20 text-loss"
                    : statusSummary.status === "warning"
                      ? "bg-amber-500/20 text-amber-500"
                      : "bg-profit/20 text-profit",
                )}
              >
                {statusSummary.status === "danger" ? (
                  <ShieldAlert className="size-5" />
                ) : statusSummary.status === "warning" ? (
                  <AlertTriangle className="size-5" />
                ) : (
                  <ShieldCheck className="size-5" />
                )}
              </div>
              <div>
                <SheetTitle className="font-display text-lg sm:text-xl tracking-wide">
                  Auditor IA & Trading Coach
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Auditoría continua, cumplimiento de estrategias y gestión de riesgo
                </SheetDescription>
              </div>
            </div>

            <Badge
              variant="outline"
              className="text-[10px] uppercase font-bold tracking-wider text-brand border-brand/35 bg-brand/5 gap-1 shrink-0"
            >
              <Sparkles className="size-2.5 text-brand" />
              {userApiKey ? `Clave Propia (${providerConfig.name})` : "IA Integrada Activa"}
            </Badge>
          </div>
        </SheetHeader>

        {/* CONTENIDO PRINCIPAL CON PESTAÑAS */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="border-b border-border bg-muted/40 px-5 pt-2">
            <TabsList className="grid w-full grid-cols-3 bg-muted">
              <TabsTrigger value="audit" className="gap-1.5 text-xs">
                <Shield className="size-3.5" />
                <span>Auditoría</span>
                {statusSummary.activeAlerts.length > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-loss text-[10px] font-bold text-white">
                    {statusSummary.activeAlerts.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="plan" className="gap-1.5 text-xs">
                <FileText className="size-3.5" />
                <span>Pedir Plan</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-1.5 text-xs">
                <MessageSquare className="size-3.5" />
                <span>Chat Coach</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 1. PESTAÑA: AUDITORÍA EN VIVO */}
          <TabsContent value="audit" className="flex-1 overflow-y-auto p-5 space-y-5 m-0">
            {/* Tarjeta de Estado Rápido */}
            <div
              className={cn(
                "rounded-lg border p-4",
                statusSummary.status === "danger"
                  ? "border-loss/40 bg-loss/10"
                  : statusSummary.status === "warning"
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-profit/40 bg-profit/10",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm uppercase tracking-wider text-muted-foreground">
                  Estado de Riesgo Hoy
                </span>
                <span
                  className={cn(
                    "text-xs font-bold uppercase",
                    statusSummary.status === "danger"
                      ? "text-loss"
                      : statusSummary.status === "warning"
                        ? "text-amber-500"
                        : "text-profit",
                  )}
                >
                  {statusSummary.status === "danger"
                    ? "Alerta de Riesgo"
                    : statusSummary.status === "warning"
                      ? "Precaución"
                      : "Plan en Orden"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-3 text-center">
                <div>
                  <span className="text-[11px] text-muted-foreground">PnL Hoy</span>
                  <p
                    className={cn(
                      "font-display text-base font-bold",
                      statusSummary.todayPnl > 0
                        ? "text-profit"
                        : statusSummary.todayPnl < 0
                          ? "text-loss"
                          : "text-foreground",
                    )}
                  >
                    {statusSummary.todayPnl >= 0 ? "+" : ""}${statusSummary.todayPnl.toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">Setups / Órdenes</span>
                  <p className="font-display text-base font-bold text-foreground">
                    {statusSummary.todayUniqueSetupsCount}
                    {statusSummary.todayTradesCount !== statusSummary.todayUniqueSetupsCount && (
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        ({statusSummary.todayTradesCount} accs)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">Racha Máx / Cuenta</span>
                  <p
                    className={cn(
                      "font-display text-base font-bold",
                      statusSummary.maxAccountStreak >= 2 ? "text-loss" : "text-foreground",
                    )}
                  >
                    {statusSummary.maxAccountStreak}
                  </p>
                </div>
              </div>
            </div>

            {/* Desglose de Cuentas y Réplicas Multicuenta */}
            {statusSummary.simultaneousGroups.some((g) => g.isMultiAccount) && (
              <div className="rounded-md border border-brand/40 bg-accent/30 p-3 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Sliders className="size-3.5 text-brand" />
                  <span>Detección de Operativa Multicuenta (Copier)</span>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  El auditor reconoce entradas simultáneas en varias cuentas como <strong>un único setup replicado</strong>, evitando falsas alertas de sobreoperativa y evaluando el riesgo de correlación de cartera.
                </p>
              </div>
            )}

            {/* Lista de Alertas Activas */}
            {statusSummary.activeAlerts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Alertas del Auditor
                </Label>
                <div className="space-y-2">
                  {statusSummary.activeAlerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 rounded-md border border-loss/30 bg-loss/5 p-3 text-xs leading-relaxed text-loss"
                    >
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      <span>{alert}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checklist de Reglas */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Reglas y Parámetros Operativos
              </Label>
              <div className="space-y-2 rounded-md border border-border bg-card p-3 text-xs">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Racha máxima permitida:</span>
                  <span className="font-semibold">
                    {rules.max_loss_streak > 0 ? `${rules.max_loss_streak} pérdidas` : "Sin límite"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Límite operaciones/día:</span>
                  <span className="font-semibold">
                    {rules.max_trades_day > 0 ? `${rules.max_trades_day} trades` : "Sin límite"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Pérdida máxima diaria:</span>
                  <span className="font-semibold">
                    {rules.max_daily_loss ? `$${rules.max_daily_loss}` : "Sin límite"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estrategias activas:</span>
                  <span className="font-semibold">{strategies.length} configuradas</span>
                </div>
              </div>
            </div>

            {/* Botón de Auditoría Profunda */}
            <Button
              onClick={handleRunAudit}
              disabled={loading}
              className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Auditando operativa...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 text-brand" />
                  Ejecutar Auditoría Completa de la Sesión
                </>
              )}
            </Button>

            {/* Resultado de la Auditoría */}
            {auditReport && (
              <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="font-display text-base font-semibold text-foreground">
                    Informe del Auditor
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(auditReport)}
                    className="h-7 px-2 text-xs"
                  >
                    <Copy className="mr-1 size-3" /> Copiar
                  </Button>
                </div>
                <MarkdownContent content={auditReport} />
              </div>
            )}
          </TabsContent>

          {/* 2. PESTAÑA: SOLICITAR PLAN Y ASISTENCIA */}
          <TabsContent value="plan" className="flex-1 overflow-y-auto p-5 space-y-4 m-0">
            <div className="space-y-1">
              <h3 className="font-display text-lg font-bold">Solicitar Plan de Trading</h3>
              <p className="text-xs text-muted-foreground">
                La IA adaptará el plan a la plantilla de tu estrategia y al tamaño de tu cuenta.
              </p>
            </div>

            <div className="grid gap-3">
              {/* Tipo de Solicitud */}
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Plan</Label>
                <Select value={planType} onValueChange={setPlanType}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre_session">Plan Pre-Sesión (Bias, Setups y Niveles)</SelectItem>
                    <SelectItem value="risk_reduction">Ajuste de Riesgo por Racha Negativa</SelectItem>
                    <SelectItem value="recovery">Plan de Rescate de Cuenta de Fondeo</SelectItem>
                    <SelectItem value="custom">Consulta / Plan a Medida</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Selector de Estrategia */}
              <div className="space-y-1.5">
                <Label className="text-xs">Estrategia Base</Label>
                <Select value={selectedStrategyId} onValueChange={setSelectedStrategyId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Selecciona una estrategia..." />
                  </SelectTrigger>
                  <SelectContent>
                    {strategies.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.mainSymbol} · {(s.riskPct * 100).toFixed(1)}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selector de Cuenta */}
              <div className="space-y-1.5">
                <Label className="text-xs">Cuenta Asignada</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Selecciona una cuenta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} (${a.currentBalance.toFixed(0)} · {a.type === "funded" ? "Fondeo" : "Personal"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contexto de Mercado */}
              <div className="space-y-1.5">
                <Label className="text-xs">Contexto de Mercado / Noticias de Hoy</Label>
                <Input
                  value={marketContext}
                  onChange={(e) => setMarketContext(e.target.value)}
                  placeholder="Ej: Noticias FOMC a las 14:00, bias alcista en apertura de NY, zona clave 18.250"
                  className="text-xs"
                />
              </div>

              {/* Estado Psicológico */}
              <div className="space-y-1.5">
                <Label className="text-xs">Tu Estado Mental Actual</Label>
                <Select value={psychologicalState} onValueChange={setPsychologicalState}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enfocado">Tranquilo, enfocado y con paciencia</SelectItem>
                    <SelectItem value="euforico">Eufórico / Muy confiado (riesgo de exceso de apalancamiento)</SelectItem>
                    <SelectItem value="frustrado">Frustrado o cansado (recuperándose de pérdidas)</SelectItem>
                    <SelectItem value="ansioso">Ansioso por entrar al mercado rápido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Objetivo Específico */}
              <div className="space-y-1.5">
                <Label className="text-xs">Detalles u Objetivo Específico</Label>
                <Textarea
                  value={specificGoal}
                  onChange={(e) => setSpecificGoal(e.target.value)}
                  placeholder="¿Alguna duda sobre contratos, invalidación o si operar hoy?"
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              <Button
                onClick={handleGeneratePlan}
                disabled={loading}
                className="mt-2 w-full gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Diseñando plan adaptativo...
                  </>
                ) : (
                  <>
                    <FileText className="size-4" />
                    Generar Plan de Trading Adaptado
                  </>
                )}
              </Button>
            </div>

            {/* Visualizador de Plan Generado */}
            {generatedPlan && (
              <div className="rounded-lg border border-brand/40 bg-accent/20 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Target className="size-4 text-brand" />
                    <span className="font-display text-base font-bold text-foreground">
                      Tu Plan de Operativa
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(generatedPlan)}
                    className="h-7 px-2 text-xs"
                  >
                    <Copy className="mr-1 size-3" /> Copiar Plan
                  </Button>
                </div>
                <MarkdownContent content={generatedPlan} />
              </div>
            )}
          </TabsContent>

          {/* 3. PESTAÑA: CHAT CON EL AUDITOR */}
          <TabsContent value="chat" className="flex flex-1 flex-col overflow-hidden p-0 m-0">
            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2.5 max-w-[85%]",
                    msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      msg.role === "user"
                        ? "bg-foreground text-background"
                        : "bg-brand text-foreground",
                    )}
                  >
                    {msg.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                  </div>

                  <div
                    className={cn(
                      "rounded-lg px-3.5 py-2.5 text-xs leading-relaxed shadow-sm",
                      msg.role === "user"
                        ? "bg-foreground text-background"
                        : "bg-muted border border-border text-foreground",
                    )}
                  >
                    <MarkdownContent content={msg.content} />
                    <span className="mt-1.5 block text-[10px] opacity-60 text-right">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin text-brand" />
                  <span>El Auditor está analizando...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Sugerencias Rápidas */}
            <div className="border-t border-border/40 bg-card px-3 py-2">
              <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[
                  "¿Debo reducir contratos?",
                  "Analiza mis errores comunes",
                  "¿Qué dice mi estrategia para hoy?",
                  "Revisa mi cercanía al Drawdown",
                ].map((promptText, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(promptText)}
                    disabled={loading}
                    className="whitespace-nowrap rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    {promptText}
                  </button>
                ))}
              </div>
            </div>

            {/* Input de Chat */}
            <div className="border-t border-border bg-card p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Pregunta al auditor sobre tu plan o disciplina..."
                  disabled={loading}
                  className="text-xs"
                />
                <Button type="submit" size="sm" disabled={loading || !inputQuery.trim()}>
                  <Send className="size-3.5" />
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
