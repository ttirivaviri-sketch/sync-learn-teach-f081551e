-- Create public bucket for cached question diagrams
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-diagrams', 'question-diagrams', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Question diagrams are publicly viewable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'question-diagrams');

-- Only service role uploads (no client-side INSERT policy = denied for anon/authenticated)
-- Service role bypasses RLS so edge functions can write freely.