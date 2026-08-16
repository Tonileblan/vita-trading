# Eliminar operaciones y deshacer importaciones

## Qué se podrá hacer

1. **Borrar una operación suelta** desde el registro de operaciones (icono de papelera en cada fila y en cada tarjeta móvil), con confirmación previa.
2. **Selección múltiple**: casillas para marcar varias operaciones y un botón "Eliminar seleccionadas".
3. **Deshacer una importación completa**: cada importación por captura/foto queda agrupada como un lote. En Operaciones aparece un panel "Importaciones recientes" con fecha, número de operaciones y PnL del lote, y un botón para deshacerla (borra todas las operaciones de ese lote de golpe).

Al borrar, el balance de la cuenta se ajusta restando el PnL de las operaciones eliminadas, igual que ahora se suma al importar, de modo que balances, curvas de capital, drawdown y estadísticas quedan cuadrados.

## Detalles técnicos

- **Base de datos**: nueva columna `import_batch_id uuid` (nullable) en `public.trades`, más índice por `(journal_id, import_batch_id)`. Las operaciones manuales la dejan a `null`.
- **`src/lib/journal-store.tsx`**:
  - `addTrades` genera un `import_batch_id` común para el lote.
  - Nuevas acciones `removeTrade(id)`, `removeTrades(ids)` y `removeImportBatch(batchId)`; todas recalculan el delta de PnL por cuenta y actualizan `current_balance` restando ese delta, después invalidan la query del diario.
  - Se expone `importBatches` derivado de `trades` (agrupado por `import_batch_id`, ordenado por fecha de creación descendente, últimos 10).
- **`src/lib/types.ts`**: añadir `importBatchId?: string` al tipo `Trade` y mapearlo en `toTrade` / `fromTrade`.
- **`src/components/trades-table.tsx`**: props opcionales `selectable` y `onDelete`; columna de checkbox y botón papelera con `AlertDialog` de confirmación (no se activan en las tablas resumidas del panel).
- **`src/routes/_authenticated/operaciones.tsx`**: estado de selección, barra de acciones "N seleccionadas · Eliminar", y el panel de importaciones recientes con su botón de deshacer (también con confirmación).
- **`src/lib/journal-csv.ts`**: incluir la columna del lote en exportación/importación para no perder el agrupado.
