import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { executeGeminiGenerateContent } from "@/lib/google-ai";

const inputSchema = z.object({
  images: z.array(z.string().startsWith("data:image/").max(8_000_000)).min(1).max(6),
  symbols: z.array(z.string().max(20)).max(30).optional(),
  accountHints: z.array(z.string().max(100)).max(50).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

const extractedTrade = z.object({
  symbol: z
    .string()
    .max(20)
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim().toUpperCase() : "")),
  direction: z
    .union([z.enum(["long", "short"]), z.null(), z.undefined()])
    .transform((v) => v ?? "long"),
  openedAt: z.string().min(4).optional().nullable(),
  closedAt: z.string().min(4).optional().nullable(),
  entryPrice: z.number().finite().optional().nullable(),
  exitPrice: z.number().finite().optional().nullable(),
  size: z.number().finite().optional().nullable(),
  pnl: z.number().finite(),
  accountName: z.string().max(100).optional().nullable(),
  accountFirm: z.string().max(100).optional().nullable(),
});

const responseSchema = z.object({ trades: z.array(extractedTrade).max(200) });

export type ExtractedTrade = z.infer<typeof extractedTrade>;

const PROMPT = `Eres un extractor experto de operaciones de trading a partir de capturas de pantalla o fotos
(plataformas tipo Tradovate, NinjaTrader, TradingView, MetaTrader, apps de prop firms, tablas,
extractos de payout, listados diarios, trade copiers multicuenta o notas).

Devuelve TODAS las operaciones o resultados cerrados visibles, uno por fila/tarjeta/línea.

MÍNIMO ACEPTABLE: si una fila solo muestra una FECHA y un IMPORTE (resultado del día u operación),
recógela igualmente con ese pnl y esa fecha, dejando el resto de campos en null. NO la descartes.
Cada importe con signo o color (verde/rojo, +/−, entre paréntesis = negativo) cuenta como una entrada.

Reglas:
- REGLA CRÍTICA DE OMISIÓN DE CUENTAS SIMULADAS: OMITE y NO EXTRAIGAS NINGUNA fila u operación que pertenezca a una cuenta que contenga "SIM" o "SIMULATOR" (en mayúsculas, minúsculas o mixto) en cualquier parte de su nombre o identificador (ej: "SIM101", "Apex-SIM", "SimAccount", "DEMO-SIM", "SIM-1", "NinjaTrader Sim", etc.). Descarta por completo las cuentas SIM.
- "pnl" (obligatorio) es el resultado NETO en dólares como número; negativo si es pérdida.
  Quita símbolos de moneda, separadores de miles y espacios. "(120,50)" → -120.5.
- "symbol": el activo o ticker negociado.
  * Si ves Oro / Gold ("MGC", "GC", "GCM", "GCM6", "GCZ", "GCJ", "XAUUSD"), devuelve "MGC".
  * Si ves Micro Nasdaq ("MNQ", "MNQM6", "MNQU6"), devuelve "MNQ".
  * Si ves Nasdaq ("NQ", "NQM6", "NQU6"), devuelve "NQ".
  * Si ves S&P 500 ("ES", "MES"), devuelve "ES" o "MES".
  * Si ves Petróleo ("CL", "MCL"), devuelve "CL" o "MCL".
- "direction": long para compras/buy/largo, short para ventas/sell/corto. Si no aparece, null.
- "accountName": el nombre, código o identificador de cuenta o prop firm que aparece en la fila/operación (ej: "Apex-101", "PA-50K-1", "Topstep #2", "123456", "MFF-PA", "Tradovate LIVE", etc.). Si no aparece, null.
- "accountFirm": la empresa de fondeo o broker si es visible (ej: "Apex", "Topstep", "FundingPips", "MyFundedFutures", "NinjaTrader", etc.). Si no aparece, null.
- Fechas: SIEMPRE que aparezca una fecha o marca de tiempo (columna, cabecera, tarjeta, fila o pie),
  devuélvela en ISO 8601 con hora si está disponible y añade el offset de Bogotá (-05:00), ej. 2026-05-14T19:32:00-05:00. Convierte 12h (am/pm) a 24h.
  (Las capturas y plataformas operativas se capturan en zona horaria de Bogotá, Colombia UTC-5 / America/Bogota).
  Si el año no se ve, usa el año actual. Si la fecha aparece una sola vez para un bloque,
  aplícala a todas las filas de ese bloque. "openedAt" y "closedAt" pueden coincidir.
- Nunca inventes precios, tamaños ni fechas: lo que no se lee va como null.
- No incluyas filas de resumen/total acumulado, balance, saldo, comisiones ni depósitos.
  Sí incluye resultados diarios individuales aunque solo tengan fecha e importe.
- NUNCA agrupes ni elimines filas repetidas: si dos o más filas tienen el MISMO importe
  (misma fecha o fechas distintas), devuélvelas TODAS por separado, una entrada por fila visible.
  El número de entradas del JSON debe coincidir exactamente con el número de filas/operaciones
  visibles en las imágenes.
Responde SOLO con JSON válido: {"trades":[{"symbol":"MGC","direction":"long","openedAt":"2026-05-14T19:30:00-05:00","closedAt":"2026-05-14T19:32:00-05:00","entryPrice":2350.5,"exitPrice":2355.0,"size":1,"pnl":450.0,"accountName":"Apex-50K-1","accountFirm":"Apex"}]}`;

