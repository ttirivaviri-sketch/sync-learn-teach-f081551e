-- Add DB-backed subject icon metadata and useful uniqueness for parsed syllabus subjects

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS icon_emoji TEXT,
  ADD COLUMN IF NOT EXISTS icon_gradient TEXT;

-- Prevent duplicate subject rows per user (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_user_lower_name_unique
  ON public.subjects (user_id, lower(name));

-- Backfill icons for existing subjects
UPDATE public.subjects
SET
  icon_emoji = CASE
    WHEN lower(name) IN ('mathematics', 'maths', 'math') THEN '📐'
    WHEN lower(name) = 'physics' THEN '⚛️'
    WHEN lower(name) = 'chemistry' THEN '🧪'
    WHEN lower(name) = 'biology' THEN '🧬'
    WHEN lower(name) IN ('english', 'english language') THEN '📖'
    WHEN lower(name) = 'literature' THEN '🪶'
    WHEN lower(name) = 'geography' THEN '🌍'
    WHEN lower(name) = 'history' THEN '🏛️'
    WHEN lower(name) IN ('computer science', 'ict') THEN '💻'
    WHEN lower(name) = 'economics' THEN '📢'
    WHEN lower(name) = 'accounting' THEN '🧮'
    WHEN lower(name) = 'business studies' THEN '💼'
    WHEN lower(name) = 'agriculture' THEN '🚜'
    WHEN lower(name) = 'foreign languages' THEN '🗣️'
    WHEN lower(name) = 'design & technology' THEN '🛠️'
    WHEN lower(name) = 'engineering graphics' THEN '📘'
    WHEN lower(name) = 'sociology' THEN '👥'
    WHEN lower(name) = 'psychology' THEN '🧠'
    WHEN lower(name) = 'religious studies' THEN '✝️'
    WHEN lower(name) = 'law' THEN '⚖️'
    WHEN lower(name) = 'music' THEN '🎵'
    WHEN lower(name) = 'health' THEN '🩺'
    WHEN lower(name) = 'environmental science' THEN '🌱'
    WHEN lower(name) = 'physical education' THEN '⚽'
    WHEN lower(name) = 'first aid' THEN '🛡️'
    WHEN lower(name) = 'art' THEN '🎨'
    ELSE COALESCE(icon_emoji, '📚')
  END,
  icon_gradient = CASE
    WHEN lower(name) IN ('mathematics', 'maths', 'math') THEN 'from-purple-500 to-violet-600'
    WHEN lower(name) = 'physics' THEN 'from-blue-500 to-indigo-600'
    WHEN lower(name) = 'chemistry' THEN 'from-green-500 to-emerald-600'
    WHEN lower(name) = 'biology' THEN 'from-pink-500 to-rose-600'
    WHEN lower(name) IN ('english', 'english language') THEN 'from-orange-500 to-amber-600'
    WHEN lower(name) = 'literature' THEN 'from-red-500 to-rose-600'
    WHEN lower(name) = 'geography' THEN 'from-lime-500 to-green-600'
    WHEN lower(name) = 'history' THEN 'from-stone-500 to-amber-700'
    WHEN lower(name) IN ('computer science', 'ict') THEN 'from-cyan-500 to-sky-600'
    WHEN lower(name) = 'economics' THEN 'from-teal-500 to-cyan-600'
    WHEN lower(name) = 'accounting' THEN 'from-blue-500 to-indigo-600'
    WHEN lower(name) = 'business studies' THEN 'from-teal-500 to-cyan-600'
    WHEN lower(name) = 'agriculture' THEN 'from-green-500 to-lime-600'
    WHEN lower(name) = 'foreign languages' THEN 'from-yellow-500 to-amber-600'
    WHEN lower(name) = 'design & technology' THEN 'from-purple-500 to-indigo-600'
    WHEN lower(name) = 'engineering graphics' THEN 'from-blue-600 to-indigo-800'
    WHEN lower(name) = 'sociology' THEN 'from-fuchsia-500 to-pink-600'
    WHEN lower(name) = 'psychology' THEN 'from-violet-500 to-purple-700'
    WHEN lower(name) = 'religious studies' THEN 'from-yellow-500 to-amber-600'
    WHEN lower(name) = 'law' THEN 'from-slate-500 to-gray-700'
    WHEN lower(name) = 'music' THEN 'from-indigo-500 to-violet-600'
    WHEN lower(name) = 'health' THEN 'from-cyan-400 to-teal-500'
    WHEN lower(name) = 'environmental science' THEN 'from-emerald-400 to-teal-500'
    WHEN lower(name) = 'physical education' THEN 'from-green-500 to-lime-600'
    WHEN lower(name) = 'first aid' THEN 'from-red-500 to-rose-600'
    WHEN lower(name) = 'art' THEN 'from-yellow-500 to-amber-600'
    ELSE COALESCE(icon_gradient, 'from-gray-500 to-slate-600')
  END;
