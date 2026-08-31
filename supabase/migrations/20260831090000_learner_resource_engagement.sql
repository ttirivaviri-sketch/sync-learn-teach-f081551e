-- Learner ↔ library-resource engagement: persistent saves (bookmarks),
-- likes, and open/watch history. Replaces the in-memory "Saved" list that
-- was lost on every refresh, and gives ranking a real quality signal.

CREATE TABLE IF NOT EXISTS public.learner_resource_engagement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Resource ids come from two tables (library_system_resources uuid /
  -- tutor_tutorials uuid) — store as text with the source discriminator.
  resource_id text NOT NULL,
  resource_source text NOT NULL DEFAULT 'system'
    CHECK (resource_source IN ('system', 'tutorial')),
  saved boolean NOT NULL DEFAULT false,
  liked boolean NOT NULL DEFAULT false,
  open_count integer NOT NULL DEFAULT 0,
  last_opened_at timestamptz,
  -- Watch history (clips): incremented when a clip is actively viewed.
  watch_count integer NOT NULL DEFAULT 0,
  last_watched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_lre_user_saved
  ON public.learner_resource_engagement (user_id) WHERE saved;
CREATE INDEX IF NOT EXISTS idx_lre_user_opened
  ON public.learner_resource_engagement (user_id, last_opened_at DESC);
-- Aggregate like-counts per resource (quality signal for ranking).
CREATE INDEX IF NOT EXISTS idx_lre_resource_liked
  ON public.learner_resource_engagement (resource_id) WHERE liked;

ALTER TABLE public.learner_resource_engagement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own engagement"
  ON public.learner_resource_engagement
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own engagement"
  ON public.learner_resource_engagement
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own engagement"
  ON public.learner_resource_engagement
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own engagement"
  ON public.learner_resource_engagement
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Atomic watch recording (upsert + increment) — callable from the app.
CREATE OR REPLACE FUNCTION public.record_clip_watch(
  p_resource_id text,
  p_source text DEFAULT 'system'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.learner_resource_engagement
    (user_id, resource_id, resource_source, watch_count, last_watched_at)
  VALUES (auth.uid(), p_resource_id, p_source, 1, now())
  ON CONFLICT (user_id, resource_id) DO UPDATE
    SET watch_count = public.learner_resource_engagement.watch_count + 1,
        last_watched_at = now(),
        updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_clip_watch(text, text) TO authenticated;

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.touch_lre_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lre_touch ON public.learner_resource_engagement;
CREATE TRIGGER trg_lre_touch
  BEFORE UPDATE ON public.learner_resource_engagement
  FOR EACH ROW EXECUTE FUNCTION public.touch_lre_updated_at();
