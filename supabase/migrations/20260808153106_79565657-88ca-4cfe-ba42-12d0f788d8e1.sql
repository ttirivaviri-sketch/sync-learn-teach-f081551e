
CREATE OR REPLACE FUNCTION public.guard_profiles_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.is_suspended := OLD.is_suspended;
  NEW.suspended_at := OLD.suspended_at;
  NEW.suspended_reason := OLD.suspended_reason;
  NEW.is_official := OLD.is_official;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profiles_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profiles_privileged_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_privileged_columns();

CREATE OR REPLACE FUNCTION public.guard_tutor_verification_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.verification_status := OLD.verification_status;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.rejection_reason := OLD.rejection_reason;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_tutor_verification_columns ON public.tutor_verifications;
CREATE TRIGGER guard_tutor_verification_columns
BEFORE UPDATE ON public.tutor_verifications
FOR EACH ROW EXECUTE FUNCTION public.guard_tutor_verification_columns();
