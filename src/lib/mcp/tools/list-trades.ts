import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_trades",
  title: "Listar operaciones",
  description:
    "Lista operaciones del usuario, opcionalmente filtradas por diario, cuenta, estrategia y rango de fechas de cierre.",
  inputSchema: {
    journal_id: z.string().uuid().optional().describe("Filtra por diario."),
    account_id: z.string().uuid().optional().describe("Filtra por cuenta."),
    strategy_id: z.string().uuid().optional().describe("Filtra por estrategia."),
    from: z.string().optional().describe("Fecha de cierre mínima en ISO (ej. 2026-01-01)."),
    to: z.string().optional().describe("Fecha de cierre máxima en ISO."),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de operaciones (por defecto 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ journal_id, account_id, strategy_id, from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("trades")
      .select(
        "id, journal_id, account_id, strategy_id, symbol, direction, entry_price, exit_price, size, pnl, opened_at, closed_at, notes, tags",
      )
      .order("closed_at", { ascending: false })
      .limit(limit ?? 50);
    if (journal_id) query = query.eq("journal_id", journal_id);
    if (account_id) query = query.eq("account_id", account_id);
    if (strategy_id) query = query.eq("strategy_id", strategy_id);
    if (from) query = query.gte("closed_at", from);
    if (to) query = query.lte("closed_at", to);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const trades = data ?? [];
    const totalPnl = trades.reduce((sum, t) => sum + Number(t.pnl ?? 0), 0);
    return {
      content: [{ type: "text", text: JSON.stringify({ count: trades.length, totalPnl, trades }) }],
      structuredContent: { count: trades.length, totalPnl, trades },
    };
  },
});
