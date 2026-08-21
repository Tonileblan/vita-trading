import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Building2,
  Calendar,
  CalendarDays,
  Camera,
  Check,
  Clock,
  Coins,
  DollarSign,
  FileSpreadsheet,
  HelpCircle,
  ImagePlus,
  Layers,
  Loader2,
  Sparkles,
  TrendingUp,
  Wand2,
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
import { extractTradesFromImages, type ExtractedTrade } from "@/lib/trade-vision.functions";
import {
  getLocalGoogleAiKey,
  getLocalGoogleAiModel,
  DEFAULT_GEMINI_MODEL,
} from "@/lib/google-ai";
import { formatCurrency } from "@/lib/metrics";
import { parseDetectedDate, type CaptureTimezoneMode, CAPTURE_TIMEZONE_CONFIGS } from "@/lib/parse-date";
import { todayKey } from "@/lib/emotions";
import { parseCsv } from "@/lib/journal-csv";
import { CsvRepairDialog } from "@/components/csv-repair-dialog";
import type { CsvRepairResult } from "@/lib/csv-repair.functions";
import type { Account, Strategy } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Normalización inteligente de símbolos y activos */
function normalizeSymbol(sym?: string | null): string {
  if (!sym) return "MNQ";
  const s = sym.toUpperCase().trim();
  if (
    s.startsWith("GCM") ||
    s === "GC" ||
    s.startsWith("MGC") ||
    s.includes("GOLD") ||
    s.includes("XAU") ||
    s.includes("ORO")
  ) {
    return "GCM";
  }
  if (s.startsWith("MNQ") || s.includes("MICRO NASDAQ")) {
    return "MNQ";
  }
  if (s.startsWith("NQ") || s.includes("E-MINI NASDAQ")) {
    return "NQ";
  }
  if (s.startsWith("MES") || s.includes("MICRO S&P")) {
    return "MES";
  }
  if (s.startsWith("ES") || s.includes("E-MINI S&P")) {
    return "ES";
  }
  if (s.startsWith("MCL") || s.includes("MICRO CRUDE")) {
    return "MCL";
  }
  if (s.startsWith("CL") || s.includes("CRUDE OIL") || s.includes("PETROLEO")) {
    return "CL";
  }
  return s;
}

/** Preselección inteligente de estrategia basada en el activo (GCM -> Oro, MNQ -> IFT/Asia/Fondeo) y horario */
function guessStrategyForTrade(
  symbol: string,
  timeIso: string | null | undefined,
  accountDefaultStrategyId: string,
  strategies: Strategy[],
): string {
  const norm = normalizeSymbol(symbol);

  // 1. Si el activo es Oro (GCM / MGC / GC) -> Preselecciona estrategia "Oro"
  if (norm === "GCM" || norm === "MGC" || norm === "GC") {
    const goldStrat = strategies.find(
      (s) =>
        s.name.toLowerCase().includes("oro") ||
        s.name.toLowerCase().includes("gold") ||
        s.mainSymbol?.toUpperCase() === "GCM" ||
        s.mainSymbol?.toUpperCase() === "MGC" ||
        s.mainSymbol?.toUpperCase() === "GC",
    );
    if (goldStrat) return goldStrat.id;
  }

  // 2. Si el activo es MNQ / NQ -> Preselecciona entre IFT, Asia, Fondeo, etc.
  if (norm === "MNQ" || norm === "NQ") {
    // Si se detectó hora, verificar si corresponde a sesión asiática nocturna
    if (timeIso) {
      try {
        const d = new Date(timeIso);
        const hour = d.getHours();
        if ((hour >= 18 || hour <= 5) && strategies.some((s) => s.name.toLowerCase().includes("asia"))) {
          const asiaStrat = strategies.find((s) => s.name.toLowerCase().includes("asia"));
          if (asiaStrat) return asiaStrat.id;
        }
      } catch {}
    }

    // Si la cuenta tiene una estrategia asignada de MNQ/NQ, usarla
    const accStrat = strategies.find((s) => s.id === accountDefaultStrategyId);
    if (accStrat && (accStrat.mainSymbol?.toUpperCase() === "MNQ" || accStrat.mainSymbol?.toUpperCase() === "NQ")) {
      return accStrat.id;
    }

    // Preferir IFT si existe
    const iftStrat = strategies.find((s) => s.name.toLowerCase().includes("ift"));
    if (iftStrat) return iftStrat.id;

    // Preferir Fondeo si existe
    const fondeoStrat = strategies.find((s) => s.name.toLowerCase().includes("fondeo"));
    if (fondeoStrat) return fondeoStrat.id;

    // Preferir Asia si existe
    const asiaStrat = strategies.find((s) => s.name.toLowerCase().includes("asia"));
    if (asiaStrat) return asiaStrat.id;

    // Cualquier estrategia con mainSymbol MNQ
    const mnqStrat = strategies.find((s) => s.mainSymbol?.toUpperCase() === "MNQ" || s.mainSymbol?.toUpperCase() === "NQ");
    if (mnqStrat) return mnqStrat.id;
  }

  // 3. Si es ES / MES
  if (norm === "ES" || norm === "MES") {
    const swingStrat = strategies.find(
      (s) => s.name.toLowerCase().includes("swing") || s.mainSymbol?.toUpperCase() === "ES" || s.mainSymbol?.toUpperCase() === "MES",
    );
    if (swingStrat) return swingStrat.id;
  }

  // 4. Coincidencia por mainSymbol de la estrategia
  const bySymbol = strategies.find((s) => s.mainSymbol?.toUpperCase() === norm);
  if (bySymbol) return bySymbol.id;

  // 5. Fallback a la estrategia por defecto de la cuenta o primera disponible
  return accountDefaultStrategyId || strategies[0]?.id || "";
}

