import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  FileSpreadsheet,
  FileWarning,
  HelpCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/lib/journal-store";
import {
  getLocalGoogleAiKey,
  getLocalGoogleAiModel,
  DEFAULT_GEMINI_MODEL,
} from "@/lib/google-ai";
import { formatCurrency, formatDateTime } from "@/lib/metrics";
import { repairCsvWithAi, type CsvRepairResult, type RepairedTrade } from "@/lib/csv-repair.functions";
import { cn } from "@/lib/utils";

interface CsvRepairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rawCsvText: string;
  fileName?: string;
  errorDetails?: string;
  context?: "full_journal" | "trades";
  onApplyRepaired: (result: CsvRepairResult) => Promise<void> | void;
}

export function CsvRepairDialog({
  open,
  onOpenChange,
  rawCsvText,
  fileName = "archivo.csv",
  errorDetails = "El formato o columnas del archivo no coinciden con la estructura esperada.",
  context = "trades",
  onApplyRepaired,
}: CsvRepairDialogProps) {
  const { accounts, strategies } = useJournal();
  const repairServerFn = useServerFn(repairCsvWithAi);

  const [isRepairing, setIsRepairing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [repairResult, setRepairResult] = useState<CsvRepairResult | null>(null);
  const [activeStep, setActiveStep] = useState<"initial" | "preview">("initial");

  const accountHints = accounts.map((a) => a.name);
  const strategyHints = strategies.map((s) => s.name);

  const handleStartRepair = async () => {
    if (!rawCsvText.trim()) {
      toast.error("No hay contenido CSV para reparar");
      return;
    }

    setIsRepairing(true);
    try {
      const apiKey = getLocalGoogleAiKey();
      const model = getLocalGoogleAiModel();

      const result = await repairServerFn({
        data: {
          rawCsvText,
          errorDetails,
          context,
          accountHints,
          strategyHints,
          apiKey: apiKey || undefined,
          model: model || DEFAULT_GEMINI_MODEL,
        },
      });

      setRepairResult(result);
      setActiveStep("preview");
      toast.success(
        result.trades.length > 0
          ? `¡CSV reparado con éxito! Se recuperaron ${result.trades.length} operaciones`
          : "¡CSV analizado y reparado con éxito!",
      );
    } catch (err: any) {
      toast.error(err.message || "Error al reparar el CSV con IA");
    } finally {
      setIsRepairing(false);
    }
  };

  const handleApply = async () => {
    if (!repairResult) return;
    setIsApplying(true);
    try {
      await onApplyRepaired(repairResult);
      onOpenChange(false);
      // Reset
      setRepairResult(null);
      setActiveStep("initial");
    } catch (err: any) {
      toast.error(err.message || "Error al aplicar los datos reparados");
    } finally {
      setIsApplying(false);
    }
  };

  const tradesCount = repairResult?.trades.length ?? 0;
  const totalPnl = (repairResult?.trades ?? []).reduce((acc, t) => acc + (t.pnl || 0), 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isRepairing && !isApplying) {
          onOpenChange(v);
          if (!v) {
            setRepairResult(null);
            setActiveStep("initial");
          }
        }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-brand">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Sparkles className="size-4" />
            </div>
            <DialogTitle className="text-lg font-bold">
              {activeStep === "initial"
                ? "Reparación Asistida de CSV con IA"
                : "Vista Previa de Datos Reparados por IA"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {activeStep === "initial"
              ? "La importación tradicional falló. Nuestra IA analiza y corrige delimitadores, formatos de brokers (Tradovate, NinjaTrader, MT5...) y columnas automáticamente."
              : "Revisa las operaciones estructuradas por Gemini antes de incorporarlas a tu bitácora."}
          </DialogDescription>
        </DialogHeader>

        {activeStep === "initial" ? (
          <div className="space-y-4 py-3 flex-1 overflow-y-auto">
            {/* Banner de error detectado */}
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-xs">
                <FileWarning className="size-4 shrink-0" />
                <span>Error durante la lectura del archivo: {fileName}</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono bg-background/80 p-2.5 rounded-lg border border-border/60">
                {errorDetails}
              </p>
            </div>

            {/* Qué hará la IA */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5 text-xs">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Wand2 className="size-3.5 text-brand" /> ¿Cómo arreglará la IA tu archivo?
              </span>
              <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
                <li>Detectará automáticamente si proviene de <strong>NinjaTrader, Tradovate, MetaTrader, TradingView, Topstep o Excel</strong>.</li>
                <li>Normalizará separadores de coma decimal (<code>1.250,50</code>) y números negativos (<code>(150,00)</code>).</li>
                <li>Convertirá fechas ambiguas al estándar temporal ISO.</li>
                <li>Descartará automáticamente cuentas de simulación ("SIM") respetando tus cuentas reales y de fondeo.</li>
              </ul>
            </div>

            {/* Muestra del texto bruto */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Primeras líneas del archivo original:</Label>
              <pre className="text-[11px] font-mono bg-muted/40 p-3 rounded-lg border border-border/60 overflow-x-auto max-h-32 text-muted-foreground">
                {rawCsvText.slice(0, 1000)}
                {rawCsvText.length > 1000 ? "\n..." : ""}
              </pre>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-3 flex-1 overflow-y-auto">
            {/* Resumen del diagnóstico de la IA */}
            {repairResult?.summary && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  <span>Diagnóstico y Reparación Aplicada</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                  {repairResult.summary}
                </p>
              </div>
            )}

            {/* Métricas clave */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-card p-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Operaciones Recuperadas</span>
                <p className="text-lg font-black font-mono text-foreground mt-0.5">{tradesCount}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">PnL Neto Total</span>
                <p className={cn("text-lg font-black font-mono mt-0.5", totalPnl >= 0 ? "text-profit" : "text-loss")}>
                  {formatCurrency(totalPnl, true)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Modelo Utilizado</span>
                <p className="text-xs font-mono font-medium text-foreground mt-1 truncate">
                  {repairResult ? "Gemini AI" : "—"}
                </p>
              </div>
            </div>

            {/* Tabla de operaciones recuperadas */}
            {tradesCount > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  <Table className="text-xs">
                    <TableHeader className="bg-muted/50 sticky top-0">
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Símbolo</TableHead>
                        <TableHead>Dirección</TableHead>
                        <TableHead>Entrada / Salida</TableHead>
                        <TableHead>Cuenta Sugerida</TableHead>
                        <TableHead className="text-right">PnL Neto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repairResult?.trades.map((t, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {t.closedAt ? formatDateTime(t.closedAt) : t.openedAt ? formatDateTime(t.openedAt) : "—"}
                          </TableCell>
                          <TableCell className="font-mono font-bold">{t.symbol || "MNQ"}</TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                                t.direction === "long"
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                              )}
                            >
                              {t.direction}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {t.entryPrice ? t.entryPrice : "—"} / {t.exitPrice ? t.exitPrice : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.accountName || <span className="italic text-muted-foreground/60">Por defecto</span>}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-mono font-bold",
                              t.pnl >= 0 ? "text-profit" : "text-loss",
                            )}
                          >
                            {formatCurrency(t.pnl, true)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-4">
          {activeStep === "initial" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isRepairing}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleStartRepair}
                disabled={isRepairing}
                className="gap-2 shadow-xs bg-brand text-brand-foreground hover:bg-brand/90 font-semibold"
              >
                {isRepairing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Analizando y Reparando...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Arreglar con IA
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveStep("initial")}
                disabled={isApplying}
              >
                Volver a intentar
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={isApplying || tradesCount === 0}
                className="gap-2 shadow-xs bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Aplicando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" /> Importar {tradesCount} Operaciones Reparadas
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
