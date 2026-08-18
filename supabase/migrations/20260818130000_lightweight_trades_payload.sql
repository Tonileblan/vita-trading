-- Optimización de carga ultrarrápida: proyección ligera de operaciones y RPC de capturas bajo demanda

-- 1. Índices compuestos para consultas de operaciones por diario, cuenta y estrategia
CREATE INDEX IF NOT EXISTS trades_journal_closed_opt_idx ON public.trades (journal_id, closed_at DESC);
CREATE INDEX IF NOT EXISTS trades_account_closed_opt_idx ON public.trades (account_id, closed_at DESC);
CREATE INDEX IF NOT EXISTS trades_strategy_closed_opt_idx ON public.trades (strategy_id, closed_at DESC);
CREATE INDEX IF NOT EXISTS trades_user_closed_opt_idx ON public.trades (user_id, closed_at DESC);

-- 2. Función RPC para obtener capturas de una operación bajo demanda (Lazy Loading)
CREATE OR REPLACE FUNCTION public.get_trade_screenshots(p_trade_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_screenshots text[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT screenshots INTO v_screenshots
  FROM public.trades
  WHERE id = p_trade_id
    AND (
      user_id = v_user_id
      OR public.is_supervisor(v_user_id)
      OR public.has_role(v_user_id, 'admin')
    );

  RETURN COALESCE(v_screenshots, ARRAY[]::text[]);
END;
$$;

-- 3. Actualizar get_journal_bundle para proyectar operaciones ultraligeras sin Base64 pesado
CREATE OR REPLACE FUNCTION public.get_journal_bundle(p_journal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Comprueba permisos: propietario del diario o supervisor/admin
  IF NOT EXISTS (
    SELECT 1 FROM public.journals j
    WHERE j.id = p_journal_id
      AND (
        j.owner_id = v_user_id
        OR public.is_supervisor(v_user_id)
        OR public.has_role(v_user_id, 'admin')
      )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'accounts', COALESCE((
      SELECT jsonb_agg(to_jsonb(a))
      FROM (
        SELECT * FROM public.accounts
        WHERE journal_id = p_journal_id
        ORDER BY created_at ASC
      ) a
    ), '[]'::jsonb),
    'strategies', COALESCE((
      SELECT jsonb_agg(to_jsonb(s))
      FROM (
        SELECT * FROM public.strategies
        WHERE journal_id = p_journal_id
      ) s
    ), '[]'::jsonb),
    'trades', COALESCE((
      SELECT jsonb_agg(to_jsonb(t))
      FROM (
        SELECT
          id,
          user_id,
          journal_id,
          account_id,
          strategy_id,
          symbol,
          direction,
          opened_at,
          closed_at,
          entry_price,
          exit_price,
          size,
          pnl,
          tags,
          notes,
          source,
          import_batch_id,
          created_at,
          emotion_before,
          emotion_after,
          followed_plan,
          mistakes,
          emotion_note,
          CASE
            WHEN screenshots IS NOT NULL AND array_length(screenshots, 1) > 0
            THEN ARRAY['__has_screenshots__']::text[]
            ELSE ARRAY[]::text[]
          END AS screenshots
        FROM public.trades
        WHERE journal_id = p_journal_id
        ORDER BY closed_at DESC
      ) t
    ), '[]'::jsonb),
    'withdrawals', COALESCE((
      SELECT jsonb_agg(to_jsonb(w))
      FROM (
        SELECT * FROM public.withdrawals
        WHERE journal_id = p_journal_id
        ORDER BY date DESC
      ) w
    ), '[]'::jsonb),
    'strategyPeriods', COALESCE((
      SELECT jsonb_agg(to_jsonb(p))
      FROM (
        SELECT * FROM public.account_strategy_periods
        WHERE journal_id = p_journal_id
        ORDER BY start_date ASC
      ) p
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
