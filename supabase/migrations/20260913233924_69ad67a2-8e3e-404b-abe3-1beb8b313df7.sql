DROP POLICY IF EXISTS "Admins can upload library diagrams" ON storage.objects;
CREATE POLICY "Admins can upload library diagrams"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'library-diagrams' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update library diagrams" ON storage.objects;
CREATE POLICY "Admins can update library diagrams"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'library-diagrams' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'library-diagrams' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete library diagrams" ON storage.objects;
CREATE POLICY "Admins can delete library diagrams"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'library-diagrams' AND public.has_role(auth.uid(), 'admin'));

COMMENT ON FUNCTION public.is_class_teacher(uuid) IS
  'SECURITY DEFINER RLS helper. Resolves the caller via auth.uid() internally. Do NOT add a caller-supplied user_id parameter: that would let any user assert another user''s class-teacher rights and bypass RLS.';
COMMENT ON FUNCTION public.is_enrolled_in_class(uuid) IS
  'SECURITY DEFINER RLS helper. Resolves the caller via auth.uid() internally. Do NOT add a caller-supplied user_id parameter: that would let any user assert another user''s enrollment and bypass RLS.';
COMMENT ON FUNCTION public.is_school_member(uuid, app_role) IS
  'SECURITY DEFINER RLS helper. Resolves the caller via auth.uid() internally. Do NOT add a caller-supplied user_id parameter: that would let any user assert another user''s school membership and bypass RLS.';