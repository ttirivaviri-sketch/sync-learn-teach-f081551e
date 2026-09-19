-- 1) blog_comments: stop exposing user_id publicly
DROP POLICY IF EXISTS "Blog comments are publicly readable" ON public.blog_comments;

CREATE POLICY "Readers can see their own comments, admins all"
ON public.blog_comments
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_blog_comments(_post_slug text)
RETURNS TABLE (
  id uuid,
  author_name text,
  body text,
  created_at timestamptz,
  is_mine boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id,
         c.author_name,
         c.body,
         c.created_at,
         (auth.uid() IS NOT NULL AND c.user_id = auth.uid()) AS is_mine
  FROM public.blog_comments c
  WHERE c.post_slug = _post_slug
  ORDER BY c.created_at DESC
  LIMIT 200
$$;

REVOKE ALL ON FUNCTION public.get_blog_comments(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_blog_comments(text) TO anon, authenticated, service_role;

-- 2) tutor_subjects: narrow blanket discovery read
DROP POLICY IF EXISTS "Authenticated users can view tutor subjects for discovery" ON public.tutor_subjects;

CREATE POLICY "Discovery limited to active tutor accounts"
ON public.tutor_subjects
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = public.tutor_subjects.user_id
      AND p.user_type = 'tutor'
      AND COALESCE(p.is_suspended, false) = false
  )
);