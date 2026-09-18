CREATE OR REPLACE FUNCTION public.get_public_bookable_tutors()
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  online_status boolean,
  last_seen timestamptz,
  rating numeric,
  total_reviews integer,
  subjects jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    p.bio,
    COALESCE(p.online_status, false) AS online_status,
    p.last_seen,
    COALESCE(r.avg_rating, 0)::numeric AS rating,
    COALESCE(r.review_count, 0)::int AS total_reviews,
    COALESCE(s.subjects, '[]'::jsonb) AS subjects
  FROM public.profiles p
  LEFT JOIN (
    SELECT ts.user_id,
           jsonb_agg(
             jsonb_build_object(
               'id', ts.id,
               'subject', ts.subject,
               'level', ts.level,
               'hourly_rate', ts.hourly_rate
             ) ORDER BY ts.subject
           ) AS subjects
    FROM public.tutor_subjects ts
    GROUP BY ts.user_id
  ) s ON s.user_id = p.id
  LEFT JOIN (
    SELECT rv.reviewed_id, AVG(rv.rating) AS avg_rating, COUNT(*) AS review_count
    FROM public.reviews rv
    GROUP BY rv.reviewed_id
  ) r ON r.reviewed_id = p.id
  WHERE p.user_type = 'tutor'
    AND COALESCE(p.is_suspended, false) = false
    AND s.subjects IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_public_bookable_tutors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_bookable_tutors() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_public_tutor_availability(_tutor_id uuid)
RETURNS TABLE(
  id uuid,
  day_of_week integer,
  start_time time,
  end_time time
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ta.id, ta.day_of_week, ta.start_time, ta.end_time
  FROM public.tutor_availability ta
  WHERE ta.tutor_id = _tutor_id
    AND ta.is_available = true
  ORDER BY ta.day_of_week, ta.start_time;
$$;

REVOKE ALL ON FUNCTION public.get_public_tutor_availability(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tutor_availability(uuid) TO anon, authenticated, service_role;