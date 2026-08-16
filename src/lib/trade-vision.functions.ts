import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  images: z.array(z.string().startsWith("data:image/").max(8_000_000)).min(1).max(6),
  symbols: z.array(z.string().max(20)).max(30).optional(),
});

const extractedTrade = z.object({
  symbol: z.string().min(1).max(20),
  direction: z.enum(["long", "short"]),
  openedAt: z.string().min(4).optional().nullable(),
  closedAt: z.string().min(4).optional().nullable(),
  entryPrice: z.number().finite().optional().nullable(),
  exitPrice: z.number().finite().optional().nullable(),
  size: z.number().finite().optional().nullable(),
  pnl: z.number().finite(),
});

const responseSchema = z.object({ trades: z.array(extractedTrade).max(200) });

export type ExtractedTrade = z.infer<typeof extractedTrade>;

const PROMPT = `Eres un extractor de operaciones de trading a partir de capturas de pantalla
(plataformas tipo Tradovate, NinjaTrader, TradingView, MetaTrader, apps de prop firms o tablas).

Devuelve TODAS las operaciones cerradas visibles en las imágenes, una por fila/tarjeta.
Reglas:
- "direction": long para compras/buy/largo, short para ventas/sell/corto.
- "pnl" es el resultado NETO en dólares como número (negativo si es pérdida). Quita símbolos y separadores de miles.
- Fechas: SIEMPRE que aparezca una fecha o marca de tiempo en la imagen (columna, cabecera, tarjeta o pie), devuélvela.
  Formato ISO 8601 con hora si está disponible (ej. 2026-05-14T15:32:00). Convierte 12h (am/pm) a 24h.
  Si la fecha aparece como dd/mm o mm/dd y el año no se ve, usa el año actual.
  Si la fecha solo aparece una vez para todo el bloque, aplícala a todas las operaciones de ese bloque.
  "openedAt" y "closedAt" pueden ser iguales si solo hay una marca de tiempo.
- Si un dato no aparece, usa null. Nunca inventes valores.
- No incluyas resúmenes, totales, ni filas de balance/comisiones.
Responde SOLO con JSON válido: {"trades":[{...}]}`;

export const extractTradesFromImages = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Falta la clave de IA en el servidor");

    const hint = data.symbols?.length
      ? `Activos habituales del usuario: ${data.symbols.join(", ")}.`
      : "";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
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

    if (res.status === 429) throw new Error("Demasiadas peticiones a la IA, inténtalo en un minuto");
    if (res.status === 402) throw new Error("Se agotaron los créditos de IA del proyecto");
    if (!res.ok) throw new Error(`Error de IA (${res.status})`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch {
      throw new Error("La IA no devolvió datos legibles");
    }

    const parsed = responseSchema.safeParse(parsedJson);
    if (!parsed.success) throw new Error("No se pudieron interpretar las operaciones");
    return parsed.data.trades;
  });
