-- Migración para soporte de Cuentas Quemadas / Perdidas, estados de cuenta e historial de quema
-- Añade columnas status, burned_at y burned_reason a public.accounts

-- 1. Añadir columnas a public.accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS burned_at timestamptz,
  ADD COLUMN IF NOT EXISTS burned_reason text;

-- 2. Asegurar valores por defecto en cuentas existentes
UPDATE public.accounts
SET status = 'active'
WHERE status IS NULL;

-- 3. Comentarios descriptivos para documentación
COMMENT ON COLUMN public.accounts.status IS 'Estado de la cuenta: active (activa), burned (quemada/perdida), passed (superada), archived (archivada)';
COMMENT ON COLUMN public.accounts.burned_at IS 'Fecha y hora en la que la cuenta fue marcada como quemada o perdida';
COMMENT ON COLUMN public.accounts.burned_reason IS 'Motivo o causa de la pérdida o quema de la cuenta (ej. Max Loss, Daily Loss, Regla de consistencia)';

-- 4. Índice para agilizar el filtrado por estado
CREATE INDEX IF NOT EXISTS accounts_status_idx ON public.accounts (journal_id, status);
