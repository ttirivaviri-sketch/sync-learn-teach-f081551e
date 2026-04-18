-- 1) Cleanup existing duplicates: keep earliest created_at per (user, subject, date, type, title)
DELETE FROM public.daily_tasks a
USING public.daily_tasks b
WHERE a.ctid <> b.ctid
  AND a.user_id = b.user_id
  AND a.task_date = b.task_date
  AND a.task_type = b.task_type
  AND a.title = b.title
  AND COALESCE(a.subject_id::text, '') = COALESCE(b.subject_id::text, '')
  AND a.created_at > b.created_at;

-- 2) Unique index to prevent future duplicates (treat NULL subject_id as a distinct key via coalesce expression index)
CREATE UNIQUE INDEX IF NOT EXISTS daily_tasks_unique_per_day
  ON public.daily_tasks (user_id, COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid), task_date, task_type, title);
