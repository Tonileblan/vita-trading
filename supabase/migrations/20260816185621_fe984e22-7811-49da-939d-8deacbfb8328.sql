CREATE TABLE public.account_strategy_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  strategy_id uuid NOT NULL REFERENCES public.strategies(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_strategy_periods TO authenticated;
GRANT ALL ON public.account_strategy_periods TO service_role;

ALTER TABLE public.account_strategy_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages account_strategy_periods"
ON public.account_strategy_periods FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Supervisors read account_strategy_periods"
ON public.account_strategy_periods FOR SELECT TO authenticated
USING (is_supervisor(auth.uid()) AND (NOT is_private_user(user_id)));

CREATE POLICY "Anyone reads template account_strategy_periods"
ON public.account_strategy_periods FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.journals j WHERE j.id = account_strategy_periods.journal_id AND j.is_template = true));

CREATE TRIGGER account_strategy_periods_set_updated_at
BEFORE UPDATE ON public.account_strategy_periods
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX account_strategy_periods_account_idx ON public.account_strategy_periods (account_id, start_date);