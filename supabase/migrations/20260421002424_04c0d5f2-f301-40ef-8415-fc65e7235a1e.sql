
-- Subject XP table
CREATE TABLE public.subject_xp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  curriculum text NOT NULL DEFAULT 'ZIMSEC',
  xp integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  last_activity_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject, curriculum)
);

CREATE INDEX idx_subject_xp_curr_subj_xp ON public.subject_xp (curriculum, subject, xp DESC);
CREATE INDEX idx_subject_xp_curr_xp ON public.subject_xp (curriculum, xp DESC);
CREATE INDEX idx_subject_xp_user ON public.subject_xp (user_id);

ALTER TABLE public.subject_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view subject xp"
  ON public.subject_xp FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own subject xp"
  ON public.subject_xp FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subject xp"
  ON public.subject_xp FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_subject_xp_updated_at
  BEFORE UPDATE ON public.subject_xp
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.subject_xp;
ALTER TABLE public.subject_xp REPLICA IDENTITY FULL;

-- Per-subject leaderboard
CREATE OR REPLACE FUNCTION public.get_subject_leaderboard(
  p_curriculum text,
  p_subject text,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_top jsonb;
  v_me jsonb;
  v_total integer;
BEGIN
  v_uid := auth.uid();

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.rank), '[]'::jsonb)
  INTO v_top
  FROM (
    SELECT
      ROW_NUMBER() OVER (ORDER BY sx.xp DESC, sx.streak DESC, sx.updated_at ASC)::int AS rank,
      sx.user_id,
      sx.xp,
      sx.streak,
      COALESCE(p.full_name, 'Student') AS full_name,
      p.avatar_url
    FROM public.subject_xp sx
    LEFT JOIN public.profiles p ON p.id = sx.user_id
    WHERE sx.curriculum = p_curriculum AND sx.subject = p_subject
    ORDER BY sx.xp DESC, sx.streak DESC, sx.updated_at ASC
    LIMIT p_limit
  ) t;

  SELECT COUNT(*) INTO v_total
  FROM public.subject_xp
  WHERE curriculum = p_curriculum AND subject = p_subject;

  IF v_uid IS NOT NULL THEN
    SELECT to_jsonb(m) INTO v_me FROM (
      SELECT
        r.rank,
        r.xp,
        r.streak,
        v_total AS total_participants,
        COALESCE(p.full_name, 'You') AS full_name,
        p.avatar_url
      FROM (
        SELECT
          sx.user_id,
          sx.xp,
          sx.streak,
          ROW_NUMBER() OVER (ORDER BY sx.xp DESC, sx.streak DESC, sx.updated_at ASC)::int AS rank
        FROM public.subject_xp sx
        WHERE sx.curriculum = p_curriculum AND sx.subject = p_subject
      ) r
      LEFT JOIN public.profiles p ON p.id = r.user_id
      WHERE r.user_id = v_uid
    ) m;
  END IF;

  RETURN jsonb_build_object(
    'top', COALESCE(v_top, '[]'::jsonb),
    'me', v_me,
    'total_participants', v_total
  );
END;
$$;

-- Overall leaderboard
CREATE OR REPLACE FUNCTION public.get_overall_leaderboard(
  p_curriculum text,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_top jsonb;
  v_me jsonb;
  v_total integer;
BEGIN
  v_uid := auth.uid();

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.rank), '[]'::jsonb)
  INTO v_top
  FROM (
    SELECT
      ROW_NUMBER() OVER (ORDER BY agg.total_xp DESC, agg.max_streak DESC)::int AS rank,
      agg.user_id,
      agg.total_xp AS xp,
      agg.max_streak AS streak,
      COALESCE(p.full_name, 'Student') AS full_name,
      p.avatar_url
    FROM (
      SELECT user_id, SUM(xp)::int AS total_xp, MAX(streak)::int AS max_streak
      FROM public.subject_xp
      WHERE curriculum = p_curriculum
      GROUP BY user_id
    ) agg
    LEFT JOIN public.profiles p ON p.id = agg.user_id
    ORDER BY agg.total_xp DESC, agg.max_streak DESC
    LIMIT p_limit
  ) t;

  SELECT COUNT(DISTINCT user_id) INTO v_total
  FROM public.subject_xp
  WHERE curriculum = p_curriculum;

  IF v_uid IS NOT NULL THEN
    SELECT to_jsonb(m) INTO v_me FROM (
      SELECT
        r.rank,
        r.xp,
        r.streak,
        v_total AS total_participants,
        COALESCE(p.full_name, 'You') AS full_name,
        p.avatar_url
      FROM (
        SELECT
          agg.user_id,
          agg.total_xp AS xp,
          agg.max_streak AS streak,
          ROW_NUMBER() OVER (ORDER BY agg.total_xp DESC, agg.max_streak DESC)::int AS rank
        FROM (
          SELECT user_id, SUM(xp)::int AS total_xp, MAX(streak)::int AS max_streak
          FROM public.subject_xp
          WHERE curriculum = p_curriculum
          GROUP BY user_id
        ) agg
      ) r
      LEFT JOIN public.profiles p ON p.id = r.user_id
      WHERE r.user_id = v_uid
    ) m;
  END IF;

  RETURN jsonb_build_object(
    'top', COALESCE(v_top, '[]'::jsonb),
    'me', v_me,
    'total_participants', v_total
  );
END;
$$;
