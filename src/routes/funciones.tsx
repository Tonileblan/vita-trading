import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
  EyeOff,
  Webhook,
  ServerCog,
  Download,
  Palette,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  TrendingUp,
  Wind,
  PlusCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/funciones")({
  head: () => ({
    meta: [
      { title: "Funciones y Ayuda — Vita-Trading" },
      {
        name: "description",
        content:
          "Guía de uso, mini-tutoriales por pestaña y todas las funciones de Vita-Trading para tu bitácora de trading.",
      },
      { property: "og:title", content: "Funciones y Ayuda — Vita-Trading" },
      {
        property: "og:description",
        content:
          "Mini-tutoriales y explicaciones paso a paso de cada sección de Vita-Trading: Resumen, Diarios, Cuentas, Operaciones, Estrategias, Conta y Mente.",
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
    text: "Check-in diario de ánimo, energía y foco. Ejercicio guiado de respiración en 3 fases para calmar el tilt, analítica emocional cruzada y alertas de riesgo.",
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
  {
    icon: EyeOff,
    title: "Modo Perfil privado",
    text: "Cada usuario puede activar un modo de perfil privado para mantener sus datos fuera de la vista de supervisión.",
  },
];

const TAB_TUTORIALS = [
  {
    id: "panel",
    tab: "Resumen",
    path: "/panel",
    icon: LineChart,
    badge: "Panel de Control Principal",
    summary: "Tu cuadro de mandos global con KPIs en tiempo real, curva de capital interactiva con trailing drawdown y calendario de rendimiento.",
    steps: [
      {
        num: "1",
        title: "Filtra por Ámbito o Cuenta",
        detail: "En la parte superior puedes alternar entre 'Total' (todo consolidado), 'Fondeo' (solo cuentas financiadas) o 'Real' (cuentas personales). También puedes seleccionar una cuenta o estrategia específica en el desplegable.",
      },
      {
        num: "2",
        title: "Interpreta la Curva de Capital y Drawdown",
        detail: "La curva azul muestra la evolución de tu balance trade a trade. En cuentas de fondeo, la línea roja discontinua representa el suelo de liquidación (Trailing Drawdown), que sube conforme ganas para proteger tu beneficio.",
        tip: "La distancia entre la curva azul y la línea roja es tu colchón de seguridad antes de romper la cuenta.",
      },
      {
        num: "3",
        title: "Analiza Rachas y Volumen de Ganadas vs Pérdidas",
        detail: "El bloque de Rachas y Capital te muestra el total ganado frente al total perdido, el ratio beneficio/pérdida ($) y tu racha activa luminosa.",
      },
      {
        num: "4",
        title: "Navega por el Calendario y Consulta Operaciones",
        detail: "Haz clic en cualquier día del calendario para aislar los trades de esa fecha. En la tabla inferior 'Operaciones', puedes consultar las más recientes o ver el historial completo.",
      },
    ],
    tips: "Usa el selector de rango temporal (7D, 30D, 90D, Mes actual, Todo) para evaluar tu evolución a corto y largo plazo.",
  },
  {
    id: "diarios",
    tab: "Diarios",
    path: "/diarios",
    icon: NotebookPen,
    badge: "Espacios de Trabajo",
    summary: "Crea y organiza bitácoras totalmente independientes para separar distintas metodologías, cuentas de evaluación o carteras personales.",
    steps: [
      {
        num: "1",
        title: "Crear un Nuevo Diario",
        detail: "Haz clic en 'Nuevo Diario' y nómbralo según su propósito (ejemplo: 'Fondeo Futuros', 'Personal Cripto', 'Forex Swing'). Cada diario almacena sus propias cuentas, estrategias y trades.",
      },
      {
        num: "2",
        title: "Activar un Diario",
        detail: "Pulsa el botón 'Seleccionar' en la tarjeta del diario que deseas trabajar. Toda la plataforma cambiará automáticamente a ese diario.",
      },
      {
        num: "3",
        title: "Exportar e Importar Respaldos (CSV)",
        detail: "Descarga una copia completa en CSV con todos tus datos con un solo clic. También puedes restaurar o migrar operaciones usando el botón de importación.",
        tip: "Haz un respaldo en CSV periódicamente para tener siempre tus datos salvaguardados en tu ordenador.",
      },
    ],
    tips: "Tener diarios separados te permite mantener limpias las métricas de tus cuentas personales respecto a las evaluaciones de fondeo.",
  },
  {
    id: "cuentas",
    tab: "Cuentas",
    path: "/cuentas",
    icon: Wallet,
    badge: "Gestión de Capital",
    summary: "Configura tus cuentas de fondeo (Apex, Topstep, FTMO, etc.) y cuentas personales, fijando límites de drawdown y registrando retiros (payouts).",
    steps: [
      {
        num: "1",
        title: "Añadir Cuenta de Fondeo o Personal",
        detail: "Haz clic en 'Nueva Cuenta'. Elige si es 'Fondeo' (evaluación o live) o 'Personal', indica el balance inicial (ej: $50,000) y la divisa.",
      },
      {
        num: "2",
        title: "Configurar Reglas de Drawdown",
        detail: "Elige el tipo de pérdida máxima: 'Estático' (fijo sobre el inicio), 'Trailing' (sube con cada nuevo máximo) o 'EOD' (sube al cierre del día). Define el límite en dólares (ej: $2,500).",
      },
      {
        num: "3",
        title: "Registrar Retiros (Payouts)",
        detail: "Cuando solicites un cobro, regístralo en la sección de retiros. La aplicación recalculará tu capital real neto sin alterar el histórico de operaciones.",
        tip: "El progreso hacia el objetivo se actualiza automáticamente indicándote cuánto te falta para superar la fase o solicitar retiro.",
      },
    ],
    tips: "Puedes hacer clic en cualquier tarjeta de cuenta para abrir su vista individual con su propia curva de capital y lista de operaciones.",
  },
  {
    id: "operaciones",
    tab: "Operaciones",
    path: "/operaciones",
    icon: ListOrdered,
    badge: "Registro de Trades",
    summary: "Registra cada compra o venta de forma manual, mediante Trade Vision con IA a partir de capturas, o conectando un webhook automático.",
    steps: [
      {
        num: "1",
        title: "Alta Rápida de Operación",
        detail: "Pulsa en 'Nueva Operación'. Selecciona cuenta, estrategia, símbolo (NQ, ES, BTC, etc.), dirección (Long o Short), precio de entrada, salida y el resultado ($ PnL).",
      },
      {
        num: "2",
        title: "Trade Vision con IA (Desde Captura o Foto)",
        detail: "Arrastra o pega una captura de pantalla de tu plataforma (NinjaTrader, TradingView, MetaTrader, etc.). La IA leerá los datos y rellenará el formulario automáticamente con detección de duplicados.",
        tip: "Asegúrate de que en la captura se vea claro el precio de entrada, salida, hora y contrato.",
      },
      {
        num: "3",
        title: "Registra tu Estado Emocional",
        detail: "Asigna la emoción con la que tomaste la operación (Calma, Ansiedad, Disciplina, Venganza, etc.) para alimentar la analítica psicológica.",
      },
    ],
    tips: "Puedes filtrar operaciones por cuenta, estrategia, dirección o buscar por notas directamente desde la cabecera de la tabla.",
  },
  {
    id: "estrategias",
    tab: "Estrategias",
    path: "/estrategias",
    icon: Layers,
    badge: "Modelos & Horarios",
    summary: "Define tus sistemas de trading (IFT, Scalping, Breakout, etc.), consulta los horarios de las bolsas mundiales en tu zona y asigna estrategias por fechas.",
    steps: [
      {
        num: "1",
        title: "Crear Estrategia Operativa",
        detail: "Añade tu estrategia indicando nombre, color identificativo, riesgo objetivo por operación (%), activo principal y descripción de sus reglas de entrada y gestión.",
      },
      {
        num: "2",
        title: "Consulta de Horarios de Bolsas Mundiales",
        detail: "En la pestaña 'Horarios', consulta en tiempo real cuándo abren y cierran las sesiones de Tokio, Londres, Nueva York, etc., convertidas automáticamente a tu hora local.",
      },
      {
        num: "3",
        title: "Asignación de Cuentas por Periodos",
        detail: "Utiliza el calendario de asignación para definir qué estrategia se utilizó en cada cuenta durante un rango específico de fechas.",
        tip: "Al asignar una estrategia por defecto a una cuenta, todas las operaciones registradas en ella la adoptarán automáticamente.",
      },
    ],
    tips: "Compara el win rate y expectativa de cada estrategia para saber qué modelo te aporta mayor ventaja estadística.",
  },
  {
    id: "conta",
    tab: "Conta",
    path: "/conta",
    icon: Receipt,
    badge: "Control de Gastos",
    summary: "Lleva el balance contable de todos los costes asociados a tu actividad: pruebas de fondeo, suscripciones, software, datos de mercado y suministros.",
    steps: [
      {
        num: "1",
        title: "Registrar un Nuevo Gasto",
        detail: "Haz clic en 'Nuevo Gasto'. Asigna el concepto, importe, fecha y categoría (Pruebas de Fondeo, Software, Datos de Mercado, Educación, App o Suministros).",
      },
      {
        num: "2",
        title: "Resultado Neto Real",
        detail: "El panel calcula tu beneficio neto exacto restando los gastos acumulados a las ganancias obtenidas en el trading.",
      },
      {
        num: "3",
        title: "Gráficos de Distribución 3D y Mensual",
        detail: "Visualiza mediante el gráfico de tarta interactivo en qué categorías se va tu capital y comprueba la barra mensual de costes.",
        tip: "Registrar tus gastos te da una visión empresarial 100% realista de tu negocio de trading.",
      },
    ],
    tips: "Guarda las facturas o recibos en las notas del gasto para tenerlo todo preparado para tu declaración fiscal.",
  },
  {
    id: "mente",
    tab: "Mente",
    path: "/mente",
    icon: Brain,
    badge: "Psicología & Anti-Tilt",
    summary: "Cuida tu rendimiento psicológico con check-ins diarios, ejercicio interactivo de respiración en 3 fases y analítica de sesgo emocional.",
    steps: [
      {
        num: "1",
        title: "Check-in Diario Pre-Sesión",
        detail: "Antes de abrir el mercado, evalúa del 1 al 10 tu nivel de ánimo, energía y enfoque mental, y anota cualquier distracción o sesgo del día.",
      },
      {
        num: "2",
        title: "Ejercicio de Respiración en 3 Fases",
        detail: "Accede a la pestaña 'Respiración 3 Fases'. Elige un patrón (Triangular 4-4-4, Calma 4-4-6 o Anti-Tilt 4-7-8) y sigue el orbe guiado con sonido relajante para reducir pulsaciones y evitar sobreoperar.",
        tip: "Haz 2 minutos de respiración si notas frustración o prisa por recuperar pérdidas.",
      },
      {
        num: "3",
        title: "Analítica Emocional Cruzada",
        detail: "Comprueba en qué estados emocionales eres más rentable y cuáles te generan 'drawdown mental' para crear reglas de bloqueo y disciplina.",
      },
    ],
    tips: "Si tu check-in mental marca un ánimo o enfoque bajo (<5), reduce el apalancamiento o plantéate no operar esa sesión.",
  },
  {
    id: "usuarios",
    tab: "Mi Perfil",
    path: "/usuarios",
    icon: Users,
    badge: "Perfil & Privacidad",
    summary: "Personaliza tu nombre, avatar, gestiona tus credenciales y activa el modo privado para proteger tus estadísticas.",
    steps: [
      {
        num: "1",
        title: "Datos del Perfil",
        detail: "Edita tu nombre público y visualiza tu rol actual dentro de la plataforma.",
      },
      {
        num: "2",
        title: "Modo Perfil Privado",
        detail: "Si activas la opción de 'Perfil Privado', tus cuentas y operaciones quedarán totalmente ocultas de la vista de supervisores y chats grupales.",
        tip: "Ideal si deseas usar la herramienta de forma 100% individual y confidencial.",
      },
      {
        num: "3",
        title: "Tema Visual y Conectores",
        detail: "Alterna entre tema claro y oscuro y consulta las credenciales de webhook y endpoints API para conectar herramientas externas.",
      },
    ],
    tips: "Tu nombre de perfil se mostrará de forma personalizada en la barra superior de navegación de la app.",
  },
];

function FuncionesPage() {
  const { user } = useAuth();
  const [activeTutorialId, setActiveTutorialId] = useState<string>("panel");

  const currentTutorial = TAB_TUTORIALS.find((t) => t.id === activeTutorialId) ?? TAB_TUTORIALS[0]!;

  return (
    <main className="min-h-screen bg-background">
      {/* Cabecera */}
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <CandlestickChart className="size-5 shrink-0" />
            <div className="flex min-w-0 flex-col leading-none">
              <span className="font-display text-2xl leading-none tracking-wide">Vita-Trading</span>
              <span className="font-hand text-sm leading-none text-muted-foreground sm:text-base">
                by Toni
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild size="sm" variant="default">
                <Link to="/panel">Ir a mi Panel</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/">Inicio</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/auth" search={{ next: undefined }}>Entrar</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-xs">
          <BookOpen className="size-3.5 text-brand" />
          <span>Manual Completo & Guías de Uso</span>
        </div>
        <h1 className="mt-3 text-4xl font-normal leading-[0.95] sm:text-6xl">
          Funciones y Guía
          <br />
          de Vita-Trading.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Una bitácora de trading diseñada para ser visual, rápida y sin fricción: diarios, cuentas,
          operaciones, estrategias, contabilidad y control emocional.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <a
            href="#ayuda"
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-xs transition hover:bg-brand/90"
          >
            <HelpCircle className="size-4" /> Ver Mini-Tutoriales por Pestaña
          </a>
          <a
            href="#caracteristicas"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-xs transition hover:bg-accent"
          >
            Ver Todas las Funciones
          </a>
        </div>
      </section>

      {/* Sección 1: Qué puedes hacer (Lista de Features) */}
      <section id="caracteristicas" className="mx-auto max-w-4xl px-4 pb-16">
        <p className="label-retro mb-4 text-sm">Resumen de Capacidades</p>
        <ul className="divide-y divide-border border-y border-border">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-4 py-4 sm:py-5">
              <f.icon className="mt-1 size-5 shrink-0 text-brand" />
              <div>
                <h2 className="text-xl leading-none">{f.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Sección 2: Técnico y Extra */}
      <section className="mx-auto max-w-4xl px-4 pb-16">
        <p className="label-retro mb-4 text-sm">Integraciones y Seguridad</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TECH.map((t) => (
            <div key={t.title} className="panel p-4">
              <div className="flex items-center gap-2">
                <t.icon className="size-4 shrink-0 text-brand" />
                <h3 className="text-lg leading-none">{t.title}</h3>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECCIÓN PRINCIPAL DE AYUDA Y MINI-TUTORIALES POR PESTAÑA */}
      <section id="ayuda" className="mx-auto max-w-4xl scroll-mt-20 px-4 pb-20">
        <div className="rounded-2xl border border-brand/30 bg-card/60 p-5 backdrop-blur-xs sm:p-8 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-brand/15 px-3 py-1 text-xs font-bold text-brand uppercase">
                <HelpCircle className="size-3.5" /> Guía de Uso & Mini-Tutoriales
              </div>
              <h2 className="mt-2 text-3xl font-normal leading-tight sm:text-4xl">
                Aprende a usar cada pestaña paso a paso
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Selecciona cualquier sección de la app para ver su funcionamiento detallado y recomendaciones de uso.
              </p>
            </div>
          </div>

          {/* Selector de pestañas */}
          <div className="mt-6 flex gap-1.5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TAB_TUTORIALS.map((tut) => {
              const active = tut.id === activeTutorialId;
              const Icon = tut.icon;
              return (
                <button
                  key={tut.id}
                  type="button"
                  onClick={() => setActiveTutorialId(tut.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-foreground text-background shadow-sm"
                      : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{tut.tab}</span>
                </button>
              );
            })}
          </div>

          {/* Tarjeta del Tutorial Activo */}
          <div className="mt-6 rounded-xl border border-border bg-card p-5 sm:p-7 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand/15 text-brand">
                  <currentTutorial.icon className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold leading-none">{currentTutorial.tab}</h3>
                    <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                      {currentTutorial.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground font-mono">{currentTutorial.path}</p>
                </div>
              </div>

              {user && (
                <Button asChild size="sm" variant="outline">
                  <Link to={currentTutorial.path}>
                    Abrir {currentTutorial.tab} <ArrowRight className="ml-1.5 size-3.5" />
                  </Link>
                </Button>
              )}
            </div>

            <p className="text-sm font-medium text-foreground sm:text-base leading-relaxed">
              {currentTutorial.summary}
            </p>

            {/* Pasos guiados */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Pasos guiados para dominar esta sección:
              </h4>

              <div className="grid gap-3 sm:grid-cols-2">
                {currentTutorial.steps.map((st) => (
                  <div
                    key={st.num}
                    className="flex flex-col justify-between rounded-lg border border-border bg-muted/20 p-4 transition hover:bg-muted/40"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground">
                          {st.num}
                        </span>
                        <h5 className="text-base font-semibold leading-tight">{st.title}</h5>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">{st.detail}</p>
                    </div>

                    {st.tip && (
                      <div className="mt-3 flex items-start gap-1.5 rounded-md border border-brand/20 bg-brand/10 p-2 text-[11px] font-medium text-foreground">
                        <Lightbulb className="size-3.5 shrink-0 text-brand mt-0.5" />
                        <span>{st.tip}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Consejo Pro */}
            {currentTutorial.tips && (
              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
                <Lightbulb className="size-4 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <span className="font-bold text-foreground">Consejo del Trader: </span>
                  {currentTutorial.tips}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="mx-auto max-w-4xl px-4 pb-20">
        <div className="panel flex flex-col items-start gap-4 p-6 sm:p-8">
          <h2 className="text-3xl leading-none sm:text-4xl">¿Listo para llevar tu trading al siguiente nivel?</h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            Comienza a registrar tus operaciones hoy mismo y transforma tu operativa con analítica objetiva.
          </p>
          <div className="flex flex-wrap gap-3">
            {user ? (
              <Button asChild size="lg">
                <Link to="/panel">Ir a mi Panel de Control</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link to="/auth" search={{ next: undefined }}>Crear cuenta gratis</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth" search={{ next: undefined }}>Iniciar sesión</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
