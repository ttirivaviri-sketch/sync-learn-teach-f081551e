CREATE OR REPLACE FUNCTION public.guard_student_grade_columns_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF current_setting('app.grading_context', true) = 'on' THEN RETURN NEW; END IF;
  IF v_uid IS NULL OR v_uid IS DISTINCT FROM NEW.student_id THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'school_homework_responses' THEN
    NEW.ai_score := NULL;
    NEW.teacher_score := NULL;
    NEW.released_at := NULL;
    IF NEW.status IS NOT NULL AND NEW.status NOT IN ('draft','submitted') THEN
      NEW.status := 'draft';
    END IF;
  ELSIF TG_TABLE_NAME = 'submissions' THEN
    NEW.score := NULL;
    NEW.feedback := NULL;
    NEW.graded_by := NULL;
    NEW.graded_at := NULL;
    IF NEW.status IS NOT NULL AND NEW.status::text IN ('graded','returned') THEN
      NEW.status := 'draft';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_student_grade_columns_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_grades_hw_responses_ins ON public.school_homework_responses;
CREATE TRIGGER trg_guard_grades_hw_responses_ins
BEFORE INSERT ON public.school_homework_responses
FOR EACH ROW EXECUTE FUNCTION public.guard_student_grade_columns_insert();

DROP TRIGGER IF EXISTS trg_guard_grades_submissions_ins ON public.submissions;
CREATE TRIGGER trg_guard_grades_submissions_ins
BEFORE INSERT ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_student_grade_columns_insert();

CREATE OR REPLACE FUNCTION public.guard_tutor_verification_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  NEW.verification_status := 'pending';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  NEW.rejection_reason := NULL;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_tutor_verification_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_tutor_verification_insert ON public.tutor_verifications;
CREATE TRIGGER trg_guard_tutor_verification_insert
BEFORE INSERT ON public.tutor_verifications
FOR EACH ROW EXECUTE FUNCTION public.guard_tutor_verification_insert();

CREATE OR REPLACE FUNCTION public.guard_profiles_privileged_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  NEW.is_official := false;
  NEW.is_suspended := false;
  NEW.suspended_at := NULL;
  NEW.suspended_reason := NULL;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_profiles_privileged_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_profiles_privileged_insert ON public.profiles;
CREATE TRIGGER trg_guard_profiles_privileged_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_privileged_insert();