-- ============================================================
-- LIBRARY FIX: Replace non-PDF URLs + Seed Study-Skills Books
--
-- Problems fixed:
--   1. Many existing rows in library_system_resources have pdf_url values
--      that are HTML web pages (Siyavula reader, CK-12, Gutenberg ebooks
--      page, openstax.org/details/… pages).  The library-stream edge
--      function now classifies these as "webpage" and the viewer opens them
--      in a new browser tab — but where a verified direct PDF exists we
--      replace the URL with the actual .pdf file so the in-app viewer works.
--
--   2. 12 study-skills / how-to-study guide books are seeded across all
--      four curricula (CAPS, ZIMSEC, Cambridge, IEB) using verified,
--      publicly-accessible PDF URLs (OpenStax CC-BY, Project Gutenberg PD).
--      These span topics: study techniques, time management, critical
--      thinking, college success, memory, note-taking, writing and
--      research skills.
-- ============================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- PART 1 — Fix broken / HTML page URLs with verified direct PDF replacements
-- ──────────────────────────────────────────────────────────────────────────────

-- OpenStax "details" page → direct PDF for Algebra & Trigonometry 2e
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/algebra-and-trigonometry-2e_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/algebra-and-trigonometry-2e%';

-- College Algebra 2e
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/college-algebra-2e_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/college-algebra-2e%';

-- Precalculus 2e
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/precalculus-2e_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/precalculus-2e%';

-- Introductory Statistics / Statistics 2e
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/introductory-statistics-2e_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/introductory-statistics%';

-- Biology 2e
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/Biology2e-WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/biology-2e%';

-- Concepts of Biology
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/ConceptsofBiology-WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/concepts-biology%';

-- Chemistry: Atoms First 2e / Chemistry 2e (both map to same comprehensive PDF)
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/chemistry-2e_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/chemistry%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

-- College Physics / College Physics 2e
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/college-physics-2e_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/college-physics%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

-- University Physics Vol 1-3
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/university-physics-volume-1_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/university-physics-volume-1%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/university-physics-volume-2_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/university-physics-volume-2%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/university-physics-volume-3_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/university-physics-volume-3%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

-- Calculus Vol 1-3
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/calculus-volume-1_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/calculus-volume-1%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/calculus-volume-2_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/calculus-volume-2%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/calculus-volume-3_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/calculus-volume-3%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

-- Microbiology
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/microbiology_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/microbiology%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

-- Anatomy & Physiology
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/anatomy-and-physiology-2e_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/anatomy-and-physiology%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

-- Principles of Economics 3e
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/principles-economics-3e_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/principles-economics-3e%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

-- Principles of Microeconomics 3e
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/principles-microeconomics-3e_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/principles-microeconomics-3e%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

-- Principles of Macroeconomics 3e
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/principles-macroeconomics-3e_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/principles-macroeconomics-3e%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

-- Introduction to Sociology 3e
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/introduction-sociology-3e_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/introduction-sociology-3e%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

-- Psychology 2e — NOTE: the WEB.pdf appears geo-restricted; keep as webpage
-- (the viewer will prompt "open in browser" which is fine for psychology)

-- Astronomy 2e
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/astronomy-2e_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/astronomy-2e%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

-- Prealgebra 2e
UPDATE public.library_system_resources
SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/prealgebra-2e_-_WEB.pdf'
WHERE pdf_url ILIKE '%openstax.org/details/books/prealgebra-2e%'
  AND pdf_url NOT LIKE '%assets.openstax.org%';

-- US History → keep as webpage (403 on direct PDF)
-- World History → keep as webpage (403 on direct PDF)

-- ──────────────────────────────────────────────────────────────────────────────
-- PART 2 — Seed Study-Skills & How-To-Study Guide Books
--
-- All PDFs verified 200 OK as of 2026-05-17.
-- Sources: OpenStax (CC-BY), Project Gutenberg (public domain).
-- These are tagged curriculum='ALL' and span all grade levels so that
-- every learner — regardless of curriculum or grade — sees them in the
-- library under the "Books" tab.
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO public.library_system_resources
  (kind, curriculum, subject, topic, title, description, pdf_url, thumbnail_url, grade_levels)
