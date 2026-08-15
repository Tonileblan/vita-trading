# Corregir el cálculo de drawdown por tipo

El cálculo actual (`accountDrawdown` en `src/lib/metrics.ts`) trata los tres tipos casi igual y tiene varios fallos confirmados al leer el código:

- El **trailing** sube el suelo sin tope: nunca se congela al llegar al capital inicial.
- El **EOD** toma "todos los días menos el último" en vez de "días ya cerrados respecto a hoy", así que si la última operación es de hace días, ignora un cierre ya consolidado; y si hay varias operaciones hoy, puede usar el saldo intradía.
- Los **retiros no se restan** del balance usado para el drawdown, aunque sí bajan el capital real de la cuenta.
- La **rotura** solo mira el balance actual: una cuenta que perforó el suelo y luego recuperó aparece como sana.
- Las fechas se agrupan cortando el texto ISO (`slice(0,10)`), lo que asigna operaciones nocturnas al día equivocado en horario local.

## Qué se corrige

1. **Balance del drawdown** = capital inicial + P&L de operaciones de la cuenta − retiros de esa cuenta.
2. **Estático**: suelo fijo = inicial − límite (sin cambios de lógica, pero ya con retiros).
3. **Trailing**: suelo = máximo alcanzado − límite, **congelado al llegar al capital inicial** (una vez el beneficio supera el límite, el suelo deja de subir).
4. **EOD**: referencia = mayor saldo de cierre de los días **anteriores a hoy** (fecha local), nunca por debajo del inicial, y con el mismo tope de congelación que el trailing.
5. **Rotura histórica**: se recorre la serie cronológica de balances comparando cada punto con el suelo vigente en ese momento; si alguna vez se cruzó, la cuenta queda marcada como rota y se indica la fecha.
6. Agrupación por día usando fecha local en vez de recorte del texto ISO.

## Interfaz

- En la ficha de cuenta (`/cuenta/$accountId`): mostrar referencia, suelo, margen restante y, si procede, aviso de rotura con la fecha en que ocurrió.
- En la tarjeta de cuenta (`/cuentas`): la barra y el aviso usan el mismo estado corregido.

## Detalle técnico

- `accountDrawdown(account, trades)` pasa a `accountDrawdown(account, trades, withdrawals)`; se actualizan las dos llamadas (`cuentas.tsx`, `cuenta.$accountId.tsx`) para pasar los retiros del diario activo.
- `DrawdownStatus` gana `breachedAt?: string` y `frozen: boolean` (indica que el trailing ya está congelado).
- Serie única de eventos (operaciones por `closedAt` + retiros por `date`) ordenada cronológicamente, sobre la que se calculan pico, cierres diarios y rotura histórica en una sola pasada.
