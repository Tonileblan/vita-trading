-- Migración: Renombrar Principal a IFT y añadir estrategia Scalping

-- 1. Renombrar estrategias existentes 'Principal' a 'IFT'
UPDATE public.strategies
SET name = 'IFT'
WHERE name = 'Principal';

-- 2. Actualizar función seed_user_strategies
CREATE OR REPLACE FUNCTION public.seed_user_strategies(p_journal_id uuid, p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id uuid;
  v_inserted_count integer := 0;
  v_rec record;
BEGIN
  -- 1. Si existe administrador y tiene estrategias configuradas
  SELECT user_id INTO v_admin_id
  FROM public.user_roles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_admin_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.strategies WHERE user_id = v_admin_id AND journal_id <> p_journal_id
  ) THEN
    FOR v_rec IN
      SELECT name, initial_capital, risk_pct, main_symbol, color, market, chart, days, schedule, execution, setup, management, contracts, is_shared
      FROM public.strategies
      WHERE user_id = v_admin_id AND journal_id <> p_journal_id
    LOOP
      IF NOT EXISTS (SELECT 1 FROM public.strategies WHERE journal_id = p_journal_id AND name = v_rec.name) THEN
        INSERT INTO public.strategies (
          journal_id, user_id, name, initial_capital, risk_pct, main_symbol, color,
          market, chart, days, schedule, execution, setup, management, contracts, is_shared
        ) VALUES (
          p_journal_id, p_user_id, v_rec.name, v_rec.initial_capital, v_rec.risk_pct, v_rec.main_symbol, v_rec.color,
          v_rec.market, v_rec.chart, v_rec.days, v_rec.schedule, v_rec.execution, v_rec.setup, v_rec.management, v_rec.contracts, true
        );
        v_inserted_count := v_inserted_count + 1;
      END IF;
    END LOOP;
  END IF;

  -- 2. Si faltan estrategias predeterminadas, asegurar el conjunto completo (IFT, Fondeo, Asia, Oro, Lite, Swing, Scalping)
  IF NOT EXISTS (SELECT 1 FROM public.strategies WHERE journal_id = p_journal_id AND name = 'IFT') THEN
    INSERT INTO public.strategies (
      journal_id, user_id, name, initial_capital, risk_pct, main_symbol, color, market, chart, days, schedule, execution, setup, management, contracts, is_shared
    ) VALUES (
      p_journal_id, p_user_id, 'IFT', 10000, 0.03, 'MNQ', '#3B82F6', 'Nueva York · Nasdaq (MNQ / NQ)', '5 minutos', 'Lunes, martes, jueves y viernes', '9:31 - 11:00 (NY)', 'Manual o bot', 'SL: 210 ticks', 'TP2 (RR 1:2) · Break-even automático 170 ticks · BE Plus +4', '4 a 5 contratos de referencia; ajustar según gestión de riesgo', true
    );
    v_inserted_count := v_inserted_count + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.strategies WHERE journal_id = p_journal_id AND name = 'Fondeo') THEN
    INSERT INTO public.strategies (
      journal_id, user_id, name, initial_capital, risk_pct, main_symbol, color, market, chart, days, schedule, execution, setup, management, contracts, is_shared
    ) VALUES (
      p_journal_id, p_user_id, 'Fondeo', 10000, 0.03, 'MNQ', '#10B981', 'Nueva York · MNQ', '4.500 ticks', 'Martes a jueves', '9:00 - 16:00 (NY) · 2 sesiones por día', 'Solo bot', 'SL dinámico: ATR(14) × 4', 'RR 1:1', 'Según el plan de gestión de riesgo', true
    );
    v_inserted_count := v_inserted_count + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.strategies WHERE journal_id = p_journal_id AND name = 'Asia') THEN
    INSERT INTO public.strategies (
      journal_id, user_id, name, initial_capital, risk_pct, main_symbol, color, market, chart, days, schedule, execution, setup, management, contracts, is_shared
    ) VALUES (
      p_journal_id, p_user_id, 'Asia', 10000, 0.025, 'MNQ', '#6366F1', 'Asia · MNQ', '200 ticks', 'Martes, miércoles y jueves', '19:00 - 23:30 (NY)', 'Manual o bot', 'SL dinámico: ATR(14) × 6', 'TP 300 ticks (RR 1:2) · Riesgo de referencia 300', 'Según el plan de gestión de riesgo', true
    );
    v_inserted_count := v_inserted_count + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.strategies WHERE journal_id = p_journal_id AND name = 'Oro') THEN
    INSERT INTO public.strategies (
      journal_id, user_id, name, initial_capital, risk_pct, main_symbol, color, market, chart, days, schedule, execution, setup, management, contracts, is_shared
    ) VALUES (
      p_journal_id, p_user_id, 'Oro', 10000, 0.03, 'MGC', '#F59E0B', 'Asia / NY · Oro (GC / MGC)', '150 ticks', 'Lunes a jueves', '19:00 - 23:30 (NY)', 'Manual o bot', 'SL fijo: 150 ticks · 150 USD de riesgo por contrato', 'RR 1:1.5 · Break-even automático a +75 ticks', 'Según el plan de gestión de riesgo', true
    );
    v_inserted_count := v_inserted_count + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.strategies WHERE journal_id = p_journal_id AND name = 'Lite') THEN
    INSERT INTO public.strategies (
      journal_id, user_id, name, initial_capital, risk_pct, main_symbol, color, market, chart, days, schedule, execution, setup, management, contracts, is_shared
    ) VALUES (
      p_journal_id, p_user_id, 'Lite', 10000, 0.02, 'MNQ', '#EC4899', 'Nueva York · MNQ', '2 minutos', 'Lunes a viernes', '9:30 (apertura NY)', 'Manual', 'Monitorear las primeras 5 velas tras la apertura', 'RR 1:1', 'Según el plan de gestión de riesgo', true
    );
    v_inserted_count := v_inserted_count + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.strategies WHERE journal_id = p_journal_id AND name = 'Swing') THEN
    INSERT INTO public.strategies (
      journal_id, user_id, name, initial_capital, risk_pct, main_symbol, color, market, chart, days, schedule, execution, setup, management, contracts, is_shared
    ) VALUES (
      p_journal_id, p_user_id, 'Swing', 20000, 0.02, 'ES', '#8B5CF6', 'Futuros S&P 500 (ES / MES)', '1h / 4h / Diario', 'Semanal', 'Cierre de sesión / Apertura', 'Manual o bot', 'Retroceso en zona de equilibrio / Fibo 61.8%', 'Stop swing estructurado · TP ratio 1:3', '1 contrato MES / ES', true
    );
    v_inserted_count := v_inserted_count + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.strategies WHERE journal_id = p_journal_id AND name = 'Scalping') THEN
    INSERT INTO public.strategies (
      journal_id, user_id, name, initial_capital, risk_pct, main_symbol, color, market, chart, days, schedule, execution, setup, management, contracts, is_shared
    ) VALUES (
      p_journal_id, p_user_id, 'Scalping', 10000, 0.02, 'MNQ', '#14B8A6', 'Nueva York · Scalping MNQ / MGC', '1 minuto / 30 seg', 'Lunes a Viernes', '15:30 - 17:30 (Apertura y volatilidad)', 'Manual rápida', 'Rechazo en niveles de liquidez intradía · Micro-estructuras', 'Stop ceñido 10-15 ticks · TP rápido 20-30 ticks · Ratio 1:2', '1 a 3 contratos micro', true
    );
    v_inserted_count := v_inserted_count + 1;
  END IF;

  RETURN v_inserted_count;
END;
$$;

-- 3. Sembrar Scalping y renombrar IFT para todos los diarios existentes
DO $$
DECLARE
  j record;
BEGIN
  FOR j IN SELECT id, owner_id FROM public.journals LOOP
    PERFORM public.seed_user_strategies(j.id, j.owner_id);
  END LOOP;
END $$;
