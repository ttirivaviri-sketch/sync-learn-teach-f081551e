-- 1) Server-side booking price enforcement -------------------------------
CREATE OR REPLACE FUNCTION public.enforce_booking_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate numeric;
  v_owner uuid;
  v_expected numeric;
BEGIN
  SELECT ts.hourly_rate, ts.user_id INTO v_rate, v_owner
  FROM public.tutor_subjects ts
  WHERE ts.id = NEW.tutor_subject_id;

  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'Invalid tutor subject for booking';
  END IF;

  IF v_owner IS DISTINCT FROM NEW.tutor_id THEN
    RAISE EXCEPTION 'Tutor subject does not belong to the selected tutor';
  END IF;

  IF NEW.duration_minutes IS NULL OR NEW.duration_minutes <= 0 THEN
    RAISE EXCEPTION 'Invalid booking duration';
  END IF;

  v_expected := round(v_rate * (NEW.duration_minutes::numeric / 60.0), 2);

  -- Admins may override (manual corrections / allocations); everyone else is
  -- forced onto the tutor's authoritative rate.
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.price := v_expected;
  ELSIF NEW.price IS NULL THEN
    NEW.price := v_expected;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_price ON public.bookings;
CREATE TRIGGER trg_enforce_booking_price
BEFORE INSERT OR UPDATE OF price, duration_minutes, tutor_subject_id, tutor_id
ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_price();

-- 2) RLS policies for tables that had RLS on but no policy ---------------
DROP POLICY IF EXISTS "ai_response_cache admin read" ON public.ai_response_cache;
CREATE POLICY "ai_response_cache admin read"
ON public.ai_response_cache FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "ip_rate_limit_counters admin read" ON public.ip_rate_limit_counters;
CREATE POLICY "ip_rate_limit_counters admin read"
ON public.ip_rate_limit_counters FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Move extensions out of the public schema ----------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
DO $$
BEGIN
  BEGIN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm move skipped: %', SQLERRM;
  END;
  BEGIN
    ALTER EXTENSION vector SET SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'vector move skipped: %', SQLERRM;
  END;
END $$;

-- 4) Lock down EXECUTE on SECURITY DEFINER functions ---------------------
DO $$
DECLARE
  r record;
  anon_allow text[] := ARRAY[
    'has_role','is_class_teacher','is_enrolled_in_class','is_school_member',
    'get_public_qualifications','get_published_tutorials','get_tutor_directory',
    'get_invitation_summary','get_overall_leaderboard','get_subject_leaderboard'
  ];
  auth_allow text[] := ARRAY[
    'accept_guardian_invite','accept_school_invitation','accept_workspace_invitation',
    'admin_study_completion_rate','admin_study_mastery_progression','admin_study_regen_usage',
    'check_mock_exam_unlock','check_school_ai_quota','class_topic_affected_students',
    'ensure_studysync_team_conversation','expire_stale_topic_sessions',
    'generate_allocation_bookings','generate_workspace_invite_token','get_exam_readiness',
    'get_homework_questions_for_student','get_invitation_summary','get_overall_leaderboard',
    'get_public_qualifications','get_published_tutorials','get_quiz_questions_for_student',
    'get_student_analytics','get_subject_context','get_subject_leaderboard',
    'get_tutor_busy_slots','get_tutor_directory','get_upstream_prerequisites','has_role',
    'increment_school_ai_usage','is_any_los_staff','is_los_workspace_staff',
    'learner_weekly_digest','log_security_event','mark_learner_onboarding_complete',
    'match_school_chunks','materialize_concept_prerequisite_edges','notify_allocation_event',
    'promote_concept_ingestion','rebuild_school_analytics_today','rebuild_student_analytics_today',
    'record_automation_run_finish','record_automation_run_start','refresh_student_context_snapshot',
    'remediation_effectiveness','request_tutor_withdrawal','resolve_payout_request',
    'route_interventions_to_teachers','run_nightly_intervention_sweep','run_study_plan_optimizer',
    'run_weekly_cohort_rollup','school_topic_affected_students','set_subscription_plan',
    'start_topic_session','submit_school_quiz_attempt','upsert_academic_profile',
    'current_school_ids','current_user_verified_email','has_conversation_access',
    'has_shared_relationship','get_ai_usage_today','get_class_misconception_digest',
    'get_guardian_learner_overview','get_study_memory_context','check_and_increment_ai_usage',
    'is_class_teacher','is_enrolled_in_class','is_school_member'
  ];
  policy_fns text[];
BEGIN
  -- keep EXECUTE for anything referenced from an RLS policy expression
  SELECT coalesce(array_agg(DISTINCT p.proname), '{}')
    INTO policy_fns
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_policies pol ON pol.schemaname IN ('public','storage')
   AND (coalesce(pol.qual,'') || coalesce(pol.with_check,'')) LIKE '%' || p.proname || '(%'
  WHERE n.nspname = 'public' AND p.prosecdef;

  FOR r IN
    SELECT p.oid, p.proname, p.prorettype = 'trigger'::regtype AS is_trigger,
           format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    IF r.is_trigger THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    ELSE
      IF NOT (r.proname = ANY(anon_allow)) AND NOT (r.proname = ANY(policy_fns)) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
      END IF;
      IF NOT (r.proname = ANY(auth_allow)) AND NOT (r.proname = ANY(policy_fns)) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
      ELSE
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
      END IF;
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;