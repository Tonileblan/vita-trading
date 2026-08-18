-- Optimización de carga de datos: RPC bundle e índices de rendimiento

-- 1. Índices para acelerar búsquedas en diarios, periodos y operaciones
CREATE INDEX IF NOT EXISTS account_strategy_periods_journal_idx ON public.account_strategy_periods (journal_id);
CREATE INDEX IF NOT EXISTS account_strategy_periods_user_idx ON public.account_strategy_periods (user_id);
CREATE INDEX IF NOT EXISTS trades_journal_closed_idx ON public.trades (journal_id, closed_at DESC);

-- 2. Función RPC para obtener todos los datos de un diario en una sola llamada y un único viaje de red
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
        SELECT * FROM public.trades
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

-- 3. Función RPC de arranque rápido del usuario (perfil + roles + diarios propios)
CREATE OR REPLACE FUNCTION public.get_user_bootstrap()
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
    RETURN jsonb_build_object('profile', null, 'roles', '[]'::jsonb, 'journals', '[]'::jsonb);
  END IF;

  SELECT jsonb_build_object(
    'profile', (
      SELECT to_jsonb(p)
      FROM (
        SELECT id, display_name, avatar_url, is_private
        FROM public.profiles
        WHERE id = v_user_id
      ) p
    ),
    'roles', COALESCE((
      SELECT jsonb_agg(role)
      FROM public.user_roles
      WHERE user_id = v_user_id
    ), '[]'::jsonb),
    'journals', COALESCE((
      SELECT jsonb_agg(to_jsonb(j))
      FROM (
        SELECT id, owner_id, name, description, base_currency, is_archived, is_template, created_at
        FROM public.journals
        WHERE owner_id = v_user_id
        ORDER BY created_at ASC
      ) j
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
