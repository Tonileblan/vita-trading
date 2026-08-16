ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'eval',
  ADD COLUMN IF NOT EXISTS profit_target numeric;