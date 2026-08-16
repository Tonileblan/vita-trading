import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CameraCapture } from "@/components/camera-capture";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJournal } from "@/lib/journal-store";
import { extractTradesFromImages, type ExtractedTrade } from "@/lib/trade-vision.functions";
import { formatCurrency } from "@/lib/metrics";
import { parseDetectedDate } from "@/lib/parse-date";
import { cn } from "@/lib/utils";

/** Clave de deduplicación: mismo activo, dirección, día y PnL. */
function dedupeKey(t: {
  symbol: string;
  direction: string;
  closedAt?: string | null | undefined;
  pnl: number;
}) {
  const parsed = parseDetectedDate(t.closedAt);
  const day = parsed ? parsed.slice(0, 10) : "sin-fecha";
  return [t.symbol.toUpperCase().trim(), t.direction, day, t.pnl.toFixed(2)].join("|");
}

const toIso = (value?: string | null) => {
  const parsed = parseDetectedDate(value);
  return parsed ? new Date(parsed).toISOString() : new Date().toISOString();
};

interface Row extends ExtractedTrade {
  key: string;
  duplicate: boolean;
  selected: boolean;
  /** Fecha normalizada detectada en la captura (null si no había). */
  detectedAt: string | null;
}


export function TradeImportDialog() {
  const { accounts, strategies, trades, addTrades } = useJournal();
  const extract = useServerFn(extractTradesFromImages);
  const [open, setOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [strategyId, setStrategyId] = useState(strategies[0]?.id ?? "");

  // Al elegir cuenta, usa la estrategia asignada a esa cuenta.
  useEffect(() => {
    const acc = accounts.find((a) => a.id === accountId);
    if (acc?.strategyId && strategies.some((s) => s.id === acc.strategyId)) {
      setStrategyId(acc.strategyId);
    }
  }, [accountId, accounts, strategies]);
  const [images, setImages] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);


  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 6)
      .forEach((f) => {
        const reader = new FileReader();
        reader.onload = () => setImages((prev) => [...prev, String(reader.result)].slice(0, 6));
        reader.readAsDataURL(f);
      });
  };

  const analyse = async () => {
    if (images.length === 0) {
      toast.error("Añade al menos una captura");
      return;
    }
    setLoading(true);
    try {
      const found = await extract({
        data: { images, symbols: strategies.map((s) => s.mainSymbol) },
      });
      // Cuenta cuántas operaciones idénticas ya existen para no descartar repeticiones legítimas.
      const existingCounts = new Map<string, number>();
      for (const t of trades) {
        const k = dedupeKey(t);
        existingCounts.set(k, (existingCounts.get(k) ?? 0) + 1);
      }
      const usedCounts = new Map<string, number>();
      const parsedRows: Row[] = [];
      found.forEach((t, i) => {
        const key = dedupeKey(t);
        const used = usedCounts.get(key) ?? 0;
        usedCounts.set(key, used + 1);
        const duplicate = used < (existingCounts.get(key) ?? 0);
        const detectedAt = parseDetectedDate(t.closedAt ?? t.openedAt);
        parsedRows.push({ ...t, key: `${key}#${i}`, duplicate, selected: !duplicate, detectedAt });
      });
      setRows(parsedRows);
      if (parsedRows.length === 0) toast.error("No se detectaron operaciones en las capturas");
      else
        toast.success(
          `${parsedRows.length} operaciones detectadas · ${parsedRows.filter((r) => r.duplicate).length} ya existentes`,
        );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo analizar la captura");
    } finally {
      setLoading(false);
    }
  };

  const importSelected = async () => {
    if (!accountId) {
      toast.error("Selecciona una cuenta");
      return;
    }
    const chosen = (rows ?? []).filter((r) => r.selected);
    if (chosen.length === 0) {
      toast.error("No hay operaciones seleccionadas");
      return;
    }
    setImporting(true);
    try {
      await addTrades(
        chosen.map((r) => ({
          accountId,
          strategyId,
          symbol: r.symbol.toUpperCase(),
          direction: r.direction,
          openedAt: toIso(r.openedAt ?? r.closedAt),
          closedAt: toIso(r.closedAt ?? r.openedAt),
          entryPrice: r.entryPrice ?? 0,
          exitPrice: r.exitPrice ?? 0,
          size: r.size ?? 1,
          pnl: r.pnl,
          mistakes: [],
          tags: [],
          notes: "Importada desde captura",
          screenshots: images.slice(0, 1),
          source: "manual" as const,
        })),
      );
      toast.success(`${chosen.length} operaciones importadas`);
      setOpen(false);
      setImages([]);
      setRows(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron importar las operaciones");
    } finally {
      setImporting(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Camera className="size-4" /> Foto o captura
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar operaciones desde imagen</DialogTitle>
          <DialogDescription>
            Sube capturas o fotos del historial. Se extraen todas las operaciones y se omiten las
            que ya están registradas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Cuenta destino</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Estrategia</Label>
            <Select value={strategyId} onValueChange={setStrategyId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {strategies.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onPaste={(e) => addFiles(Array.from(e.clipboardData.files))}
          className={cn(
            "rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors",
            dragging
              ? "border-brand bg-brand/10 text-brand-soft"
              : "border-border text-muted-foreground",
          )}
        >
          <ImagePlus className="mx-auto mb-2 size-6" />
          Arrastra, pega (Ctrl+V) o usa los botones (máx. 6)
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setCameraOpen(true)}>
              <Camera className="size-4" /> Hacer foto
            </Button>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-4" /> Elegir captura
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        <CameraCapture
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          onCapture={(dataUrl) => {
            setImages((prev) => [...prev, dataUrl].slice(0, 6));
            setCameraOpen(false);
          }}
        />


        {images.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {images.map((src, i) => (
              <div key={i} className="group relative overflow-hidden rounded-md border">
                <img src={src} alt={`Captura ${i + 1}`} className="h-20 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-1"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button onClick={analyse} disabled={loading || images.length === 0}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          {loading ? "Analizando capturas…" : "Analizar capturas"}
        </Button>

        {rows && rows.length > 0 && (
          <div className="space-y-2">
            <Label>Operaciones detectadas</Label>
            <div className="divide-y rounded-lg border">
              {rows.map((r, i) => (
                <label
                  key={r.key}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={() =>
                      setRows((prev) =>
                        (prev ?? []).map((x, j) => (j === i ? { ...x, selected: !x.selected } : x)),
                      )
                    }
                  />
                  <span className="font-semibold">{r.symbol.toUpperCase()}</span>
                  <span className="uppercase text-muted-foreground">{r.direction}</span>
                  <span
                    className={cn(
                      "text-muted-foreground",
                      !r.detectedAt && "italic text-loss/80",
                    )}
                  >
                    {r.detectedAt
                      ? new Date(r.detectedAt).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "sin fecha"}
                  </span>
                  <span
                    className={cn("ml-auto font-semibold", r.pnl >= 0 ? "text-profit" : "text-loss")}
                  >
                    {formatCurrency(r.pnl, true)}
                  </span>
                  {r.duplicate && (
                    <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      duplicada
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={importSelected} disabled={!rows || rows.length === 0 || importing}>
            {importing && <Loader2 className="size-4 animate-spin" />}
            {importing ? "Importando…" : "Importar seleccionadas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
