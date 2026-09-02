import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, Sparkles, Upload, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getLocalGoogleAiKey, getLocalGoogleAiModel } from "@/lib/google-ai";
import { CsvRepairDialog } from "@/components/csv-repair-dialog";
import { TradeImportDropzone } from "./trade-import/trade-import-dropzone";
import { TradeImportPreviewTable } from "./trade-import/trade-import-preview-table";
import { useTradeImportWizard } from "./trade-import/use-trade-import-wizard";

export function TradeImportDialog() {
  const [open, setOpen] = useState(false);
  const googleAiKey = getLocalGoogleAiKey();
  const googleAiModel = getLocalGoogleAiModel();

  const wizard = useTradeImportWizard(() => setOpen(false));

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-1.5 shadow-xs cursor-pointer">
            <Camera className="size-4 text-brand" /> Foto o captura
          </Button>
        </DialogTrigger>

        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Camera className="size-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold font-display uppercase tracking-wide">
                    Importador de Operaciones & Prop Firms
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Confirmación de fecha, asignación de cuentas y preselección automática de estrategias
                  </DialogDescription>
                </div>
              </div>

              {googleAiKey ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="size-3" /> Tu Google AI ({googleAiModel})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[11px] text-muted-foreground font-semibold">
                  <Sparkles className="size-3 text-brand" /> Google AI Gemini
                </span>
              )}
            </div>
          </DialogHeader>

          {!googleAiKey && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Conecta Google AI para Trade Vision</p>
                  <p className="text-[11px] opacity-90">Obtén tu clave gratuita en Google AI Studio y pégala en tu perfil.</p>
                </div>
              </div>
              <Button
                asChild
                size="sm"
                className="shrink-0 bg-amber-600 text-white hover:bg-amber-700 h-8 text-xs font-semibold shadow-xs"
              >
                <Link to="/usuarios" onClick={() => setOpen(false)}>
                  Conectar Google AI aquí
                </Link>
              </Button>
            </div>
          )}

          {/* Paso 1: Carga de Archivos o Fotos */}
          {!wizard.rows ? (
            <TradeImportDropzone
              images={wizard.images}
              analyzing={wizard.analyzing}
              batchDate={wizard.batchDate}
              detectedDate={wizard.detectedCaptureDate}
              onAddImages={(newImgs) => wizard.setImages((prev) => [...prev, ...newImgs])}
              onRemoveImage={(idx) =>
                wizard.setImages((prev) => prev.filter((_, i) => i !== idx))
              }
              onSelectCsv={wizard.handleCsvFile}
              onSetBatchDate={wizard.setBatchDate}
              onAnalyze={wizard.handleAnalyzeImages}
            />
          ) : (
            /* Paso 2: Previsualización y Edición de Operaciones */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => wizard.setRows(null)}
                  className="h-7 text-xs"
                >
                  ← Volver a Cargar Archivos
                </Button>
                <span className="text-xs text-muted-foreground">
                  Revisa y ajusta las cuentas y estrategias antes de guardar
                </span>
              </div>

              <TradeImportPreviewTable
                rows={wizard.rows}
                accounts={wizard.accounts}
                strategies={wizard.strategies}
                accountMappings={wizard.accountMappings}
                onToggleSelectRow={wizard.handleToggleSelectRow}
                onToggleSelectAll={wizard.handleToggleSelectAll}
                onUpdateRow={wizard.handleUpdateRow}
                onDeleteRow={wizard.handleDeleteRow}
                onUpdateGroupAccount={wizard.handleUpdateGroupAccount}
                onUpdateGroupStrategy={wizard.handleUpdateGroupStrategy}
              />
            </div>
          )}

          {wizard.rows && (
            <DialogFooter className="pt-3 border-t border-border flex flex-row items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={wizard.importing || wizard.rows.filter((r) => r.selected).length === 0}
                onClick={wizard.handleImportSelected}
                className="gap-1.5 font-display text-sm tracking-wide bg-brand hover:bg-brand/90"
              >
                {wizard.importing ? (
                  <>
                    <RotateCcw className="size-4 animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <Upload className="size-4" /> Importar {wizard.rows.filter((r) => r.selected).length} Operaciones
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Reparación de CSV con IA */}
      <CsvRepairDialog
        open={wizard.repairModalOpen}
        onOpenChange={wizard.setRepairModalOpen}
        rawCsvText={wizard.rawCsvForRepair}
        errorDetails={wizard.csvRepairError}
        onApplyRepaired={(result) => {
          wizard.setRepairModalOpen(false);
          if (result.trades && result.trades.length > 0) {
            wizard.handleCsvFile(new File([wizard.rawCsvForRepair], "repaired.csv"));
          }
        }}
      />
    </>
  );
}
