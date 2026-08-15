import { createFileRoute } from "@tanstack/react-router";
import { Copy, Webhook, Zap } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/integraciones")({
  head: () => ({
    meta: [
      { title: "Integraciones y Webhooks — TONITRADING" },
      {
        name: "description",
        content:
          "Endpoint webhook listo para recibir ejecuciones de MetaTrader, cTrader o NinjaTrader vía n8n.",
      },
      { property: "og:title", content: "Integraciones y Webhooks — TONITRADING" },
      {
        property: "og:description",
        content: "Automatiza el registro de trades en tiempo real con un simple POST JSON.",
      },
    ],
  }),
  component: IntegrationsPage,
});

const payload = `{
  "account_id": "acc-apex",
  "symbol": "NQ1!",
  "direction": "long",
  "opened_at": "2026-08-15T13:31:00Z",
  "closed_at": "2026-08-15T14:02:00Z",
  "entry_price": 18240.25,
  "exit_price": 18276.50,
  "size": 2,
  "pnl": 725.00,
  "tags": ["ICT", "FVG"],
  "notes": "Ejecución automática desde NinjaTrader 8"
}`;

function Block({ title, code }: { title: string; code: string }) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            toast.success("Copiado al portapapeles");
          }}
        >
          <Copy className="size-3.5" /> Copiar
        </Button>
      </div>
      <pre className="num overflow-x-auto p-4 text-xs leading-relaxed text-muted-foreground">
        {code}
      </pre>
    </div>
  );
}

function IntegrationsPage() {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/trades/webhook`
      : "/api/public/trades/webhook";

  return (
    <AppShell
      title="Integraciones"
      subtitle="Automatiza el registro de operaciones con n8n, MetaTrader, cTrader o NinjaTrader 8"
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Webhook className="size-5 text-brand" />
            <h2 className="text-base font-semibold">Endpoint de ingesta</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Envía un <span className="num">POST</span> con cuerpo JSON. Cabecera obligatoria{" "}
            <span className="num">x-webhook-secret</span> con tu clave (se valida en el servidor).
          </p>
          <div className="num break-all rounded-md bg-muted px-3 py-2 text-sm">POST {url}</div>
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(url);
              toast.success("URL copiada");
            }}
          >
            <Copy className="size-4" /> Copiar URL
          </Button>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <Zap className="mt-0.5 size-4 shrink-0 text-brand-soft" /> Respuesta{" "}
              <span className="num">200</span> con el trade normalizado.
            </li>
            <li className="flex gap-2">
              <Zap className="mt-0.5 size-4 shrink-0 text-brand-soft" /> Validación de esquema con
              Zod; errores devuelven <span className="num">422</span> con detalle por campo.
            </li>
            <li className="flex gap-2">
              <Zap className="mt-0.5 size-4 shrink-0 text-brand-soft" /> Al conectar la base de
              datos, cada payload se insertará en la tabla de trades y actualizará el balance.
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <Block title="Payload JSON" code={payload} />
          <Block
            title="Ejemplo cURL"
            code={`curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-secret: TU_CLAVE" \\
  -d '${payload.replace(/\n\s*/g, " ")}'`}
          />
        </div>
      </div>
    </AppShell>
  );
}
