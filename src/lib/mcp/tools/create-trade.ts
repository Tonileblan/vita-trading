import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_trade",
  title: "Registrar operación",
  description: "Registra una operación en un diario del usuario, con PnL, precios y notas opcionales.",
  inputSchema: {
    journal_id: z.string().uuid().describe("Diario donde se registra la operación."),
    symbol: z.string().trim().min(1).describe("Activo operado, ej. NQ o MNQ."),
    direction: z.enum(["long", "short"]).describe("Dirección de la operación."),
    pnl: z.number().describe("Resultado neto en la divisa de la cuenta."),
    closed_at: z.string().describe("Fecha/hora de cierre en ISO."),
    opened_at: z.string().optional().describe("Fecha/hora de apertura en ISO."),
    entry_price: z.number().optional(),
    exit_price: z.number().optional(),
    size: z.number().optional().describe("Número de contratos o unidades."),
    account_id: z.string().uuid().optional(),
    strategy_id: z.string().uuid().optional(),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("trades")
      .insert({
        user_id: ctx.getUserId()!,
        journal_id: input.journal_id,
        account_id: input.account_id ?? null,
        strategy_id: input.strategy_id ?? null,
        symbol: input.symbol,
        direction: input.direction,
        pnl: input.pnl,
        closed_at: input.closed_at,
        opened_at: input.opened_at ?? input.closed_at,
        entry_price: input.entry_price ?? 0,
        exit_price: input.exit_price ?? 0,
        size: input.size ?? 0,
        notes: input.notes ?? null,
        source: "mcp",
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { trade: data },
    };
  },
});
