CREATE POLICY "Admins can read syllabus uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'syllabus-uploads' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upload syllabus uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'syllabus-uploads' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update syllabus uploads"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'syllabus-uploads' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'syllabus-uploads' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete syllabus uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'syllabus-uploads' AND public.has_role(auth.uid(), 'admin'));

GRANT DELETE ON public.curriculum_syllabus_sources TO authenticated;

CREATE POLICY "Admins can delete syllabus sources"
  ON public.curriculum_syllabus_sources FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));