CREATE INDEX IF NOT EXISTS accounts_journal_idx ON public.accounts (journal_id);
CREATE INDEX IF NOT EXISTS strategies_journal_idx ON public.strategies (journal_id);
CREATE INDEX IF NOT EXISTS withdrawals_journal_idx ON public.withdrawals (journal_id);
CREATE INDEX IF NOT EXISTS journals_owner_idx ON public.journals (owner_id);
CREATE INDEX IF NOT EXISTS journals_template_idx ON public.journals (is_template) WHERE is_template;
CREATE INDEX IF NOT EXISTS trades_journal_closed_idx ON public.trades (journal_id, closed_at DESC);