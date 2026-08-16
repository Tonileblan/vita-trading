# Capital de estrategia = capital de sus cuentas

Hoy cada estrategia muestra el capital que se escribió a mano en su ficha, aunque las cuentas asignadas a esa estrategia tengan otro dinero. Pasamos a calcularlo a partir de las cuentas.

## Qué cambia

- **Capital inicial de una estrategia** = suma de los balances iniciales de las cuentas que tienen esa estrategia asignada.
- **Capital actual** = suma de los balances actuales de esas mismas cuentas (ya descontados los retiros aprobados).
- **Neto (P&L)** = suma del P&L de las operaciones que cuentan para la estrategia (las suyas propias o las que heredan la estrategia de su cuenta).
- **Retiros** = retiros aprobados de las cuentas asignadas a la estrategia.
- **Riesgo por operación** y **% de retorno** se recalculan sobre este capital real.
- Si una estrategia no tiene cuentas asignadas, sus cifras de capital quedan a 0 y la tarjeta lo indica ("sin cuentas asignadas").
- El campo "Capital inicial" del diálogo de estrategia se mantiene visible como referencia, pero ya no alimenta los cálculos.

## Dónde se ve

- Página **Estrategias**: tarjetas (línea de resumen bajo el nombre), tabla "Comparativa por estrategia" y los cuatro totales superiores, que pasan a sumar el capital de las cuentas en lugar del capital manual.
- La tabla de comparativa añade el nombre de las cuentas asignadas a cada estrategia para que se vea de dónde sale el dinero.

## Detalles técnicos

- `computeStrategyStats` en `src/lib/metrics.ts` recibe también `accounts`; deriva `initialCapital`/`currentCapital` de las cuentas con `strategy_id` coincidente usando `accountBalance` y `accountWithdrawn`, y asigna operaciones mediante `effectiveStrategyId`.
- `src/routes/_authenticated/estrategias.tsx` pasa `accounts` desde `useJournal()` y usa el capital devuelto por las estadísticas para las tarjetas, la tabla y los totales (incluida la base de `monthlyNet`).
- Sin cambios de base de datos ni de esquema.
