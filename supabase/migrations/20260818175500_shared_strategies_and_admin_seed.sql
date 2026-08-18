-- Migración: Estrategias Compartidas e Inicialización Automática de Estrategias desde la Cuenta del Admin

-- 1. Añadir columna is_shared a public.strategies
ALTER TABLE public.strategies
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS strategies_is_shared_idx ON public.strategies (is_shared);

-- 2. Actualizar políticas RLS de public.strategies
DROP POLICY IF EXISTS "Owner manages strategies" ON public.strategies;
DROP POLICY IF EXISTS "Supervisors read strategies" ON public.strategies;
DROP POLICY IF EXISTS "Users view own and shared strategies" ON public.strategies;
DROP POLICY IF EXISTS "Users manage own strategies" ON public.strategies;
DROP POLICY IF EXISTS "Users update own strategies" ON public.strategies;
DROP POLICY IF EXISTS "Users delete own strategies" ON public.strategies;

-- Política de lectura: propias, compartidas globalmente, supervisor o administrador
CREATE POLICY "Users view own and shared strategies" ON public.strategies
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR is_shared = true
    OR public.is_supervisor(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Política de inserción: crear propias o admin
CREATE POLICY "Users manage own strategies" ON public.strategies
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Política de actualización: propias o admin
CREATE POLICY "Users update own strategies" ON public.strategies
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Política de borrado: propias o admin
CREATE POLICY "Users delete own strategies" ON public.strategies
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 3. Función RPC para clonar/sembrar estrategias de la cuenta del admin o compartidas para un diario
CREATE OR REPLACE FUNCTION public.seed_user_strategies(p_journal_id uuid, p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_inserted_count integer := 0;
  v_rec record;
BEGIN
  -- Buscar un ID de administrador para obtener sus estrategias
  SELECT user_id INTO v_admin_id
  FROM public.user_roles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  -- 1. Si existe administrador y tiene estrategias configuradas, clonarlas para el nuevo usuario
  IF v_admin_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.strategies WHERE user_id = v_admin_id) THEN
    FOR v_rec IN
      SELECT name, initial_capital, risk_pct, main_symbol, color, market, chart, days, schedule, execution, setup, management, contracts, is_shared
      FROM public.strategies
      WHERE user_id = v_admin_id
    LOOP
      INSERT INTO public.strategies (
        journal_id, user_id, name, initial_capital, risk_pct, main_symbol, color,
        market, chart, days, schedule, execution, setup, management, contracts, is_shared
      ) VALUES (
        p_journal_id, p_user_id, v_rec.name, v_rec.initial_capital, v_rec.risk_pct, v_rec.main_symbol, v_rec.color,
        v_rec.market, v_rec.chart, v_rec.days, v_rec.schedule, v_rec.execution, v_rec.setup, v_rec.management, v_rec.contracts, v_rec.is_shared
      );
      v_inserted_count := v_inserted_count + 1;
    END LOOP;

  -- 2. Si no hay admin o no tiene estrategias, copiar estrategias compartidas
  ELSIF EXISTS (SELECT 1 FROM public.strategies WHERE is_shared = true) THEN
    FOR v_rec IN
      SELECT DISTINCT ON (name) name, initial_capital, risk_pct, main_symbol, color, market, chart, days, schedule, execution, setup, management, contracts, is_shared
      FROM public.strategies
      WHERE is_shared = true
    LOOP
      INSERT INTO public.strategies (
        journal_id, user_id, name, initial_capital, risk_pct, main_symbol, color,
        market, chart, days, schedule, execution, setup, management, contracts, is_shared
      ) VALUES (
        p_journal_id, p_user_id, v_rec.name, v_rec.initial_capital, v_rec.risk_pct, v_rec.main_symbol, v_rec.color,
        v_rec.market, v_rec.chart, v_rec.days, v_rec.schedule, v_rec.execution, v_rec.setup, v_rec.management, v_rec.contracts, v_rec.is_shared
      );
      v_inserted_count := v_inserted_count + 1;
    END LOOP;

  -- 3. Si no hay estrategias existentes en la plataforma, sembrar el conjunto predeterminado
  ELSE
    INSERT INTO public.strategies (
      journal_id, user_id, name, initial_capital, risk_pct, main_symbol, color, market, chart, days, schedule, execution, setup, management, contracts, is_shared
    ) VALUES
      (p_journal_id, p_user_id, 'Principal (MNQ)', 10000, 0.02, 'MNQ', '#3B82F6', 'Futuros Micro Nasdaq (MNQ)', '1 min / 5 min con niveles 15m/1h', 'Lunes a Viernes (evitar festivos EEUU)', '15:30 a 17:30 (hora española)', 'A mercado tras confirmación de vela', 'Ruptura y retesteo de nivel clave', 'Stop en el último mínimo/máximo, trailing stop a 1.5R', '1-2 contratos MNQ', true),
      (p_journal_id, p_user_id, 'Fondeo Apex (NQ)', 25000, 0.015, 'NQ', '#10B981', 'Futuros Nasdaq (NQ)', '2 min con VWAP y volumen', 'Martes, Miércoles y Jueves', '15:45 a 17:00 (apertura NY)', 'Orden límite en retroceso', 'Pullback a VWAP en tendencia confirmada', 'Stop rígido de 20 pts, target a 40 pts', '1 contrato NQ', true),
      (p_journal_id, p_user_id, 'Sesión Asia (GC)', 15000, 0.01, 'GC', '#F59E0B', 'Futuros Oro (GC)', '5 min / 15 min', 'Domingo a Jueves noche', '02:00 a 05:00 (sesión Tokio/Hong Kong)', 'Límite en rango de consolidación', 'Barrido de liquidez de sesión Londres previa', 'Stop 15 ticks, target 30 ticks', '1 contrato micro MGC', true),
      (p_journal_id, p_user_id, 'Scalping Oro (MGC)', 5000, 0.025, 'MGC', '#EC4899', 'Futuros Micro Oro (MGC)', '30 seg / 1 min', 'Lunes a Viernes', '14:00 a 16:30', 'A mercado en pico de volatilidad', 'Rechazo en zona de oferta/demanda intradía', 'Stop ceñido 10 ticks, TP 20 ticks', '2-4 contratos MGC', true),
      (p_journal_id, p_user_id, 'Swing ES', 20000, 0.01, 'ES', '#8B5CF6', 'Futuros S&P 500 (ES)', '1h / 4h / Diario', 'Semanal', 'Cierre de sesión / Apertura', 'Límite en retroceso Fibonacci 61.8%', 'Estructura mayor con confirmación en 1h', 'Stop bajo mínimo swing, TP a ratio 1:3', '1 contrato MES/ES', true);
    v_inserted_count := 5;
  END IF;

  RETURN v_inserted_count;
END;
$$;

-- 4. Actualizar handle_new_user() para inicializar automáticamente con las estrategias del admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journal_id uuid;
BEGIN
  -- Perfil
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Rol de usuario estándar
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Diario Principal
  INSERT INTO public.journals (owner_id, name, description)
  VALUES (NEW.id, 'Diario principal', 'Bitácora creada automáticamente')
  RETURNING id INTO v_journal_id;

  -- Sembrar estrategias del admin para el nuevo usuario
  IF v_journal_id IS NOT NULL THEN
    PERFORM public.seed_user_strategies(v_journal_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Actualizar get_journal_bundle para incluir is_shared y proyectar estrategias
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
        SELECT
          id,
          journal_id,
          user_id,
          name,
          initial_capital,
          risk_pct,
          main_symbol,
          color,
          market,
          chart,
          days,
          schedule,
          execution,
          setup,
          management,
          contracts,
          COALESCE(is_shared, false) AS is_shared,
          created_at,
          updated_at
        FROM public.strategies
        WHERE journal_id = p_journal_id
        ORDER BY created_at ASC
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
            WHEN screenshots IS NOT NULL AND array_length(screenshots, 1) > 0 THEN ARRAY['__has_screenshots__']::text[]
            ELSE ARRAY[]::text[]
          END AS screenshots
        FROM public.trades
        WHERE journal_id = p_journal_id OR journal_id IS NULL
        ORDER BY closed_at DESC
      ) t
    ), '[]'::jsonb),
    'withdrawals', COALESCE((
      SELECT jsonb_agg(to_jsonb(w))
      FROM (
        SELECT * FROM public.withdrawals
        WHERE strategy_id IN (
          SELECT id FROM public.strategies WHERE journal_id = p_journal_id
        )
        ORDER BY date DESC
      ) w
    ), '[]'::jsonb),
    'strategyPeriods', COALESCE((
      SELECT jsonb_agg(to_jsonb(p))
      FROM (
        SELECT * FROM public.account_strategy_periods
        WHERE account_id IN (
          SELECT id FROM public.accounts WHERE journal_id = p_journal_id
        )
      ) p
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
