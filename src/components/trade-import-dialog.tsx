import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Coins,
  DollarSign,
  HelpCircle,
  ImagePlus,
  Layers,
  Loader2,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
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
import {
  getLocalGoogleAiKey,
  getLocalGoogleAiModel,
  DEFAULT_GEMINI_MODEL,
} from "@/lib/google-ai";
import { formatCurrency } from "@/lib/metrics";
import { parseDetectedDate } from "@/lib/parse-date";
import type { Account, Strategy } from "@/lib/types";
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
  detectedAt: string | null;
  /** Identificador detectado para agrupar */
  detectedAccountKey: string;
  /** Cuenta destino final asignada */
  assignedAccountId: string;
  /** Estrategia destino final asignada */
  assignedStrategyId: string;
}

function compressImageFile(file: File, maxDim = 1280, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } else {
          resolve(String(e.target?.result || ""));
        }
      };
      img.onerror = () => resolve(String(e.target?.result || ""));
      img.src = String(e.target?.result || "");
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

/**
 * Función para emparejar inteligentemente un texto detectado con las cuentas registradas del usuario.
 */
function findBestAccountMatch(
  detected: string,
  accounts: Account[],
): Account | undefined {
  if (!detected || !accounts.length) return undefined;
  const d = detected.toLowerCase().trim();

  // 1. Coincidencia exacta por nombre
  const exact = accounts.find((a) => a.name.toLowerCase().trim() === d);
  if (exact) return exact;

  // 2. Coincidencia por subcadena de nombre o empresa (firm)
  const bySub = accounts.find((a) => {
    const aName = a.name.toLowerCase();
    const aFirm = (a.firm || "").toLowerCase();
    return (
      (aName && (d.includes(aName) || aName.includes(d))) ||
      (aFirm && (d.includes(aFirm) || aFirm.includes(d)))
    );
  });
  if (bySub) return bySub;

  return undefined;
}

