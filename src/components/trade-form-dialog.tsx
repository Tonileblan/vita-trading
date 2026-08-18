import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { useJournal, fetchTradeScreenshots } from "@/lib/journal-store";
import { type Direction, type Trade } from "@/lib/types";
import {
  EMOTIONS_AFTER,
  EMOTIONS_BEFORE,
  FOLLOWED_PLAN,
  MISTAKES,
  type FollowedPlan,
} from "@/lib/emotions";
import { cn } from "@/lib/utils";

function toDatetimeLocal(isoString?: string | null) {
  if (!isoString) {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function fromDatetimeLocal(value: string) {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function TradeFormDialog({
  trade,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onSuccess,
}: {
  trade?: Trade | null;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
} = {}) {
  const { accounts, strategies, addTrade, updateTrade } = useJournal();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (v: boolean) => {
    if (setControlledOpen) setControlledOpen(v);
    setUncontrolledOpen(v);
  };

  const isEditing = Boolean(trade);

  const [accountId, setAccountId] = useState(trade?.accountId ?? accounts[0]?.id ?? "");
  const [strategyId, setStrategyId] = useState(trade?.strategyId ?? strategies[0]?.id ?? "");
  const [symbol, setSymbol] = useState(trade?.symbol ?? "NQ1!");
  const [direction, setDirection] = useState<Direction>(trade?.direction ?? "long");
  const [openedAt, setOpenedAt] = useState(() => toDatetimeLocal(trade?.openedAt));
  const [closedAt, setClosedAt] = useState(() => toDatetimeLocal(trade?.closedAt));
  const [entryPrice, setEntryPrice] = useState(trade?.entryPrice ? String(trade.entryPrice) : "");
  const [exitPrice, setExitPrice] = useState(trade?.exitPrice ? String(trade.exitPrice) : "");
  const [size, setSize] = useState(trade?.size ? String(trade.size) : "1");
  const [pnl, setPnl] = useState(trade?.pnl !== undefined && trade?.pnl !== null ? String(trade.pnl) : "");
  const [tags, setTags] = useState<string[]>(trade?.tags ?? []);
  const [notes, setNotes] = useState(trade?.notes ?? "");
  const [shots, setShots] = useState<string[]>(trade?.screenshots ?? []);
  const [dragging, setDragging] = useState(false);
  const [showMood, setShowMood] = useState(
    Boolean(
      trade?.emotionBefore ||
      trade?.emotionAfter ||
      trade?.followedPlan ||
      (trade?.mistakes && trade.mistakes.length > 0) ||
      trade?.emotionNote
    )
  );
  const [emotionBefore, setEmotionBefore] = useState(trade?.emotionBefore ?? "");
  const [emotionAfter, setEmotionAfter] = useState(trade?.emotionAfter ?? "");
  const [followedPlan, setFollowedPlan] = useState<FollowedPlan | "">((trade?.followedPlan as FollowedPlan) ?? "");
  const [mistakes, setMistakes] = useState<string[]>(trade?.mistakes ?? []);
  const [emotionNote, setEmotionNote] = useState(trade?.emotionNote ?? "");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sincroniza los estados cuando se abre el diálogo o cambia la operación a editar.
  useEffect(() => {
    if (!open) return;
    if (trade) {
      setAccountId(trade.accountId || accounts[0]?.id || "");
      setStrategyId(trade.strategyId || strategies[0]?.id || "");
      setSymbol(trade.symbol || "");
      setDirection(trade.direction || "long");
      setOpenedAt(toDatetimeLocal(trade.openedAt));
      setClosedAt(toDatetimeLocal(trade.closedAt));
      setEntryPrice(trade.entryPrice > 0 ? String(trade.entryPrice) : "");
      setExitPrice(trade.exitPrice > 0 ? String(trade.exitPrice) : "");
      setSize(trade.size > 0 ? String(trade.size) : "1");
      setPnl(trade.pnl !== undefined && trade.pnl !== null ? String(trade.pnl) : "");
      setTags(trade.tags ?? []);
      setNotes(trade.notes ?? "");
      
      // Carga diferida (Lazy loading) de capturas pesadas
      const currentShots = (trade.screenshots ?? []).filter((s) => s !== "__has_screenshots__");
      setShots(currentShots);
      if (trade.id && (currentShots.length === 0 || trade.screenshots?.[0] === "__has_screenshots__")) {
        fetchTradeScreenshots(trade.id).then((loaded) => {
          if (loaded && loaded.length > 0) {
            setShots(loaded);
          }
        });
      }

      const hasMood = Boolean(
        trade.emotionBefore ||
        trade.emotionAfter ||
        trade.followedPlan ||
        (trade.mistakes && trade.mistakes.length > 0) ||
        trade.emotionNote
      );
      setShowMood(hasMood);
      setEmotionBefore(trade.emotionBefore ?? "");
      setEmotionAfter(trade.emotionAfter ?? "");
      setFollowedPlan((trade.followedPlan as FollowedPlan) ?? "");
      setMistakes(trade.mistakes ?? []);
      setEmotionNote(trade.emotionNote ?? "");
    } else {
      setAccountId(accounts[0]?.id ?? "");
      setStrategyId(strategies[0]?.id ?? "");
      setSymbol("NQ1!");
      setDirection("long");
      setOpenedAt(toDatetimeLocal());
      setClosedAt(toDatetimeLocal());
      setEntryPrice("");
      setExitPrice("");
      setSize("1");
      setPnl("");
      setTags([]);
      setNotes("");
      setShots([]);
      setShowMood(false);
      setEmotionBefore("");
      setEmotionAfter("");
      setFollowedPlan("");
      setMistakes([]);
      setEmotionNote("");
    }
  }, [open, trade, accounts, strategies]);

  // Al elegir cuenta en modo creación, usa la estrategia asignada a esa cuenta.
  useEffect(() => {
    if (isEditing || !accountId) return;
    const acc = accounts.find((a) => a.id === accountId);
    if (acc?.strategyId && strategies.some((s) => s.id === acc.strategyId)) {
      setStrategyId(acc.strategyId);
    }
  }, [accountId, accounts, strategies, isEditing]);

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

  const submit = async () => {
    if (!accountId || !symbol || pnl === "") {
      toast.error("Completa cuenta, activo y PnL");
      return;
    }
    setSaving(true);
    try {
      const cleanStrategyId = strategyId && strategyId !== "none" ? strategyId : undefined;
      if (isEditing && trade) {
        await updateTrade(trade.id, {
          accountId,
          strategyId: cleanStrategyId,
          symbol: symbol.toUpperCase().trim(),
          direction,
          openedAt: fromDatetimeLocal(openedAt),
          closedAt: fromDatetimeLocal(closedAt),
          entryPrice: Number(entryPrice) || 0,
          exitPrice: Number(exitPrice) || 0,
          size: Number(size) || 1,
          pnl: Number(pnl),
          tags,
          notes: notes.trim() || undefined,
          screenshots: shots,
          emotionBefore: emotionBefore || undefined,
          emotionAfter: emotionAfter || undefined,
          followedPlan: (followedPlan as FollowedPlan) || undefined,
          mistakes,
          emotionNote: emotionNote.trim() || undefined,
        });
        toast.success("Operación actualizada");
      } else {
        await addTrade({
          accountId,
          strategyId: cleanStrategyId,
          symbol: symbol.toUpperCase().trim(),
          direction,
          openedAt: fromDatetimeLocal(openedAt),
          closedAt: fromDatetimeLocal(closedAt),
          entryPrice: Number(entryPrice) || 0,
          exitPrice: Number(exitPrice) || 0,
          size: Number(size) || 1,
          pnl: Number(pnl),
          tags,
          notes: notes.trim() || undefined,
          screenshots: shots,
          source: "manual",
          ...(emotionBefore ? { emotionBefore } : {}),
          ...(emotionAfter ? { emotionAfter } : {}),
          ...(followedPlan ? { followedPlan } : {}),
          mistakes,
          ...(emotionNote ? { emotionNote } : {}),
        });
        toast.success("Operación registrada");
      }
      onSuccess?.();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar la operación");
    } finally {
      setSaving(false);
    }
  };

  const defaultTrigger =
    trigger !== undefined
      ? trigger
      : controlledOpen !== undefined
        ? null
        : (
            <Button>
              <Plus className="size-4" /> Nueva operación
            </Button>
          );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {defaultTrigger ? <DialogTrigger asChild>{defaultTrigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar operación" : "Registro de operación"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos, añade capturas, notas o completa el registro emocional."
              : "Registro rápido manual. Los campos numéricos aceptan decimales."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Cuenta</Label>
            <Select
              value={accountId}
              onValueChange={(accId) => {
                setAccountId(accId);
                if (!isEditing) {
                  const acc = accounts.find((a) => a.id === accId);
                  if (acc?.strategyId) {
                    setStrategyId(acc.strategyId);
                  }
                }
              }}
            >
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
            <Select
              value={strategyId || "none"}
              onValueChange={(val) => setStrategyId(val === "none" ? "" : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona estrategia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin estrategia asignada</SelectItem>
                {strategies.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      {s.color && (
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                      )}
                      <span>{s.name}</span>
                    </div>
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
            <Label>PnL neto ($)</Label>
            <Input
              value={pnl}
              onChange={(e) => setPnl(e.target.value)}
              inputMode="decimal"
              placeholder="Positivo o negativo, ej. -180.50"
            />
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
            <Label>Estrategias / Etiquetas</Label>
            <div className="flex flex-wrap gap-2">
              {strategies.map(({ id, name: tag }) => (
                <button
                  key={id}
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
            <Label>Galería de evidencia (Capturas)</Label>
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
                  <div key={i} className="group relative overflow-hidden rounded-md border border-border">
                    <img src={src} alt={`Captura ${i + 1}`} className="h-20 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setShots((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      title="Eliminar captura"
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
              placeholder="Contexto técnico, sesgo, ejecución, confirmaciones, qué funcionó o qué falló…"
            />
          </div>

          <div className="space-y-3 sm:col-span-2">
            <button
              type="button"
              onClick={() => setShowMood((v) => !v)}
              className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-semibold"
            >
              <span>Estado emocional (opcional)</span>
              <span className="text-xs text-muted-foreground">{showMood ? "Ocultar" : "Mostrar"}</span>
            </button>
            {showMood && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="space-y-2">
                  <Label>¿Cómo estaba antes de entrar?</Label>
                  <div className="flex flex-wrap gap-2">
                    {EMOTIONS_BEFORE.map((e) => (
                      <button
                        key={e.key}
                        type="button"
                        onClick={() => setEmotionBefore((p) => (p === e.key ? "" : e.key))}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          emotionBefore === e.key
                            ? "border-brand bg-brand/15 text-brand-soft"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>¿Cómo me quedé después?</Label>
                  <div className="flex flex-wrap gap-2">
                    {EMOTIONS_AFTER.map((e) => (
                      <button
                        key={e.key}
                        type="button"
                        onClick={() => setEmotionAfter((p) => (p === e.key ? "" : e.key))}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          emotionAfter === e.key
                            ? "border-brand bg-brand/15 text-brand-soft"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>¿Seguí el plan?</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {FOLLOWED_PLAN.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setFollowedPlan((p) => (p === f.key ? "" : f.key))}
                        className={cn(
                          "rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
                          followedPlan === f.key
                            ? f.key === "yes"
                              ? "border-profit bg-profit/15 text-profit"
                              : f.key === "no"
                                ? "border-loss bg-loss/15 text-loss"
                                : "border-brand bg-brand/15 text-brand-soft"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Errores cometidos</Label>
                  <div className="flex flex-wrap gap-2">
                    {MISTAKES.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() =>
                          setMistakes((prev) =>
                            prev.includes(m.key)
                              ? prev.filter((x) => x !== m.key)
                              : [...prev, m.key],
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          mistakes.includes(m.key)
                            ? "border-loss bg-loss/15 text-loss"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Nota emocional</Label>
                  <Textarea
                    rows={2}
                    value={emotionNote}
                    onChange={(e) => setEmotionNote(e.target.value)}
                    placeholder="¿Qué me llevó a operar así?"
                  />
                </div>
              </div>
            )}
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={submit}>
            {saving ? "Guardando…" : isEditing ? "Guardar cambios" : "Guardar operación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
