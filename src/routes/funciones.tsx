import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  CandlestickChart,
  CheckCircle2,
  Download,
  EyeOff,
  HelpCircle,
  History,
  Layers,
  Lightbulb,
  LineChart,
  ListOrdered,
  Lock,
  MessageSquare,
  NotebookPen,
  Palette,
  Receipt,
  RotateCcw,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  Webhook,
  Wind,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/funciones")({
  head: () => ({
    meta: [
      { title: "Funciones y Guía de Uso — Vita-Trading" },
      {
        name: "description",
        content:
          "Guía de uso completa, mini-tutoriales por pestaña y todas las funciones avanzadas de Vita-Trading para tu bitácora de trading.",
      },
      { property: "og:title", content: "Funciones y Guía de Uso — Vita-Trading" },
      {
        property: "og:description",
        content:
          "Manual detallado y explicaciones paso a paso de cada sección de Vita-Trading: Resumen, Operaciones, Estrategias, Cuentas, Conta, Mente, Diarios y Mi Perfil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FuncionesPage,
});

const FEATURES = [
  {
    icon: LineChart,
    title: "Resumen Inteligente y Adaptable",
    text: "KPIs en tiempo real (Win Rate, Profit Factor, Expectativa) y curva de capital con Trailing Drawdown. Al seleccionar una estrategia, todo el panel (curva, calendario y métricas) se adapta instantáneamente a ella. Incluye botón de alertas de drawdown en la cabecera.",
  },
  {
    icon: ListOrdered,
    title: "Operaciones con Selector Unificado e IA",
    text: "Filtra en un solo clic entre TODO, cuentas de fondeo, personales o cualquier estrategia. Alta manual rápida, extracción con Trade Vision mediante IA con confirmación de fecha, y pestaña de historial de importaciones para deshacer lotes.",
  },
  {
    icon: Layers,
    title: "Estrategias y Asignación por Tramos",
    text: "Fichas técnicas con reglas de entrada, activos principales y horarios de bolsas mundiales en hora local. Asignación de estrategias a cuentas mediante tramos de fechas en calendario y sincronización automática de trades.",
  },
  {
    icon: Wallet,
    title: "Cuentas de Fondeo y Personales",
    text: "Configuración de fases (Eval y Live), límites de drawdown (Trailing, Estático y EOD) y alertas visuales cuando la cuenta se acerca a su límite de pérdida (<$600). Registro de cobros y retiros (payouts).",
  },
  {
    icon: Sparkles,
    title: "Trade Vision con Google AI Studio (Gemini)",
    text: "Procesa capturas de pantalla de NinjaTrader, TradingView, MetaTrader o fotos del historial con Gemini 2.0 Flash usando tu propia API Key gratuita y detección inteligente de duplicados.",
  },
  {
    icon: ShieldCheck,
    title: "Supervisión Segura y Roles Protegidos",
    text: "Los supervisores y administradores consultan el diario de otros usuarios en modo Solo Lectura por defecto. El Administrador cuenta con un interruptor exclusivo en su perfil para habilitar la edición controlada.",
  },
  {
    icon: Brain,
    title: "Mente y Psicología Anti-Tilt",
    text: "Check-in diario de ánimo, energía y foco pre-sesión. Ejercicio interactivo de respiración en 3 fases (Triangular, Calma y Anti-Tilt) con orbe animado y sonido, y analítica cruzada de emociones.",
  },
  {
    icon: NotebookPen,
    title: "Diarios Independientes y Plantillas",
    text: "Crea espacios de trabajo separados para cada operativa, genera diarios de ejemplo para practicar, clona plantillas y haz copias de seguridad completas en CSV.",
  },
  {
    icon: Receipt,
    title: "Conta y Control de Costes",
    text: "Registra gastos categorizados (pruebas de fondeo, software, datos, suministros o app), calcula tu beneficio neto real tras costes y analízalos con gráficos 3D interactivos y barras mensuales.",
  },
];

const TECH = [
  {
    icon: Sparkles,
    title: "Trade Vision con IA (Gemini 2.0 Flash)",
    text: "Lectura óptica inteligente de capturas y fotos de operaciones con confirmación de fecha real y descarte automático de duplicados.",
  },
  {
    icon: ShieldAlert,
    title: "Protección de Datos & Modo Solo Lectura",
    text: "Restricción de edición para supervisores por defecto. Solo el Administrador puede habilitar temporalmente la edición de datos de otros usuarios.",
  },
  {
    icon: Webhook,
    title: "Webhook y Conectores de Trading",
    text: "Endpoint público seguro para recibir ejecuciones automáticas desde TradingView, NinjaTrader 8, MT4/5 o flujos automatizados de n8n.",
  },
  {
    icon: ServerCog,
    title: "Servidor MCP Integrado",
    text: "Protocolo Model Context Protocol para conectar asistentes de inteligencia artificial externos directamente a tu bitácora de trading.",
  },
  {
    icon: Download,
    title: "Respaldo Completo en CSV",
    text: "Exportación e importación integral de diarios, cuentas, estrategias, operaciones, retiros, gastos y registros psicológicos.",
  },
  {
    icon: EyeOff,
    title: "Modo de Perfil Privado",
    text: "Permite a cualquier trader ocultar totalmente sus estadísticas y operativas de la vista de supervisores y directorios públicos.",
  },
];

const TAB_TUTORIALS = [
  {
    id: "panel",
    tab: "Resumen",
    path: "/panel",
    icon: LineChart,
    badge: "Cuadro de Mandos Principal",
    summary:
      "Tu centro de control global con KPIs en tiempo real, curva de capital interactiva, calendario de PnL y adaptación completa al seleccionar cuentas o estrategias.",
    steps: [
      {
        num: "1",
        title: "Selector Desplegable Unificado",
        detail:
          "Usa el desplegable superior para elegir entre '🌐 TODO' (consolidado global), una cuenta de fondeo o personal concreta, o bien una Estrategia específica. Toda la interfaz se adaptará a tu selección.",
      },
      {
        num: "2",
        title: "Adaptación Total por Estrategia",
        detail:
          "Al seleccionar una estrategia, la curva de capital mostrará la evolución acumulada de dicha estrategia, el calendario de PnL filtrará sus días y verás una tarjeta con Win Rate, Profit Factor y cuentas asociadas.",
        tip: "Ideal para saber exactamente cuánto dinero te está generando cada modelo de trading por separado.",
      },
      {
        num: "3",
        title: "Curva de Capital y Alerta de Drawdown",
        detail:
          "La curva azul representa tu balance trade a trade y la línea roja discontinua el suelo de liquidación. Si alguna cuenta entra en zona de riesgo (<$600 para el límite) o se vulnera, un botón de alerta en la cabecera te avisará de inmediato.",
        tip: "Haz clic en el botón de alerta de la cabecera para ir directamente a la cuenta en peligro.",
      },
      {
        num: "4",
        title: "Calendario de Rendimiento y Selector de Supervisión",
        detail:
          "Haz clic en cualquier día para filtrar los trades de esa fecha. Si eres supervisor o administrador, usa el selector de diario superior para revisar el rendimiento de cualquier usuario registrado.",
      },
    ],
    tips: "Usa los botones de rango rápido (7D, 30D, 90D, Mes Actual, Todo) para evaluar tu consistencia en diferentes horizontes temporales.",
  },
  {
    id: "operaciones",
    tab: "Operaciones",
    path: "/operaciones",
    icon: ListOrdered,
    badge: "Registro de Trades",
    summary:
      "Consulta, filtra, añade e importa masivamente tus operaciones, con control de fechas, Trade Vision con IA y protección de datos para supervisores.",
    steps: [
      {
        num: "1",
        title: "Filtro Unificado y Búsqueda Rápida",
        detail:
          "Filtra fácilmente desde el selector unificado ('🌐 TODO', Cuentas de Fondeo, Personales o Estrategias) y busca activos (NQ, ES, EURUSD, BTC…) o notas desde la barra de búsqueda.",
      },
      {
        num: "2",
        title: "Trade Vision con IA y Confirmación de Fecha",
        detail:
          "Pulsa 'Importar Operaciones' y arrastra una captura de pantalla de tu plataforma. La IA extraerá los datos y te permitirá confirmar o corregir la fecha exacta de las ejecuciones antes de guardarlas.",
        tip: "Si la captura contiene operaciones de días anteriores, el sistema te avisará con una alerta visual para que verifiques la fecha real.",
      },
      {
        num: "3",
        title: "Historial de Lotes y Opción de Deshacer",
        detail:
          "En la pestaña 'Historial de Importaciones', revisa cada lote importado por captura o CSV. Si cometiste algún error, pulsa 'Deshacer lote' para eliminarlo y restaurar los balances automáticamente.",
      },
      {
        num: "4",
        title: "Modo Supervisión Seguro (Solo Lectura)",
        detail:
          "Al supervisar las operaciones de otro usuario, la vista se bloquea en modo de solo lectura para evitar modificaciones accidentales. Solo un administrador con el permiso activo podrá editar o eliminar trades.",
      },
    ],
    tips: "Al abrir una operación para editarla, la estrategia preseleccionada coincidirá con la jerarquía activa (estrategia directa > tramo de fecha > cuenta).",
  },
  {
    id: "estrategias",
    tab: "Estrategias",
    path: "/estrategias",
    icon: Layers,
    badge: "Modelos & Horarios",
    summary:
      "Gestiona tus sistemas de trading, consulta los horarios de las bolsas mundiales en tu zona y asigna estrategias a cuentas mediante tramos de fechas.",
    steps: [
      {
        num: "1",
        title: "Crear Ficha de Estrategia",
        detail:
          "Define el nombre, color identificativo, riesgo objetivo por operación (%), activo principal (ej. NQ1!) y descripción de las reglas de entrada, confirmación y salida.",
      },
      {
        num: "2",
        title: "Horarios de Sesiones Mundiales en Tiempo Real",
        detail:
          "En la pestaña 'Horarios', consulta las aperturas y cierres de las sesiones de Asia (Tokio), Europa (Londres) y América (Nueva York), convertidas a tu hora local con estado abierto/cerrado.",
      },
      {
        num: "3",
        title: "Asignación por Tramos de Fechas en Calendario",
        detail:
          "En la pestaña 'Asignar a Cuentas', selecciona una cuenta y define periodos de fechas en los que operaste una estrategia específica. Todas las operaciones de ese rango adoptarán dicha estrategia.",
        tip: "Los tramos por fecha tienen prioridad sobre la estrategia por defecto de la cuenta, permitiéndote cambiar de modelo a lo largo del tiempo sin alterar trades antiguos.",
      },
      {
        num: "4",
        title: "Métricas y Análisis de Rendimiento",
        detail:
          "Cada estrategia calcula su Win Rate, Profit Factor, PnL total acumulado y número de operaciones para que identifiques tu modelo más rentable.",
      },
    ],
    tips: "Combina el análisis de horarios con tus estrategias para evitar operar en solapes de baja liquidez o fuera de tu ventana óptima.",
  },
  {
    id: "cuentas",
    tab: "Cuentas",
    path: "/cuentas",
    icon: Wallet,
    badge: "Gestión de Capital",
    summary:
      "Administra cuentas de fondeo y personales, define reglas de pérdida máxima (drawdown), supervisa alertas de liquidación y gestiona retiros.",
    steps: [
      {
        num: "1",
        title: "Configurar Fondeo (Eval / Live) o Cuenta Personal",
        detail:
          "Añade cuentas indicando nombre, broker o empresa de fondeo, balance inicial, objetivo de profit y límite de drawdown.",
      },
      {
        num: "2",
        title: "Tipos de Drawdown y Alertas de Riesgo",
        detail:
          "Configura si el drawdown es 'Trailing' (sube con los nuevos máximos), 'Estático' o 'EOD' (al cierre del día). La barra de progreso te muestra el colchón restante y activa alertas si te quedan menos de $600.",
        tip: "El indicador de alerta te ayuda a pausar la operativa antes de romper la regla de pérdida máxima.",
      },
      {
        num: "3",
        title: "Detalle Individual de Cuenta",
        detail:
          "Haz clic en cualquier tarjeta de cuenta para abrir su página individual (`/cuenta/ID`) con su curva de capital dedicada, desglose por estrategia y listado de trades.",
      },
      {
        num: "4",
        title: "Registrar Retiros (Payouts)",
        detail:
          "Añade tus solicitudes de cobro aprobadas para que el balance real se actualice sin distorsionar el historial de operaciones ni el PnL operativo.",
      },
    ],
    tips: "Usa la tarjeta de costes de cuenta para registrar pagos de resets, activaciones o suscripciones mensuales de cada cuenta de fondeo.",
  },
  {
    id: "usuarios",
    tab: "Mi Perfil",
    path: "/usuarios",
    icon: Users,
    badge: "Perfil, IA & Permisos",
    summary:
      "Personaliza tus datos, configura tu clave de Google AI Studio, solicita supervisor o tutor, y gestiona los permisos de edición para administradores.",
    steps: [
      {
        num: "1",
        title: "Datos del Perfil y Tutor Asignado",
        detail:
          "Actualiza tu nombre y avatar. En 'Supervisión de mi Cuenta', puedes elegir voluntariamente un tutor o supervisor del directorio para que revise tu operativa.",
      },
      {
        num: "2",
        title: "Configuración de Google AI Studio (Gemini)",
        detail:
          "Introduce tu clave gratuita de Google AI Studio y selecciona el modelo (Gemini 2.0 Flash) para habilitar Trade Vision y procesar capturas de trades sin límite.",
        tip: "Puedes obtener una clave gratuita en pocos segundos desde aistudio.google.com/app/apikey.",
      },
      {
        num: "3",
        title: "Permisos de Edición en Supervisión (Solo Admin)",
        detail:
          "Los administradores disponen de un interruptor exclusivo para activar o desactivar la edición de datos de otros usuarios durante las sesiones de supervisión.",
        tip: "Por seguridad, mantén esta opción desactivada para operar en modo solo lectura y evitar alteraciones accidentales.",
      },
      {
        num: "4",
        title: "Tema, Modo Privado e Integraciones",
        detail:
          "Alterna entre modo claro u oscuro, activa el 'Perfil Privado' si no deseas compartir tus datos con supervisores, y consulta las credenciales de webhook y API.",
      },
    ],
    tips: "Si eres supervisor, puedes responder a las dudas de tus alumnos directamente desde la pestaña 'Chat' interna.",
  },
  {
    id: "mente",
    tab: "Mente",
    path: "/mente",
    icon: Brain,
    badge: "Psicología & Anti-Tilt",
    summary:
      "Controla el estado emocional, ejecuta respiraciones guiadas para calmar la mente antes o después de operar y detecta sesgos que afecten tu operativa.",
    steps: [
      {
        num: "1",
        title: "Check-in Diario Pre-Sesión",
        detail:
          "Evalúa del 1 al 10 tu estado de ánimo, energía y nivel de foco antes de que abra el mercado, anotando cualquier factor externo distractor.",
      },
      {
        num: "2",
        title: "Ejercicio de Respiración en 3 Fases",
        detail:
          "En la pestaña 'Respiración', selecciona un patrón ('Triangular 4-4-4', 'Calma 4-4-6' o 'Anti-Tilt 4-7-8') y sigue el orbe animado con sonido relajante.",
        tip: "Realiza 2 o 3 minutos de respiración guiada si sientes impulsividad por revancha tras una pérdida.",
      },
      {
        num: "3",
        title: "Analítica Emocional Cruzada",
        detail:
          "Compara tu rentabilidad ($ PnL) y tasa de acierto según la emoción registrada (Calma, Disciplina, Euforia, Miedo, Venganza) para identificar tus patrones tóxicos.",
      },
      {
        num: "4",
        title: "Historial Psicológico",
        detail:
          "Revisa la evolución de tu bienestar mental semana a semana para correlacionar la calidad de tu descanso y foco con tus resultados financieros.",
      },
    ],
    tips: "Si tu puntuación de enfoque o ánimo es inferior a 5, plantéate reducir el tamaño de posición a la mitad o no operar ese día.",
  },
  {
    id: "diarios",
    tab: "Diarios",
    path: "/diarios",
    icon: NotebookPen,
    badge: "Espacios de Trabajo",
    summary:
      "Separa distintas bitácoras independientes, crea diarios de ejemplo con datos de muestra y realiza respaldos completos en CSV.",
    steps: [
      {
        num: "1",
        title: "Múltiples Diarios Independientes",
        detail:
          "Crea diarios para diferentes cuentas o estilos (ejemplo: 'Fondeo Apex', 'Forex Swing', 'Cripto Spot'). Cada diario mantiene sus propias cuentas, estrategias y trades.",
      },
      {
        num: "2",
        title: "Diario de Ejemplo & Plantillas",
        detail:
          "Genera un diario de muestra con datos precargados para explorar todas las gráficas y funciones de la app sin alterar tus cuentas reales.",
      },
      {
        num: "3",
        title: "Exportación e Importación CSV Completa",
        detail:
          "Descarga una copia de seguridad integral en CSV con todos tus datos y restáurala en cualquier momento con un solo clic.",
        tip: "Haz una exportación periódica para tener siempre un respaldo físico de tu historial de trading.",
      },
    ],
    tips: "El diario seleccionado actualmente se muestra en la barra superior y sincroniza todas las vistas de la plataforma.",
  },
  {
    id: "conta",
    tab: "Conta",
    path: "/conta",
    icon: Receipt,
    badge: "Control Contable",
    summary:
      "Registra todos los costes de tu negocio de trading (pruebas de fondeo, suscripciones, software, datos, app y suministros) y visualiza tu beneficio neto real.",
    steps: [
      {
        num: "1",
        title: "Registro de Gastos Categorizados",
        detail:
          "Pulsa 'Nuevo Gasto' e introduce concepto, importe, fecha y categoría (Pruebas de Fondeo, Software, Datos de Mercado, Educación, App o Suministros).",
      },
      {
        num: "2",
        title: "Cálculo de Rendimiento Neto Real",
        detail:
          "El sistema resta los gastos acumulados a las ganancias brutas de tus operaciones para mostrarte el beneficio neto exacto que te queda en el bolsillo.",
      },
      {
        num: "3",
        title: "Gráficos de Distribución 3D y Evolución Mensual",
        detail:
          "Visualiza con el gráfico de tarta interactivo en qué categorías se concentra tu gasto y compara las barras mensuales de costes.",
        tip: "Añade notas o adjunta números de factura en la descripción del gasto para tu contabilidad fiscal.",
      },
    ],
    tips: "Tener control estricto de los gastos en pruebas de fondeo te ayuda a evitar gastar en resets innecesarios.",
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
                  <Link to="/auth" search={{}}>Entrar</Link>
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
                  <Link to="/auth" search={{}}>Crear cuenta gratis</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth" search={{}}>Iniciar sesión</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
