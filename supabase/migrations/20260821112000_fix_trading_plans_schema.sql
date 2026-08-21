-- Migración: Corregir restricciones de trading_plans para soportar múltiples planes por usuario/diario
-- y permitir sincronización transparente en móviles y web

-- 1. Eliminar restricción de plan único por diario/usuario si existe
ALTER TABLE public.trading_plans DROP CONSTRAINT IF EXISTS trading_plans_journal_user_unique;

-- 2. Asegurar que las políticas RLS permitan acceso completo al propietario del diario o del plan
DROP POLICY IF EXISTS "Owner manages trading_plans" ON public.trading_plans;
DROP POLICY IF EXISTS "Supervisors read trading_plans" ON public.trading_plans;

CREATE POLICY "Owner manages trading_plans" ON public.trading_plans
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    OR journal_id IN (SELECT id FROM public.journals WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR journal_id IN (SELECT id FROM public.journals WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Supervisors read trading_plans" ON public.trading_plans
  FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()));

-- 3. Políticas RLS para trading_plan_slots
DROP POLICY IF EXISTS "Owner manages trading_plan_slots" ON public.trading_plan_slots;
DROP POLICY IF EXISTS "Supervisors read trading_plan_slots" ON public.trading_plan_slots;

CREATE POLICY "Owner manages trading_plan_slots" ON public.trading_plan_slots
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    OR journal_id IN (SELECT id FROM public.journals WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR journal_id IN (SELECT id FROM public.journals WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Supervisors read trading_plan_slots" ON public.trading_plan_slots
  FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()));

-- 4. Políticas RLS para trading_plan_checklists
DROP POLICY IF EXISTS "Owner manages trading_plan_checklists" ON public.trading_plan_checklists;
DROP POLICY IF EXISTS "Supervisors read trading_plan_checklists" ON public.trading_plan_checklists;

CREATE POLICY "Owner manages trading_plan_checklists" ON public.trading_plan_checklists
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    OR journal_id IN (SELECT id FROM public.journals WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR journal_id IN (SELECT id FROM public.journals WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Supervisors read trading_plan_checklists" ON public.trading_plan_checklists
  FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()));
