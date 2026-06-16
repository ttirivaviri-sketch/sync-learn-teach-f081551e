CREATE OR REPLACE FUNCTION public.refresh_student_context_snapshot(_user_id uuid)
 RETURNS student_context_snapshots
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_school_id uuid;
  v_grade_id uuid;
  v_class_ids uuid[];
  v_teacher_ids uuid[];
  v_subject_ids uuid[];
  v_curriculum text;
  v_row public.student_context_snapshots;
BEGIN
  SELECT m.school_id
    INTO v_school_id
    FROM public.school_memberships m
   WHERE m.user_id = _user_id
     AND m.status = 'active'
     AND m.role = 'school_student'
   LIMIT 1;

  SELECT COALESCE(array_agg(DISTINCT e.class_id), '{}')
    INTO v_class_ids
    FROM public.enrollments e
   WHERE e.student_id = _user_id
     AND e.status = 'active';

  SELECT c.grade_id
    INTO v_grade_id
    FROM public.classes c
   WHERE c.id = ANY(v_class_ids)
   LIMIT 1;

  SELECT COALESCE(array_agg(DISTINCT cs.teacher_id), '{}'),
         COALESCE(array_agg(DISTINCT cs.subject_id), '{}')
    INTO v_teacher_ids, v_subject_ids
    FROM public.class_subjects cs
   WHERE cs.class_id = ANY(v_class_ids);

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
$function$;