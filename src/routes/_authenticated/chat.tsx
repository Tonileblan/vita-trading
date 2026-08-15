import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ChatThread } from "@/components/chat-thread";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat interno — Bitácora de Trading" },
      {
        name: "description",
        content: "Conversación privada entre el trader y su supervisor sobre sus resultados.",
      },
      { property: "og:title", content: "Chat interno — Bitácora de Trading" },
      {
        property: "og:description",
        content: "Comentarios privados sobre tus operaciones con tu supervisor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { user } = useAuth();
  return (
    <AppShell title="Chat" subtitle="Conversación privada con tu supervisor">
      <ChatThread
        subjectUserId={user?.id ?? null}
        title="Mi hilo"
        hint="Solo lo ves tú y los supervisores."
      />
    </AppShell>
  );
}
