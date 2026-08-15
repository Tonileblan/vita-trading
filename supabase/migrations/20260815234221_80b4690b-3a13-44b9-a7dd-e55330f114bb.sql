ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_private_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.is_private FROM public.profiles p WHERE p.id = _user_id), false)
$$;
REVOKE ALL ON FUNCTION public.is_private_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_private_user(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Supervisors read accounts" ON public.accounts;
CREATE POLICY "Supervisors read accounts" ON public.accounts FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) AND NOT public.is_private_user(user_id));

DROP POLICY IF EXISTS "Supervisors read trades" ON public.trades;
CREATE POLICY "Supervisors read trades" ON public.trades FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) AND NOT public.is_private_user(user_id));

DROP POLICY IF EXISTS "Supervisors read strategies" ON public.strategies;
CREATE POLICY "Supervisors read strategies" ON public.strategies FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) AND NOT public.is_private_user(user_id));

DROP POLICY IF EXISTS "Supervisors read withdrawals" ON public.withdrawals;
CREATE POLICY "Supervisors read withdrawals" ON public.withdrawals FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) AND NOT public.is_private_user(user_id));

DROP POLICY IF EXISTS "Supervisors read journals" ON public.journals;
CREATE POLICY "Supervisors read journals" ON public.journals FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) AND NOT public.is_private_user(owner_id));

DROP POLICY IF EXISTS "Supervisors read profiles" ON public.profiles;
CREATE POLICY "Supervisors read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) AND NOT public.is_private_user(id));

DROP POLICY IF EXISTS "Supervisors read roles" ON public.user_roles;
CREATE POLICY "Supervisors read roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) AND NOT public.is_private_user(user_id));

DROP POLICY IF EXISTS "Thread participants read messages" ON public.chat_messages;
CREATE POLICY "Thread participants read messages" ON public.chat_messages FOR SELECT TO authenticated
  USING (auth.uid() = subject_user_id OR (public.is_supervisor(auth.uid()) AND NOT public.is_private_user(subject_user_id)));

DROP POLICY IF EXISTS "Thread participants send messages" ON public.chat_messages;
CREATE POLICY "Thread participants send messages" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND (auth.uid() = subject_user_id OR (public.is_supervisor(auth.uid()) AND NOT public.is_private_user(subject_user_id))));