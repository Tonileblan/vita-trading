import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { executeGeminiGenerateContent } from "@/lib/google-ai";

const inputSchema = z.object({
  rawCsvText: z.string().max(800_000),
  errorDetails: z.string().optional(),
  context: z.enum(["full_journal", "trades"]).default("trades"),
  accountHints: z.array(z.string().max(100)).optional(),
  strategyHints: z.array(z.string().max(100)).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

export const repairedTradeSchema = z.object({
  symbol: z
    .string()
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim().toUpperCase() : "MNQ")),
  direction: z
    .union([z.enum(["long", "short"]), z.null(), z.undefined()])
    .transform((v) => v ?? "long"),
  openedAt: z.string().nullish(),
  closedAt: z.string().nullish(),
  entryPrice: z.number().finite().nullish(),
  exitPrice: z.number().finite().nullish(),
  size: z.number().finite().nullish(),
  pnl: z.number().finite(),
  accountName: z.string().max(100).nullish(),
  accountFirm: z.string().max(100).nullish(),
  strategyName: z.string().max(100).nullish(),
  notes: z.string().max(500).nullish(),
});

export type RepairedTrade = z.infer<typeof repairedTradeSchema>;

const outputSchema = z.object({
  summary: z.string(),
  repairedCsvText: z.string().optional(),
  trades: z.array(repairedTradeSchema).default([]),
});

export type CsvRepairResult = z.infer<typeof outputSchema>;

const REPAIR_PROMPT = `Eres un experto ingeniero de datos y auditor de bitácoras de trading.
El usuario ha intentado importar un archivo CSV (o texto tabulado / export de broker) pero ha fallado debido a:
- Delimitadores incorrectos o mixtos (comas vs punto y coma vs tabulaciones).
- Cabeceras en inglés o formatos específicos de brokers (NinjaTrader, Tradovate, MetaTrader 4/5, Interactive Brokers, Rithmic, TradingView, Topstep, Apex, etc.).
- Formatos de número con moneda ($/€), comas decimales ("1.250,50"), números negativos entre paréntesis ("(150,00)" -> -150.0).
- Formatos de fecha ambiguos (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD HH:mm:ss, timestamps en milisegundos).
- Filas corruptas o codificación de texto.

Tu misión es ANALIZAR el contenido sin procesar, identificar las columnas, reparar todas las filas válidas y devolver los datos perfectamente estructurados.

Reglas indispensables:
1. OMITE y NO EXTRAIGAS NINGUNA fila u operación perteneciente a cuentas que contengan "SIM" o "SIMULATOR" (ej: "SIM101", "Apex-SIM", "NinjaTrader Sim").
2. Para cada fila de trade / operación:
   - "pnl" (OBLIGATORIO): Resultado monetario neto en dólares/euros como número con signo (+ o -). Si una operación no tiene PnL visible pero tiene precio de entrada y salida + tamaño + dirección, calcúlalo si es posible o asígnalo.
   - "symbol": Ticker del activo (ej: "MNQ", "NQ", "GC", "MGC", "ES", "MES", "EURUSD", etc.). Si no aparece, deduce según el contexto o usa "MNQ".
   - "direction": "long" o "short" (o compra/venta).
   - "closedAt" / "openedAt": Fechas convertidas a formato ISO (YYYY-MM-DDTHH:mm:ss o YYYY-MM-DD).
   - "entryPrice", "exitPrice", "size": Números limpios.
   - "accountName": Nombre de la cuenta si está en el archivo o coincide con alguna cuenta conocida.
   - "strategyName": Nombre de la estrategia si se deduce del símbolo/horario/texto.
3. En "summary", describe brevemente en español qué problemas tenía el archivo y cómo los solucionaste (ej: "Se detectó formato de exportación de NinjaTrader con separadores de punto y coma; se mapearon 35 operaciones y se normalizaron las fechas y PnL.").

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este esquema:
{
  "summary": "Explicación de los cambios realizados...",
  "repairedCsvText": "texto csv estándar opcional...",
  "trades": [
    {
      "symbol": "MNQ",
      "direction": "long",
      "openedAt": "2026-08-15T15:35:00Z",
      "closedAt": "2026-08-15T15:42:00Z",
      "entryPrice": 19500.25,
      "exitPrice": 19520.50,
      "size": 2,
      "pnl": 81.0,
      "accountName": "Apex-Funded-1",
      "strategyName": "IFT",
      "notes": "..."
    }
  ]
}`;

export const repairCsvWithAi = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const rawKey = data.apiKey?.trim() || process.env['GOOGLE_AI_API_KEY'] || "";
    if (!rawKey) {
      throw new Error(
        "Falta la clave API de Google AI. Configúrala en Usuarios > Ajustes de IA o como variable de entorno.",
      );
    }

    const preferredModel = data.model?.trim() || "gemini-2.0-flash";

    const userPrompt = `
Contenido bruto del archivo que falló:
\`\`\`csv
${data.rawCsvText.slice(0, 500_000)}
\`\`\`

Detalle del error original: ${data.errorDetails || "Formato no reconocido o columnas no válidas"}
Contexto: ${data.context}
${data.accountHints?.length ? `Cuentas conocidas del usuario: ${data.accountHints.join(", ")}` : ""}
${data.strategyHints?.length ? `Estrategias conocidas del usuario: ${data.strategyHints.join(", ")}` : ""}
`;

    const contents = [
      {
        role: "user",
        parts: [
          { text: REPAIR_PROMPT },
          { text: userPrompt },
        ],
      },
    ];

    const generationConfig = {
      responseMimeType: "application/json",
      temperature: 0.1,
    };

    const res = await executeGeminiGenerateContent(
      rawKey,
      preferredModel,
      contents,
      generationConfig,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(res.text);
    } catch {
      const match = res.text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("La IA no devolvió un JSON válido al reparar el CSV");
      }
    }

    const validated = outputSchema.parse(parsed);

    return {
      summary: validated.summary,
      repairedCsvText: validated.repairedCsvText,
      trades: validated.trades,
      modelUsed: res.modelUsed,
    };
  });
