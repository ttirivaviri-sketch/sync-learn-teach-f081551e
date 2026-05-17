
-- ============================================================
-- Tutor & Learner onboarding overhaul
-- ============================================================

-- A1. Trial trigger only fires for learners
CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only learners get a subscription/trial. Tutors are service providers.
  IF COALESCE(NEW.raw_user_meta_data->>'user_type', 'learner') <> 'learner' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.subscriptions (user_id, plan, trial_start, trial_end, status)
  VALUES (NEW.id, 'free', now(), now() + interval '7 days', 'trial')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- A2. Extend tutor_verifications
ALTER TABLE public.tutor_verifications
  ADD COLUMN IF NOT EXISTS student_status TEXT,
  ADD COLUMN IF NOT EXISTS transcript_url TEXT,
  ADD COLUMN IF NOT EXISTS qualification_url TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- Allow admin to view + update any verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tutor_verifications' AND policyname='Admins can view all verifications'
  ) THEN
    CREATE POLICY "Admins can view all verifications"
      ON public.tutor_verifications FOR SELECT
      USING (public.has_role(auth.uid(),'admin'::app_role));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tutor_verifications' AND policyname='Admins can update any verification'
  ) THEN
    CREATE POLICY "Admins can update any verification"
      ON public.tutor_verifications FOR UPDATE
      USING (public.has_role(auth.uid(),'admin'::app_role));
  END IF;
END $$;

-- A3. Tutor teaching profile (curriculums, grades, bio)
CREATE TABLE IF NOT EXISTS public.tutor_teaching_profile (
  user_id UUID PRIMARY KEY,
  curriculums TEXT[] NOT NULL DEFAULT '{}',
  grades TEXT[] NOT NULL DEFAULT '{}',
  bio TEXT,
  teaching_style TEXT,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tutor_teaching_profile ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tutor_teaching_profile' AND policyname='Tutor can view own teaching profile') THEN
    CREATE POLICY "Tutor can view own teaching profile" ON public.tutor_teaching_profile
      FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tutor_teaching_profile' AND policyname='Tutor can upsert own teaching profile') THEN
    CREATE POLICY "Tutor can upsert own teaching profile" ON public.tutor_teaching_profile
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tutor_teaching_profile' AND policyname='Tutor can update own teaching profile') THEN
    CREATE POLICY "Tutor can update own teaching profile" ON public.tutor_teaching_profile
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TRIGGER trg_tutor_teaching_profile_updated_at
BEFORE UPDATE ON public.tutor_teaching_profile
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- B2. Track learner onboarding completion (subscription step)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- D5. Curriculum topic templates (shared across learners)
CREATE TABLE IF NOT EXISTS public.curriculum_topic_templates (
  curriculum TEXT NOT NULL,
  grade TEXT NOT NULL,
  subject TEXT NOT NULL,
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'ai',
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (curriculum, grade, subject)
);
ALTER TABLE public.curriculum_topic_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='curriculum_topic_templates' AND policyname='Anyone authenticated can read templates') THEN
    CREATE POLICY "Anyone authenticated can read templates"
      ON public.curriculum_topic_templates FOR SELECT
      TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='curriculum_topic_templates' AND policyname='Admins manage templates') THEN
    CREATE POLICY "Admins manage templates"
      ON public.curriculum_topic_templates FOR ALL
      USING (public.has_role(auth.uid(),'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
  END IF;
END $$;

CREATE TRIGGER trg_curriculum_topic_templates_updated_at
BEFORE UPDATE ON public.curriculum_topic_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- D3. Subject coverage audit
CREATE TABLE IF NOT EXISTS public.subject_coverage_audit (
  subject_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  total_topics INT NOT NULL DEFAULT 0,
  covered_topics INT NOT NULL DEFAULT 0,
  mastered_topics INT NOT NULL DEFAULT 0,
  last_audit_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subject_coverage_audit ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subject_coverage_audit' AND policyname='Owner reads coverage') THEN
    CREATE POLICY "Owner reads coverage" ON public.subject_coverage_audit
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Helper: did learner complete the subscription step?
CREATE OR REPLACE FUNCTION public.mark_learner_onboarding_complete()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET onboarding_completed_at = COALESCE(onboarding_completed_at, now())
  WHERE id = auth.uid();
END;
$function$;
