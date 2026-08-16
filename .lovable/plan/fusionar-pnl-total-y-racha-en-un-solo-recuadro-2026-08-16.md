# Fusionar PNL TOTAL y RACHA en un solo recuadro

## Objetivo
Unir el cuadro **PNL TOTAL** y el cuadro **Racha actual** en un único recuadro combinado, e integrar dentro de ese mismo recuadro los botones de rango (7d / 30d / 180d) que muestran ganadas y perdidas en ese periodo.

## Estado actual
- `src/components/kpi-cards.tsx` renderiza una rejilla `sm:grid-cols-2` con dos tarjetas independientes:
  1. Tarjeta PnL (capital + PnL en modo fusión, o PnL Total/Fondeo/Real).
  2. Tarjeta Racha (`StreakCard`) con wins/losses globales y racha actual.
- La `StreakCard` actual no tiene botones de rango; calcula rachas sobre todas las operaciones recibidas.
- `computeStreaks(trades)` y `filterByDays(trades, days)` ya existen en `src/lib/metrics.ts`.

## Cambios

### 1. `src/components/kpi-cards.tsx`
- Sustituir la rejilla de dos tarjetas por **un único recuadro** `.panel` que fusiona:
  - **Bloque superior (PnL):** etiqueta dinámica (`Capital` / `PnL Total` / `PnL Fondeo` / `PnL Real`), valor (capital inicial sin símbolo en modo fusión, o PnL con signo), y diferencia PnL debajo en modo fusión. Igual que hoy.
  - **Bloque inferior (Racha):** racha actual (ganadas/perdidas con iconos y color) + mejor racha, y debajo los **botones de rango** `7d`, `30d`, `180d` que recalculan wins/losses y racha sobre `filterByDays(trades, N)`.
- Añadir estado interno `streakRange` (`"7" | "30" | "180"`) dentro del componente fusionado.
- El bloque de racha usa `computeStreaks(filterByDays(trades, N))` según el botón activo.
- Separar PnL y Racha con un divisor sutil (borde superior) dentro del mismo panel.
- Eliminar la `StreakCard` independiente y la tarjeta de racha fallback del `KpiCards`.

### 2. `src/routes/_authenticated/panel.tsx`
- Sin cambios de lógica: ya pasa `metrics`, `scope`, `trades`, `fusionEquity`, `fusionInitial` a `KpiCards`. El selector de rango de la cabecera se mantiene igual (afecta a toda la pestaña); los nuevos botones 7d/30d/180d son locales al recuadro de racha.

## Resultado
Un solo recuadro que muestra arriba el PnL/capital y abajo la racha con sus botones 7d/30d/180d, ocupando el ancho disponible en lugar de dos columnas.

## Notas técnicas
- Mantener `tabular-nums` y la tipografía retro existente.
- En móvil el recuadro ocupa todo el ancho; los botones de rango caben en una fila con `flex-wrap`.
- No tocar `metrics.ts` ni `panel.tsx` más allá de lo necesario.
