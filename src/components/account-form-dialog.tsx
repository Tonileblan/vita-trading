import { useState } from "react";
import { Building2, User, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJournal } from "@/lib/journal-store";
import { parseMoneyInput } from "@/lib/money";
import {
  ACCOUNT_PHASES,
  BROKERS,
  DRAWDOWN_TYPES,
  PROP_FIRMS,
  type Account,
  type AccountPhase,
  type AccountType,
  type DrawdownType,
} from "@/lib/types";
import { usePropFirms } from "@/lib/prop-firms";
import { useBrokers } from "@/lib/brokers";
import { cn } from "@/lib/utils";

interface AccountDialogProps {
  account?: Account | undefined;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AccountFormDialog({
  account,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: AccountDialogProps) {
  const { addAccount, updateAccount, removeAccount } = useJournal();
  const editing = Boolean(account);

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? setControlledOpen! : setUncontrolledOpen;

  const [type, setType] = useState<AccountType>(account?.type ?? "funded");
  const [name, setName] = useState(account?.name ?? "");

  const { firms, customFirms, addFirm, removeFirm } = usePropFirms();
  const [newFirm, setNewFirm] = useState("");
  const [firm, setFirm] = useState(account?.firm ?? PROP_FIRMS[0]!);

  const handleAddFirm = () => {
    const added = addFirm(newFirm);
    if (!added) return;
    setFirm(added);
    setNewFirm("");
  };

  const { brokers, customBrokers, addBroker, removeBroker } = useBrokers();
  const [newBroker, setNewBroker] = useState("");
  const [broker, setBroker] = useState(account?.broker ?? BROKERS[0]!);

  const handleAddBroker = () => {
    const added = addBroker(newBroker);
    if (!added) return;
    setBroker(added);
    setNewBroker("");
  };

  const [initial, setInitial] = useState(String(account?.initialBalance ?? 50000));
  const [current, setCurrent] = useState(String(account?.currentBalance ?? 50000));

  const [maxLoss, setMaxLoss] = useState(
    String(account?.maxLossLimit ?? account?.drawdownLimit ?? 2500),
  );
  const [dailyLoss, setDailyLoss] = useState(
    account?.dailyLossLimit != null ? String(account.dailyLossLimit) : "",
  );
  const [highWatermark, setHighWatermark] = useState(
    String(account?.highWatermark ?? account?.initialBalance ?? 50000),
  );
  const [startOfDay, setStartOfDay] = useState(
    String(account?.startOfDayBalance ?? account?.initialBalance ?? 50000),
  );
  const [ddType, setDdType] = useState<DrawdownType>(account?.drawdownType ?? "trailing");
  const [phase, setPhase] = useState<AccountPhase>(account?.phase ?? "eval");
  const [target, setTarget] = useState(account?.profitTarget ? String(account.profitTarget) : "");

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v && account) {
      setType(account.type);
      setName(account.name);
      setFirm(account.firm ?? PROP_FIRMS[0]!);
      setBroker(account.broker ?? BROKERS[0]!);
      setInitial(String(account.initialBalance));
      setCurrent(String(account.currentBalance));

      setMaxLoss(String(account.maxLossLimit ?? account.drawdownLimit ?? 2500));
      setDailyLoss(account.dailyLossLimit != null ? String(account.dailyLossLimit) : "");
      setHighWatermark(String(account.highWatermark ?? account.initialBalance));
      setStartOfDay(String(account.startOfDayBalance ?? account.initialBalance));
      setDdType(account.drawdownType ?? "trailing");
      setPhase(account.phase ?? "eval");
      setTarget(account.profitTarget ? String(account.profitTarget) : "");
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Añade un nombre de cuenta");
      return;
    }
    const initialBalance = parseMoneyInput(initial);
    const currentBalance = parseMoneyInput(current);
    const parsedMaxLoss = parseMoneyInput(maxLoss);
    const parsedDailyLoss = dailyLoss.trim() ? parseMoneyInput(dailyLoss) : undefined;
    const parsedHwm = highWatermark.trim() ? parseMoneyInput(highWatermark) : initialBalance;
    const parsedSod = startOfDay.trim() ? parseMoneyInput(startOfDay) : initialBalance;

    if (!Number.isFinite(initialBalance) || !Number.isFinite(currentBalance)) {
      toast.error("Revisa los balances introducidos");
      return;
    }

    if (type === "funded") {
      if (!Number.isFinite(parsedMaxLoss) || parsedMaxLoss <= 0) {
        toast.error("Introduce un Límite Total de Pérdida válido");
        return;
      }
    }

    const payload = {
      name: name.trim(),
      type,
      firm: type === "funded" ? firm : undefined,
      broker: type === "personal" ? broker : undefined,
      initialBalance,
      currentBalance,
      maxLossLimit: type === "funded" ? parsedMaxLoss : undefined,
      drawdownLimit: type === "funded" ? parsedMaxLoss : undefined,
      dailyLossLimit:
        type === "funded" &&
        parsedDailyLoss !== undefined &&
        Number.isFinite(parsedDailyLoss) &&
        parsedDailyLoss > 0
          ? parsedDailyLoss
          : undefined,
      highWatermark:
        Number.isFinite(parsedHwm) && parsedHwm > 0
          ? parsedHwm
          : Math.max(initialBalance, currentBalance),
      startOfDayBalance: Number.isFinite(parsedSod) && parsedSod > 0 ? parsedSod : initialBalance,
      drawdownType: type === "funded" ? ddType : undefined,
      phase: type === "funded" ? phase : undefined,
      profitTarget:
        type === "funded" && Number.isFinite(parseMoneyInput(target)) && parseMoneyInput(target) > 0
          ? parseMoneyInput(target)
          : undefined,
      currency: account?.currency ?? "USD",
    };

    try {
      if (account) {
        await updateAccount(account.id, payload);
        toast.success("Cuenta actualizada");
      } else {
        await addAccount(payload);
        toast.success("Cuenta creada");
        setName("");
      }
      setOpen(false);
    } catch {
      toast.error("No se pudo guardar la cuenta");
    }
  };

