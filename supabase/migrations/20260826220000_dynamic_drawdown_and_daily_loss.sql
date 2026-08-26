-- Migración para soporte dinámico de Drawdown (Trailing, EOD, Static) y Límite Diario de Pérdida
-- Añade columnas a la tabla public.accounts y configura triggers para High Watermark automático.

-- 1. Añadir columnas a public.accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS max_loss_limit numeric,
  ADD COLUMN IF NOT EXISTS daily_loss_limit numeric,
  ADD COLUMN IF NOT EXISTS high_watermark numeric,
  ADD COLUMN IF NOT EXISTS start_of_day_balance numeric;

-- 2. Asegurar valores por defecto y migración de datos existentes
UPDATE public.accounts
SET
  max_loss_limit = COALESCE(max_loss_limit, drawdown_limit, 0),
  high_watermark = COALESCE(high_watermark, current_balance, initial_balance, 0),
  start_of_day_balance = COALESCE(start_of_day_balance, initial_balance, current_balance, 0),
  drawdown_type = COALESCE(drawdown_type, 'static')
WHERE max_loss_limit IS NULL OR high_watermark IS NULL OR start_of_day_balance IS NULL;

-- 3. Comentarios en las columnas para documentación
COMMENT ON COLUMN public.accounts.drawdown_type IS 'Tipo de drawdown: trailing (intraday), eod (end of day) o static (estático)';
COMMENT ON COLUMN public.accounts.max_loss_limit IS 'Límite total de pérdida máxima permitida en la cuenta';
COMMENT ON COLUMN public.accounts.daily_loss_limit IS 'Límite máximo de pérdida permitida en un solo día de trading';
COMMENT ON COLUMN public.accounts.high_watermark IS 'Pico máximo histórico de balance/equity alcanzado por la cuenta';
COMMENT ON COLUMN public.accounts.start_of_day_balance IS 'Balance con el que inició la cuenta al principio de la sesión/día actual';

-- 4. Función Trigger para sincronizar High Watermark y valores por defecto
CREATE OR REPLACE FUNCTION public.sync_account_drawdown_watermarks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inicializar valores nulos
  IF NEW.high_watermark IS NULL THEN
    NEW.high_watermark := COALESCE(NEW.current_balance, NEW.initial_balance, 0);
  END IF;

  IF NEW.start_of_day_balance IS NULL THEN
    NEW.start_of_day_balance := COALESCE(NEW.initial_balance, NEW.current_balance, 0);
  END IF;

  IF NEW.max_loss_limit IS NULL AND NEW.drawdown_limit IS NOT NULL THEN
    NEW.max_loss_limit := NEW.drawdown_limit;
  END IF;

  -- Actualizar drawdown_limit para retrocompatibilidad con clientes anteriores
  IF NEW.max_loss_limit IS NOT NULL THEN
    NEW.drawdown_limit := NEW.max_loss_limit;
  END IF;

  -- Lógica de High Watermark:
  -- En Trailing y EOD, el high watermark sube cuando el balance supera el pico guardado
  IF NEW.drawdown_type = 'trailing' OR NEW.drawdown_type = 'eod' THEN
    IF NEW.current_balance > NEW.high_watermark THEN
      NEW.high_watermark := NEW.current_balance;
    END IF;
  ELSIF NEW.drawdown_type = 'static' THEN
    -- En Estático, el high watermark se mantiene en el balance inicial
    NEW.high_watermark := NEW.initial_balance;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Crear el Trigger en public.accounts
DROP TRIGGER IF EXISTS accounts_sync_drawdown_trigger ON public.accounts;
CREATE TRIGGER accounts_sync_drawdown_trigger
BEFORE INSERT OR UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.sync_account_drawdown_watermarks();
