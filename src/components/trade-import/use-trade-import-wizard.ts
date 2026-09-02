import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useJournal } from "@/lib/journal-store";
import { extractTradesFromImages, type ExtractedTrade } from "@/lib/trade-vision.functions";
import { getLocalGoogleAiKey, getLocalGoogleAiModel, DEFAULT_GEMINI_MODEL } from "@/lib/google-ai";
import { parseDetectedDate, type CaptureTimezoneMode } from "@/lib/parse-date";
import { todayKey } from "@/lib/emotions";
import { parseCsv } from "@/lib/journal-csv";
import { normalizeSymbol } from "@/lib/symbols";
import {
  guessStrategyForTrade,
  dedupeKey,
  combineDateTimeToIso,
} from "@/lib/trade-helpers";
import type { PreviewTradeRow, AccountMapping } from "./trade-import-preview-table";

export function useTradeImportWizard(onCloseDialog?: () => void) {
  const { accounts, strategies, trades: existingTrades, addTrades } = useJournal();
  const extractTradesServer = useServerFn(extractTradesFromImages);

  const [images, setImages] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [batchDate, setBatchDate] = useState<string>(todayKey());
  const [detectedCaptureDate, setDetectedCaptureDate] = useState<string | null>(null);
  const [captureTimezone, setCaptureTimezone] = useState<CaptureTimezoneMode>("bogota");

  const [rows, setRows] = useState<PreviewTradeRow[] | null>(null);
  const [accountMappings, setAccountMappings] = useState<Record<string, AccountMapping>>({});

  // Csv repair state
  const [repairModalOpen, setRepairModalOpen] = useState(false);
  const [rawCsvForRepair, setRawCsvForRepair] = useState("");
  const [csvRepairError, setCsvRepairError] = useState("");

  const defaultAccountId = accounts[0]?.id || "";
  const defaultStrategyId = strategies[0]?.id || "";

  // Procesa trades extraídos (por OCR o CSV) hacia el estado de filas editables
  const processExtractedTrades = (
    rawTrades: ExtractedTrade[],
    detectedDay: string | null = null,
    customSuccessMsg?: string,
  ) => {
    const existingCounts = new Map<string, number>();
    existingTrades.forEach((t) => {
      const key = dedupeKey(t);
      existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
    });

    const initialDate = detectedDay || batchDate || todayKey();
    const newMappings: Record<string, AccountMapping> = { ...accountMappings };

    // Auto-detección de cuentas y grupos
    rawTrades.forEach((t) => {
      const accTag = t.accountName
        ? t.accountFirm
          ? `${t.accountName} (${t.accountFirm})`
          : t.accountName
        : t.accountFirm || "";
      const groupKey = accTag.trim() || "Cuenta principal (sin nombre detectado)";

      if (!newMappings[groupKey]) {
        const found = accounts.find(
          (a) =>
            (t.accountName && a.name.toLowerCase().includes(t.accountName.toLowerCase())) ||
            (t.accountFirm && a.firm?.toLowerCase().includes(t.accountFirm.toLowerCase())) ||
            (t.accountFirm && a.name.toLowerCase().includes(t.accountFirm.toLowerCase())),
        );
        const targetAccId = found?.id || defaultAccountId;
        const targetStratId = found?.strategyId || defaultStrategyId;
        newMappings[groupKey] = {
          targetAccountId: targetAccId,
          targetStrategyId: targetStratId,
        };
      }
    });

    setAccountMappings(newMappings);

    const parsedRows: PreviewTradeRow[] = rawTrades.map((t) => {
      const normalized = normalizeSymbol(t.symbol);
      const key = dedupeKey(t);
      const isDuplicate = (existingCounts.get(key) ?? 0) > 0;
      const detectedAt = parseDetectedDate(t.closedAt ?? t.openedAt, captureTimezone);

      let rowDate = initialDate;
      let rowTime = "15:30";

      if (detectedAt && detectedAt.includes("T")) {
        const parts = detectedAt.split("T");
        if (parts[0] && parts[0].length === 10) rowDate = parts[0];
        if (parts[1]) rowTime = parts[1].slice(0, 5);
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

      return {
        selected: !isDuplicate,
        symbol: normalized,
        direction: (t.direction === "short" ? "short" : "long") as "long" | "short",
        entryPrice: t.entryPrice ?? undefined,
        exitPrice: t.exitPrice ?? undefined,
        size: t.size ?? undefined,
        pnl: t.pnl,
        accountName: t.accountName ?? undefined,
        accountFirm: t.accountFirm ?? undefined,
        detectedAt,
        customDate: rowDate,
        customTime: rowTime,
        detectedAccountKey: groupKey,
        assignedAccountId: assignedAccId,
        assignedStrategyId: assignedStratId,
      };
    });

    setRows(parsedRows);

    if (customSuccessMsg) {
      toast.success(customSuccessMsg);
    } else {
      toast.success(`${parsedRows.length} operaciones detectadas correctamente.`);
    }
  };

  // Analizar capturas con Gemini Vision
  const handleAnalyzeImages = async () => {
    if (images.length === 0) {
      toast.error("Por favor añade al menos una captura o foto");
      return;
    }

    setAnalyzing(true);
    const googleKey = getLocalGoogleAiKey();
    const googleModel = getLocalGoogleAiModel();

    try {
      const tradesResult = await extractTradesServer({
        data: {
          images,
          apiKey: googleKey || undefined,
          model: googleModel || DEFAULT_GEMINI_MODEL,
        },
      });

      if (!tradesResult || tradesResult.length === 0) {
        toast.info("No se detectaron operaciones en las imágenes cargadas");
        return;
      }

      processExtractedTrades(tradesResult);
    } catch (err: any) {
      toast.error(err?.message || "Error al procesar capturas con Trade Vision");
    } finally {
      setAnalyzing(false);
    }
  };

  // Procesar archivo CSV
  const handleCsvFile = async (file: File) => {
    try {
      const rawText = await file.text();
      const rawRows = parseCsv(rawText);
      if (rawRows.length < 2) throw new Error("El archivo CSV no contiene suficientes datos.");

      const header = (rawRows[0] || []).map((h) => h.trim().toLowerCase());
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
        setRawCsvForRepair(rawText);
        setCsvRepairError("No se detectó columna de PnL o resultado monetario.");
        setRepairModalOpen(true);
        return;
      }

      const symIdx = header.findIndex((h) => h.includes("symbol") || h.includes("activo") || h.includes("item"));
      const dateIdx = header.findIndex((h) => h.includes("date") || h.includes("fecha") || h.includes("time"));
      const dirIdx = header.findIndex((h) => h.includes("side") || h.includes("type") || h.includes("dir"));

      const parsedTrades: ExtractedTrade[] = [];
      for (let i = 1; i < rawRows.length; i++) {
        const r = rawRows[i];
        if (!r) continue;
        const pnl = Number((r[pnlIdx] || "0").replace(/[^0-9.-]/g, "")) || 0;
        const sym = symIdx >= 0 && r[symIdx] ? r[symIdx] : "MNQ";
        const dateVal = dateIdx >= 0 && r[dateIdx] ? r[dateIdx] : todayKey();
        const dirVal = dirIdx >= 0 && (r[dirIdx]?.toLowerCase().includes("short") || r[dirIdx]?.toLowerCase().includes("sell")) ? "short" : "long";

        parsedTrades.push({
          symbol: sym,
          direction: dirVal,
          pnl,
          closedAt: dateVal,
          openedAt: dateVal,
        });
      }

      processExtractedTrades(parsedTrades, null, `${parsedTrades.length} operaciones importadas desde CSV`);
    } catch (err: any) {
      toast.error(err?.message || "Error al procesar el archivo CSV");
    }
  };

  // Guardar operaciones seleccionadas en Supabase / Store
  const handleImportSelected = async () => {
    const chosen = (rows ?? []).filter((r) => r.selected);
    if (chosen.length === 0) {
      toast.error("No hay operaciones seleccionadas para importar");
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

      toast.success(`${chosen.length} operaciones añadidas con éxito.`);
      setImages([]);
      setRows(null);
      setAccountMappings({});
      if (onCloseDialog) onCloseDialog();
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar las operaciones");
    } finally {
      setImporting(false);
    }
  };

  // Handlers para edición en la tabla
  const handleToggleSelectRow = (index: number) => {
    setRows((prev) =>
      (prev ?? []).map((r, i) => (i === index ? { ...r, selected: !r.selected } : r)),
    );
  };

  const handleToggleSelectAll = () => {
    setRows((prev) => {
      if (!prev) return null;
      const allSelected = prev.every((r) => r.selected);
      return prev.map((r) => ({ ...r, selected: !allSelected }));
    });
  };

  const handleUpdateRow = (index: number, updates: Partial<PreviewTradeRow>) => {
    setRows((prev) =>
      (prev ?? []).map((r, i) => (i === index ? { ...r, ...updates } : r)),
    );
  };

  const handleDeleteRow = (index: number) => {
    setRows((prev) => (prev ?? []).filter((_, i) => i !== index));
  };

  const handleUpdateGroupAccount = (groupKey: string, newAccountId: string) => {
    const acc = accounts.find((a) => a.id === newAccountId);
    const newStratId = acc?.strategyId || accountMappings[groupKey]?.targetStrategyId || defaultStrategyId;

    setAccountMappings((prev) => ({
      ...prev,
      [groupKey]: { targetAccountId: newAccountId, targetStrategyId: newStratId },
    }));

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
        r.detectedAccountKey === groupKey ? { ...r, assignedStrategyId: newStrategyId } : r,
      ),
    );
  };

  return {
    images,
    setImages,
    analyzing,
    importing,
    batchDate,
    setBatchDate,
    detectedCaptureDate,
    captureTimezone,
    setCaptureTimezone,
    rows,
    setRows,
    accounts,
    strategies,
    accountMappings,
    repairModalOpen,
    setRepairModalOpen,
    rawCsvForRepair,
    csvRepairError,
    handleAnalyzeImages,
    handleCsvFile,
    handleImportSelected,
    handleToggleSelectRow,
    handleToggleSelectAll,
    handleUpdateRow,
    handleDeleteRow,
    handleUpdateGroupAccount,
    handleUpdateGroupStrategy,
  };
}
