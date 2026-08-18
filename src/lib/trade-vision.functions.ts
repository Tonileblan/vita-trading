import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { executeGeminiGenerateContent } from "@/lib/google-ai";

const inputSchema = z.object({
  images: z.array(z.string().startsWith("data:image/").max(8_000_000)).min(1).max(6),
  symbols: z.array(z.string().max(20)).max(30).optional(),
  provider: z.enum(["google", "groq", "openrouter", "deepseek"]).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

const extractedTrade = z.object({
  symbol: z
    .string()
    .max(20)
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : "")),
  direction: z
    .union([z.enum(["long", "short"]), z.null(), z.undefined()])
    .transform((v) => v ?? "long"),
  openedAt: z.string().min(4).optional().nullable(),
  closedAt: z.string().min(4).optional().nullable(),
  entryPrice: z.number().finite().optional().nullable(),
  exitPrice: z.number().finite().optional().nullable(),
  size: z.number().finite().optional().nullable(),
  pnl: z.number().finite(),
});

const responseSchema = z.object({ trades: z.array(extractedTrade).max(200) });

export type ExtractedTrade = z.infer<typeof extractedTrade>;

const PROMPT = `Eres un extractor de operaciones de trading a partir de capturas de pantalla o fotos
(plataformas tipo Tradovate, NinjaTrader, TradingView, MetaTrader, apps de prop firms, tablas,
extractos de payout, listados diarios o incluso notas escritas a mano).

Devuelve TODAS las operaciones o resultados cerrados visibles, uno por fila/tarjeta/línea.

MÍNIMO ACEPTABLE: si una fila solo muestra una FECHA y un IMPORTE (resultado del día u operación),
recógela igualmente con ese pnl y esa fecha, dejando el resto de campos en null. NO la descartes.
Cada importe con signo o color (verde/rojo, +/−, entre paréntesis = negativo) cuenta como una entrada.

Reglas:
- "pnl" (obligatorio) es el resultado NETO en dólares como número; negativo si es pérdida.
  Quita símbolos de moneda, separadores de miles y espacios. "(120,50)" → -120.5.
- "symbol": el activo si es visible (MNQ, NQ, ES, GC, EURUSD…). Si no aparece, null.
- "direction": long para compras/buy/largo, short para ventas/sell/corto. Si no aparece, null.
- Fechas: SIEMPRE que aparezca una fecha o marca de tiempo (columna, cabecera, tarjeta, fila o pie),
  devuélvela en ISO 8601 con hora si está disponible (ej. 2026-05-14T15:32:00). Convierte 12h (am/pm) a 24h.
  Si el año no se ve, usa el año actual. Si la fecha aparece una sola vez para un bloque,
  aplícala a todas las filas de ese bloque. "openedAt" y "closedAt" pueden coincidir.
- Nunca inventes precios, tamaños ni fechas: lo que no se lee va como null.
- No incluyas filas de resumen/total acumulado, balance, saldo, comisiones ni depósitos.
  Sí incluye resultados diarios individuales aunque solo tengan fecha e importe.
- NUNCA agrupes ni elimines filas repetidas: si dos o más filas tienen el MISMO importe
  (misma fecha o fechas distintas), devuélvelas TODAS por separado, una entrada por fila visible.
  El número de entradas del JSON debe coincidir exactamente con el número de filas/operaciones
  visibles en las imágenes.
Responde SOLO con JSON válido: {"trades":[{"symbol":null,"direction":null,"openedAt":null,"closedAt":"2026-05-14T15:32:00","entryPrice":null,"exitPrice":null,"size":null,"pnl":-120.5}]}`;

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
    const provider = data.provider || "google";
    const userApiKey = data.apiKey?.trim();
    const serverGeminiKey =
      process.env["GEMINI_API_KEY"] ||
      process.env["GOOGLE_AI_API_KEY"] ||
      process.env["GOOGLE_API_KEY"];
    const lovableKey = process.env["LOVABLE_API_KEY"];

    const hint = data.symbols?.length
      ? `Activos habituales del usuario: ${data.symbols.join(", ")}.`
      : "";

    let content = "{}";

    // 1. PROVEEDOR: GROQ CLOUD (Llama 3.2 Vision)
    if (provider === "groq" && userApiKey) {
      const groqModel = data.model || "llama-3.2-11b-vision-preview";
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${userApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            { role: "system", content: `${PROMPT}\n${hint}` },
            {
              role: "user",
              content: [
                { type: "text", text: "Extrae todas las operaciones de estas capturas en formato JSON." },
                ...data.images.map((url) => ({ type: "image_url", image_url: { url } })),
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error((err as any)?.error?.message || `Error en Groq Cloud (${res.status})`);
      }

      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      content = json.choices?.[0]?.message?.content ?? "{}";
    }
    // 2. PROVEEDOR: OPENROUTER (Modelos con visión como Llama 3.2 Vision o Qwen VL)
    else if (provider === "openrouter" && userApiKey) {
      const openRouterModel = data.model || "meta-llama/llama-3.2-11b-vision-instruct:free";
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${userApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://vita-trading.app",
          "X-Title": "Vita-Trading",
        },
        body: JSON.stringify({
          model: openRouterModel,
          messages: [
            { role: "system", content: `${PROMPT}\n${hint}` },
            {
              role: "user",
              content: [
                { type: "text", text: "Extrae todas las operaciones de estas capturas en formato JSON." },
                ...data.images.map((url) => ({ type: "image_url", image_url: { url } })),
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error((err as any)?.error?.message || `Error en OpenRouter (${res.status})`);
      }

      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      content = json.choices?.[0]?.message?.content ?? "{}";
    }
    // 3. PROVEEDOR: GOOGLE AI (Gemini Flash / Pro)
    else if (userApiKey || serverGeminiKey) {
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
              { text: `${PROMPT}\n${hint}\nExtrae todas las operaciones de estas capturas.` },
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
    // 4. FALLBACK: GATEWAY DE RESPALDO
    else if (lovableKey) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${lovableKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: `${PROMPT}\n${hint}` },
            {
              role: "user",
              content: [
                { type: "text", text: "Extrae todas las operaciones de estas capturas." },
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
        "Falta configurar tu clave de IA. Puedes configurarla gratuitamente (Google AI, Groq o OpenRouter) en tu Perfil.",
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
    return parsed.data.trades;
  });
