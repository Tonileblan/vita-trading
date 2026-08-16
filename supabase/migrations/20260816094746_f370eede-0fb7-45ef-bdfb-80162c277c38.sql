ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;

CREATE POLICY "Anyone reads template journals" ON public.journals FOR SELECT TO authenticated USING (is_template = true);

CREATE POLICY "Anyone reads template strategies" ON public.strategies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.journals j WHERE j.id = journal_id AND j.is_template = true));

CREATE POLICY "Anyone reads template accounts" ON public.accounts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.journals j WHERE j.id = journal_id AND j.is_template = true));

CREATE POLICY "Anyone reads template trades" ON public.trades FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.journals j WHERE j.id = journal_id AND j.is_template = true));

CREATE POLICY "Anyone reads template withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.journals j WHERE j.id = journal_id AND j.is_template = true));

CREATE POLICY "Anyone reads template expenses" ON public.expenses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.journals j WHERE j.id = journal_id AND j.is_template = true));

CREATE POLICY "Anyone reads template rules" ON public.journal_rules FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.journals j WHERE j.id = journal_id AND j.is_template = true));

CREATE POLICY "Anyone reads template mood_checkins" ON public.mood_checkins FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.journals j WHERE j.id = journal_id AND j.is_template = true));