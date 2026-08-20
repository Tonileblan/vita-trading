-- Migración: Módulo GO - Diseñador y Gestor de Planing Operativo
-- Tablas: trading_plans, trading_plan_slots, trading_plan_checklists

-- 1. Tabla principal de Planes de Trading
CREATE TABLE IF NOT EXISTS public.trading_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Plan Operativo Principal',
  is_active boolean NOT NULL DEFAULT true,
  weekly_risk_budget numeric NOT NULL DEFAULT 1500,
  daily_risk_budget numeric NOT NULL DEFAULT 400,
  max_daily_trades integer NOT NULL DEFAULT 3,
  max_loss_streak integer NOT NULL DEFAULT 2,
  profit_lock_target numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trading_plans_journal_user_unique UNIQUE (journal_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_plans TO authenticated;
GRANT ALL ON public.trading_plans TO service_role;

ALTER TABLE public.trading_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages trading_plans" ON public.trading_plans
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisors read trading_plans" ON public.trading_plans
  FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()));

CREATE TRIGGER trading_plans_set_updated_at
  BEFORE UPDATE ON public.trading_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS trading_plans_journal_idx ON public.trading_plans (journal_id);


-- 2. Tabla de Slots / Franjas del Horario Semanal (Lunes a Viernes: 1 a 5)
CREATE TABLE IF NOT EXISTS public.trading_plan_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.trading_plans(id) ON DELETE CASCADE,
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 5), -- 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes
  session_name text NOT NULL DEFAULT 'Sesión Principal', -- 'Londres', 'NY Apertura', 'NY Cierre', etc.
  start_time text NOT NULL DEFAULT '15:30',
  end_time text NOT NULL DEFAULT '17:30',
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  strategy_id uuid REFERENCES public.strategies(id) ON DELETE SET NULL,
  risk_amount numeric,
  risk_pct numeric,
  max_trades integer NOT NULL DEFAULT 2,
  allowed_symbols text DEFAULT 'MNQ, NQ',
  setup_notes text,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_plan_slots TO authenticated;
GRANT ALL ON public.trading_plan_slots TO service_role;

ALTER TABLE public.trading_plan_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages trading_plan_slots" ON public.trading_plan_slots
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisors read trading_plan_slots" ON public.trading_plan_slots
  FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()));

CREATE TRIGGER trading_plan_slots_set_updated_at
  BEFORE UPDATE ON public.trading_plan_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS trading_plan_slots_plan_day_idx ON public.trading_plan_slots (plan_id, day_of_week);


-- 3. Tabla de Checklists y Registros Diarios Pre-Flight
CREATE TABLE IF NOT EXISTS public.trading_plan_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.trading_plans(id) ON DELETE CASCADE,
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  slot_id uuid REFERENCES public.trading_plan_slots(id) ON DELETE SET NULL,
  checked_news boolean NOT NULL DEFAULT false,
  checked_levels boolean NOT NULL DEFAULT false,
  checked_mind boolean NOT NULL DEFAULT false,
  checked_risk boolean NOT NULL DEFAULT false,
  custom_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'active', -- 'pending', 'active', 'completed', 'skipped'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trading_plan_checklists_unique UNIQUE (journal_id, user_id, date, slot_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_plan_checklists TO authenticated;
GRANT ALL ON public.trading_plan_checklists TO service_role;

ALTER TABLE public.trading_plan_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages trading_plan_checklists" ON public.trading_plan_checklists
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisors read trading_plan_checklists" ON public.trading_plan_checklists
  FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()));

CREATE TRIGGER trading_plan_checklists_set_updated_at
  BEFORE UPDATE ON public.trading_plan_checklists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS trading_plan_checklists_date_idx ON public.trading_plan_checklists (journal_id, date);
