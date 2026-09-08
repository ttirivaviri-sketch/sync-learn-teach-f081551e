CREATE TABLE public.community_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  curriculum text,
  grade_level text,
  source text NOT NULL DEFAULT 'landing',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX community_signups_email_lower_idx
  ON public.community_signups (lower(email));

GRANT INSERT, UPDATE ON public.community_signups TO anon;
GRANT INSERT, UPDATE ON public.community_signups TO authenticated;
GRANT ALL ON public.community_signups TO service_role;

ALTER TABLE public.community_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join the community"
  ON public.community_signups FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can refresh their own submission"
  ON public.community_signups FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read community signups"
  ON public.community_signups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_community_signups_updated_at
  BEFORE UPDATE ON public.community_signups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();