function parseDataUrl(dataUrl: string): { mime_type: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match && match[1] && match[2]) {
    return { mime_type: match[1], data: match[2] };
  }
  return { mime_type: "image/jpeg", data: dataUrl.replace(/^data:[^;]+;base64,/, "") };
}

export const extractTradesFromImages = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const userApiKey = data.apiKey?.trim();
    const serverGeminiKey =
      process.env["GEMINI_API_KEY"] ||
      process.env["GOOGLE_AI_API_KEY"] ||
      process.env["GOOGLE_API_KEY"];
    const lovableKey = process.env["LOVABLE_API_KEY"];

    const symbolHint = data.symbols?.length
      ? `Activos habituales del usuario: ${data.symbols.join(", ")}, MGC (Oro), MNQ (Nasdaq), NQ, ES, MES.`
      : "Activos habituales: MGC (Oro), MNQ, NQ, ES, MES.";

    const accountHint = data.accountHints?.length
      ? `Cuentas registradas del usuario en el sistema: ${data.accountHints.join(", ")}. Recuerda omitir cuentas que contengan "SIM".`
      : "";

    const hints = [symbolHint, accountHint].filter(Boolean).join("\n");

    let content = "{}";

    // 1. GOOGLE AI (GEMINI) DIRECTO
    if (userApiKey || serverGeminiKey) {
      const key = userApiKey || serverGeminiKey!;
      const geminiModel = data.model || "gemini-2.0-flash";

      const imageParts = data.images.map((img) => {
        const { mime_type, data: base64Data } = parseDataUrl(img);
        return {
          inline_data: {
            mime_type,
            data: base64Data,
          },
        };
      });

      const { text } = await executeGeminiGenerateContent(
        key,
        geminiModel,
        [
          {
            parts: [
              { text: `${PROMPT}\n${hints}\nExtrae todas las operaciones reales de estas capturas (omitiendo cuentas SIM).` },
              ...imageParts,
            ],
          },
        ],
        {
          response_mime_type: "application/json",
          temperature: 0.1,
        },
      );

      content = text;
    }
    // 2. FALLBACK: GATEWAY DE RESPALDO
    else if (lovableKey) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${lovableKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: `${PROMPT}\n${hints}` },
            {
              role: "user",
              content: [
                { type: "text", text: "Extrae todas las operaciones de estas capturas (omitiendo cuentas SIM)." },
                ...data.images.map((url) => ({ type: "image_url", image_url: { url } })),
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error((err as any)?.error?.message || `Error de IA (${res.status})`);
      }

      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      content = json.choices?.[0]?.message?.content ?? "{}";
    } else {
      throw new Error(
        "Para usar funciones de IA conecta Google AI aquí (en la pestaña de tu Perfil).",
      );
    }

    const cleaned = content
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch {
      throw new Error("La IA no devolvió un formato JSON válido");
    }

    const parsed = responseSchema.safeParse(parsedJson);
    if (!parsed.success) throw new Error("No se pudieron interpretar las operaciones de la imagen");

    // Filtrar estrictamente cualquier operación que contenga "sim" en el nombre o empresa de la cuenta
    const nonSimTrades = parsed.data.trades.filter((t) => {
      const name = (t.accountName || "").toLowerCase();
      const firm = (t.accountFirm || "").toLowerCase();
      return !name.includes("sim") && !firm.includes("sim");
    });

    return nonSimTrades;
  });
