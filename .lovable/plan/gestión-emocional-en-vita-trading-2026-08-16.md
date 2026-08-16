# Gestión emocional en Vita-Trading

Objetivo: registrar el estado mental antes/después de operar, detectar patrones que arruinan resultados y avisar cuando conviene parar. Mezcla de campos integrados en lo que ya usas + una pestaña propia "Mente" para el diario y la analítica.

## 1. Estado por operación (integrado)

En el formulario de operación, un bloque plegable "Estado" (opcional, no estorba al registro rápido):

- Emoción antes: calma, confianza, ansiedad, FOMO, aburrimiento, venganza.
- Emoción después: satisfecho, indiferente, frustrado, eufórico, culpable.
- Disciplina: "¿Seguí el plan?" sí / parcial / no.
- Errores marcados con etiquetas: entrada precipitada, sin stop, mover stop, revenge trade, sobreoperar, salida temprana, sobreapalancar.
- Nota corta de contexto emocional.

Se muestran como chips discretos en la tabla de operaciones y en el detalle.

## 2. Check-in diario (pestaña Mente)

Un registro por día, rápido (menos de 20 segundos):

- Ánimo, energía, estrés y foco (escalas 1-5 con caras/barras).
- Horas de sueño.
- Nota libre: qué me preocupa hoy / intención del día.
- Cierre del día opcional: qué hice bien, qué repetir, qué evitar.

Vista de calendario mensual con el color del ánimo por día y el PnL de esa jornada al lado, para ver la correlación de un vistazo.

## 3. Analítica emocional (pestaña Mente + bloque en Resumen)

- PnL, win rate y nº de operaciones por emoción previa (ranking: "operando con FOMO pierdes X de media").
- Comparativa "seguí el plan" vs "no seguí el plan".
- Coste de cada error: cuánto te ha costado en total cada etiqueta de error.
- Rendimiento por rango de ánimo/energía/sueño.
- Bloque compacto en Resumen: tu mejor estado, tu peor estado y el error más caro, con enlace a Mente.

## 4. Alertas y reglas (reglas por diario)

Reglas configurables con valores por defecto sensatos:

- Máx. pérdidas consecutivas (por defecto 3).
- Máx. operaciones por día (por defecto 5).
- Pérdida máxima diaria (% del capital o importe).
- Aviso si no hay check-in del día antes de registrar operaciones.

Cuando se cruza un umbral, aparece un banner en Resumen y un aviso al guardar una operación: "Llevas 3 pérdidas seguidas hoy — considera parar". No bloquea nada, solo avisa, con opción de silenciar hasta mañana.

## Detalles técnicos

- Nuevas tablas en la base de datos, todas con RLS por `auth.uid()` y lectura para supervisores igual que el resto (respetando `is_private_user`):
  - `mood_checkins` (journal_id, user_id, date único por usuario/diario, mood, energy, stress, focus, sleep_hours, intention, review_note).
  - `journal_rules` (journal_id, user_id, max_loss_streak, max_trades_day, max_daily_loss, require_checkin, enabled).
  - Columnas nuevas en `trades`: `emotion_before`, `emotion_after`, `followed_plan`, `mistakes text[]`, `emotion_note`.
- Catálogos de emociones y errores en `src/lib/emotions.ts` (español, editables en código).
- Cálculos en `src/lib/emotion-metrics.ts` (agregados por emoción/error/disciplina, reutilizando el filtrado por scope y fechas ya existente).
- Nueva ruta `src/routes/_authenticated/mente.tsx` + entrada en la navegación, tras Estrategias.
- Componentes: `mood-checkin-card.tsx`, `mood-calendar.tsx`, `emotion-stats.tsx`, `risk-alerts.tsx`.
- El export/import CSV incluirá los check-ins y los campos emocionales de las operaciones.
