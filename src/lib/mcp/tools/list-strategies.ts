import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_strategies",
  title: "Listar estrategias",
  description: "Lista las estrategias definidas en los diarios del usuario, con mercado, horario y riesgo.",
  inputSchema: {
    journal_id: z.string().uuid().optional().describe("Filtra por diario. Omite para todas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ journal_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("strategies")
      .select(
        "id, journal_id, name, market, main_symbol, schedule, days, risk_pct, initial_capital, setup, management, execution",
      )
      .order("created_at", { ascending: true });
    if (journal_id) query = query.eq("journal_id", journal_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { strategies: data ?? [] },
    };
  },
});
