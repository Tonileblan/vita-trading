CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  journal_id uuid REFERENCES public.journals(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'other',
  concept text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  date timestamp with time zone NOT NULL DEFAULT now(),
  recurrence text NOT NULL DEFAULT 'none',
  recurrence_end timestamp with time zone,
  paid boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Supervisors read expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) AND (NOT public.is_private_user(user_id)));

CREATE INDEX expenses_user_journal_idx ON public.expenses (user_id, journal_id, date DESC);

CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();