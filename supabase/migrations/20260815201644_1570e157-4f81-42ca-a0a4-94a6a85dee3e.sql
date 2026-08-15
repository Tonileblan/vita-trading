CREATE OR REPLACE FUNCTION public.is_supervisor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','supervisor')
  )
$$;

-- ACCOUNTS
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'personal',
  firm text,
  initial_balance numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  drawdown_limit numeric,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages accounts" ON public.accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Supervisors read accounts" ON public.accounts FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()));
CREATE TRIGGER accounts_set_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STRATEGIES
CREATE TABLE public.strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  initial_capital numeric NOT NULL DEFAULT 0,
  risk_pct numeric NOT NULL DEFAULT 0.01,
  main_symbol text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#888888',
  market text, chart text, days text, schedule text,
  execution text, setup text, management text, contracts text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategies TO authenticated;
GRANT ALL ON public.strategies TO service_role;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages strategies" ON public.strategies FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Supervisors read strategies" ON public.strategies FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()));
CREATE TRIGGER strategies_set_updated_at BEFORE UPDATE ON public.strategies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TRADES
CREATE TABLE public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  strategy_id uuid REFERENCES public.strategies(id) ON DELETE SET NULL,
  symbol text NOT NULL,
  direction text NOT NULL DEFAULT 'long',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz NOT NULL DEFAULT now(),
  entry_price numeric NOT NULL DEFAULT 0,
  exit_price numeric NOT NULL DEFAULT 0,
  size numeric NOT NULL DEFAULT 1,
  pnl numeric NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  screenshots text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages trades" ON public.trades FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Supervisors read trades" ON public.trades FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()));
CREATE TRIGGER trades_set_updated_at BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX trades_journal_idx ON public.trades(journal_id);
CREATE INDEX trades_user_idx ON public.trades(user_id);

-- WITHDRAWALS
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  strategy_id uuid REFERENCES public.strategies(id) ON DELETE CASCADE,
  date timestamptz NOT NULL DEFAULT now(),
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages withdrawals" ON public.withdrawals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Supervisors read withdrawals" ON public.withdrawals FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()));
CREATE TRIGGER withdrawals_set_updated_at BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SUPERVISOR READ ACCESS TO JOURNALS AND PROFILES
CREATE POLICY "Supervisors read journals" ON public.journals FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()));
CREATE POLICY "Supervisors read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()));
CREATE POLICY "Supervisors read roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()));

-- CHAT
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Thread participants read messages" ON public.chat_messages FOR SELECT TO authenticated
  USING (auth.uid() = subject_user_id OR public.is_supervisor(auth.uid()));
CREATE POLICY "Thread participants send messages" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND (auth.uid() = subject_user_id OR public.is_supervisor(auth.uid())));
CREATE INDEX chat_messages_subject_idx ON public.chat_messages(subject_user_id, created_at);