-- 1) Create study_level enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'study_level') THEN
    CREATE TYPE public.study_level AS ENUM (
      'junior_primary',
      'senior_primary',
      'junior_high',
      'senior_high',
      'tertiary'
    );
  END IF;
END $$;

-- 2) Add study_level column to profiles (idempotent)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS study_level public.study_level;

-- Note: Existing RLS policies on profiles already restrict access to the owner, so no policy changes are required.
