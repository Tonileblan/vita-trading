import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CandlestickChart,
  LineChart,
  NotebookPen,
  Wallet,
  ListOrdered,
  Layers,
  Receipt,
  Brain,
  Users,
  MessageSquare,
  ShieldCheck,
  Webhook,
  ServerCog,
  Download,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/funciones")({
  head: () => ({
    meta: [
      { title: "Funciones — Vita-Trading Journal" },
      {
        name: "description",
        content:
          "Diarios, cuentas de fondeo y personales, operaciones, estrategias, contabilidad y mente: todas las funciones de Vita-Trading.",
      },
      { property: "og:title", content: "Funciones — Vita-Trading Journal" },
      {
        property: "og:description",
        content:
          "Una bitácora de trading completa: diarios, cuentas, operaciones, estrategias, contabilidad y gestión emocional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FuncionesPage,
});

const FEATURES = [
  {
    icon: NotebookPen,
    title: "Diarios independientes",
    text: "Crea varios diarios, cada uno con sus cuentas, estrategias y operaciones. Edita, elimina y exporta o importa todo en CSV como respaldo completo.",
  },
  {
    icon: Wallet,
    title: "Cuentas de fondeo y personales",
    text: "Fases Eval y Live, objetivo de capital y tipos de drawdown (estático, trailing y a cierre del día). Abre cualquier cuenta para ver su detalle y progreso hacia el retiro o la evaluación.",
  },
  {
    icon: ListOrdered,
    title: "Operaciones",
    text: "Alta manual, importación por webhook y extracción automática desde capturas o fotos con detección de duplicados para no registrar la misma operación dos veces.",
  },
  {
    icon: Layers,
    title: "Estrategias",
    text: "Ficha operativa de cada estrategia, horarios de las bolsas de Asia, Europa y Nueva York convertidos a tu zona horaria, y asignación de cuentas por fechas en un calendario.",
  },
  {
    icon: LineChart,
    title: "Resumen",
    text: "KPIs en tiempo real: win rate, profit factor, expectativa y curva de capital. Capital de fondeo y real separados, calendario de PnL e indicadores de evaluación y retiro.",
  },
  {
    icon: Receipt,
    title: "Conta",
    text: "Registra gastos por categoría (incluidas App y Suministros), calcula el resultado neto y visualízalo con un gráfico 3D de tarta y barras mensuales.",
  },
  {
    icon: Brain,
    title: "Mente",
    text: "Check-in diario de ánimo, energía y foco. Analítica emocional cruzada con tus resultados para detectar qué emociones te cuestan dinero, más reglas y alertas de riesgo.",
  },
  {
    icon: Users,
    title: "Usuarios y roles",
    text: "Perfil propio para cada trader con roles de administrador, supervisor y usuario. Integraciones de API y webhook y elección de modo claro u oscuro.",
  },
  {
    icon: ShieldCheck,
    title: "Supervisión y chat interno",
    text: "Acceso restringido al supervisor para ver el resumen de todos y comentar el desempeño en un chat interno con el equipo.",
  },
];

const TECH = [
  { icon: Webhook, title: "Webhook de operaciones", text: "Recibe operaciones automáticamente desde tu plataforma de trading vía un endpoint público." },
  { icon: ServerCog, title: "Servidor MCP", text: "Conecta un asistente externo para consultar diarios, cuentas, estrategias y registrar operaciones." },
  { icon: Palette, title: "Autenticación", text: "Entra con Google o por email. Cada diario y sus datos quedan protegidos por control de acceso." },
  { icon: Download, title: "Respaldo completo", text: "Exporta e importa todo (diarios, cuentas, estrategias, operaciones, retiros, gastos y mente) en CSV." },
];

function FuncionesPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <CandlestickChart className="size-5" />
            <div className="flex min-w-0 flex-col leading-none">
              <span className="font-display text-2xl leading-none tracking-wide">Vita-Trading</span>
              <span className="font-hand text-sm leading-none text-muted-foreground sm:text-base">
                by Toni
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link to="/">Volver</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/auth" search={{ next: undefined }}>Entrar</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-4 py-16">
        <p className="label-retro text-sm">Diario de operaciones</p>
        <h1 className="mt-2 text-5xl leading-[0.95] sm:text-6xl">
          Todo lo que hace
          <br />
          Vita-Trading.
        </h1>
        <p className="mt-4 max-w-lg text-muted-foreground">
          Una bitácora de trading sencilla y visual: diarios, cuentas, operaciones, estrategias,
          contabilidad y estado mental. Sin ruido, centrada en la eficiencia.
        </p>
      </section>

      <section className="mx-auto max-w-2xl px-4 pb-16">
        <p className="label-retro mb-4 text-sm">Qué puedes hacer</p>
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

      <section className="mx-auto max-w-2xl px-4 pb-16">
        <p className="label-retro mb-4 text-sm">Técnico y extra</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TECH.map((t) => (
            <div key={t.title} className="panel p-4">
              <div className="flex items-center gap-2">
                <t.icon className="size-4 shrink-0" />
                <h3 className="text-lg leading-none">{t.title}</h3>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 pb-24">
        <div className="panel flex flex-col items-start gap-4 p-6">
          <h2 className="text-3xl leading-none">¿Listo para empezar?</h2>
          <p className="text-sm text-muted-foreground">
            Crea tu cuenta gratis y empieza a registrar operaciones en minutos.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ next: undefined }}>Crear cuenta gratis</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ next: undefined }}>Ya tengo cuenta</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
