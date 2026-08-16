ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS emotion_before text,
  ADD COLUMN IF NOT EXISTS emotion_after text,
  ADD COLUMN IF NOT EXISTS followed_plan text,
  ADD COLUMN IF NOT EXISTS mistakes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS emotion_note text;

CREATE TABLE public.mood_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  mood smallint NOT NULL DEFAULT 3,
  energy smallint NOT NULL DEFAULT 3,
  stress smallint NOT NULL DEFAULT 3,
  focus smallint NOT NULL DEFAULT 3,
  sleep_hours numeric,
  intention text,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journal_id, user_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mood_checkins TO authenticated;
GRANT ALL ON public.mood_checkins TO service_role;
ALTER TABLE public.mood_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages mood_checkins" ON public.mood_checkins FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Supervisors read mood_checkins" ON public.mood_checkins FOR SELECT TO authenticated
  USING (is_supervisor(auth.uid()) AND (NOT is_private_user(user_id)));
CREATE TRIGGER mood_checkins_set_updated_at BEFORE UPDATE ON public.mood_checkins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.journal_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  max_loss_streak integer NOT NULL DEFAULT 3,
  max_trades_day integer NOT NULL DEFAULT 5,
  max_daily_loss numeric,
  require_checkin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journal_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_rules TO authenticated;
GRANT ALL ON public.journal_rules TO service_role;
ALTER TABLE public.journal_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages journal_rules" ON public.journal_rules FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Supervisors read journal_rules" ON public.journal_rules FOR SELECT TO authenticated
  USING (is_supervisor(auth.uid()) AND (NOT is_private_user(user_id)));
CREATE TRIGGER journal_rules_set_updated_at BEFORE UPDATE ON public.journal_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();