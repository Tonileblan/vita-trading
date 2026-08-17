# Pestaña "Coach" — consejos de trading con IA

Sí se puede, y no hace falta que me facilites tu conector de Gemini: la app ya usa la IA integrada de Lovable (la extracción de operaciones desde capturas funciona así). Añadir tu propia clave solo sumaría gestión de secretos sin ninguna ventaja.

## Qué se añade

Una nueva pestaña **Coach** en la navegación (después de Mente) que analiza los datos del diario activo y devuelve consejos concretos, en español, con el mismo estilo Paper & Ink del resto de la app.

Contenido de la página:

- **Botón "Analizar mi trading"**: genera el informe bajo demanda (no en cada carga, para no gastar créditos).
- **Diagnóstico**: 3-5 frases sobre el estado actual (rentabilidad, consistencia, disciplina).
- **Puntos fuertes** y **fugas de dinero**: listas cortas y concretas.
- **Consejos por estrategia**: para cada estrategia con operaciones, qué está funcionando y qué ajustar.
- **Riesgo y cuentas**: avisos sobre drawdown cercano al límite, tamaño de posición, cuentas en evaluación.
- **Plan de la semana**: 3 acciones concretas.
- Filtros por cuenta y por rango de fechas, igual que en Resumen.

## Qué datos se envían a la IA

Solo un resumen agregado del diario activo (nunca datos de otros usuarios):

- Estrategias: nombre, riesgo %, símbolo principal, reglas descritas.
- Cuentas: tipo (fondeo/real), fase, saldo, tipo y límite de drawdown, objetivo.
- Métricas ya calculadas: PnL total, win rate, media ganadora/perdedora, factor de beneficio, racha máxima de pérdidas, resultado por día de la semana y por hora, PnL por estrategia y por símbolo.
- Últimas ~100 operaciones en forma compacta (fecha, símbolo, dirección, resultado, emoción, si siguió el plan, errores marcados).
- Check-ins de Mente (ánimo, estrés, foco) si existen, para cruzar psicología con resultados.

## Detalles técnicos

- `src/lib/coach.functions.ts`: `createServerFn` con `requireSupabaseAuth`, valida entrada con Zod, recalcula métricas en servidor a partir de las tablas del usuario (RLS aplica) y llama al AI Gateway con el modelo `openai/gpt-5.6-sol` vía AI SDK (`streamText` + salida estructurada, esquema simple sin límites de longitud, con fallback si el JSON viene mal).
- `src/routes/_authenticated/coach.tsx`: la página, con `useServerFn` + `useMutation`, estados de carga/error y aviso si el diario no tiene operaciones suficientes.
- `src/components/app-shell.tsx`: nueva entrada de navegación con icono.
- `src/routes/funciones.tsx`: añadir la sección "Coach IA" a la presentación de funciones.
- Sin cambios de esquema en la base de datos. Opcionalmente se puede guardar el último informe para no regenerarlo al cambiar de pestaña; por defecto se mantiene en memoria de la sesión.
