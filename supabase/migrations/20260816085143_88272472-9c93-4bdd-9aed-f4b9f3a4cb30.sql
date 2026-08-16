ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS import_batch_id uuid;
CREATE INDEX IF NOT EXISTS trades_journal_import_batch_idx ON public.trades (journal_id, import_batch_id);