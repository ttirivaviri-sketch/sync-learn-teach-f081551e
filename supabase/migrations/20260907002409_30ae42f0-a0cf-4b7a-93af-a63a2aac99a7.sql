CREATE TABLE IF NOT EXISTS public.curriculum_syllabus_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum text NOT NULL,
  subject text NOT NULL,
  grade text,
  name text NOT NULL,
  source_url text,
  storage_path text,
  content text,
  char_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error text,
  fetched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS curriculum_syllabus_sources_key
  ON public.curriculum_syllabus_sources (curriculum, subject, name);
CREATE INDEX IF NOT EXISTS curriculum_syllabus_sources_lookup
  ON public.curriculum_syllabus_sources (curriculum, subject);

GRANT SELECT ON public.curriculum_syllabus_sources TO authenticated;
GRANT ALL ON public.curriculum_syllabus_sources TO service_role;

ALTER TABLE public.curriculum_syllabus_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read syllabus sources"
  ON public.curriculum_syllabus_sources FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_curriculum_syllabus_sources_updated_at
  BEFORE UPDATE ON public.curriculum_syllabus_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();