export function TradeImportDialog() {
  const navigate = useNavigate();
  const { accounts, strategies, trades, addTrades } = useJournal();
  const extract = useServerFn(extractTradesFromImages);

  const [open, setOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  // Cuenta y estrategia por defecto para capturas simples
  const [defaultAccountId, setDefaultAccountId] = useState(accounts[0]?.id ?? "");
  const [defaultStrategyId, setDefaultStrategyId] = useState(strategies[0]?.id ?? "");

  // Mapeo interactivo: { [detectedAccountKey]: { targetAccountId, targetStrategyId } }
  const [accountMappings, setAccountMappings] = useState<
    Record<string, { targetAccountId: string; targetStrategyId: string }>
  >({});

  // Al elegir cuenta por defecto, asigna la estrategia asociada
  useEffect(() => {
    const acc = accounts.find((a) => a.id === defaultAccountId);
    if (acc?.strategyId && strategies.some((s) => s.id === acc.strategyId)) {
      setDefaultStrategyId(acc.strategyId);
    }
  }, [defaultAccountId, accounts, strategies]);

  const [images, setImages] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const googleAiKey = typeof window !== "undefined" ? getLocalGoogleAiKey() : "";
  const googleAiModel = typeof window !== "undefined" ? getLocalGoogleAiModel() : DEFAULT_GEMINI_MODEL;

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files) return;
    const fileList = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 6);

    for (const f of fileList) {
      const compressed = await compressImageFile(f);
      if (compressed) {
        setImages((prev) => [...prev, compressed].slice(0, 6));
      }
    }
  };

  const analyse = async () => {
    if (images.length === 0) {
      toast.error("Añade al menos una captura");
      return;
    }
    if (!googleAiKey) {
      toast.error("Para usar funciones de IA conecta Google AI aquí", {
        action: {
          label: "Conectar aquí",
          onClick: () => {
            setOpen(false);
            navigate({ to: "/usuarios" });
          },
        },
        duration: 7000,
      });
      return;
    }
    setLoading(true);
    try {
      const found = await extract({
        data: {
          images,
          symbols: strategies.map((s) => s.mainSymbol),
          accountHints: accounts.map((a) => `${a.name}${a.firm ? ` [${a.firm}]` : ""}`),
          apiKey: googleAiKey || undefined,
          model: googleAiModel,
        },
      });

      // Cuenta cuántas operaciones idénticas ya existen
      const existingCounts = new Map<string, number>();
      for (const t of trades) {
        const k = dedupeKey(t);
        existingCounts.set(k, (existingCounts.get(k) ?? 0) + 1);
      }

      // Detectar grupos de cuentas presentes en la extracción
      const newMappings: Record<string, { targetAccountId: string; targetStrategyId: string }> = {};
      const detectedGroups = new Set<string>();

      found.forEach((t) => {
        const accTag = t.accountName
          ? t.accountFirm
            ? `${t.accountName} (${t.accountFirm})`
            : t.accountName
          : t.accountFirm || "";
        const groupKey = accTag.trim() || "Cuenta principal (sin nombre detectado)";
        detectedGroups.add(groupKey);
      });

      // Emparejar cada grupo detectado con una cuenta de Vita-Trading
      detectedGroups.forEach((groupKey) => {
        const matched = findBestAccountMatch(groupKey, accounts);
        const targetAcc = matched || accounts[0];
        const targetStratId = targetAcc?.strategyId || strategies[0]?.id || "";
        newMappings[groupKey] = {
          targetAccountId: targetAcc ? targetAcc.id : defaultAccountId,
          targetStrategyId: targetStratId,
        };
      });

      setAccountMappings(newMappings);

      const usedCounts = new Map<string, number>();
      const parsedRows: Row[] = [];

      found.forEach((t, i) => {
        const key = dedupeKey(t);
        const used = usedCounts.get(key) ?? 0;
        usedCounts.set(key, used + 1);
        const duplicate = used < (existingCounts.get(key) ?? 0);
        const detectedAt = parseDetectedDate(t.closedAt ?? t.openedAt);

        const accTag = t.accountName
          ? t.accountFirm
            ? `${t.accountName} (${t.accountFirm})`
            : t.accountName
          : t.accountFirm || "";
        const groupKey = accTag.trim() || "Cuenta principal (sin nombre detectado)";
        const mapping = newMappings[groupKey];

        parsedRows.push({
          ...t,
          key: `${key}#${i}`,
          duplicate,
          selected: !duplicate,
          detectedAt,
          detectedAccountKey: groupKey,
          assignedAccountId: mapping?.targetAccountId || defaultAccountId,
          assignedStrategyId: mapping?.targetStrategyId || defaultStrategyId,
        });
      });

      setRows(parsedRows);

      if (parsedRows.length === 0) {
        toast.error("No se detectaron operaciones en las capturas");
      } else {
        const uniqueAccountsDetected = detectedGroups.size;
        toast.success(
          `${parsedRows.length} operaciones detectadas · ${uniqueAccountsDetected} ${uniqueAccountsDetected === 1 ? "cuenta/prop firm" : "cuentas/prop firms distintas"}`,
        );
      }
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("404") ||
        msg.includes("not found") ||
        msg.includes("Falta configurar") ||
        msg.includes("no válida") ||
        msg.includes("Google AI") ||
        msg.includes("AIza")
      ) {
        toast.error("Para usar funciones de IA conecta Google AI aquí", {
          action: {
            label: "Conectar aquí",
            onClick: () => {
              setOpen(false);
              navigate({ to: "/usuarios" });
            },
          },
          duration: 7000,
        });
      } else {
        toast.error(msg || "No se pudo analizar la captura con Google AI Gemini");
      }
    } finally {
      setLoading(false);
    }
  };

  // Actualizar cuenta destino para un grupo detectado
  const handleUpdateGroupAccount = (groupKey: string, newAccountId: string) => {
    const acc = accounts.find((a) => a.id === newAccountId);
    const newStratId = acc?.strategyId || accountMappings[groupKey]?.targetStrategyId || defaultStrategyId;

    setAccountMappings((prev) => ({
      ...prev,
      [groupKey]: {
        targetAccountId: newAccountId,
        targetStrategyId: newStratId,
      },
    }));

    // Actualizar todas las filas asociadas a ese grupo
    setRows((prev) =>
      (prev ?? []).map((r) =>
        r.detectedAccountKey === groupKey
          ? {
              ...r,
              assignedAccountId: newAccountId,
              assignedStrategyId: newStratId,
            }
          : r,
      ),
    );
  };

  // Actualizar estrategia destino para un grupo detectado
  const handleUpdateGroupStrategy = (groupKey: string, newStrategyId: string) => {
    setAccountMappings((prev) => ({
      ...prev,
      [groupKey]: {
        ...(prev[groupKey] ?? { targetAccountId: defaultAccountId }),
        targetStrategyId: newStrategyId,
      },
    }));

    setRows((prev) =>
      (prev ?? []).map((r) =>
        r.detectedAccountKey === groupKey
          ? {
              ...r,
              assignedStrategyId: newStrategyId,
            }
          : r,
      ),
    );
  };

  // Actualizar cuenta de una fila individual
  const handleUpdateRowAccount = (rowIndex: number, newAccountId: string) => {
    const acc = accounts.find((a) => a.id === newAccountId);
    setRows((prev) =>
      (prev ?? []).map((r, i) =>
        i === rowIndex
          ? {
              ...r,
              assignedAccountId: newAccountId,
              assignedStrategyId: acc?.strategyId || r.assignedStrategyId,
            }
          : r,
      ),
    );
  };

  // Grupos únicos detectados con su conteo
  const detectedGroupList = useMemo(() => {
    if (!rows) return [];
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      counts.set(r.detectedAccountKey, (counts.get(r.detectedAccountKey) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([key, count]) => ({
      groupKey: key,
      count,
      mapping: accountMappings[key],
    }));
  }, [rows, accountMappings]);

  const hasMultipleDetectedAccounts = detectedGroupList.length > 1 || (detectedGroupList.length === 1 && detectedGroupList[0].groupKey !== "Cuenta principal (sin nombre detectado)");

  const importSelected = async () => {
    const chosen = (rows ?? []).filter((r) => r.selected);
    if (chosen.length === 0) {
      toast.error("No hay operaciones seleccionadas");
      return;
    }

    // Verificar que todas tengan cuenta asignada
    const withoutAccount = chosen.some((r) => !r.assignedAccountId);
    if (withoutAccount) {
      toast.error("Por favor confirma la cuenta de destino para todas las operaciones");
      return;
    }

    setImporting(true);
    try {
      await addTrades(
        chosen.map((r) => ({
          accountId: r.assignedAccountId || defaultAccountId,
          strategyId: r.assignedStrategyId || defaultStrategyId,
          symbol: r.symbol.toUpperCase() || "TRADE",
          direction: r.direction,
          openedAt: toIso(r.openedAt ?? r.closedAt),
          closedAt: toIso(r.closedAt ?? r.openedAt),
          entryPrice: r.entryPrice ?? 0,
          exitPrice: r.exitPrice ?? 0,
          size: r.size ?? 0,
          pnl: r.pnl,
          mistakes: [],
          tags: r.accountName ? [r.accountName] : [],
          notes: r.accountFirm
            ? `Importada vía Trade Vision · ${r.accountFirm}${r.accountName ? ` (${r.accountName})` : ""}`
            : "Importada vía Trade Vision",
          screenshots: images.slice(0, 1),
          source: "manual" as const,
        })),
      );

      const distinctAccounts = new Set(chosen.map((r) => r.assignedAccountId));
      toast.success(
        `${chosen.length} operaciones importadas en ${distinctAccounts.size} ${distinctAccounts.size === 1 ? "cuenta" : "cuentas distintas"}`,
      );
      setOpen(false);
      setImages([]);
      setRows(null);
      setAccountMappings({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron importar las operaciones");
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = rows ? rows.filter((r) => r.selected).length : 0;
  const selectedPnl = rows
    ? rows.filter((r) => r.selected).reduce((s, r) => s + r.pnl, 0)
    : 0;

  return (
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
                <p className="text-xs text-muted-foreground">
                  Extrae múltiples operaciones y asígnalas simultáneamente a cada cuenta
                </p>
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
                <p className="font-semibold text-foreground">Para usar funciones de IA conecta Google AI aquí</p>
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

        {/* Zona de Carga de Imágenes */}
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
            "rounded-xl border-2 border-dashed p-6 text-center text-sm transition-all relative overflow-hidden",
            dragging
              ? "border-brand bg-brand/10 text-brand scale-[1.01]"
              : "border-border/80 bg-muted/20 text-muted-foreground hover:bg-muted/30",
          )}
        >
          <ImagePlus className="mx-auto mb-2 size-8 text-brand/80" />
          <p className="font-bold text-foreground text-xs">
            Arrastra capturas, pega con Ctrl+V / Cmd+V o sube archivos (máx. 6)
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Soporta paneles de Prop Firms (Apex, Topstep, MFF, FTMO), Trade Copiers, Tradovate, NinjaTrader o tablas
          </p>

          <div className="mt-3.5 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCameraOpen(true)}
              className="gap-1.5 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Camera className="size-4" /> Hacer foto con cámara
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              className="gap-1.5 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <ImagePlus className="size-4" /> Seleccionar capturas
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

        {/* Vista previa de miniaturas */}
        {images.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{images.length} capturas listas para analizar</span>
              <button
                type="button"
                onClick={() => {
                  setImages([]);
                  setRows(null);
                  setAccountMappings({});
                }}
                className="text-[11px] text-loss hover:underline cursor-pointer"
              >
                Eliminar todas
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {images.map((src, i) => (
                <div key={i} className="group relative overflow-hidden rounded-lg border border-border bg-card">
                  <img src={src} alt={`Captura ${i + 1}`} className="h-16 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground hover:bg-loss hover:text-white transition cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>

            <Button
              onClick={analyse}
              disabled={loading}
              className="w-full gap-2 font-bold shadow-xs cursor-pointer mt-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {loading ? "Analizando y extrayendo operaciones por cuenta…" : "Analizar con IA Gemini"}
            </Button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BLOQUE DE MAPEO Y CONFIRMACIÓN DE CUENTAS / PROP FIRMS DETECTADAS        */}
        {/* ========================================================================= */}
        {rows && rows.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-border/60">
            {/* Cabecera de Confirmación */}
            <div className="rounded-xl border border-brand/40 bg-brand/[0.04] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-brand" />
                  <h4 className="text-xs font-bold font-display uppercase tracking-wider text-foreground">
                    Confirmación de Cuentas & Prop Firms Detectadas
                  </h4>
                </div>
                <span className="text-[11px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                  {detectedGroupList.length} {detectedGroupList.length === 1 ? "cuenta identificada" : "cuentas identificadas"}
                </span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Revisa cómo se relacionan los nombres de cuentas leídos en tu captura con tus cuentas reales en Vita-Trading. Todas las operaciones se guardarán al mismo tiempo en sus respectivas cuentas.
              </p>

              {/* Lista de Mapeo por Grupo */}
              <div className="space-y-2.5 pt-1">
                {detectedGroupList.map(({ groupKey, count, mapping }) => {
                  const currentAccountId = mapping?.targetAccountId || defaultAccountId;
                  const currentStrategyId = mapping?.targetStrategyId || defaultStrategyId;

                  return (
                    <div
                      key={groupKey}
                      className="rounded-lg border border-border bg-card p-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs"
                    >
                      {/* Nombre detectado en la captura */}
                      <div className="space-y-0.5 md:w-5/12">
                        <div className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-brand shrink-0" />
                          <span className="font-bold text-foreground text-xs truncate">
                            {groupKey}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground pl-3.5">
                          {count} {count === 1 ? "operación detectada" : "operaciones detectadas"}
                        </p>
                      </div>

                      {/* Flecha indicadora */}
                      <ArrowRight className="size-4 text-muted-foreground/60 hidden md:block shrink-0" />

                      {/* Selectores de Cuenta y Estrategia */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:w-6/12">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold">
                            Cuenta destino
                          </Label>
                          <Select
                            value={currentAccountId}
                            onValueChange={(val) => handleUpdateGroupAccount(groupKey, val)}
                          >
                            <SelectTrigger className="h-8 text-xs font-semibold">
                              <SelectValue placeholder="Seleccionar cuenta" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name} {a.firm ? `(${a.firm})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold">
                            Estrategia
                          </Label>
                          <Select
                            value={currentStrategyId}
                            onValueChange={(val) => handleUpdateGroupStrategy(groupKey, val)}
                          >
                            <SelectTrigger className="h-8 text-xs font-semibold">
                              <SelectValue placeholder="Estrategia" />
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
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* LISTA DETALLADA DE OPERACIONES EXTRAÍDAS                                  */}
            {/* ========================================================================= */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Label className="font-bold text-foreground text-xs uppercase tracking-wide">
                    Operaciones a Importar ({selectedCount} de {rows.length})
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = rows.every((r) => r.selected);
                      setRows((prev) => (prev ?? []).map((r) => ({ ...r, selected: !allSelected })));
                    }}
                    className="text-[11px] text-brand hover:underline font-semibold cursor-pointer"
                  >
                    {rows.every((r) => r.selected) ? "Deseleccionar todas" : "Seleccionar todas"}
                  </button>
                </div>

                <span
                  className={cn(
                    "num text-xs font-bold px-2 py-0.5 rounded",
                    selectedPnl >= 0 ? "text-profit bg-profit/10" : "text-loss bg-loss/10",
                  )}
                >
                  PnL Lote: {selectedPnl >= 0 ? "+" : ""}
                  {formatCurrency(selectedPnl, true)}
                </span>
              </div>

              <div className="divide-y divide-border/60 rounded-xl border border-border bg-card max-h-60 overflow-y-auto">
                {rows.map((r, i) => {
                  const targetAcc = accounts.find((a) => a.id === r.assignedAccountId);

                  return (
                    <div
                      key={r.key}
                      className={cn(
                        "flex items-center justify-between gap-2 p-2.5 text-xs transition-colors",
                        !r.selected && "opacity-40 bg-muted/10",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={r.selected}
                          onChange={() =>
                            setRows((prev) =>
                              (prev ?? []).map((x, j) =>
                                j === i ? { ...x, selected: !x.selected } : x,
                              ),
                            )
                          }
                          className="size-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
                        />

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground uppercase">
                              {r.symbol || "MNQ"}
                            </span>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.2 text-[10px] font-bold uppercase",
                                r.direction === "long"
                                  ? "bg-profit/15 text-profit"
                                  : "bg-loss/15 text-loss",
                              )}
                            >
                              {r.direction}
                            </span>

                            {/* Badge de Cuenta Asignada */}
                            <span className="inline-flex items-center gap-1 rounded bg-muted/70 border border-border px-1.5 py-0.5 text-[10px] font-semibold text-foreground truncate max-w-[160px]">
                              <Wallet className="size-2.5 text-brand shrink-0" />
                              {targetAcc?.name ?? "Cuenta"}
                            </span>

                            {r.duplicate && (
                              <span className="rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 px-1.5 py-0.2 text-[9px] font-bold uppercase">
                                Duplicada
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {r.detectedAt
                              ? new Date(r.detectedAt).toLocaleString("es-ES", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Fecha por defecto hoy"}
                            {r.entryPrice != null && r.exitPrice != null && (
                              <span> · Entry: {r.entryPrice} ➔ Exit: {r.exitPrice}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "num font-bold text-sm shrink-0",
                          r.pnl >= 0 ? "text-profit" : "text-loss",
                        )}
                      >
                        {r.pnl >= 0 ? "+" : ""}
                        {formatCurrency(r.pnl, true)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
          <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">
            Cancelar
          </Button>
          <Button
            onClick={importSelected}
            disabled={!rows || rows.length === 0 || importing || selectedCount === 0}
            className="font-bold gap-2 shadow-xs cursor-pointer"
          >
            {importing && <Loader2 className="size-4 animate-spin" />}
            {importing
              ? "Guardando operaciones…"
              : `Importar ${selectedCount} ${selectedCount === 1 ? "operación" : "operaciones"} a la vez`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
