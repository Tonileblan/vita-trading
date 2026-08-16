# Calendario de resultados en Resumen

Añadir a la pestaña **Resumen** un calendario mensual (estilo el de Mente, pero sin caras de ánimo) que refleje exactamente lo que esté seleccionado en el desplegable de arriba (GENERAL, una cuenta o una estrategia).

## Qué muestra

Cada día del mes:
- Número del día.
- P&L del día en verde (ganancia) o rojo (pérdida), con fondo suave del mismo color para verlo de un vistazo.
- Número de operaciones de ese día (p. ej. "3 op.").
- Los días sin operaciones quedan vacíos y en gris.

Debajo de la rejilla, un **resumen mensual** con:
- Neto del mes.
- Operaciones totales del mes.
- Días ganadores y días perdedores.
- Mejor día y peor día.

En la cabecera: nombre del mes, flechas para ir al mes anterior/siguiente y el neto del mes.

## Comportamiento

- Usa las mismas operaciones ya filtradas del Resumen (cuenta o estrategia seleccionada), así que al cambiar el selector el calendario se actualiza solo.
- No depende del selector de rango (7D/30D/…) de la curva: el calendario navega por meses.
- Se coloca después de los cuadros de análisis y antes de la curva de capital.

## Detalles técnicos

- Nuevo componente `src/components/pnl-calendar.tsx` con prop `trades`, reutilizando `pnlByDay` de `src/lib/emotion-metrics.ts` (ya devuelve `{ pnl, trades }` por día) y `todayKey` / `formatCurrency`.
- Misma estructura de rejilla lunes-primero y navegación por cursor de mes que `mood-calendar.tsx`, sin check-ins.
- Se monta en `src/routes/_authenticated/panel.tsx` pasando `scopedTrades`.
- Sin cambios de datos ni de base de datos.
