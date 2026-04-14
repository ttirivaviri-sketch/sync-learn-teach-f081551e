-- Create the tutor-videos public storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('tutor-videos', 'tutor-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view/download videos (public bucket)
CREATE POLICY "Anyone can view tutor videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'tutor-videos');

-- Authenticated users can upload under their own folder
CREATE POLICY "Tutors can upload own videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tutor-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Authenticated users can delete their own videos
CREATE POLICY "Tutors can delete own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tutor-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);