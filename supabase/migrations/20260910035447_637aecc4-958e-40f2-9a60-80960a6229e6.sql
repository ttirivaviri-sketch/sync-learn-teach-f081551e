CREATE OR REPLACE FUNCTION public.get_tutor_reviews(_tutor_id uuid)
RETURNS TABLE(rating integer, comment text, created_at timestamptz, reviewer_first_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.rating,
    r.comment,
    r.created_at,
    COALESCE(NULLIF(split_part(p.full_name, ' ', 1), ''), 'Student') AS reviewer_first_name
  FROM public.reviews r
  LEFT JOIN public.profiles p ON p.id = r.reviewer_id
  WHERE r.reviewed_id = _tutor_id
  ORDER BY r.created_at DESC
  LIMIT 50
$$;

REVOKE ALL ON FUNCTION public.get_tutor_reviews(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tutor_reviews(uuid) TO authenticated;