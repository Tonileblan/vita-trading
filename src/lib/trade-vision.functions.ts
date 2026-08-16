import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  images: z.array(z.string().startsWith("data:image/").max(8_000_000)).min(1).max(6),
  symbols: z.array(z.string().max(20)).max(30).optional(),
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
