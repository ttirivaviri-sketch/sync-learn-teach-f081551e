
WITH seed(curriculum, kind, subject, title, description, pdf_url, thumbnail_url, grade_levels) AS (
  VALUES
    -- CAPS gaps
    ('CAPS','textbook','Life Sciences',         'Life Sciences Grade 11 (Siyavula)',         'Free CAPS-aligned Grade 11 Life Sciences textbook by Siyavula.',         'https://www.siyavula.com/read/za/life-sciences/grade-11',                  'https://placehold.co/600x800/0d7a5f/ffffff?text=Life+Sciences%0AGrade+11', ARRAY['Grade 11']::text[]),
    ('CAPS','textbook','Life Sciences',         'Life Sciences Grade 12 (Siyavula)',         'Free CAPS-aligned Grade 12 Life Sciences textbook by Siyavula.',         'https://www.siyavula.com/read/za/life-sciences/grade-12',                  'https://placehold.co/600x800/0d7a5f/ffffff?text=Life+Sciences%0AGrade+12', ARRAY['Grade 12']::text[]),
    ('CAPS','textbook','Mathematical Literacy', 'Mathematical Literacy Grade 11 (Siyavula)', 'Free CAPS-aligned Grade 11 Mathematical Literacy textbook by Siyavula.', 'https://www.siyavula.com/read/za/mathematical-literacy/grade-11',          'https://placehold.co/600x800/3b82f6/ffffff?text=Math+Literacy%0AGrade+11', ARRAY['Grade 11']::text[]),

    -- IEB gaps (IEB schools widely use Siyavula)
    ('IEB','textbook','Mathematics',         'Mathematics Grade 11 (Siyavula, IEB-aligned)',         'CAPS-based open textbook used by IEB schools for Grade 11 Mathematics.',         'https://www.siyavula.com/read/za/mathematics/grade-11',         'https://placehold.co/600x800/1e3a5f/ffffff?text=Mathematics%0AGrade+11',     ARRAY['Grade 11']::text[]),
    ('IEB','textbook','Mathematics',         'Mathematics Grade 12 (Siyavula, IEB-aligned)',         'CAPS-based open textbook used by IEB schools for Grade 12 Mathematics.',         'https://www.siyavula.com/read/za/mathematics/grade-12',         'https://placehold.co/600x800/1e3a5f/ffffff?text=Mathematics%0AGrade+12',     ARRAY['Grade 12']::text[]),
    ('IEB','textbook','Physical Sciences',   'Physical Sciences Grade 11 (Siyavula, IEB-aligned)',   'CAPS-based open textbook used by IEB schools for Grade 11 Physical Sciences.',   'https://www.siyavula.com/read/za/physical-sciences/grade-11',   'https://placehold.co/600x800/c9a84c/ffffff?text=Physical%0ASciences+G11',   ARRAY['Grade 11']::text[]),
    ('IEB','textbook','Physical Sciences',   'Physical Sciences Grade 12 (Siyavula, IEB-aligned)',   'CAPS-based open textbook used by IEB schools for Grade 12 Physical Sciences.',   'https://www.siyavula.com/read/za/physical-sciences/grade-12',   'https://placehold.co/600x800/c9a84c/ffffff?text=Physical%0ASciences+G12',   ARRAY['Grade 12']::text[]),
    ('IEB','textbook','Life Sciences',       'Life Sciences Grade 11 (Siyavula, IEB-aligned)',       'CAPS-based open textbook used by IEB schools for Grade 11 Life Sciences.',       'https://www.siyavula.com/read/za/life-sciences/grade-11',       'https://placehold.co/600x800/0d7a5f/ffffff?text=Life+Sciences%0AGrade+11', ARRAY['Grade 11']::text[]),
    ('IEB','textbook','Life Sciences',       'Life Sciences Grade 12 (Siyavula, IEB-aligned)',       'CAPS-based open textbook used by IEB schools for Grade 12 Life Sciences.',       'https://www.siyavula.com/read/za/life-sciences/grade-12',       'https://placehold.co/600x800/0d7a5f/ffffff?text=Life+Sciences%0AGrade+12', ARRAY['Grade 12']::text[]),
    ('IEB','textbook','Mathematical Literacy','Mathematical Literacy Grade 11 (Siyavula, IEB-aligned)','CAPS-based open textbook used by IEB schools for Grade 11 Mathematical Literacy.','https://www.siyavula.com/read/za/mathematical-literacy/grade-11','https://placehold.co/600x800/3b82f6/ffffff?text=Math+Literacy%0AGrade+11', ARRAY['Grade 11']::text[]),
    ('IEB','textbook','Mathematical Literacy','Mathematical Literacy Grade 12 (Siyavula, IEB-aligned)','CAPS-based open textbook used by IEB schools for Grade 12 Mathematical Literacy.','https://www.siyavula.com/read/za/mathematical-literacy/grade-12','https://placehold.co/600x800/3b82f6/ffffff?text=Math+Literacy%0AGrade+12', ARRAY['Grade 12']::text[]),

    -- Cambridge (IGCSE / O-Level / A-Level mapping using Siyavula content)
    ('Cambridge','textbook','Mathematics',       'Mathematics — IGCSE Foundation (Siyavula G11)',          'Siyavula Grade 11 Mathematics — aligned to Cambridge IGCSE core topics.',          'https://www.siyavula.com/read/za/mathematics/grade-11',          'https://placehold.co/600x800/1e3a5f/ffffff?text=IGCSE%0AMathematics',    ARRAY['IGCSE','O-Level']::text[]),
    ('Cambridge','textbook','Mathematics',       'Mathematics — AS / A-Level Companion (Siyavula G12)',    'Siyavula Grade 12 Mathematics — bridging to AS / A-Level Pure topics.',           'https://www.siyavula.com/read/za/mathematics/grade-12',          'https://placehold.co/600x800/1e3a5f/ffffff?text=AS+%2F+A-Level%0AMathematics', ARRAY['AS Level','A-Level']::text[]),
    ('Cambridge','textbook','Physics',           'Physics — IGCSE / AS Companion (Siyavula G11)',          'Siyavula Grade 11 Physical Sciences (Physics) — aligned to IGCSE / AS Physics.',  'https://www.siyavula.com/read/za/physical-sciences/grade-11',    'https://placehold.co/600x800/c9a84c/ffffff?text=IGCSE%2FAS%0APhysics',    ARRAY['IGCSE','AS Level']::text[]),
    ('Cambridge','textbook','Chemistry',         'Chemistry — IGCSE / AS Companion (Siyavula G11)',        'Siyavula Grade 11 Physical Sciences (Chemistry) — aligned to IGCSE / AS Chemistry.','https://www.siyavula.com/read/za/physical-sciences/grade-11',    'https://placehold.co/600x800/8b5e3c/ffffff?text=IGCSE%2FAS%0AChemistry',  ARRAY['IGCSE','AS Level']::text[]),
    ('Cambridge','textbook','Biology',           'Biology — IGCSE / AS Companion (Siyavula G11)',          'Siyavula Grade 11 Life Sciences — aligned to IGCSE / AS Biology core topics.',    'https://www.siyavula.com/read/za/life-sciences/grade-11',        'https://placehold.co/600x800/0d7a5f/ffffff?text=IGCSE%2FAS%0ABiology',    ARRAY['IGCSE','AS Level']::text[])
)
INSERT INTO public.library_system_resources
  (curriculum, kind, subject, title, description, pdf_url, thumbnail_url, grade_levels)
SELECT s.curriculum, s.kind, s.subject, s.title, s.description, s.pdf_url, s.thumbnail_url, s.grade_levels
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.library_system_resources r
  WHERE r.title = s.title AND r.curriculum = s.curriculum
);
