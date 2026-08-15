import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const tradeSchema = z.object({
  account_id: z.string().min(1).max(64),
  symbol: z.string().min(1).max(20),
  direction: z.enum(["long", "short"]),
  opened_at: z.string().datetime(),
  closed_at: z.string().datetime(),
  entry_price: z.number().finite(),
  exit_price: z.number().finite(),
  size: z.number().positive().max(10000),
  pnl: z.number().finite(),
  tags: z.array(z.string().max(40)).max(10).optional(),
  notes: z.string().max(4000).optional(),
});

export const Route = createFileRoute("/api/public/trades/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["TRADE_WEBHOOK_SECRET"];
        if (secret && request.headers.get("x-webhook-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "JSON inválido" }, { status: 400 });
        }

        const parsed = tradeSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Payload inválido", issues: parsed.error.flatten().fieldErrors },
            { status: 422 },
          );
        }

        const d = parsed.data;
        // Persistencia pendiente: al conectar la base de datos se insertará aquí.
        return Response.json({
          ok: true,
          received: {
            accountId: d.account_id,
            symbol: d.symbol.toUpperCase(),
            direction: d.direction,
            openedAt: d.opened_at,
            closedAt: d.closed_at,
            entryPrice: d.entry_price,
            exitPrice: d.exit_price,
            size: d.size,
            pnl: d.pnl,
            tags: d.tags ?? [],
            notes: d.notes ?? "",
            source: "webhook",
          },
        });
      },
    },
  },
});