/** Clave de deduplicación: mismo activo, dirección, día y PnL. */
function dedupeKey(t: {
  symbol: string;
  direction: string;
  closedAt?: string | null | undefined;
  pnl: number;
}) {
  const parsed = parseDetectedDate(t.closedAt);
  const day = parsed ? parsed.slice(0, 10) : "sin-fecha";
  return [normalizeSymbol(t.symbol), t.direction, day, t.pnl.toFixed(2)].join("|");
}

function getYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

function formatDisplayDate(dateKey: string): string {
  if (!dateKey) return "Sin fecha seleccionada";
  try {
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(y!, m! - 1, d!);
    if (isNaN(date.getTime())) return dateKey;
    const formatted = date.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return dateKey;
  }
}

function combineDateTimeToIso(dateStr: string, timeStr?: string): string {
  try {
    const [y, m, d] = (dateStr || todayKey()).split("-").map(Number);
    let hh = 12;
    let mm = 0;
    let ss = 0;
    if (timeStr) {
      const parts = timeStr.split(":").map(Number);
      if (!isNaN(parts[0]!)) hh = parts[0]!;
      if (!isNaN(parts[1]!)) mm = parts[1]!;
      if (parts[2] !== undefined && !isNaN(parts[2])) ss = parts[2];
    }
    const dateObj = new Date(y!, m! - 1, d!, hh, mm, ss);
    if (isNaN(dateObj.getTime())) return new Date().toISOString();
    return dateObj.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

interface Row extends ExtractedTrade {
  key: string;
  duplicate: boolean;
  selected: boolean;
  detectedAt: string | null;
  /** Fecha confirmada para la operación (YYYY-MM-DD) */
  customDate: string;
  /** Hora confirmada para la operación (HH:mm) */
  customTime: string;
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

  // Fecha confirmada global para el lote de operaciones importadas
  const [batchDate, setBatchDate] = useState<string>(() => todayKey());
  const [detectedCaptureDate, setDetectedCaptureDate] = useState<string | null>(null);

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
  const csvFileRef = useRef<HTMLInputElement>(null);

  // Estados para reparación de CSV con IA
  const [csvRepairOpen, setCsvRepairOpen] = useState(false);
  const [failedCsvText, setFailedCsvText] = useState("");
  const [failedFileName, setFailedFileName] = useState("");
  const [failedErrorDetails, setFailedErrorDetails] = useState("");

  // Zona horaria de las capturas (por defecto Bogotá UTC-5 para brokers/plataformas con ese huso)
  const [captureTimezone, setCaptureTimezone] = useState<CaptureTimezoneMode>(() => {
    if (typeof window !== "undefined") {
      return (window.localStorage.getItem("vita-trading:capture-timezone") as CaptureTimezoneMode) || "bogota";
    }
    return "bogota";
  });
  const rawExtractedTradesRef = useRef<ExtractedTrade[] | null>(null);

  const googleAiKey = typeof window !== "undefined" ? getLocalGoogleAiKey() : "";
  const googleAiModel = typeof window !== "undefined" ? getLocalGoogleAiModel() : DEFAULT_GEMINI_MODEL;

  /** Procesa un listado de operaciones extraídas (de imagen o de CSV) y genera las filas interactivas */
  const processExtractedTrades = (
    rawTrades: ExtractedTrade[],
    customSuccessMsg?: string,
    overrideTz?: CaptureTimezoneMode,
  ) => {
    rawExtractedTradesRef.current = rawTrades;
    const activeTz = overrideTz ?? captureTimezone;

    // Omitir cualquier operación que tenga "sim" en cualquier parte del nombre de cuenta o prop firm
    const isSim = (t: ExtractedTrade) => {
      const name = (t.accountName || "").toLowerCase();
      const firm = (t.accountFirm || "").toLowerCase();
      return name.includes("sim") || firm.includes("sim");
    };

    const validFound = rawTrades.filter((t) => !isSim(t));
    const omittedSimCount = rawTrades.length - validFound.length;

    if (validFound.length === 0) {
      if (omittedSimCount > 0) {
        toast.info(`Se detectaron ${omittedSimCount} operaciones de cuentas SIM que fueron omitidas automáticamente.`);
      } else {
        toast.error("No se encontraron operaciones válidas en el archivo.");
      }
      return;
    }

    // Cuenta cuántas operaciones idénticas ya existen
    const existingCounts = new Map<string, number>();
    for (const t of trades) {
      const k = dedupeKey(t);
      existingCounts.set(k, (existingCounts.get(k) ?? 0) + 1);
    }

    // Detectar fecha principal
    let detectedDay: string | null = null;
    for (const t of validFound) {
      const parsed = parseDetectedDate(t.closedAt ?? t.openedAt, activeTz);
      if (parsed && parsed.includes("T")) {
        const day = parsed.split("T")[0];
        if (day && day.length === 10) {
          detectedDay = day;
          break;
        }
      }
    }

    const initialDate = detectedDay || todayKey();
    setBatchDate(initialDate);
    setDetectedCaptureDate(detectedDay);

    // Detectar grupos de cuentas presentes
    const newMappings: Record<string, { targetAccountId: string; targetStrategyId: string }> = {};
    const detectedGroups = new Set<string>();

    validFound.forEach((t) => {
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

    validFound.forEach((t, i) => {
      const normalized = normalizeSymbol(t.symbol);
      const key = dedupeKey({ ...t, symbol: normalized });
      const used = usedCounts.get(key) ?? 0;
      usedCounts.set(key, used + 1);
      const duplicate = used < (existingCounts.get(key) ?? 0);
      const detectedAt = parseDetectedDate(t.closedAt ?? t.openedAt, activeTz);

      let rowDate = initialDate;
      let rowTime = "15:30";

      if (detectedAt && detectedAt.includes("T")) {
        const parts = detectedAt.split("T");
        if (parts[0] && parts[0].length === 10) {
          rowDate = parts[0];
        }
        if (parts[1]) {
          rowTime = parts[1].slice(0, 5);
        }
      }

      const accTag = t.accountName
        ? t.accountFirm
          ? `${t.accountName} (${t.accountFirm})`
          : t.accountName
        : t.accountFirm || "";
      const groupKey = accTag.trim() || "Cuenta principal (sin nombre detectado)";
      const mapping = newMappings[groupKey];
      const assignedAccId = mapping?.targetAccountId || defaultAccountId;

      const assignedStratId = guessStrategyForTrade(
        normalized,
        detectedAt,
        mapping?.targetStrategyId || defaultStrategyId,
        strategies,
      );

      parsedRows.push({
        ...t,
        symbol: normalized,
        key: `${key}#${i}`,
        duplicate,
        selected: !duplicate,
        detectedAt,
        customDate: rowDate,
        customTime: rowTime,
        detectedAccountKey: groupKey,
        assignedAccountId: assignedAccId,
        assignedStrategyId: assignedStratId,
      });
    });

    setRows(parsedRows);

    if (customSuccessMsg) {
      toast.success(customSuccessMsg);
    } else {
      const uniqueAccountsDetected = detectedGroups.size;
      const simNote = omittedSimCount > 0 ? ` · ${omittedSimCount} ops SIM omitidas` : "";
      const dateNote = detectedDay ? ` · Fecha: ${formatDisplayDate(detectedDay)}` : "";
      toast.success(
        `${parsedRows.length} operaciones detectadas · ${uniqueAccountsDetected} ${uniqueAccountsDetected === 1 ? "cuenta" : "cuentas distintas"}${dateNote}${simNote}`,
      );
    }
  };

  /** Parsea un número de forma tolerante a formatos de brokers */
  const parseNum = (v: string | undefined): number => {
    if (!v) return 0;
    const s = v.trim().replace(/\s/g, "").replace(/[€$]/g, "");
    const normalized =
      s.includes(",") && !s.includes(".") ? s.replace(",", ".") : s.replace(/,(?=\d{3}\b)/g, "");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  /** Procesa un archivo CSV de operaciones o abre el reparador con IA si falla */
  const handleCsvFile = async (file: File) => {
    let rawText = "";
    try {
      rawText = await file.text();
      const rawRows = parseCsv(rawText);
      if (rawRows.length < 2) throw new Error("El archivo CSV no contiene datos suficientes.");

      const header = rawRows[0]!.map((h) => h.trim().toLowerCase());
      const pnlIdx = header.findIndex(
        (h) =>
          h.includes("pnl") ||
          h.includes("profit") ||
          h.includes("resultado") ||
          h.includes("ganancia") ||
          h.includes("net") ||
          h.includes("benefit"),
      );

      if (pnlIdx === -1) {
        throw new Error(
          "No se detectó columna de PnL o resultado monetario. El archivo necesita ser estructurado con IA.",
        );
      }

      const symIdx = header.findIndex(
        (h) =>
          h.includes("simbolo") ||
          h.includes("symbol") ||
          h.includes("activo") ||
          h.includes("instrument") ||
          h.includes("contract") ||
          h.includes("item"),
      );
      const dateIdx = header.findIndex(
        (h) =>
          h.includes("fecha") ||
          h.includes("date") ||
          h.includes("time") ||
          h.includes("cierre") ||
          h.includes("exit"),
      );
      const dirIdx = header.findIndex(
        (h) =>
          h.includes("direccion") ||
          h.includes("dir") ||
          h.includes("side") ||
          h.includes("type") ||
          h.includes("tipo"),
      );
      const entryIdx = header.findIndex(
        (h) =>
          h.includes("entrada") ||
          h.includes("entry") ||
          h.includes("open price") ||
          h.includes("buy price"),
      );
      const exitIdx = header.findIndex(
        (h) =>
          h.includes("salida") ||
          h.includes("exit") ||
          h.includes("close price") ||
          h.includes("sell price"),
      );
      const sizeIdx = header.findIndex(
        (h) =>
          h.includes("tamano") ||
          h.includes("size") ||
          h.includes("qty") ||
          h.includes("contracts") ||
          h.includes("contratos"),
      );
      const accIdx = header.findIndex(
        (h) => h.includes("cuenta") || h.includes("account") || h.includes("account name"),
      );

      const parsedTrades: ExtractedTrade[] = [];

      for (let i = 1; i < rawRows.length; i++) {
        const r = rawRows[i]!;
        if (!r.some((c) => c.trim())) continue;
        const pnlVal = parseNum(r[pnlIdx]);
        const symVal = symIdx >= 0 ? r[symIdx]?.trim() || "MNQ" : "MNQ";
        const dateVal = dateIdx >= 0 ? r[dateIdx]?.trim() : undefined;
        const dirRaw = dirIdx >= 0 ? (r[dirIdx] || "").toLowerCase() : "";
        const dirVal: "long" | "short" =
          dirRaw.includes("short") || dirRaw.includes("sell") || dirRaw.includes("venta")
            ? "short"
            : "long";
        const entryVal = entryIdx >= 0 ? parseNum(r[entryIdx]) : null;
        const exitVal = exitIdx >= 0 ? parseNum(r[exitIdx]) : null;
        const sizeVal = sizeIdx >= 0 ? parseNum(r[sizeIdx]) || 1 : 1;
        const accVal = accIdx >= 0 ? r[accIdx]?.trim() : null;

        parsedTrades.push({
          symbol: symVal,
          direction: dirVal,
          closedAt: dateVal,
          openedAt: dateVal,
          entryPrice: entryVal,
          exitPrice: exitVal,
          size: sizeVal,
          pnl: pnlVal,
          accountName: accVal,
          accountFirm: null,
        });
      }

      if (parsedTrades.length === 0) {
        throw new Error("No se encontraron operaciones válidas en el CSV.");
      }

      processExtractedTrades(
        parsedTrades,
        `Se cargaron ${parsedTrades.length} operaciones desde ${file.name}`,
      );
    } catch (err: any) {
      const errMsg = err.message || "Error al procesar el archivo CSV";
      setFailedCsvText(rawText);
      setFailedFileName(file.name);
      setFailedErrorDetails(errMsg);
      setCsvRepairOpen(true);

      toast.error(errMsg, {
        action: {
          label: "✨ Arreglar con IA",
          onClick: () => setCsvRepairOpen(true),
        },
        duration: 9000,
      });
    }
  };

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files) return;
    const fileArray = Array.from(files);

    // Si contiene un archivo CSV / texto
    const csvFile = fileArray.find(
      (f) =>
        f.name.endsWith(".csv") ||
        f.name.endsWith(".txt") ||
        f.type === "text/csv" ||
        f.type === "text/plain",
    );
    if (csvFile) {
      void handleCsvFile(csvFile);
      return;
    }

    const imageList = fileArray
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 6);

    for (const f of imageList) {
      const compressed = await compressImageFile(f);
      if (compressed) {
        setImages((prev) => [...prev, compressed].slice(0, 6));
      }
    }
  };

  const analyse = async () => {
    if (images.length === 0) {
      toast.error("Añade al menos una captura o sube un archivo CSV");
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
          symbols: ["GCM", "MNQ", "NQ", "ES", "MES", "MGC", "GC", ...strategies.map((s) => s.mainSymbol)],
          accountHints: accounts.map((a) => `${a.name}${a.firm ? ` [${a.firm}]` : ""}`),
          apiKey: googleAiKey || undefined,
          model: googleAiModel,
        },
      });

      processExtractedTrades(found);
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

  // Actualizar fecha de lote global para todas las filas
  const handleUpdateBatchDate = (newDate: string) => {
    if (!newDate) return;
    setBatchDate(newDate);
    setRows((prev) =>
      (prev ?? []).map((r) => ({
        ...r,
        customDate: newDate,
      })),
    );
    toast.info(`Fecha de operaciones actualizada a: ${formatDisplayDate(newDate)}`);
  };

  // Cambiar zona horaria de origen de las capturas
  const handleCaptureTimezoneChange = (tz: CaptureTimezoneMode) => {
    setCaptureTimezone(tz);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("vita-trading:capture-timezone", tz);
    }
    if (rawExtractedTradesRef.current && rawExtractedTradesRef.current.length > 0) {
      processExtractedTrades(rawExtractedTradesRef.current, undefined, tz);
      const conf = CAPTURE_TIMEZONE_CONFIGS.find((c) => c.id === tz);
      toast.info(`Zona horaria de capturas ajustada a: ${conf?.label || tz}`);
    }
  };

  // Actualizar fecha de una fila individual
  const handleUpdateRowDate = (rowIndex: number, newDate: string) => {
    if (!newDate) return;
    setRows((prev) =>
      (prev ?? []).map((r, i) =>
        i === rowIndex
          ? {
              ...r,
              customDate: newDate,
            }
          : r,
      ),
    );
  };

  // Actualizar hora de una fila individual
  const handleUpdateRowTime = (rowIndex: number, newTime: string) => {
    setRows((prev) =>
      (prev ?? []).map((r, i) =>
        i === rowIndex
          ? {
              ...r,
              customTime: newTime,
            }
          : r,
      ),
    );
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
              assignedStrategyId: guessStrategyForTrade(
                r.symbol,
                r.detectedAt,
                newStratId,
                strategies,
              ),
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

  // Actualizar estrategia de una fila individual
  const handleUpdateRowStrategy = (rowIndex: number, newStrategyId: string) => {
    setRows((prev) =>
      (prev ?? []).map((r, i) =>
        i === rowIndex
          ? {
              ...r,
              assignedStrategyId: newStrategyId,
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
        chosen.map((r) => {
          const finalIso = combineDateTimeToIso(r.customDate || batchDate || todayKey(), r.customTime);
          return {
            accountId: r.assignedAccountId || defaultAccountId,
            strategyId: r.assignedStrategyId || defaultStrategyId,
            symbol: normalizeSymbol(r.symbol) || "MNQ",
            direction: r.direction,
            openedAt: finalIso,
            closedAt: finalIso,
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
          };
        }),
      );

      const distinctAccounts = new Set(chosen.map((r) => r.assignedAccountId));
      toast.success(
        `${chosen.length} operaciones importadas con fecha ${formatDisplayDate(batchDate)} en ${distinctAccounts.size} ${distinctAccounts.size === 1 ? "cuenta" : "cuentas distintas"}`,
      );
      setOpen(false);
      setImages([]);
      setRows(null);
      setAccountMappings({});
      setBatchDate(todayKey());
      setDetectedCaptureDate(null);
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
                  Confirmación de fecha, asignación de cuentas y preselección automática de estrategias
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

        {/* Zona de Carga de Imágenes y CSV */}
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
          <div className="flex items-center justify-center gap-2 mx-auto mb-2 text-brand/80">
            <ImagePlus className="size-7" />
            <FileSpreadsheet className="size-7 text-emerald-500" />
          </div>
          <p className="font-bold text-foreground text-xs">
            Arrastra capturas, archivos CSV de broker o pega con Ctrl+V / Cmd+V
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Compatible con fotos de TradingView, NinjaTrader, Tradovate, MetaTrader 4/5 y CSVs exportados
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
              <ImagePlus className="size-4 text-brand" /> Seleccionar capturas
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => csvFileRef.current?.click()}
              className="gap-1.5 text-xs font-semibold shadow-xs cursor-pointer border-emerald-500/30 hover:bg-emerald-500/10"
            >
              <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" /> Subir archivo CSV
            </Button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*,.csv,text/csv,text/plain"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
          <input
            ref={csvFileRef}
            type="file"
            accept=".csv,text/csv,text/plain,.txt"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void handleCsvFile(f);
            }}
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
                  setBatchDate(todayKey());
                  setDetectedCaptureDate(null);
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
              {loading ? "Analizando y preseleccionando estrategias, cuentas y fechas…" : "Analizar con IA Gemini"}
            </Button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BLOQUE DE MAPEO Y CONFIRMACIÓN DE FECHAS & CUENTAS / PROP FIRMS          */}
        {/* ========================================================================= */}
        {rows && rows.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-border/60">

            {/* ===================================================================== */}
            {/* 1. CONFIRMACIÓN DE FECHA DE OPERACIONES                              */}
            {/* ===================================================================== */}
            <div className="rounded-xl border border-brand/40 bg-brand/[0.04] p-4 space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <CalendarDays className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold font-display uppercase tracking-wider text-foreground">
                      Confirmación de Fecha de Operaciones
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Verifica y confirma la fecha en que se ejecutaron las operaciones de la captura
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand bg-brand/10 border border-brand/20 px-2.5 py-0.5 rounded-full">
                  <Check className="size-3" /> Fecha confirmada: {batchDate}
                </span>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card border border-border rounded-lg p-3 shadow-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Fecha asignada al lote ({rows.length} {rows.length === 1 ? "operación" : "operaciones"})
                  </span>
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-brand" />
                    {formatDisplayDate(batchDate)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-[11px] font-semibold text-muted-foreground shrink-0">Cambiar fecha:</Label>
                    <Input
                      type="date"
                      value={batchDate}
                      onChange={(e) => {
                        if (e.target.value) handleUpdateBatchDate(e.target.value);
                      }}
                      className="h-8 w-36 text-xs font-semibold bg-background"
                    />
                  </div>

                  {/* Botones rápidos de acceso a fechas habituales */}
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant={batchDate === todayKey() ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleUpdateBatchDate(todayKey())}
                      className="h-8 text-xs font-semibold px-2.5 cursor-pointer"
                    >
                      Hoy
                    </Button>
                    <Button
                      type="button"
                      variant={batchDate === getYesterdayKey() ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleUpdateBatchDate(getYesterdayKey())}
                      className="h-8 text-xs font-semibold px-2.5 cursor-pointer"
                    >
                      Ayer
                    </Button>
                    {detectedCaptureDate && detectedCaptureDate !== todayKey() && detectedCaptureDate !== getYesterdayKey() && (
                      <Button
                        type="button"
                        variant={batchDate === detectedCaptureDate ? "default" : "secondary"}
                        size="sm"
                        onClick={() => handleUpdateBatchDate(detectedCaptureDate)}
                        className="h-8 text-xs font-semibold px-2.5 cursor-pointer gap-1"
                      >
                        <Sparkles className="size-3 text-brand" /> Detectada ({detectedCaptureDate.slice(8, 10)}/{detectedCaptureDate.slice(5, 7)})
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Selector de Zona Horaria de las Capturas / Broker */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card/70 border border-border/80 rounded-lg p-3 shadow-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="size-3 text-brand" />
                    Zona horaria de las capturas / broker
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {CAPTURE_TIMEZONE_CONFIGS.find((c) => c.id === captureTimezone)?.description ||
                      "Ajusta el huso horario en el que tu broker o app muestra las horas"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={captureTimezone}
                    onValueChange={(val: CaptureTimezoneMode) => handleCaptureTimezoneChange(val)}
                  >
                    <SelectTrigger className="h-8 w-60 text-xs font-semibold bg-background border-border">
                      <SelectValue placeholder="Zona horaria" />
                    </SelectTrigger>
                    <SelectContent>
                      {CAPTURE_TIMEZONE_CONFIGS.map((tz) => (
                        <SelectItem key={tz.id} value={tz.id} className="text-xs cursor-pointer">
                          <div className="flex flex-col py-0.5 text-left">
                            <span className="font-semibold text-foreground">{tz.label}</span>
                            <span className="text-[10px] text-muted-foreground">{tz.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ===================================================================== */}
            {/* 2. CONFIRMACIÓN DE CUENTAS & PROP FIRMS DETECTADAS                    */}
            {/* ===================================================================== */}
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
                Se han relacionado automáticamente los nombres de cuentas leídos en tu captura con tus cuentas de Vita-Trading. Las operaciones se preseleccionaron con la estrategia correspondiente (ej: <strong>GCM ➔ Oro</strong>, <strong>MNQ ➔ IFT / Asia / Fondeo</strong>).
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
                            Estrategia por defecto
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
                                  {s.name} ({s.mainSymbol})
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
            {/* 3. LISTA DETALLADA DE OPERACIONES EXTRAÍDAS                               */}
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

              <div className="divide-y divide-border/60 rounded-xl border border-border bg-card max-h-80 overflow-y-auto">
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
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
                          className="size-4 rounded border-border text-brand focus:ring-brand cursor-pointer shrink-0"
                        />

                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Activo / Símbolo */}
                            <div className="inline-flex items-center gap-1">
                              <span
                                className={cn(
                                  "font-bold uppercase px-1.5 py-0.5 rounded text-[11px]",
                                  r.symbol === "GCM"
                                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                    : "bg-muted font-bold text-foreground border border-border",
                                )}
                              >
                                {r.symbol || "MNQ"}
                              </span>
                            </div>

                            {/* Dirección Long / Short */}
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
                            <span className="inline-flex items-center gap-1 rounded bg-muted/70 border border-border px-1.5 py-0.5 text-[10px] font-semibold text-foreground truncate max-w-[130px]">
                              <Wallet className="size-2.5 text-brand shrink-0" />
                              {targetAcc?.name ?? "Cuenta"}
                            </span>

                            {/* Selector de Estrategia Preseleccionada por Fila */}
                            <div className="inline-flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground font-semibold">Estrategia:</span>
                              <select
                                value={r.assignedStrategyId}
                                onChange={(e) => handleUpdateRowStrategy(i, e.target.value)}
                                className={cn(
                                  "h-6 rounded border px-1.5 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer",
                                  r.symbol === "GCM"
                                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                    : "border-border bg-background text-foreground",
                                )}
                              >
                                {strategies.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} ({s.mainSymbol})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {r.duplicate && (
                              <span className="rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 px-1.5 py-0.2 text-[9px] font-bold uppercase">
                                Duplicada
                              </span>
                            )}
                          </div>

                          {/* Fila editable de Fecha y Hora confirmadas para esta operación */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="inline-flex items-center gap-1">
                              <Calendar className="size-3 text-muted-foreground shrink-0" />
                              <input
                                type="date"
                                value={r.customDate}
                                onChange={(e) => handleUpdateRowDate(i, e.target.value)}
                                className="h-6 w-31 rounded border border-border bg-background px-1 text-[11px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
                                title="Modificar fecha para esta operación"
                              />
                            </div>

                            <div className="inline-flex items-center gap-1">
                              <Clock className="size-3 text-muted-foreground shrink-0" />
                              <input
                                type="time"
                                value={r.customTime}
                                onChange={(e) => handleUpdateRowTime(i, e.target.value)}
                                className="h-6 w-20 rounded border border-border bg-background px-1 text-[11px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
                                title="Modificar hora para esta operación"
                              />
                            </div>

                            {r.entryPrice != null && r.exitPrice != null && (
                              <span className="text-[11px] text-muted-foreground pl-0.5">
                                · Entry: {r.entryPrice} ➔ Exit: {r.exitPrice}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "num font-bold text-sm shrink-0 pl-2",
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

      {/* Reparación asistida de CSV con IA */}
      <CsvRepairDialog
        open={csvRepairOpen}
        onOpenChange={setCsvRepairOpen}
        rawCsvText={failedCsvText}
        fileName={failedFileName}
        errorDetails={failedErrorDetails}
        context="trades"
        onApplyRepaired={(result) => {
          if (result.trades && result.trades.length > 0) {
            const mapped: ExtractedTrade[] = result.trades.map((t) => ({
              symbol: t.symbol || "MNQ",
              direction: t.direction || "long",
              openedAt: t.openedAt || undefined,
              closedAt: t.closedAt || undefined,
              entryPrice: t.entryPrice ?? null,
              exitPrice: t.exitPrice ?? null,
              size: t.size ?? 1,
              pnl: t.pnl,
              accountName: t.accountName ?? null,
              accountFirm: t.accountFirm ?? null,
            }));
            processExtractedTrades(
              mapped,
              `¡${mapped.length} operaciones recuperadas con IA e incorporadas a la vista previa!`,
            );
            setCsvRepairOpen(false);
          }
        }}
      />
    </Dialog>
  );
}
