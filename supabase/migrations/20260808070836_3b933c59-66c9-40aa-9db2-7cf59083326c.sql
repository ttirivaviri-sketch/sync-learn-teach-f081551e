-- 1. Backfill total XP so it is never below the sum of subject XP
WITH totals AS (
  SELECT user_id, SUM(COALESCE(xp,0))::int AS total_xp, MAX(COALESCE(streak,0))::int AS max_streak
  FROM public.subject_xp
  GROUP BY user_id
)
UPDATE public.user_progress up
SET xp = GREATEST(COALESCE(up.xp,0), t.total_xp),
    streak = GREATEST(COALESCE(up.streak,0), t.max_streak)
FROM totals t
WHERE up.user_id = t.user_id;

INSERT INTO public.user_progress (user_id, xp, streak, badges)
SELECT t.user_id, t.total_xp, t.max_streak, '[]'::jsonb
FROM (
  SELECT user_id, SUM(COALESCE(xp,0))::int AS total_xp, MAX(COALESCE(streak,0))::int AS max_streak
  FROM public.subject_xp GROUP BY user_id
) t
WHERE NOT EXISTS (SELECT 1 FROM public.user_progress up WHERE up.user_id = t.user_id);

-- 2. Overall leaderboard now reads the same total XP as the home screen
CREATE OR REPLACE FUNCTION public.get_overall_leaderboard(p_curriculum text, p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_top jsonb;
  v_me jsonb;
  v_total integer;
BEGIN
  v_uid := auth.uid();

  CREATE TEMP TABLE IF NOT EXISTS _lb_tmp ON COMMIT DROP AS SELECT 1;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.rank), '[]'::jsonb)
  INTO v_top
  FROM (
    SELECT
      ROW_NUMBER() OVER (ORDER BY agg.xp DESC, agg.streak DESC)::int AS rank,
      agg.user_id,
      agg.xp,
      agg.streak,
      COALESCE(p.full_name, 'Student') AS full_name,
      p.avatar_url
    FROM (
      SELECT up.user_id, COALESCE(up.xp,0)::int AS xp, COALESCE(up.streak,0)::int AS streak
      FROM public.user_progress up
      LEFT JOIN public.academic_profiles ap ON ap.user_id = up.user_id
      WHERE up.user_id IS NOT NULL
        AND COALESCE(NULLIF(ap.curriculum, ''), p_curriculum) = p_curriculum
    ) agg
    LEFT JOIN public.profiles p ON p.id = agg.user_id
    ORDER BY agg.xp DESC, agg.streak DESC
    LIMIT p_limit
  ) t;

  SELECT COUNT(*) INTO v_total
  FROM public.user_progress up
  LEFT JOIN public.academic_profiles ap ON ap.user_id = up.user_id
  WHERE up.user_id IS NOT NULL
    AND COALESCE(NULLIF(ap.curriculum, ''), p_curriculum) = p_curriculum;

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
          agg.xp,
          agg.streak,
          ROW_NUMBER() OVER (ORDER BY agg.xp DESC, agg.streak DESC)::int AS rank
        FROM (
          SELECT up.user_id, COALESCE(up.xp,0)::int AS xp, COALESCE(up.streak,0)::int AS streak
          FROM public.user_progress up
          LEFT JOIN public.academic_profiles ap ON ap.user_id = up.user_id
          WHERE up.user_id IS NOT NULL
            AND COALESCE(NULLIF(ap.curriculum, ''), p_curriculum) = p_curriculum
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