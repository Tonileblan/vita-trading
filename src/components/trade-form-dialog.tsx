import { useRef, useState } from "react";
import { ImagePlus, Plus, X } from "lucide-react";
import { toast } from "sonner";
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
import { useJournal } from "@/lib/journal-store";
import { STRATEGY_TAGS, type Direction } from "@/lib/types";
import { cn } from "@/lib/utils";

const nowLocal = () => new Date().toISOString().slice(0, 16);

export function TradeFormDialog() {
  const { accounts, strategies, addTrade } = useJournal();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [strategyId, setStrategyId] = useState(strategies[0]?.id ?? "");
  const [symbol, setSymbol] = useState("NQ1!");
  const [direction, setDirection] = useState<Direction>("long");
  const [openedAt, setOpenedAt] = useState(nowLocal());
  const [closedAt, setClosedAt] = useState(nowLocal());
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [size, setSize] = useState("1");
  const [pnl, setPnl] = useState("");
  const [tags, setTags] = useState<string[]>(["ICT"]);
  const [notes, setNotes] = useState("");
  const [shots, setShots] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .forEach((f) => {
        const reader = new FileReader();
        reader.onload = () => setShots((prev) => [...prev, String(reader.result)]);
        reader.readAsDataURL(f);
      });
  };

  const submit = () => {
    if (!accountId || !symbol || !pnl) {
      toast.error("Completa cuenta, activo y PnL");
      return;
    }
    addTrade({
      accountId,
      strategyId,
      symbol: symbol.toUpperCase(),
      direction,
      openedAt: new Date(openedAt).toISOString(),
      closedAt: new Date(closedAt).toISOString(),
      entryPrice: Number(entryPrice) || 0,
      exitPrice: Number(exitPrice) || 0,
      size: Number(size) || 1,
      pnl: Number(pnl),
      tags,
      notes,
      screenshots: shots,
      source: "manual",
    });
    toast.success("Operación registrada");
    setOpen(false);
    setPnl("");
    setEntryPrice("");
    setExitPrice("");
    setNotes("");
    setShots([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nueva operación
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registro de operación</DialogTitle>
          <DialogDescription>
            Registro rápido manual. Los campos numéricos aceptan decimales.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Cuenta</Label>
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

          <div className="space-y-2">
            <Label>Activo</Label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="NQ1!, EURUSD…"
            />
          </div>

          <div className="space-y-2">
            <Label>Dirección</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["long", "short"] as Direction[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-semibold capitalize transition-colors",
                    direction === d
                      ? d === "long"
                        ? "border-profit bg-profit/15 text-profit"
                        : "border-loss bg-loss/15 text-loss"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tamaño (contratos / lotes)</Label>
            <Input value={size} onChange={(e) => setSize(e.target.value)} inputMode="decimal" />
          </div>

          <div className="space-y-2">
            <Label>Apertura</Label>
            <Input
              type="datetime-local"
              value={openedAt}
              onChange={(e) => setOpenedAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Cierre</Label>
            <Input
              type="datetime-local"
              value={closedAt}
              onChange={(e) => setClosedAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Precio de entrada</Label>
            <Input
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              inputMode="decimal"
              placeholder="18240.25"
            />
          </div>
          <div className="space-y-2">
            <Label>Precio de salida</Label>
            <Input
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              inputMode="decimal"
              placeholder="18276.50"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>PnL neto ($)</Label>
            <Input
              value={pnl}
              onChange={(e) => setPnl(e.target.value)}
              inputMode="decimal"
              placeholder="Positivo o negativo, ej. -180.50"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Estrategias</Label>
            <div className="flex flex-wrap gap-2">
              {STRATEGY_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setTags((prev) =>
                      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    tags.includes(tag)
                      ? "border-brand bg-brand/15 text-brand-soft"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Galería de evidencia</Label>
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
              onClick={() => fileRef.current?.click()}
              className={cn(
                "cursor-pointer rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors",
                dragging
                  ? "border-brand bg-brand/10 text-brand-soft"
                  : "border-border text-muted-foreground hover:border-brand/60",
              )}
            >
              <ImagePlus className="mx-auto mb-2 size-6" />
              Arrastra, pega (Ctrl+V) o haz clic para subir capturas del gráfico
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>
            {shots.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {shots.map((src, i) => (
                  <div key={i} className="group relative overflow-hidden rounded-md border">
                    <img src={src} alt={`Captura ${i + 1}`} className="h-20 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setShots((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 rounded-full bg-background/80 p-1"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Notas (pre y post mercado)</Label>
            <Textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto, sesgo, ejecución, errores…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Guardar operación</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
