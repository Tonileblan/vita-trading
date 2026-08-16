ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS requested_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.validate_withdrawal_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'status must be pending, approved or rejected';
  END IF;
  IF NEW.status = 'approved' AND NEW.approved_at IS NULL THEN
    NEW.approved_at = now();
  END IF;
  IF NEW.status <> 'approved' THEN
    NEW.approved_at = NULL;
  END IF;
  IF NEW.requested_at IS NULL THEN
    NEW.requested_at = COALESCE(NEW.date, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS withdrawals_validate_status ON public.withdrawals;
CREATE TRIGGER withdrawals_validate_status
BEFORE INSERT OR UPDATE ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.validate_withdrawal_status();