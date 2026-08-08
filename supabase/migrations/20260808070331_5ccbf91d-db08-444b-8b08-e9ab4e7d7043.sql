-- Collapse duplicate user_progress rows into a single row per user
WITH ranked AS (
  SELECT user_id,
         MAX(COALESCE(xp,0)) AS xp,
         MAX(COALESCE(streak,0)) AS streak,
         MAX(last_study_date) AS last_study_date,
         (ARRAY_AGG(badges ORDER BY jsonb_array_length(COALESCE(badges,'[]'::jsonb)) DESC))[1] AS badges
  FROM public.user_progress
  WHERE user_id IS NOT NULL
  GROUP BY user_id
), keep AS (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM public.user_progress
  WHERE user_id IS NOT NULL
  ORDER BY user_id, COALESCE(xp,0) DESC, created_at ASC
)
UPDATE public.user_progress up
SET xp = r.xp, streak = r.streak, last_study_date = r.last_study_date, badges = COALESCE(r.badges,'[]'::jsonb)
FROM ranked r, keep k
WHERE up.id = k.id AND k.user_id = r.user_id;

DELETE FROM public.user_progress up
WHERE up.user_id IS NOT NULL
  AND up.id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM public.user_progress
    WHERE user_id IS NOT NULL
    ORDER BY user_id, COALESCE(xp,0) DESC, created_at ASC
  );

ALTER TABLE public.user_progress
  ADD CONSTRAINT user_progress_user_id_unique UNIQUE (user_id);