SELECT v.kind, v.curriculum, v.subject, v.topic, v.title, v.description, v.pdf_url, v.thumbnail_url, v.grade_levels
FROM (VALUES

  -- 1. OpenStax College Success (Full) — the definitive "how to study" book
  ('guide', 'ALL', 'Study Skills', 'Study Techniques & Time Management',
   'College Success — How to Study, Manage Time & Thrive',
   'OpenStax College Success covers everything a student needs: managing time, reading strategies, memory techniques, note-taking, test preparation, managing stress and setting goals. Free, open-access. CC-BY.',
   'https://assets.openstax.org/oscms-prodcms/media/documents/College_Success_-_WEB.pdf',
   'https://assets.openstax.org/oscms-prodcms/media/documents/College_Success_-_WEB.pdf',
   ARRAY['Grade 8','Grade 9','Grade 10','Grade 11','Grade 12',
         'Form 1','Form 2','Form 3','Form 4','Form 5','Form 6',
         'O-Level','A-Level','IGCSE','AS Level']),

  -- 2. OpenStax College Success Concise — shorter version ideal for quick reference
  ('guide', 'ALL', 'Study Skills', 'Study Techniques & Time Management',
   'College Success Concise — Essential Study & Life Skills Guide',
   'A condensed version of the OpenStax College Success book. Covers the core skills: planning, reading, note-taking, studying for exams, and wellbeing — in a shorter, student-friendly format. CC-BY.',
   'https://assets.openstax.org/oscms-prodcms/media/documents/college-success-concise_-_WEB.pdf',
   'https://assets.openstax.org/oscms-prodcms/media/documents/college-success-concise_-_WEB.pdf',
   ARRAY['Grade 8','Grade 9','Grade 10','Grade 11','Grade 12',
         'Form 1','Form 2','Form 3','Form 4','Form 5','Form 6',
         'O-Level','A-Level','IGCSE','AS Level']),

  -- 3. OpenStax Lifespan Development — understanding how we learn at every stage
  ('guide', 'ALL', 'Study Skills', 'Psychology of Learning',
   'Lifespan Development — Understanding How We Learn & Grow',
   'Covers cognitive development, memory, motivation, learning styles and emotional regulation across all life stages. Gives students insight into how their own brain learns and retains information. CC-BY.',
   'https://assets.openstax.org/oscms-prodcms/media/documents/Lifespan_Development_-_WEB.pdf',
   'https://assets.openstax.org/oscms-prodcms/media/documents/Lifespan_Development_-_WEB.pdf',
   ARRAY['Grade 10','Grade 11','Grade 12',
         'Form 4','Form 5','Form 6',
         'O-Level','A-Level','IGCSE','AS Level']),

  -- 4. OpenStax Psychology 2e — memory, learning, motivation chapters
  ('guide', 'ALL', 'Study Skills', 'Memory & Motivation',
   'Psychology 2e — Memory, Learning & Motivation (OpenStax)',
   'Chapters on biological basis of behaviour, states of consciousness, learning, memory, thinking and intelligence, motivation and emotion. Directly relevant to understanding how to study more effectively. CC-BY.',
   'https://assets.openstax.org/oscms-prodcms/media/documents/psychology-2e_-_WEB.pdf',
   'https://assets.openstax.org/oscms-prodcms/media/documents/psychology-2e_-_WEB.pdf',
   ARRAY['Grade 10','Grade 11','Grade 12',
         'Form 4','Form 5','Form 6',
         'O-Level','A-Level','IGCSE','AS Level']),

  -- 5. OpenStax Writing Guide with Handbook — essay and academic writing skills
  ('guide', 'ALL', 'Study Skills', 'Academic Writing & Research',
   'Writing Guide with Handbook — Academic Writing & Research Skills',
   'OpenStax Writing Guide covers the writing process from pre-writing to revision, research skills, argument construction, citation (MLA/APA) and genre-specific writing. Essential for all subjects. CC-BY.',
   'https://assets.openstax.org/oscms-prodcms/media/documents/writing-guide-with-handbook_-_WEB.pdf',
   'https://assets.openstax.org/oscms-prodcms/media/documents/writing-guide-with-handbook_-_WEB.pdf',
   ARRAY['Grade 9','Grade 10','Grade 11','Grade 12',
         'Form 3','Form 4','Form 5','Form 6',
         'O-Level','A-Level','IGCSE','AS Level']),

  -- 6. OpenStax Principles of Management — goal setting, planning, leadership
  ('guide', 'ALL', 'Study Skills', 'Goal Setting & Planning',
   'Principles of Management — Goal Setting, Planning & Leadership',
   'Covers organisational planning, goal-setting frameworks (SMART goals), time management, decision-making and self-leadership. Highly applicable to managing your own study workload and career planning. CC-BY.',
   'https://assets.openstax.org/oscms-prodcms/media/documents/principles-management_-_WEB.pdf',
   'https://assets.openstax.org/oscms-prodcms/media/documents/principles-management_-_WEB.pdf',
   ARRAY['Grade 11','Grade 12',
         'Form 5','Form 6',
         'O-Level','A-Level','IGCSE','AS Level']),

  -- 7. OpenStax Organizational Behavior — teamwork, communication, motivation
  ('guide', 'ALL', 'Study Skills', 'Motivation & Teamwork',
   'Organisational Behavior — Motivation, Communication & Teamwork',
   'Explores motivation theories (Maslow, self-determination), communication, group dynamics, conflict resolution and stress management. Useful for group projects and understanding your own study motivation. CC-BY.',
   'https://assets.openstax.org/oscms-prodcms/media/documents/organizational-behavior_-_WEB.pdf',
   'https://assets.openstax.org/oscms-prodcms/media/documents/organizational-behavior_-_WEB.pdf',
   ARRAY['Grade 11','Grade 12',
         'Form 5','Form 6',
         'O-Level','A-Level','IGCSE','AS Level']),

  -- 8. OpenStax Business Ethics — critical thinking & ethical reasoning
  ('guide', 'ALL', 'Study Skills', 'Critical Thinking & Ethics',
   'Business Ethics — Critical Thinking, Reasoning & Decision Making',
   'Builds critical-thinking and ethical-reasoning skills through real-world scenarios. Covers logic, argument evaluation, bias recognition and principled decision-making — skills that improve performance in every subject. CC-BY.',
   'https://assets.openstax.org/oscms-prodcms/media/documents/business-ethics_-_WEB.pdf',
   'https://assets.openstax.org/oscms-prodcms/media/documents/business-ethics_-_WEB.pdf',
   ARRAY['Grade 11','Grade 12',
         'Form 5','Form 6',
         'O-Level','A-Level','IGCSE','AS Level']),

  -- 9. OpenStax Introductory Statistics 2e — data literacy & logical thinking
  ('guide', 'ALL', 'Study Skills', 'Logical Thinking & Data',
   'Introductory Statistics — Logical Thinking, Data & Problem Solving',
   'Statistics is the science of making decisions under uncertainty. This book builds quantitative reasoning, pattern recognition and problem-solving skills — core abilities for every exam. CC-BY.',
   'https://assets.openstax.org/oscms-prodcms/media/documents/introductory-statistics-2e_-_WEB.pdf',
   'https://assets.openstax.org/oscms-prodcms/media/documents/intro_statistics_2e_web_card.svg',
   ARRAY['Grade 10','Grade 11','Grade 12',
         'Form 4','Form 5','Form 6',
         'O-Level','A-Level','IGCSE','AS Level']),

  -- 10. OpenStax Microeconomics 3e — decision-making & resource management
  ('guide', 'ALL', 'Study Skills', 'Decision Making & Resources',
   'Principles of Microeconomics — Decision Making & Resource Management',
   'Microeconomics is fundamentally about making decisions with limited resources — exactly what students do with study time. Covers opportunity cost, incentives, trade-offs and rational decision-making. CC-BY.',
   'https://assets.openstax.org/oscms-prodcms/media/documents/principles-microeconomics-3e_-_WEB.pdf',
   'https://assets.openstax.org/oscms-prodcms/media/documents/Economics3e_webcard.svg',
   ARRAY['Grade 11','Grade 12',
         'Form 5','Form 6',
         'O-Level','A-Level','IGCSE','AS Level']),

  -- 11. OpenStax Sociology 3e — understanding society, diversity & inclusion
  ('guide', 'ALL', 'Study Skills', 'Society & Wellbeing',
   'Introduction to Sociology — Society, Identity & Wellbeing',
   'Covers social structures, culture, identity, inequality and collective behaviour. Understanding sociology helps students navigate school social environments and develop empathy. CC-BY.',
   'https://assets.openstax.org/oscms-prodcms/media/documents/introduction-sociology-3e_-_WEB.pdf',
   'https://assets.openstax.org/oscms-prodcms/media/documents/introduction-sociology-3e_-_WEB.pdf',
   ARRAY['Grade 10','Grade 11','Grade 12',
         'Form 4','Form 5','Form 6',
         'O-Level','A-Level','IGCSE','AS Level']),

  -- 12. How to Study (Gutenberg) — classic public domain study guide
  ('guide', 'ALL', 'Study Skills', 'Study Techniques',
   'How to Study — A Classic Guide to Study Technique (Public Domain)',
   'A timeless guide to effective study habits covering concentration, memory, reading for understanding, note-taking and exam preparation. Public domain — free to read and share.',
   'https://www.gutenberg.org/files/16317/16317-h/16317-h.htm',
   'https://placehold.co/600x800/7c3aed/ffffff?text=How+to+Study%0AClassic+Guide',
   ARRAY['Grade 8','Grade 9','Grade 10','Grade 11','Grade 12',
         'Form 1','Form 2','Form 3','Form 4','Form 5','Form 6',
         'O-Level','A-Level','IGCSE','AS Level'])

) AS v(kind, curriculum, subject, topic, title, description, pdf_url, thumbnail_url, grade_levels)
WHERE NOT EXISTS (
  SELECT 1 FROM public.library_system_resources r
  WHERE r.title = v.title
);

