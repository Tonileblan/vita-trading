# Control de costos y rentabilidad neta

Nueva pestaña **Costos** para registrar todo lo que te cuesta operar (cuentas PropFirm, suscripciones, hardware, autónomo/impuestos) y ver la rentabilidad real: PnL bruto menos costos.

## Ámbito: general + por diario

Cada costo puede ser:
- **General**: afecta a todo tu negocio (cuota de autónomo, portátil, TradingView). No pertenece a ningún diario.
- **De un diario**: se imputa solo a esa bitácora (por ejemplo la evaluación de una cuenta concreta).

En la pestaña Costos hay un selector: *Este diario* / *Generales* / *Todo*. Los cálculos de rentabilidad del diario suman siempre sus costos propios, y opcionalmente los generales (interruptor "incluir costos generales").

## Categorías

- **Cuenta PropFirm**: compra de evaluación, reset, activación. Se puede enlazar a una cuenta existente.
- **Suscripción**: plataforma, datos de mercado, apps, VPS. Con periodicidad mensual/anual y fecha de fin opcional; se expande automáticamente a cada mes sin tener que reintroducirlo.
- **Hardware y material**: equipo, monitores, formación (gasto puntual).
- **Impuestos y autónomo**: cuota, IRPF/IVA estimado, gestoría. También puede ser recurrente.
- **Otros**.

Cada costo guarda: fecha, concepto, importe, moneda del diario, categoría, cuenta enlazada (opcional), periodicidad, notas y estado pagado/previsto.

## Pantalla Costos

- Tarjetas superiores: **Costos del mes**, **Costos del año**, **Coste fijo mensual** (suma de recurrentes) y **Punto de equilibrio** (cuánto tienes que ganar al mes para cubrirlos).
- Botón "Nuevo costo" con formulario en diálogo, y edición/eliminación desde la lista.
- Lista filtrable por categoría, ámbito y rango de fechas, en tabla en escritorio y tarjetas en móvil (mismo patrón que Operaciones).
- Gráfico de barras de costos por mes, coloreado por categoría, y desglose por categoría con porcentaje del total.
- Bloque **Rentabilidad neta**: PnL bruto del periodo, costos, retiros, resultado neto y ROI sobre el capital.

## Por cuenta PropFirm

En la ficha de cada cuenta (`/cuenta/:id`) se añade un bloque **Coste de la cuenta**:
- Total invertido en esa cuenta (compra + resets + activaciones).
- Beneficio operativo de la cuenta.
- **Resultado neto** y si la cuenta ya se ha amortizado (verde) o todavía no (rojo), con lo que falta para cubrirla.

En la lista de Cuentas, cada tarjeta muestra en pequeño el neto tras costos.

## Detalles técnicos

- Nueva tabla `public.expenses`: `user_id`, `journal_id` (nullable = costo general), `account_id` (nullable), `category`, `concept`, `amount`, `currency`, `date`, `recurrence` (`none`/`monthly`/`yearly`), `recurrence_end`, `paid`, `notes`, timestamps. GRANT a `authenticated` y `service_role`, RLS con dueño (`auth.uid() = user_id`) y lectura de supervisores respetando `is_private_user`, más trigger `set_updated_at`.
- `src/lib/expenses.ts`: hooks de TanStack Query (listar, crear, editar, borrar) y expansión de recurrentes a ocurrencias mensuales/anuales para los cálculos.
- `src/lib/expense-metrics.ts`: totales por mes/categoría, coste fijo mensual, punto de equilibrio, coste por cuenta y PnL neto.
- Componentes nuevos: `expense-form-dialog.tsx`, `expenses-table.tsx`, `expense-breakdown.tsx`, `account-cost-card.tsx`.
- Ruta nueva `src/routes/_authenticated/costos.tsx` con su `head()` propio, y entrada "Costos" en la navegación de `app-shell.tsx` después de Retiros.
- Exportación/importación CSV: se añade el tipo `costo` al CSV completo de `src/lib/journal-csv.ts`.
