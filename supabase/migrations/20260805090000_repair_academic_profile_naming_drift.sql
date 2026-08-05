-- Repair academic_profiles rows written by the legacy StudyMode OnboardingFlow
-- (removed in this change). That flow saved non-canonical values:
--   curriculum: upper-cased board slug ('CAMBRIDGE', 'CAPS', 'PRIMARY', ...)
--   grade:      level slug ('igcse', 'o-level', 'zimsec-o', 'caps-fet', ...)
-- Canonical values (src/types/academicProfile.ts):
--   curriculum: ZIMSEC | CAMB | IEB | NSC | OTHER
--   grade:      'Form 1'..'Form 6', 'Grade 1'..'Grade 12', IGCSE, O-Level, A-Level
--
-- Non-canonical rows break template lookups (curriculum_topic_templates is
-- keyed on exact curriculum/grade/subject), leaving learners with empty
-- topic trees. This migration normalizes them in place. Idempotent: every
-- UPDATE narrows on the legacy value, so re-runs are no-ops.

-- 1. Curriculum aliases -> canonical codes
UPDATE public.academic_profiles SET curriculum = 'CAMB'
  WHERE upper(curriculum) IN ('CAMBRIDGE', 'CIE', 'CAIE');

UPDATE public.academic_profiles SET curriculum = 'NSC'
  WHERE upper(curriculum) = 'CAPS';

UPDATE public.academic_profiles SET curriculum = 'ZIMSEC'
  WHERE upper(curriculum) IN ('ZIMSEC-O', 'ZIMSEC-A');

-- Boards the app has no curriculum for -> OTHER (keeps profile usable;
-- template lookups fall back to lazy seeding under OTHER).
UPDATE public.academic_profiles SET curriculum = 'OTHER'
  WHERE upper(curriculum) IN ('PRIMARY', 'NSSC', 'BGCSE', 'GCSE', 'KCSE', 'TERTIARY');

-- Normalize casing on already-canonical codes (e.g. 'zimsec' -> 'ZIMSEC').
UPDATE public.academic_profiles SET curriculum = upper(curriculum)
  WHERE curriculum IS NOT NULL
    AND curriculum <> upper(curriculum)
    AND upper(curriculum) IN ('ZIMSEC', 'CAMB', 'IEB', 'NSC', 'OTHER');

-- 2. Grade slugs -> canonical labels
UPDATE public.academic_profiles SET grade = 'IGCSE'
  WHERE lower(grade) = 'igcse' AND grade <> 'IGCSE';

UPDATE public.academic_profiles SET grade = 'O-Level'
  WHERE lower(grade) IN ('o-level', 'olevel', 'o level') AND grade <> 'O-Level';

UPDATE public.academic_profiles SET grade = 'A-Level'
  WHERE lower(grade) IN ('a-level', 'alevel', 'a level', 'as-level', 'a-level-uk')
    AND grade <> 'A-Level';

-- ZIMSEC slugs: O Level maps to Form 4 (terminal exam year), A Level to Form 6.
UPDATE public.academic_profiles SET grade = 'Form 4'
  WHERE lower(grade) = 'zimsec-o';
UPDATE public.academic_profiles SET grade = 'Form 6'
  WHERE lower(grade) = 'zimsec-a';

-- CAPS/IEB slugs: FET phase / NSC certificate rows default to Grade 12
-- (the only NSC/IEB grade with verified templates; safest for exam prep).
UPDATE public.academic_profiles SET grade = 'Grade 12'
  WHERE lower(grade) IN ('caps-fet', 'ieb-nsc', 'nsc');

-- 3. Subject-name drift inside the subjects array (per-curriculum).
-- ZIMSEC used 'Accounting' in some earlier flows; the canonical ZIMSEC name
-- is 'Accounts' (matches seeded templates).
UPDATE public.academic_profiles
SET subjects = array_replace(subjects, 'Accounting', 'Accounts')
WHERE curriculum = 'ZIMSEC' AND 'Accounting' = ANY(subjects);

-- Bare 'English' at ZIMSEC exam forms means the English Language syllabus.
UPDATE public.academic_profiles
SET subjects = array_replace(subjects, 'English', 'English Language')
WHERE curriculum = 'ZIMSEC'
  AND grade IN ('Form 4', 'Form 5', 'Form 6')
  AND 'English' = ANY(subjects)
  AND NOT ('English Language' = ANY(subjects));

-- If both were selected, just drop the bare duplicate.
UPDATE public.academic_profiles
SET subjects = array_remove(subjects, 'English')
WHERE curriculum = 'ZIMSEC'
  AND grade IN ('Form 4', 'Form 5', 'Form 6')
  AND 'English' = ANY(subjects)
  AND 'English Language' = ANY(subjects);

-- NSC/IEB: bare 'English' / 'Afrikaans' drift to canonical names.
UPDATE public.academic_profiles
SET subjects = array_replace(subjects, 'English', 'English Home Language')
WHERE curriculum IN ('NSC', 'IEB')
  AND 'English' = ANY(subjects)
  AND NOT ('English Home Language' = ANY(subjects));

UPDATE public.academic_profiles
SET subjects = array_replace(subjects, 'Afrikaans', 'Afrikaans First Additional Language')
WHERE curriculum = 'NSC'
  AND 'Afrikaans' = ANY(subjects)
  AND NOT ('Afrikaans First Additional Language' = ANY(subjects));

-- CAMB: bare 'English' means English Language.
UPDATE public.academic_profiles
SET subjects = array_replace(subjects, 'English', 'English Language')
WHERE curriculum = 'CAMB'
  AND 'English' = ANY(subjects)
  AND NOT ('English Language' = ANY(subjects));
