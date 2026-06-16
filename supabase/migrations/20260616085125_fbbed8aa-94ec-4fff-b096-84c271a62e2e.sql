
CREATE TABLE IF NOT EXISTS public.student_context_snapshots (
  user_id uuid PRIMARY KEY,
  school_id uuid,
  grade_id uuid,
  class_ids uuid[] NOT NULL DEFAULT '{}',
  teacher_ids uuid[] NOT NULL DEFAULT '{}',
  subject_ids uuid[] NOT NULL DEFAULT '{}',
  curriculum text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.student_context_snapshots TO authenticated;
GRANT ALL ON public.student_context_snapshots TO service_role;

ALTER TABLE public.student_context_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learner can read own context snapshot"
  ON public.student_context_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "School staff can read tenant snapshots"
  ON public.student_context_snapshots FOR SELECT
  TO authenticated
  USING (
    school_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.school_memberships m
      WHERE m.school_id = student_context_snapshots.school_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('school_admin','school_teacher')
    )
  );

CREATE INDEX IF NOT EXISTS idx_student_context_snapshots_school
  ON public.student_context_snapshots(school_id);

CREATE OR REPLACE FUNCTION public.refresh_student_context_snapshot(_user_id uuid)
RETURNS public.student_context_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_grade_id uuid;
  v_class_ids uuid[];
  v_teacher_ids uuid[];
  v_subject_ids uuid[];
  v_curriculum text;
  v_row public.student_context_snapshots;
BEGIN
  -- Resolve school membership (learner only).
  SELECT m.school_id
    INTO v_school_id
    FROM public.school_memberships m
   WHERE m.user_id = _user_id
     AND m.status = 'active'
     AND m.role = 'school_learner'
   LIMIT 1;

  -- Classes the student is enrolled in.
  SELECT COALESCE(array_agg(DISTINCT e.class_id), '{}')
    INTO v_class_ids
    FROM public.enrollments e
   WHERE e.student_id = _user_id
     AND e.status = 'active';

  -- Grade — pull from the first class (assume one grade per learner).
  SELECT c.grade_id
    INTO v_grade_id
    FROM public.classes c
   WHERE c.id = ANY(v_class_ids)
   LIMIT 1;

  -- Teachers via class_subjects.
  SELECT COALESCE(array_agg(DISTINCT cs.teacher_id), '{}'),
         COALESCE(array_agg(DISTINCT cs.subject_id), '{}')
    INTO v_teacher_ids, v_subject_ids
    FROM public.class_subjects cs
   WHERE cs.class_id = ANY(v_class_ids);

  -- Curriculum from academic profile.
  SELECT ap.curriculum
    INTO v_curriculum
    FROM public.academic_profiles ap
   WHERE ap.user_id = _user_id
   LIMIT 1;

  INSERT INTO public.student_context_snapshots AS s
    (user_id, school_id, grade_id, class_ids, teacher_ids, subject_ids, curriculum, context, refreshed_at)
  VALUES
    (_user_id, v_school_id, v_grade_id, v_class_ids, v_teacher_ids, v_subject_ids, v_curriculum,
     jsonb_build_object('source','refresh_student_context_snapshot'), now())
  ON CONFLICT (user_id) DO UPDATE
     SET school_id    = EXCLUDED.school_id,
         grade_id     = EXCLUDED.grade_id,
         class_ids    = EXCLUDED.class_ids,
         teacher_ids  = EXCLUDED.teacher_ids,
         subject_ids  = EXCLUDED.subject_ids,
         curriculum   = EXCLUDED.curriculum,
         refreshed_at = now(),
         updated_at   = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_student_context_snapshot(uuid) TO authenticated, service_role;

-- Auto-refresh trigger on enrollment changes.
CREATE OR REPLACE FUNCTION public.trg_refresh_context_on_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_student_context_snapshot(COALESCE(NEW.student_id, OLD.student_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS enrollments_refresh_context ON public.enrollments;
CREATE TRIGGER enrollments_refresh_context
AFTER INSERT OR UPDATE OR DELETE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_context_on_enrollment();
