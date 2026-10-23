import { useState, useEffect } from "react";
import { Building2, User, Plus, Flame, CheckCircle2, Archive, AlertTriangle, ShieldCheck, ShieldAlert, SlidersHorizontal } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { isTradeOfAccount, accountBalance, accountDrawdown, formatCurrency } from "@/lib/metrics";
import {
  ACCOUNT_PHASES,
  ACCOUNT_STATUSES,
  BURNED_REASONS,
  BROKERS,
  DRAWDOWN_TYPES,
  PROP_FIRMS,
  type Account,
  type AccountPhase,
  type AccountStatus,
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
  const { addAccount, updateAccount, removeAccount, markAccountBurned, trades, withdrawals } = useJournal();
  const editing = Boolean(account);

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? setControlledOpen! : setUncontrolledOpen;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [type, setType] = useState<AccountType>(account?.type ?? "funded");
  const [status, setStatus] = useState<AccountStatus>(account?.status ?? "active");
  const [burnedReason, setBurnedReason] = useState<string>(account?.burnedReason ?? BURNED_REASONS[0]);
  const [customBurnedReason, setCustomBurnedReason] = useState("");
  const [burnedAt, setBurnedAt] = useState<string>(
    account?.burnedAt ? account.burnedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
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
  const [customFloor, setCustomFloor] = useState(
    String(
      (account?.highWatermark ?? account?.initialBalance ?? 50000) -
        (account?.maxLossLimit ?? account?.drawdownLimit ?? 2500),
    ),
  );
  const [customRemaining, setCustomRemaining] = useState(
    String(
      Math.max(
        0,
        (account?.currentBalance ?? 50000) -
          ((account?.highWatermark ?? account?.initialBalance ?? 50000) -
            (account?.maxLossLimit ?? account?.drawdownLimit ?? 2500)),
      ),
    ),
  );
  const [ddType, setDdType] = useState<DrawdownType>(account?.drawdownType ?? "eod");
  const [phase, setPhase] = useState<AccountPhase>(account?.phase ?? "eval");
  const [target, setTarget] = useState(account?.profitTarget ? String(account.profitTarget) : "");
  const [enablePersonalDrawdown, setEnablePersonalDrawdown] = useState(
    Boolean(account?.maxLossLimit ?? account?.drawdownLimit),
  );

  // Funciones de sincronización interactiva de Drawdown
  const handleMaxLossChange = (val: string) => {
    setMaxLoss(val);
    const pLimit = parseMoneyInput(val);
    const pHwm = parseMoneyInput(highWatermark);
    const pCurr = parseMoneyInput(current);
    const pInit = parseMoneyInput(initial);
    if (Number.isFinite(pLimit)) {
      const f = ddType === "static" ? pInit - pLimit : pHwm - pLimit;
      const r = pCurr - f;
      if (Number.isFinite(f)) setCustomFloor(f.toFixed(2));
      if (Number.isFinite(r)) setCustomRemaining(Math.max(0, r).toFixed(2));
    }
  };

  const handleHwmChange = (val: string) => {
    setHighWatermark(val);
    const pHwm = parseMoneyInput(val);
    const pLimit = parseMoneyInput(maxLoss);
    const pCurr = parseMoneyInput(current);
    if (Number.isFinite(pHwm) && Number.isFinite(pLimit)) {
      const f = pHwm - pLimit;
      const r = pCurr - f;
      if (Number.isFinite(f)) setCustomFloor(f.toFixed(2));
      if (Number.isFinite(r)) setCustomRemaining(Math.max(0, r).toFixed(2));
    }
  };

  const handleFloorChange = (val: string) => {
    setCustomFloor(val);
    const pFloor = parseMoneyInput(val);
    const pLimit = parseMoneyInput(maxLoss);
    const pCurr = parseMoneyInput(current);
    if (Number.isFinite(pFloor)) {
      if (Number.isFinite(pLimit) && ddType !== "static") {
        const h = pFloor + pLimit;
        setHighWatermark(h.toFixed(2));
      }
      if (Number.isFinite(pCurr)) {
        const r = pCurr - pFloor;
        setCustomRemaining(Math.max(0, r).toFixed(2));
      }
    }
  };

  const handleRemainingChange = (val: string) => {
    setCustomRemaining(val);
    const pRem = parseMoneyInput(val);
    const pCurr = parseMoneyInput(current);
    const pLimit = parseMoneyInput(maxLoss);
    if (Number.isFinite(pRem) && Number.isFinite(pCurr)) {
      const f = pCurr - pRem;
      setCustomFloor(f.toFixed(2));
      if (Number.isFinite(pLimit) && ddType !== "static") {
        const h = f + pLimit;
        setHighWatermark(h.toFixed(2));
      }
    }
  };

  const handleCurrentChange = (val: string) => {
    setCurrent(val);
    const pCurr = parseMoneyInput(val);
    const pFloor = parseMoneyInput(customFloor);
    if (Number.isFinite(pCurr) && Number.isFinite(pFloor)) {
      const r = pCurr - pFloor;
      setCustomRemaining(Math.max(0, r).toFixed(2));
    }
  };

  const handleDdTypeChange = (v: DrawdownType) => {
    setDdType(v);
    const pLimit = parseMoneyInput(maxLoss);
    const pHwm = parseMoneyInput(highWatermark);
    const pInit = parseMoneyInput(initial);
    const pCurr = parseMoneyInput(current);
    if (Number.isFinite(pLimit)) {
      const f = v === "static" ? pInit - pLimit : pHwm - pLimit;
      const r = pCurr - f;
      if (Number.isFinite(f)) setCustomFloor(f.toFixed(2));
      if (Number.isFinite(r)) setCustomRemaining(Math.max(0, r).toFixed(2));
    }
  };

  // Sincronizar todos los campos del formulario cada vez que se abre el modal o cambia la cuenta
  useEffect(() => {
    if (open) {
      if (account) {
        setType(account.type);
        setStatus(account.status ?? "active");
        setName(account.name);
        setFirm(account.firm ?? PROP_FIRMS[0]!);
        setBroker(account.broker ?? BROKERS[0]!);
        setInitial(String(account.initialBalance));
        setCurrent(String(account.currentBalance));

        const initBal = account.initialBalance || 0;
        const currBal = account.currentBalance || 0;
        const existingDd = accountDrawdown(account, trades, withdrawals);
        const limitVal = account.maxLossLimit ?? account.drawdownLimit ?? 2500;
        const dType = account.drawdownType ?? "eod";
        const hwmVal = account.highWatermark ?? existingDd?.highWatermark ?? Math.max(initBal, currBal);
        const floorVal = existingDd?.floor ?? (dType === "static" ? initBal - limitVal : hwmVal - limitVal);
        const remVal = existingDd?.remaining ?? Math.max(0, currBal - floorVal);

        setMaxLoss(String(limitVal));
        setDailyLoss(account.dailyLossLimit != null ? String(account.dailyLossLimit) : "");
        setHighWatermark(String(hwmVal));
        setCustomFloor(String(floorVal.toFixed(2)));
        setCustomRemaining(String(remVal.toFixed(2)));
        setStartOfDay(String(account.startOfDayBalance ?? account.initialBalance));
        setDdType(dType);
        setPhase(account.phase ?? "eval");
        setTarget(account.profitTarget ? String(account.profitTarget) : "");
        setEnablePersonalDrawdown(Boolean(account.maxLossLimit ?? account.drawdownLimit));

        if (account.burnedReason) {
          if (BURNED_REASONS.includes(account.burnedReason as any)) {
            setBurnedReason(account.burnedReason);
            setCustomBurnedReason("");
          } else {
            setBurnedReason("Otro motivo");
            setCustomBurnedReason(account.burnedReason);
          }
        } else {
          setBurnedReason(BURNED_REASONS[0]);
          setCustomBurnedReason("");
        }
        setBurnedAt(
          account.burnedAt ? account.burnedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
        );
      } else {
        setType("funded");
        setStatus("active");
        setName("");
        setFirm(PROP_FIRMS[0]!);
        setBroker(BROKERS[0]!);
        setInitial("50000");
        setCurrent("50000");
        setMaxLoss("2500");
        setDailyLoss("");
        setHighWatermark("50000");
        setCustomFloor("47500");
        setCustomRemaining("2500");
        setStartOfDay("50000");
        setDdType("eod");
        setPhase("eval");
        setTarget("");
        setEnablePersonalDrawdown(false);
        setBurnedReason(BURNED_REASONS[0]);
        setCustomBurnedReason("");
        setBurnedAt(new Date().toISOString().slice(0, 10));
      }
    }
  }, [open, account, trades, withdrawals]);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
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

    let finalInitialBalance = initialBalance;
    let finalCurrentBalance = currentBalance;

    if (account) {
      const accTrades = (trades || []).filter((t) => isTradeOfAccount(t, account));
      const tradePnl = accTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
      const withdrawn = (withdrawals || [])
        .filter((w) => String(w.accountId || "").toLowerCase() === account.id.toLowerCase())
        .reduce((s, w) => s + Math.abs(w.amount), 0);

      if (accTrades.length > 0) {
        const prevCalcBalance = Number(((account.initialBalance || 0) + tradePnl - withdrawn).toFixed(2));
        if (currentBalance !== prevCalcBalance && initialBalance === account.initialBalance) {
          // El usuario editó manualmente el balance actual
          finalInitialBalance = Number((currentBalance - tradePnl + withdrawn).toFixed(2));
          finalCurrentBalance = currentBalance;
        } else if (initialBalance !== account.initialBalance) {
          // El usuario editó el balance inicial
          finalInitialBalance = initialBalance;
          finalCurrentBalance = Number((initialBalance + tradePnl - withdrawn).toFixed(2));
        }
      }
    }

    const finalBurnedReason =
      status === "burned"
        ? burnedReason === "Otro motivo"
          ? customBurnedReason.trim() || "Otro motivo"
          : burnedReason
        : undefined;

    const finalBurnedAt =
      status === "burned"
        ? burnedAt
          ? new Date(burnedAt).toISOString()
          : new Date().toISOString()
        : undefined;

    const hasDrawdown =
      type === "funded" ||
      enablePersonalDrawdown ||
      (Number.isFinite(parsedMaxLoss) && parsedMaxLoss > 0);

    const payload = {
      name: name.trim(),
      type,
      status,
      burnedAt: finalBurnedAt,
      burnedReason: finalBurnedReason,
      firm: type === "funded" ? firm : undefined,
      broker: type === "personal" ? broker : undefined,
      initialBalance: finalInitialBalance,
      currentBalance: finalCurrentBalance,
      maxLossLimit: hasDrawdown ? parsedMaxLoss : undefined,
      drawdownLimit: hasDrawdown ? parsedMaxLoss : undefined,
      dailyLossLimit:
        hasDrawdown &&
        parsedDailyLoss !== undefined &&
        Number.isFinite(parsedDailyLoss) &&
        parsedDailyLoss > 0
          ? parsedDailyLoss
          : undefined,
      highWatermark:
        hasDrawdown && Number.isFinite(parsedHwm) && parsedHwm > 0
          ? parsedHwm
          : Math.max(finalInitialBalance, finalCurrentBalance),
      startOfDayBalance:
        hasDrawdown && Number.isFinite(parsedSod) && parsedSod > 0 ? parsedSod : finalInitialBalance,
      drawdownType: hasDrawdown ? ddType : undefined,
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
    } catch (err: unknown) {
      console.error("Error al guardar la cuenta:", err);
      const msg = err instanceof Error ? err.message : "No se pudo guardar la cuenta";
      toast.error(msg);
    }
  };

  const handleMarkBurnedQuick = async () => {
    if (!account) return;
    try {
      await markAccountBurned(account.id, burnedReason, burnedAt);
      toast.success("Cuenta archivada como Quemada / Perdida");
      setShowDeleteConfirm(false);
      setOpen(false);
    } catch (err) {
      toast.error("No se pudo marcar la cuenta como quemada");
    }
  };

  const handlePermanentDelete = () => {
    if (!account) return;
    removeAccount(account.id);
    toast.success("Cuenta eliminada definitivamente");
    setShowDeleteConfirm(false);
    setOpen(false);
  };

  const defaultTrigger = (
    <Button className="gap-1.5 font-display text-sm tracking-wide">
      <Plus className="size-4" /> Nueva Cuenta
    </Button>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-wide">
              {editing ? "Editar cuenta" : "Crear nueva cuenta"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configura el estado, tipo de cuenta, capital inicial y límites de riesgo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 text-xs">
            {/* ESTADO DE LA CUENTA */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Estado de la cuenta</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { key: "active", label: "Activa", icon: ShieldCheck, color: "text-emerald-500" },
                  { key: "burned", label: "🔥 Quemada", icon: Flame, color: "text-loss" },
                  { key: "passed", label: "Superada", icon: CheckCircle2, color: "text-sky-500" },
                  { key: "archived", label: "Archivada", icon: Archive, color: "text-muted-foreground" },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatus(s.key as AccountStatus)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-semibold transition-all",
                      status === s.key
                        ? "border-brand bg-brand/10 text-foreground font-bold shadow-xs ring-1 ring-brand/40"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30",
                    )}
                  >
                    <s.icon className={cn("size-3.5", s.color)} />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SECCIÓN ESPECÍFICA SI ESTÁ QUEMADA */}
            {status === "burned" && (
              <div className="rounded-xl border border-loss/30 bg-loss/5 p-3 space-y-2.5">
                <div className="flex items-center gap-2 text-loss font-bold text-xs">
                  <Flame className="size-4 shrink-0" />
                  <span>Información de la Cuenta Quemada / Perdida</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Motivo de quema / breach</Label>
                  <Select value={burnedReason} onValueChange={setBurnedReason}>
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BURNED_REASONS.map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {burnedReason === "Otro motivo" && (
                    <Input
                      value={customBurnedReason}
                      onChange={(e) => setCustomBurnedReason(e.target.value)}
                      placeholder="Describe el motivo específico..."
                      className="text-xs h-8 mt-1.5"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Fecha de quema / pérdida</Label>
                  <Input
                    type="date"
                    value={burnedAt}
                    onChange={(e) => setBurnedAt(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
            )}

            {/* TIPO DE CUENTA: FONDEO VS PERSONAL */}
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
                placeholder="Ej. Apex 50K PA / FundedNext 50K Eval"
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
                  onChange={(e) => handleCurrentChange(e.target.value)}
                  inputMode="decimal"
                  className="text-xs font-mono font-medium"
                />
              </div>
            </div>

            {type === "funded" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Fase de la cuenta</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ACCOUNT_PHASES.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPhase(p.key)}
                      className={cn(
                        "rounded-xl border p-2.5 text-xs font-semibold transition-all cursor-pointer",
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
            )}

            {type === "funded" && (
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
                  className="text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  {ACCOUNT_PHASES.find((p) => p.key === phase)?.help}
                </p>
              </div>
            )}

            {type === "personal" && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="acc-enable-dd"
                  checked={enablePersonalDrawdown}
                  onChange={(e) => setEnablePersonalDrawdown(e.target.checked)}
                  className="size-3.5 rounded border-border text-brand focus:ring-brand/40 cursor-pointer"
                />
                <Label
                  htmlFor="acc-enable-dd"
                  className="text-xs cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  Configurar y supervisar límites de Drawdown en esta cuenta personal
                </Label>
              </div>
            )}

            {/* SECCIÓN AVANZADA: CONTROL Y AJUSTE MANUAL DE DRAWDOWN */}
            {(type === "funded" || enablePersonalDrawdown) && (
              <div className="rounded-xl border border-brand/30 bg-brand/[0.03] dark:bg-brand/[0.06] p-3.5 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-border/50 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-4 text-brand shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        Control y Ajuste Manual de Drawdown
                      </h4>
                      <p className="text-[10px] text-muted-foreground">
                        Modifica cualquier parámetro; el suelo y el margen se sincronizan al instante.
                      </p>
                    </div>
                  </div>
                  <span className="rounded bg-brand/10 border border-brand/25 px-2 py-0.5 text-[10px] font-bold text-brand uppercase font-mono">
                    {DRAWDOWN_TYPES.find((d) => d.key === ddType)?.label}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tipo de Drawdown</Label>
                  <Select value={ddType} onValueChange={(v) => handleDdTypeChange(v as DrawdownType)}>
                    <SelectTrigger className="text-xs h-8">
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
                  <p className="text-[10px] text-muted-foreground">
                    {DRAWDOWN_TYPES.find((d) => d.key === ddType)?.help}
                  </p>
                </div>

                {/* FILA 1: LÍMITE TOTAL DE DRAWDOWN & MARGEN RESTANTE MANUAL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label
                      htmlFor="acc-max-loss"
                      className="text-xs font-bold text-foreground flex items-center justify-between"
                    >
                      <span>Límite Total de Drawdown ($) *</span>
                    </Label>
                    <Input
                      id="acc-max-loss"
                      value={maxLoss}
                      onChange={(e) => handleMaxLossChange(e.target.value)}
                      inputMode="decimal"
                      placeholder="2500"
                      className="text-xs font-mono font-semibold"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Pérdida máxima total permitida antes de quema
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label
                      htmlFor="acc-rem-dd"
                      className="text-xs font-bold text-profit flex items-center justify-between"
                    >
                      <span>Margen Restante de Drawdown ($)</span>
                      <span className="text-[9px] font-normal uppercase text-muted-foreground font-mono">
                        Colchón
                      </span>
                    </Label>
                    <Input
                      id="acc-rem-dd"
                      value={customRemaining}
                      onChange={(e) => handleRemainingChange(e.target.value)}
                      inputMode="decimal"
                      placeholder="1850"
                      className="text-xs font-mono font-bold text-profit bg-profit/[0.04] border-profit/35 focus-visible:ring-profit/40"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Modifica directamente tu colchón restante
                    </p>
                  </div>
                </div>

                {/* FILA 2: SUELO DE LIQUIDACIÓN Y HIGH WATERMARK MANUAL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40">
                  <div className="space-y-1">
                    <Label
                      htmlFor="acc-floor"
                      className="text-xs font-semibold text-foreground/90 flex items-center justify-between"
                    >
                      <span>Suelo de Liquidación ($)</span>
                      <span className="text-[9px] font-normal text-loss font-mono">Rotura</span>
                    </Label>
                    <Input
                      id="acc-floor"
                      value={customFloor}
                      onChange={(e) => handleFloorChange(e.target.value)}
                      inputMode="decimal"
                      placeholder="48500"
                      className="text-xs font-mono font-semibold border-loss/35 focus-visible:ring-loss/40"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Nivel de balance donde la cuenta se quemaría
                    </p>
                  </div>

                  {ddType !== "static" ? (
                    <div className="space-y-1">
                      <Label
                        htmlFor="acc-hwm"
                        className="text-xs font-semibold text-foreground/90 flex items-center justify-between"
                      >
                        <span>Pico Máximo (High Watermark) ($)</span>
                        <span className="text-[9px] font-normal text-muted-foreground font-mono">
                          Trailing
                        </span>
                      </Label>
                      <Input
                        id="acc-hwm"
                        value={highWatermark}
                        onChange={(e) => handleHwmChange(e.target.value)}
                        inputMode="decimal"
                        className="text-xs font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Pico que arrastra dinámicamente el suelo
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Modo Estático
                      </Label>
                      <div className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[11px] font-mono text-muted-foreground">
                        Suelo fijo sobre capital inicial ({initial}$)
                      </div>
                      <p className="text-[10px] text-muted-foreground">El suelo nunca sube con las ganancias</p>
                    </div>
                  )}
                </div>

                {/* FILA 3: LÍMITE DIARIO Y BALANCE INICIO DÍA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40">
                  <div className="space-y-1">
                    <Label htmlFor="acc-daily-loss" className="text-xs font-medium text-muted-foreground">
                      Límite de Pérdida Diaria ($)
                    </Label>
                    <Input
                      id="acc-daily-loss"
                      value={dailyLoss}
                      onChange={(e) => setDailyLoss(e.target.value)}
                      inputMode="decimal"
                      placeholder="1000 (opcional)"
                      className="text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">Pérdida máxima por sesión de trading</p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="acc-sod" className="text-xs font-medium text-muted-foreground">
                      Balance Inicio Día ($)
                    </Label>
                    <Input
                      id="acc-sod"
                      value={startOfDay}
                      onChange={(e) => setStartOfDay(e.target.value)}
                      inputMode="decimal"
                      className="text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">Referencia para la pérdida diaria de hoy</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-between pt-2">
            {editing ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="gap-1.5 text-xs"
              >
                Eliminar / Archivar
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

      {/* CONFIRMACIÓN DE ELIMINACIÓN VS ARCHIVADO / QUEMADA */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-5 text-amber-500" />
              ¿Qué deseas hacer con esta cuenta?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2 pt-1 text-muted-foreground">
              <p>
                Si se trata de una cuenta que superó el drawdown o se perdió, te recomendamos{" "}
                <strong className="text-foreground">marcarla como Cuenta Quemada</strong>. De este modo conservarás
                su historial de operaciones, métricas y podrás recuperarla cuando lo desees.
              </p>
              <p className="text-[11px] text-loss">
                La eliminación definitiva borrará la cuenta y sus operaciones asociadas de forma irreversible.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkBurnedQuick}
              className="text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1.5"
            >
              <Flame className="size-3.5" />
              Marcar como Quemada (Seguro)
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handlePermanentDelete}
              className="text-xs"
            >
              Eliminar definitivamente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