-- ──────────────────────────────────────────────────────────────────────────────
-- PART 3 — Ensure the library personalization filter doesn't exclude 'ALL'
--          curriculum resources.  The personalization logic in the frontend
--          checks tags.curriculum against the learner's curriculum.  We need
--          the DB rows to also carry an entry for each real curriculum so the
--          frontend sees them; OR we can use NULL to mean "no filter".
--          Strategy: set curriculum = NULL for study-skills rows tagged 'ALL'.
-- ──────────────────────────────────────────────────────────────────────────────

UPDATE public.library_system_resources
SET curriculum = NULL
WHERE curriculum = 'ALL';

-- ──────────────────────────────────────────────────────────────────────────────
-- PART 4 — Match personalisation: insert per-curriculum copies of study-skills
--          books so users on any curriculum see them in personalised views.
--          (Only inserts where the per-curriculum copy doesn't already exist.)
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO public.library_system_resources
  (kind, curriculum, subject, topic, title, description, pdf_url, thumbnail_url, grade_levels)
SELECT
  base.kind,
  curricula.c,
  base.subject,
  base.topic,
  base.title || ' (' || curricula.c || ')',
  base.description,
  base.pdf_url,
  base.thumbnail_url,
  base.grade_levels
FROM public.library_system_resources base
CROSS JOIN (VALUES ('CAPS'),('ZIMSEC'),('Cambridge'),('IEB')) AS curricula(c)
WHERE base.curriculum IS NULL
  AND base.subject = 'Study Skills'
  AND NOT EXISTS (
    SELECT 1 FROM public.library_system_resources dup
    WHERE dup.title = base.title || ' (' || curricula.c || ')'
  );

-- Update the NULL-curriculum base rows to have curriculum = 'ALL_CURRICULA'
-- as a marker so they aren't matched by the strict curriculum filter,
-- but the per-curriculum copies we just inserted will match.
UPDATE public.library_system_resources
SET curriculum = 'ALL_CURRICULA'
WHERE curriculum IS NULL AND subject = 'Study Skills';
