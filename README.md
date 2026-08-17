# Vita-Trading

Con esta orientacion visual desarrolla lo siguiente :Crea una aplicación web moderna tipo "Trading Journal" (Bitácora de Trading) diseñada para ser sencilla, visual y orientada a la eficiencia. El diseño debe ser limpio, profesional y utilizar un tema oscuro (Dark Mode) por defecto, similar a las interfaces de las plataformas de trading.

La aplicación debe estructurarse con las siguientes funcionalidades principales:

1. GESTIÓN DE CUENTAS (ACCOUNTS):

- Un panel lateral o sección para agregar y gestionar múltiples cuentas.

- Al crear una cuenta, debe haber dos tipos: "Cuenta de Fondeo" y "Cuenta Personal".

- Para las cuentas de fondeo, incluye campos específicos: Nombre de la Prop Firm (ej. Apex Trader Funding, Wall Street Funded, Lucid Trading, IC Markets), Balance Inicial, Balance Actual y Límite de Drawdown.

2. REGISTRO DE OPERACIONES (TRADES):

- Un formulario rápido e intuitivo para registrar operaciones manuales con los siguientes campos: Activo (ej. NQ, NQ1!, EURUSD), Dirección (Long/Short), Fecha y Hora de apertura/cierre, Precio de Entrada, Precio de Salida, Tamaño (Contratos/Lotes), PnL neto (Beneficio/Pérdida en $) y Etiquetas para la estrategia utilizada (ej. ICT, Wyckoff, Smart Money).

- Galería de Evidencia: Un área de "Drag & Drop" nativa para subir o pegar capturas de pantalla de los gráficos por cada operación.

- Un campo de notas de texto enriquecido para añadir el análisis de pre-mercado y post-mercado.

3. DASHBOARD Y MÉTRICAS:

- Una vista principal (Overview) que consolide los datos de las cuentas seleccionadas.

- Tarjetas de resumen (KPIs): Win Rate (%), PnL Total, Profit Factor y Racha de ganancias/pérdidas.

- Un gráfico de líneas interactivo que muestre la curva de capital (Equity Curve), filtrable por cuenta (o todas juntas) y por marco temporal.

4. INTEGRACIÓN Y CONECTIVIDAD (API/WEBHOOKS):

- Construye la arquitectura pensando en la automatización. Habilita una ruta o endpoint (Webhook) preparado para recibir un JSON con los datos de un trade. 

- El objetivo es que la app esté lista para recibir ejecuciones en tiempo real desde plataformas como MetaTrader, cTrader o NinjaTrader 8 mediante herramientas de automatización de flujos como n8n.

Requisitos técnicos para Lovable: 

Usa React con Tailwind CSS para una interfaz responsive y moderna. Configura el backend con Supabase (para gestionar la autenticación, la base de datos relacional entre Cuentas y Trades, y un bucket de Storage para almacenar las capturas de pantalla). Empieza generando la UI completa con datos de prueba (mock data) muy realistas para poder visualizar el Dashboard antes de conectar la base de datos.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vita-trading.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9fa67b4d-83d0-4b25-8504-0c57d4dd1987).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
