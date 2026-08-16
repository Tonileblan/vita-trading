import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CandlestickChart } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s['next'] === "string" ? (s['next'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Acceder — Bitácora de Trading" },
      {
        name: "description",
        content: "Inicia sesión o crea tu cuenta para gestionar tus diarios de trading.",
      },
      { property: "og:title", content: "Acceder — Bitácora de Trading" },
      {
        property: "og:description",
        content: "Accede con email o Google y entra a tus diarios de trading.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  const goNext = () => {
    if (safeNext) {
      window.location.href = safeNext;
      return;
    }
    navigate({ to: "/panel", replace: true });
  };
  const { session, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState(false);

  useEffect(() => {
    if (!loading && session) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    goNext();
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: safeNext ? window.location.origin + safeNext : window.location.origin,
        data: { display_name: displayName },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      setPendingConfirm(true);
      toast.success("Revisa tu correo para confirmar la cuenta");
      return;
    }
    goNext();
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: safeNext ? window.location.origin + safeNext : window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("No se pudo iniciar sesión con Google");
      return;
    }
    if (result.redirected) return;
    goNext();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <CandlestickChart className="size-5" />
          <div className="flex flex-col items-center leading-none">
            <span className="font-display text-2xl leading-none tracking-wide">Vita-Trading</span>
            <span className="font-hand text-sm leading-none text-muted-foreground sm:text-base">
              by Toni
            </span>
          </div>
        </div>

        <div className="panel p-6">
          {pendingConfirm ? (
            <div className="space-y-3 text-center">
              <h1 className="text-lg font-semibold">Confirma tu correo</h1>
              <p className="text-sm text-muted-foreground">
                Te hemos enviado un enlace a <strong>{email}</strong>. Ábrelo para activar tu cuenta
                y volver aquí.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setPendingConfirm(false)}>
                Volver
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>
                <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form className="space-y-3 pt-4" onSubmit={handleSignIn}>
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email">Email</Label>
                    <Input
                      id="si-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="si-pass">Contraseña</Label>
                    <Input
                      id="si-pass"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form className="space-y-3 pt-4" onSubmit={handleSignUp}>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Nombre</Label>
                    <Input
                      id="su-name"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email</Label>
                    <Input
                      id="su-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pass">Contraseña</Label>
                    <Input
                      id="su-pass"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    Crear cuenta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}

          {!pendingConfirm && (
            <>
              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
              </div>
              <Button variant="outline" className="w-full" disabled={busy} onClick={handleGoogle}>
                Continuar con Google
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
