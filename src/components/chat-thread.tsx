import { Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { useChatThread, useSendMessage } from "@/lib/chat";
import { cn } from "@/lib/utils";

export function ChatThread({
  subjectUserId,
  title = "Chat interno",
  hint,
}: {
  subjectUserId: string | null;
  title?: string;
  hint?: string;
}) {
  const { user } = useAuth();
  const { data: messages = [], isLoading } = useChatThread(subjectUserId);
  const send = useSendMessage(subjectUserId);
  const [text, setText] = useState("");

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    send.mutate(body, {
      onSuccess: () => setText(""),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <section className="panel space-y-3 p-4">
      <div>
        <h2 className="text-xl leading-none">{title}</h2>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto rounded-sm border border-border p-3">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!isLoading && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no hay mensajes.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-sm px-3 py-2 text-sm",
                  mine ? "bg-foreground text-background" : "bg-accent text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={cn("mt-1 text-[10px] opacity-70")}>
                  {new Date(m.created_at).toLocaleString("es-ES")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Escribe un comentario…"
          aria-label="Mensaje"
        />
        <Button onClick={submit} disabled={send.isPending || !subjectUserId}>
          <Send className="size-4" /> Enviar
        </Button>
      </div>
    </section>
  );
}
