import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
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
import { useJournal } from "@/lib/journal-store";
import type { Strategy } from "@/lib/types";

const TEXT_FIELDS = [
  { key: "market", label: "Mercado / Instrumento", placeholder: "Ej: Nasdaq (NQ / MNQ), S&P 500, EURUSD..." },
  { key: "chart", label: "Temporalidad / Gráfico (TF)", placeholder: "Ej: 1m, 5m, 15m, 1h..." },
  { key: "days", label: "Días Operativos", placeholder: "Ej: Lun - Vie, Mar y Jue, Lun a Jue..." },
  { key: "schedule", label: "Horario Operativo", placeholder: "Ej: 09:30 - 11:30 EST, Sesión NY / London..." },
  { key: "execution", label: "Tipo de Operación", placeholder: "Ej: Scalping, Day Trading, Swing..." },
  { key: "setup", label: "Setup / Configuración", placeholder: "Ej: Ruptura de rango, FVG + ChoCH, Doble suelo..." },
  { key: "management", label: "Gestión de Posición", placeholder: "Ej: 1:2 R:R, Stop a BE tras +1R, Parciales 50%..." },
  { key: "contracts", label: "Contratos / Lotes", placeholder: "Ej: 1 a 3 micro contratos..." },
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
      setText(
        Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, strategy[f.key] ?? ""])) as Record<
          TextKey,
          string
        >,
      );
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

          {TEXT_FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label>{f.label}</Label>
              <Input
                value={text[f.key]}
                placeholder={f.placeholder}
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
