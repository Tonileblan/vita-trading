import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CandlestickChart, CheckCircle2, Mail, MailCheck, RefreshCw, Send, Sparkles } from "lucide-react";
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
  validateSearch: (s: Record<string, unknown>): { next?: string; verified?: boolean } => ({
    ...(typeof s['next'] === "string" ? { next: s['next'] as string } : {}),
    ...(s['verified'] === "true" || s['verified'] === true ? { verified: true } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Acceder — Vita-Trading" },
      {
        name: "description",
        content: "Inicia sesión o crea tu cuenta para gestionar tus diarios y cuentas de trading.",
      },
      { property: "og:title", content: "Acceder — Vita-Trading" },
      {
        property: "og:description",
        content: "Accede con tu correo o Google y entra a tu bitácora de trading.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

/** Traduce mensajes de error de autenticación a un español cercano y comprensible */
function getSpanishAuthError(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("user already registered") || m.includes("already exists")) {
    return "Ya existe una cuenta con este correo electrónico. ¡Prueba a iniciar sesión!";
  }
  if (m.includes("invalid login credentials") || m.includes("invalid credentials")) {
    return "El correo o la contraseña no son correctos. Por favor, revísalos.";
  }
  if (m.includes("email not confirmed")) {
    return "Tu correo aún no ha sido confirmado. Por favor, pulsa el enlace que te hemos enviado por email.";
  }
  if (m.includes("password should be at least")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (m.includes("rate limit") || m.includes("too many requests") || m.includes("over_email_send_rate_limit")) {
    return "Hemos enviado varios correos seguidos. Por favor, espera un par de minutos antes de volver a solicitarlo.";
  }
  if (m.includes("signup is disabled") || m.includes("signups not allowed")) {
    return "El registro no está disponible temporalmente. Inténtalo de nuevo más tarde.";
  }
  if (m.includes("valid email") || m.includes("invalid email")) {
    return "Por favor, introduce una dirección de correo válida (ej. tu@correo.com).";
  }
  return message || "Ha ocurrido un problema. Por favor, inténtalo de nuevo en unos momentos.";
}

function AuthPage() {
  const navigate = useNavigate();
  const { next, verified } = Route.useSearch();
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
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      if (verified) {
        toast.success("¡Correo verificado con éxito! Bienvenido a Vita-Trading 🎉");
      }
      goNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, verified]);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      toast.error(getSpanishAuthError(error.message));
      return;
    }
    toast.success("¡Bienvenido de nuevo!");
    goNext();
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanName = displayName.trim();

    if (!cleanEmail || !password || !cleanName) {
      toast.error("Por favor completa todos los campos para crear tu cuenta");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/panel`,
        data: {
          display_name: cleanName,
          full_name: cleanName,
        },
      },
    });
    setBusy(false);

    if (error) {
      toast.error(getSpanishAuthError(error.message));
      return;
    }

    // Si Supabase requiere confirmación de email (no genera sesión directa)
    if (!data.session) {
      setPendingConfirm(true);
      toast.success("¡Genial! Te hemos enviado un correo para activar tu cuenta.");
      return;
    }

    toast.success("¡Cuenta creada con éxito! Bienvenido a Vita-Trading 🎉");
    goNext();
  }

  async function handleResendEmail() {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      toast.error("Introduce tu correo para reenviar el enlace.");
      return;
    }

    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/panel`,
      },
    });
    setResending(false);

    if (error) {
      toast.error(getSpanishAuthError(error.message));
      return;
    }

    toast.success("¡Correo de verificación reenviado! Revisa tu bandeja de entrada.");
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: safeNext ? window.location.origin + safeNext : `${window.location.origin}/panel`,
    });
    if (result.error) {
      setBusy(false);
      toast.error("No se pudo iniciar sesión con Google. Inténtalo con tu email.");
      return;
    }
    if (result.redirected) return;
    goNext();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Cabecera / Logotipo */}
        <div className="mb-6 flex flex-col items-center justify-center gap-1.5 text-center">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <CandlestickChart className="size-5" />
            </div>
            <span className="font-display text-2xl font-bold tracking-wide">Vita-Trading</span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Tu bitácora y control de operaciones personalizada
          </span>
        </div>

        <div className="panel p-6 shadow-sm border border-border/70 rounded-2xl bg-card">
          {/* Pantalla de confirmación de correo pendiente */}
          {pendingConfirm ? (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-4 ring-brand/5">
                <MailCheck className="size-7 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h1 className="text-lg font-bold tracking-tight">¡Casi listo! Revisa tu correo 📩</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Te hemos enviado un enlace de confirmación a:
                </p>
                <div className="rounded-lg bg-muted/60 px-3 py-1.5 font-mono text-xs font-semibold text-foreground break-all">
                  {email}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  Solo tienes que abrir el mensaje y pulsar en <strong>"Activar mi cuenta"</strong> para empezar a registrar tus operaciones.
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-left space-y-1">
                <p className="text-[11px] font-bold text-foreground flex items-center gap-1">
                  <Sparkles className="size-3 text-brand" /> ¿No lo encuentras?
                </p>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Echa un vistazo en tu carpeta de <em>Spam</em> o <em>Promociones</em>. A veces puede tardar 1 o 2 minutos.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs h-9"
                  disabled={resending}
                  onClick={handleResendEmail}
                >
                  {resending ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" /> Reenviando…
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" /> Reenviar correo de confirmación
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground hover:text-foreground h-8"
                  onClick={() => setPendingConfirm(false)}
                >
                  ← Volver al formulario
                </Button>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 rounded-xl">
                <TabsTrigger value="signin" className="rounded-lg text-xs font-semibold">
                  Iniciar sesión
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg text-xs font-semibold">
                  Crear cuenta
                </TabsTrigger>
              </TabsList>

              {/* Formulario Iniciar Sesión */}
              <TabsContent value="signin">
                <form className="space-y-3.5 pt-3" onSubmit={handleSignIn}>
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email" className="text-xs font-semibold">
                      Correo electrónico
                    </Label>
                    <Input
                      id="si-email"
                      type="email"
                      placeholder="tu@correo.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10 text-sm rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="si-pass" className="text-xs font-semibold">
                        Contraseña
                      </Label>
                    </div>
                    <Input
                      id="si-pass"
                      type="password"
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 text-sm rounded-xl"
                    />
                  </div>
                  <Button type="submit" className="w-full h-10 rounded-xl font-bold text-sm shadow-xs" disabled={busy}>
                    {busy ? "Iniciando sesión…" : "Entrar a mi bitácora"}
                  </Button>
                </form>
              </TabsContent>

              {/* Formulario Crear Cuenta */}
              <TabsContent value="signup">
                <form className="space-y-3.5 pt-3" onSubmit={handleSignUp}>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name" className="text-xs font-semibold">
                      ¿Cómo te llamas?
                    </Label>
                    <Input
                      id="su-name"
                      placeholder="Ej. Toni"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="h-10 text-sm rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email" className="text-xs font-semibold">
                      Tu correo electrónico
                    </Label>
                    <Input
                      id="su-email"
                      type="email"
                      placeholder="tu@correo.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10 text-sm rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pass" className="text-xs font-semibold">
                      Elige una contraseña
                    </Label>
                    <Input
                      id="su-pass"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 text-sm rounded-xl"
                    />
                  </div>
                  <Button type="submit" className="w-full h-10 rounded-xl font-bold text-sm shadow-xs" disabled={busy}>
                    {busy ? "Creando cuenta…" : "Registrarme y recibir verificación"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}

          {/* Opción alternativa con Google */}
          {!pendingConfirm && (
            <>
              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border/80" />
                <span className="text-[11px] uppercase tracking-wider font-semibold">o también</span>
                <span className="h-px flex-1 bg-border/80" />
              </div>
              <Button
                variant="outline"
                className="w-full h-10 rounded-xl text-xs font-semibold border-border/80 hover:bg-muted/50 gap-2"
                disabled={busy}
                onClick={handleGoogle}
              >
                Continuar con Google
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
