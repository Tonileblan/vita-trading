import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CandlestickChart, LineChart, NotebookPen, Users } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bitácora de Trading — Diarios, métricas y equipo" },
      {
        name: "description",
        content:
          "Registra operaciones, organiza varios diarios de trading y gestiona usuarios con métricas en tiempo real.",
      },
      { property: "og:title", content: "Bitácora de Trading — Diarios, métricas y equipo" },
      {
        property: "og:description",
        content:
          "Registra operaciones, organiza varios diarios de trading y gestiona usuarios con métricas en tiempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: NotebookPen,
    title: "Diarios independientes",
    text: "Cada bitácora agrupa sus propias cuentas, estrategias y operaciones.",
  },
  {
    icon: LineChart,
    title: "Métricas al instante",
    text: "Win rate, profit factor, expectativa y curva de capital consolidada.",
  },
  {
    icon: Users,
    title: "Usuarios y roles",
    text: "Perfil propio para cada trader y rol de administrador para el equipo.",
  },
];

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/panel", replace: true });
  }, [loading, session, navigate]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <CandlestickChart className="size-5" />
            <div className="flex min-w-0 flex-col leading-none">
              <span className="font-display text-2xl leading-none tracking-wide">Vita-Trading</span>
              <span className="font-hand text-sm leading-none text-muted-foreground sm:text-base">
                by Toni
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link to="/funciones">Funciones</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/auth" search={{}}>Entrar</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-4 py-16">
        <p className="label-retro text-sm">Diario de operaciones</p>
        <h1 className="mt-2 text-5xl leading-[0.95] sm:text-6xl">
          Apunta cada operación.
          <br />
          Mira los números claros.
        </h1>
        <p className="mt-4 max-w-lg text-muted-foreground">
          Varios diarios, cuentas de fondeo y personales, estrategias y retiros. Sin ruido.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth" search={{}}>Crear cuenta gratis</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth" search={{}}>Ya tengo cuenta</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 pb-24">
        <ul className="divide-y divide-border border-y border-border">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-4 py-5">
              <f.icon className="mt-1 size-5 shrink-0" />
              <div>
                <h2 className="text-xl leading-none">{f.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
