# Presentación de la app — página de funciones

## Objetivo

Crear una nueva página pública `/funciones` dentro de Vita-Trading que presente, de forma visual y ordenada, todas las funciones de la app. Será accesible sin iniciar sesión y sirva como escaparate del producto, manteniendo el sistema visual "papel y tinta" ya establecido (fondo hueso, tipografía Bebas Neue + Barlow, acentos retro).

## Lo que se construye

### 1. Nueva ruta pública `src/routes/funciones.tsx`

- `createFileRoute("/funciones")` con `head()` propio (title, description, og:title, og:description, og:type website, twitter:card).
- Página pública (sin `_authenticated`, sin loader con auth) para que se pueda ver sin sesión.
- Estructura de una sola columna, `max-w-2xl`, coherente con la landing actual (`src/routes/index.tsx`):
  - **Cabecera** ligera con el logo "Vita-Trading by Toni" y un botón "Entrar" hacia `/auth`.
  - **Hero**: etiqueta retro "Diario de operaciones", título grande y un párrafo resumen.
  - **Sección "Qué puedes hacer"**: lista de funciones agrupadas, cada una con icono, título y descripción corta. Las funciones se extraen del propio contenido de la app:
    - Diarios independientes (varios, CRUD, exportar/importar todo en CSV).
    - Cuentas de fondeo y personales (fases Eval/Live, objetivo de capital, tipos de drawdown estático/trailing/EOD, vista detallada por cuenta).
    - Operaciones (alta manual, importación por webhook, extracción automática desde capturas con detección de duplicados).
    - Estrategias (ficha operativa, horarios de bolsa por zona horaria, asignación de cuentas por fechas en calendario).
    - Resumen (KPIs, win rate, profit factor, curva de capital, capital fondeo vs real, calendario PnL, indicadores de evaluación/retiro).
    - Conta (gastos por categoría, resultado neto, gráfico 3D de tarta y barras mensuales, categorías App y Suministros).
    - Mente (check-in de ánimo/energía/foco, analítica emocional cruzada con resultados, reglas y alertas de riesgo).
    - Usuarios y roles (perfil propio, admin/supervisor/usuario, integraciones y API/webhook, modo claro/oscuro).
    - Supervisión y chat interno (acceso restringido a supervisor, comentarios en un chat entre el equipo).
  - **Sección técnica/extra**: webhook público de operaciones, servidor MCP, autenticación con Google y email, exportación/importación completa de respaldo.
  - **CTA final**: botones "Crear cuenta gratis" / "Ya tengo cuenta" hacia `/auth`.

### 2. Enlazar la presentación

- Añadir un enlace "Funciones" en la cabecera de la landing (`src/routes/index.tsx`) junto a "Entrar".
- (Opcional) añadir un enlace en el menú del `AppShell` o en el menú de usuario para que, ya dentro de la app, se pueda volver a consultar la presentación.

## Decisiones de diseño

- Reutilizar utilidades existentes: `panel`, `label-retro`, `font-hand`, `font-display`, tokens semánticos de color. Sin colores hardcoded.
- Sin imágenes generadas: iconos `lucide-react` ya usados en la navegación (`NotebookPen`, `Wallet`, `ListOrdered`, `Layers`, `Receipt`, `Brain`, `Users`, `MessageSquare`, `ShieldCheck`, `CandlestickChart`, `LineChart`).
- Responsive: una columna en móvil, sin tablas ni grids complejos.

## Fuera de alcance

- No se añaden nuevas funciones de negocio ni se modifica la lógica existente.
- No se generan imágenes de marketing.

## Verificación

- Comprobar que la build pasa y que `/funciones` carga (con y sin sesión) sin 401.
- Revisar que el `head()` tenga metadatos propios y correctos.
