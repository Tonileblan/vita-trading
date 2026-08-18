import { useState, type ReactNode } from "react";
import { Globe, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { useJournal } from "@/lib/journal-store";
import type { Strategy } from "@/lib/types";

const TEXT_FIELDS = [
  { key: "market", label: "Mercado / instrumento" },
  { key: "chart", label: "Gráfico" },
  { key: "days", label: "Días" },
  { key: "schedule", label: "Horario" },
  { key: "execution", label: "Operación" },
  { key: "setup", label: "Configuración" },
  { key: "management", label: "Gestión" },
  { key: "contracts", label: "Contratos" },
] as const;

type TextKey = (typeof TEXT_FIELDS)[number]["key"];

export function StrategyDialog({
  strategy,
  trigger,
}: {
  strategy?: Strategy;
  trigger: ReactNode;
}) {
  const { addStrategy, updateStrategy, removeStrategy } = useJournal();
  const editing = Boolean(strategy);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(strategy?.name ?? "");
  const [capital, setCapital] = useState(String(strategy?.initialCapital ?? 10000));
  const [risk, setRisk] = useState(String(((strategy?.riskPct ?? 0.03) * 100).toFixed(2)));
  const [symbol, setSymbol] = useState(strategy?.mainSymbol ?? "MNQ");
  const [isShared, setIsShared] = useState(Boolean(strategy?.isShared ?? false));
  const [text, setText] = useState<Record<TextKey, string>>(() =>
    Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, strategy?.[f.key] ?? ""])) as Record<
      TextKey,
      string
    >,
  );

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v && strategy) {
      setName(strategy.name);
      setCapital(String(strategy.initialCapital));
      setRisk((strategy.riskPct * 100).toFixed(2));
      setSymbol(strategy.mainSymbol);
      setIsShared(Boolean(strategy.isShared ?? false));
      setText(
        Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, strategy[f.key] ?? ""])) as Record<
          TextKey,
          string
        >,
      );
    } else if (v && !strategy) {
      setIsShared(false);
    }
  };

  const submit = () => {
    if (!name.trim()) {
      toast.error("Añade un nombre de estrategia");
      return;
    }
    const payload = {
      name: name.trim(),
      initialCapital: Number(capital) || 0,
      riskPct: (Number(risk) || 0) / 100,
      mainSymbol: symbol.trim().toUpperCase() || "MNQ",
      color: strategy?.color ?? "var(--brand)",
      isShared,
      ...(Object.fromEntries(
        TEXT_FIELDS.map((f) => [f.key, text[f.key].trim() || undefined]),
      ) as Partial<Record<TextKey, string | undefined>>),
    };
    if (strategy) {
      updateStrategy(strategy.id, payload);
      toast.success("Estrategia actualizada");
    } else {
      addStrategy(payload);
      toast.success("Estrategia creada");
      setName("");
    }
    setOpen(false);
  };

  const remove = () => {
    if (!strategy) return;
    removeStrategy(strategy.id);
    toast.success("Estrategia eliminada");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar estrategia" : "Nueva estrategia"}</DialogTitle>
          <DialogDescription>
            Define capital, riesgo y la ficha operativa de la estrategia.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Principal" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Capital inicial</Label>
              <Input
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label>Riesgo (%)</Label>
              <Input value={risk} onChange={(e) => setRisk(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-2">
              <Label>Símbolo</Label>
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} />
            </div>
          </div>

          {/* OPCIÓN: COMPARTIR CON TODOS LOS USUARIOS */}
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/40 p-3.5">
            <div className="space-y-0.5 pr-3">
              <Label htmlFor="strategy-shared-toggle" className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <Globe className="size-3.5 text-blue-500" /> Compartir con todos los usuarios
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Permite que todos los usuarios de la plataforma puedan ver y usar esta estrategia.
              </p>
            </div>
            <Switch
              id="strategy-shared-toggle"
              checked={isShared}
              onCheckedChange={setIsShared}
            />
          </div>

          {TEXT_FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label>{f.label}</Label>
              <Input
                value={text[f.key]}
                onChange={(e) => setText((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <DialogFooter className="sm:justify-between">
          {editing ? (
            <Button variant="destructive" onClick={remove}>
              <Trash2 className="size-4" /> Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit}>{editing ? "Guardar cambios" : "Crear estrategia"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
