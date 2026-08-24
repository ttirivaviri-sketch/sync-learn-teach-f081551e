DROP POLICY IF EXISTS "Authenticated can read library diagrams" ON storage.objects;
CREATE POLICY "Authenticated can read library diagrams"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'library-diagrams');