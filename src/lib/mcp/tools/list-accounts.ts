import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_accounts",
  title: "Listar cuentas",
  description:
    "Lista las cuentas de trading (fondeo y reales) con su balance inicial, balance actual y tipo de drawdown.",
  inputSchema: {
    journal_id: z.string().uuid().optional().describe("Filtra por diario. Omite para todas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ journal_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("accounts")
      .select(
        "id, journal_id, name, type, phase, firm, broker, currency, initial_balance, current_balance, drawdown_type, drawdown_limit, profit_target, strategy_id",
      )
      .order("created_at", { ascending: true });
    if (journal_id) query = query.eq("journal_id", journal_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { accounts: data ?? [] },
    };
  },
});
