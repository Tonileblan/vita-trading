import { Copy, Webhook, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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

export function IntegrationsPanel() {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/trades/webhook`
      : "/api/public/trades/webhook";

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Webhook className="size-5 text-brand" />
          <h3 className="text-base font-semibold">Endpoint de ingesta</h3>
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
            <Zap className="mt-0.5 size-4 shrink-0 text-brand-soft" /> Cada payload válido se
            registra como operación y actualiza el balance.
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
  );
}
