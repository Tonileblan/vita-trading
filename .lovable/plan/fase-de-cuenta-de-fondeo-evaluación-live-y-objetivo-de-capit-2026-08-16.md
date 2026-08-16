# Fase de cuenta de fondeo (Evaluación / Live) y objetivo de capital

## Qué se añade

Las cuentas de fondeo pasan a tener dos datos nuevos:

1. **Fase**: `Evaluación` o `Live (fondeada)`.
2. **Objetivo de capital**:
   - En Evaluación: capital objetivo para superar la prueba (p. ej. 50.000 → 53.000).
   - En Live: capital objetivo a partir del cual se puede solicitar retiro (umbral de payout).

Ambos campos solo aparecen para cuentas de tipo Fondeo. Las cuentas personales no cambian.

## Dónde se refleja

- **Formulario de cuenta** (crear/editar): selector Evaluación / Live y campo "Objetivo" (importe absoluto; se muestra también el equivalente en % sobre el inicial). El texto de ayuda cambia según la fase.
- **Ficha de cuenta en la pestaña Cuentas**: etiqueta de fase junto al nombre (chip "EVAL" o "LIVE") y una barra de progreso hacia el objetivo, con "faltan X" o "objetivo alcanzado".
- **Detalle de cuenta**: tarjeta "Objetivo" con inicial → actual → objetivo, progreso, importe restante y, si está alcanzado, aviso de acción (pasar a Live / solicitar retiro).
- **Panel lateral de cuentas**: mini indicador de progreso al objetivo bajo el balance.
- **Resumen**: el bloque de riesgo/alertas avisa cuando una cuenta alcanza su objetivo ("Apex 50K ha alcanzado el objetivo de evaluación").
- **Conta → Retiros**: al crear un retiro sobre una cuenta Live, se avisa si el balance aún no llega al umbral de payout (aviso informativo, no bloquea).
- **Importar/exportar CSV**: dos columnas nuevas (`fase`, `objetivo`) para no perder el dato en copias de seguridad.

## Reglas de cálculo

- Progreso = (balance actual − inicial) / (objetivo − inicial), acotado a 0–100 %.
- El balance usado es el mismo que ya usa la app (balance actual menos retiros aprobados), para que coincida con el resto de tarjetas.
- Si no se define objetivo, no se muestra progreso y la cuenta funciona como hasta ahora.
- El drawdown sigue funcionando exactamente igual; objetivo y drawdown se muestran juntos como "techo y suelo" de la cuenta.

## Detalles técnicos

- Migración: añadir a `public.accounts` las columnas `phase text not null default 'eval'` (valores `eval` | `live`) y `profit_target numeric null`.
- `src/lib/types.ts`: `AccountPhase` y campos `phase?`, `profitTarget?` en `Account`.
- `src/lib/journal-store.tsx`: mapear las nuevas columnas en lectura y escritura.
- `src/lib/metrics.ts`: nueva función `accountTarget(account, trades, withdrawals)` que devuelve `{ target, progress, remaining, reached }`.
- UI: nuevo componente `src/components/target-progress.tsx` reutilizado en la lista de cuentas, el detalle, el panel lateral y las alertas.
- Actualizar `src/lib/journal-csv.ts` con las dos columnas nuevas.
