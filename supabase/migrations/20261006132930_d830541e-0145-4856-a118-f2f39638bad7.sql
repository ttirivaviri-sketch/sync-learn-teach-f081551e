UPDATE public.tutor_subjects SET hourly_rate = 300 WHERE hourly_rate IS NULL OR hourly_rate < 300;
ALTER TABLE public.tutor_subjects ALTER COLUMN hourly_rate SET DEFAULT 300;
CREATE OR REPLACE FUNCTION public.enforce_min_tutor_rate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.hourly_rate IS NULL THEN NEW.hourly_rate := 300; END IF;
  IF NEW.hourly_rate < 300 THEN
    RAISE EXCEPTION 'Minimum hourly rate is R300';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enforce_min_tutor_rate ON public.tutor_subjects;
CREATE TRIGGER trg_enforce_min_tutor_rate BEFORE INSERT OR UPDATE ON public.tutor_subjects
FOR EACH ROW EXECUTE FUNCTION public.enforce_min_tutor_rate();