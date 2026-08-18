-- Migración: Sembrar automáticamente las 6 estrategias del admin para todas las cuentas y diarios

-- 1. Actualizar seed_user_strategies con las 6 estrategias oficiales del admin
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
  -- Buscar un ID de administrador para obtener sus estrategias si las tiene
  SELECT user_id INTO v_admin_id
  FROM public.user_roles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  -- 1. Si existe administrador y tiene estrategias configuradas (y no es el mismo diario)
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

  -- 2. Si v_inserted_count es 0 (o no hay suficientes estrategias), insertar las 6 estrategias oficiales
  IF NOT EXISTS (SELECT 1 FROM public.strategies WHERE journal_id = p_journal_id) THEN
    INSERT INTO public.strategies (
      journal_id, user_id, name, initial_capital, risk_pct, main_symbol, color, market, chart, days, schedule, execution, setup, management, contracts, is_shared
    ) VALUES
      (p_journal_id, p_user_id, 'Principal', 10000, 0.03, 'MNQ', '#3B82F6', 'Nueva York · Nasdaq (MNQ / NQ)', '5 minutos', 'Lunes, martes, jueves y viernes', '9:31 - 11:00 (NY)', 'Manual o bot', 'SL: 210 ticks', 'TP2 (RR 1:2) · Break-even automático 170 ticks · BE Plus +4', '4 a 5 contratos de referencia; ajustar según gestión de riesgo', true),
      (p_journal_id, p_user_id, 'Fondeo', 10000, 0.03, 'MNQ', '#10B981', 'Nueva York · MNQ', '4.500 ticks', 'Martes a jueves', '9:00 - 16:00 (NY) · 2 sesiones por día', 'Solo bot', 'SL dinámico: ATR(14) × 4', 'RR 1:1', 'Según el plan de gestión de riesgo', true),
      (p_journal_id, p_user_id, 'Asia', 10000, 0.025, 'MNQ', '#6366F1', 'Asia · MNQ', '200 ticks', 'Martes, miércoles y jueves', '19:00 - 23:30 (NY)', 'Manual o bot', 'SL dinámico: ATR(14) × 6', 'TP 300 ticks (RR 1:2) · Riesgo de referencia 300', 'Según el plan de gestión de riesgo', true),
      (p_journal_id, p_user_id, 'Oro', 10000, 0.03, 'MGC', '#F59E0B', 'Asia / NY · Oro (GC / MGC)', '150 ticks', 'Lunes a jueves', '19:00 - 23:30 (NY)', 'Manual o bot', 'SL fijo: 150 ticks · 150 USD de riesgo por contrato', 'RR 1:1.5 · Break-even automático a +75 ticks', 'Según el plan de gestión de riesgo', true),
      (p_journal_id, p_user_id, 'Lite', 10000, 0.02, 'MNQ', '#EC4899', 'Nueva York · MNQ', '2 minutos', 'Lunes a viernes', '9:30 (apertura NY)', 'Manual', 'Monitorear las primeras 5 velas tras la apertura', 'RR 1:1', 'Según el plan de gestión de riesgo', true),
      (p_journal_id, p_user_id, 'Swing', 20000, 0.02, 'ES', '#8B5CF6', 'Futuros S&P 500 (ES / MES)', '1h / 4h / Diario', 'Semanal', 'Cierre de sesión / Apertura', 'Manual o bot', 'Retroceso en zona de equilibrio / Fibo 61.8%', 'Stop swing estructurado · TP ratio 1:3', '1 contrato MES / ES', true);
    v_inserted_count := 6;
  END IF;

  RETURN v_inserted_count;
END;
$$;

-- 2. Sembrar automáticamente para todos los diarios existentes que no tengan estrategias
DO $$
DECLARE
  j record;
BEGIN
  FOR j IN SELECT id, owner_id FROM public.journals LOOP
    IF NOT EXISTS (SELECT 1 FROM public.strategies WHERE journal_id = j.id) THEN
      PERFORM public.seed_user_strategies(j.id, j.owner_id);
    END IF;
  END LOOP;
END $$;