  const remove = () => {
    if (!account) return;
    removeAccount(account.id);
    toast.success("Cuenta eliminada");
    setOpen(false);
  };

  const defaultTrigger = (
    <Button className="gap-1.5 font-display text-sm tracking-wide">
      <Plus className="size-4" /> Nueva Cuenta
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wide">
            {editing ? "Editar cuenta" : "Crear nueva cuenta"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configura el tipo de cuenta, capital inicial y límites de riesgo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: "funded", label: "Cuenta de Fondeo", icon: Building2 },
                { key: "personal", label: "Cuenta Personal", icon: User },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setType(opt.key)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all",
                  type === opt.key
                    ? "border-brand bg-brand/10 text-brand shadow-xs"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <opt.icon className="size-4" />
                {opt.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="acc-name" className="text-xs">
              Nombre de la cuenta
            </Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Apex 50K PA / FTMO 100K Eval"
              className="text-xs"
            />
          </div>

          {type === "funded" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Prop Firm</Label>
              <Select value={firm} onValueChange={setFirm}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {firms.map((f) => (
                    <SelectItem key={f} value={f} className="text-xs">
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 pt-1">
                <Input
                  value={newFirm}
                  onChange={(e) => setNewFirm(e.target.value)}
                  placeholder="Otra prop firm personalizada"
                  className="text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddFirm();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddFirm} className="text-xs h-8">
                  Añadir
                </Button>
              </div>
              {customFirms.includes(firm) && (
                <button
                  type="button"
                  className="text-[11px] text-destructive hover:underline"
                  onClick={() => {
                    removeFirm(firm);
                    setFirm(PROP_FIRMS[0]!);
                  }}
                >
                  Eliminar "{firm}" de la lista
                </button>
              )}
            </div>
          )}

          {type === "personal" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Broker</Label>
              <Select value={broker} onValueChange={setBroker}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {brokers.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 pt-1">
                <Input
                  value={newBroker}
                  onChange={(e) => setNewBroker(e.target.value)}
                  placeholder="Otro broker personalizado"
                  className="text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddBroker();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddBroker} className="text-xs h-8">
                  Añadir
                </Button>
              </div>
              {customBrokers.includes(broker) && (
                <button
                  type="button"
                  className="text-[11px] text-destructive hover:underline"
                  onClick={() => {
                    removeBroker(broker);
                    setBroker(BROKERS[0]!);
                  }}
                >
                  Eliminar "{broker}" de la lista
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-init" className="text-xs">
                Balance inicial ($)
              </Label>
              <Input
                id="acc-init"
                value={initial}
                onChange={(e) => {
                  setInitial(e.target.value);
                  if (!editing) setCurrent(e.target.value);
                }}
                inputMode="decimal"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-curr" className="text-xs">
                Balance actual ($)
              </Label>
              <Input
                id="acc-curr"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                inputMode="decimal"
                className="text-xs"
              />
            </div>
          </div>

          {type === "funded" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Fase de la cuenta</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ACCOUNT_PHASES.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPhase(p.key)}
                      className={cn(
                        "rounded-xl border p-2.5 text-xs font-semibold transition-all",
                        phase === p.key
                          ? "border-brand bg-brand/10 text-brand shadow-xs"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="acc-target" className="text-xs">
                  {phase === "live" ? "Objetivo para retiro ($)" : "Objetivo de evaluación ($)"}
                </Label>
                <Input
                  id="acc-target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ej. 53000"
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  {ACCOUNT_PHASES.find((p) => p.key === phase)?.help}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Drawdown</Label>
                <Select value={ddType} onValueChange={(v) => setDdType(v as DrawdownType)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DRAWDOWN_TYPES.map((d) => (
                      <SelectItem key={d.key} value={d.key} className="text-xs">
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {DRAWDOWN_TYPES.find((d) => d.key === ddType)?.help}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="acc-max-loss" className="text-xs">
                    Límite Total de Pérdida ($) *
                  </Label>
                  <Input
                    id="acc-max-loss"
                    value={maxLoss}
                    onChange={(e) => setMaxLoss(e.target.value)}
                    inputMode="decimal"
                    placeholder="2500"
                    className="text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Max Loss total permitido</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="acc-daily-loss" className="text-xs">
                    Límite Diario ($)
                  </Label>
                  <Input
                    id="acc-daily-loss"
                    value={dailyLoss}
                    onChange={(e) => setDailyLoss(e.target.value)}
                    inputMode="decimal"
                    placeholder="1000 (opcional)"
                    className="text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Pérdida máx. por día</p>
                </div>
              </div>

              {editing && (
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/40">
                  <div className="space-y-1">
                    <Label htmlFor="acc-hwm" className="text-xs text-muted-foreground">
                      High Watermark ($)
                    </Label>
                    <Input
                      id="acc-hwm"
                      value={highWatermark}
                      onChange={(e) => setHighWatermark(e.target.value)}
                      inputMode="decimal"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="acc-sod" className="text-xs text-muted-foreground">
                      Balance Inicio Día ($)
                    </Label>
                    <Input
                      id="acc-sod"
                      value={startOfDay}
                      onChange={(e) => setStartOfDay(e.target.value)}
                      inputMode="decimal"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-between pt-2">
          {editing ? (
            <Button variant="destructive" size="sm" onClick={remove} className="gap-1.5 text-xs">
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={submit} className="text-xs font-display tracking-wide">
              {editing ? "Guardar cambios" : "Crear cuenta"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
