ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS drawdown_type text NOT NULL DEFAULT 'static';