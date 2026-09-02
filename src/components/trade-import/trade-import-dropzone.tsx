import { useRef, useState } from "react";
import { Camera, ImagePlus, FileSpreadsheet, Sparkles, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraCapture } from "@/components/camera-capture";
import { formatDisplayDate, getYesterdayKey } from "@/lib/trade-helpers";
import { todayKey } from "@/lib/emotions";
import { cn } from "@/lib/utils";

interface TradeImportDropzoneProps {
  images: string[];
  analyzing: boolean;
  batchDate: string;
  detectedDate: string | null;
  onAddImages: (newImages: string[]) => void;
  onRemoveImage: (index: number) => void;
  onSelectCsv: (file: File) => void;
  onSetBatchDate: (date: string) => void;
  onAnalyze: () => void;
}

export function TradeImportDropzone({
  images,
  analyzing,
  batchDate,
  detectedDate,
  onAddImages,
  onRemoveImage,
  onSelectCsv,
  onSetBatchDate,
  onAnalyze,
}: TradeImportDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const today = todayKey();
  const yesterday = getYesterdayKey();

  const handleImageFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const readers = Array.from(files).map(
      (f) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(f);
        }),
    );
    Promise.all(readers).then((results) => {
      onAddImages(results);
    });
  };

  return (
    <div className="space-y-4">
      {/* Selectores de Carga (Capturas / Fotos / CSV) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 bg-muted/20 p-6 text-center hover:bg-muted/40 hover:border-brand/50 transition-all cursor-pointer group"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand group-hover:scale-110 transition-transform">
            <ImagePlus className="size-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">Añadir Fotos o Capturas</p>
            <p className="text-[11px] text-muted-foreground">Soporta múltiples imágenes (PNG, JPG)</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleImageFiles(e.target.files)}
          />
        </div>

        <div
          onClick={() => csvInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 bg-muted/20 p-6 text-center hover:bg-muted/40 hover:border-brand/50 transition-all cursor-pointer group"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
            <FileSpreadsheet className="size-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">Importar Archivo CSV</p>
            <p className="text-[11px] text-muted-foreground">NinjaTrader, Rithmic, Tradovate, MT4/5</p>
          </div>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onSelectCsv(file);
            }}
          />
        </div>
      </div>

      {/* Botón para abrir Cámara Web / Móvil */}
      <div className="flex items-center justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCameraOpen(true)}
          className="gap-2 text-xs font-semibold"
        >
          <Camera className="size-4 text-brand" /> Abrir Cámara del Dispositivo
        </Button>
        <CameraCapture
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          onCapture={(dataUrl) => onAddImages([dataUrl])}
        />
      </div>

      {/* Selector Rápido de Fecha de la Sesión */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Fecha de las Operaciones
          </label>
          <span className="text-xs font-semibold text-brand font-display">
            {formatDisplayDate(batchDate)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => onSetBatchDate(today)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
              batchDate === today
                ? "bg-brand text-brand-foreground shadow-xs"
                : "border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => onSetBatchDate(yesterday)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
              batchDate === yesterday
                ? "bg-brand text-brand-foreground shadow-xs"
                : "border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Ayer
          </button>
          {detectedDate && (
            <button
              type="button"
              onClick={() => onSetBatchDate(detectedDate)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                batchDate === detectedDate
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "border border-emerald-500/40 text-emerald-600 hover:text-emerald-500",
              )}
            >
              Detectada por IA ({detectedDate})
            </button>
          )}
          <input
            type="date"
            value={batchDate}
            onChange={(e) => onSetBatchDate(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground"
          />
        </div>
      </div>

      {/* Miniaturas de imágenes cargadas */}
      {images.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {images.length} {images.length === 1 ? "captura lista para procesar" : "capturas listas para procesar"}
            </span>
            <Button
              type="button"
              size="sm"
              disabled={analyzing}
              onClick={onAnalyze}
              className="gap-1.5 font-display text-sm tracking-wide bg-brand hover:bg-brand/90"
            >
              {analyzing ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Procesando con Trade Vision...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Analizar con Trade Vision
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 rounded-lg border border-border bg-muted/20">
            {images.map((img, i) => (
              <div key={i} className="relative group size-16 rounded-md overflow-hidden border border-border shadow-xs">
                <img src={img} alt={`Captura ${i + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemoveImage(i)}
                  className="absolute top-0.5 right-0.5 rounded-full bg-black/70 p-1 text-white hover:bg-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
