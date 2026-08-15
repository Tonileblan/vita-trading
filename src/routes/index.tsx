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
        content: "Diarios independientes, cuentas de fondeo, estrategias y control de retiros.",
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
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <CandlestickChart className="size-6 text-brand" />
          <span className="font-display text-lg font-bold tracking-tight">Trading Journal</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Tu bitácora de trading, ordenada y medible
        </h1>
        <p className="mt-4 text-muted-foreground">
          Crea varios diarios, controla tus cuentas de fondeo y personales, sigue tus estrategias y
          gestiona el acceso de cada usuario.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Crear cuenta gratis</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Ya tengo cuenta</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className="panel p-5">
            <f.icon className="size-5 text-brand" />
            <h2 className="mt-3 text-base font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
