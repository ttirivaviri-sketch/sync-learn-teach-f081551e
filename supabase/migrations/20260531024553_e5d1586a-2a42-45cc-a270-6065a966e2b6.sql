-- Allow 'video' as a resource kind and seed an initial set of openly-available educational videos.
ALTER TABLE public.library_system_resources DROP CONSTRAINT IF EXISTS library_system_resources_kind_check;
ALTER TABLE public.library_system_resources
  ADD CONSTRAINT library_system_resources_kind_check
  CHECK (kind = ANY (ARRAY['past_paper'::text, 'textbook'::text, 'video'::text]));

-- Helper: only insert when (title, curriculum) combination not already present.
WITH seed(title, subject, topic, curriculum, grade_levels, pdf_url, thumbnail_url, description, pages) AS (
  VALUES
    -- Mathematics
    ('Khan Academy — Algebra Basics', 'Mathematics', 'Algebra', 'CAPS', ARRAY[8,9,10], 'https://www.youtube.com/watch?v=NybHckSEQBI', 'https://i.ytimg.com/vi/NybHckSEQBI/hqdefault.jpg', 'Foundations of algebra: variables, expressions, and equations.', NULL::int),
    ('Khan Academy — Algebra Basics', 'Mathematics', 'Algebra', 'IEB',  ARRAY[8,9,10], 'https://www.youtube.com/watch?v=NybHckSEQBI', 'https://i.ytimg.com/vi/NybHckSEQBI/hqdefault.jpg', 'Foundations of algebra: variables, expressions, and equations.', NULL),
    ('Khan Academy — Trigonometry', 'Mathematics', 'Trigonometry', 'CAPS', ARRAY[10,11,12], 'https://www.youtube.com/watch?v=PUB0TaZ7bhA', 'https://i.ytimg.com/vi/PUB0TaZ7bhA/hqdefault.jpg', 'Right-triangle trig, unit circle, and identities.', NULL),
    ('Khan Academy — Calculus Intro', 'Mathematics', 'Calculus', 'IEB',  ARRAY[11,12], 'https://www.youtube.com/watch?v=WUvTyaaNkzM', 'https://i.ytimg.com/vi/WUvTyaaNkzM/hqdefault.jpg', 'Introduction to limits, derivatives and integrals.', NULL),
    ('Khan Academy — Calculus Intro', 'Mathematics', 'Calculus', 'Cambridge', ARRAY[11,12], 'https://www.youtube.com/watch?v=WUvTyaaNkzM', 'https://i.ytimg.com/vi/WUvTyaaNkzM/hqdefault.jpg', 'Introduction to limits, derivatives and integrals.', NULL),
    ('Khan Academy — Probability', 'Mathematics', 'Probability', 'CAPS', ARRAY[10,11,12], 'https://www.youtube.com/watch?v=uzkc-qNVoOk', 'https://i.ytimg.com/vi/uzkc-qNVoOk/hqdefault.jpg', 'Probability fundamentals and combinatorics.', NULL),
    -- Physics
    ('CrashCourse Physics — Motion in a Straight Line', 'Physical Sciences', 'Mechanics', 'CAPS', ARRAY[10,11], 'https://www.youtube.com/watch?v=ZM8ECpBuQYE', 'https://i.ytimg.com/vi/ZM8ECpBuQYE/hqdefault.jpg', 'Kinematics: displacement, velocity, acceleration.', NULL),
    ('CrashCourse Physics — Newton''s Laws', 'Physical Sciences', 'Mechanics', 'IEB',  ARRAY[10,11], 'https://www.youtube.com/watch?v=kKKM8Y-u7ds', 'https://i.ytimg.com/vi/kKKM8Y-u7ds/hqdefault.jpg', 'The three laws of motion explained.', NULL),
    ('CrashCourse Physics — Electric Charge', 'Physical Sciences', 'Electricity', 'Cambridge', ARRAY[10,11,12], 'https://www.youtube.com/watch?v=TFlVWf8JX4A', 'https://i.ytimg.com/vi/TFlVWf8JX4A/hqdefault.jpg', 'Static electricity, charge and fields.', NULL),
    -- Chemistry
    ('CrashCourse Chemistry — The Periodic Table', 'Physical Sciences', 'Chemistry', 'CAPS', ARRAY[10,11], 'https://www.youtube.com/watch?v=0RRVV4Diomg', 'https://i.ytimg.com/vi/0RRVV4Diomg/hqdefault.jpg', 'Structure and trends of the periodic table.', NULL),
    ('CrashCourse Chemistry — Stoichiometry', 'Physical Sciences', 'Chemistry', 'IEB',  ARRAY[11,12], 'https://www.youtube.com/watch?v=UL1jmJaUkaQ', 'https://i.ytimg.com/vi/UL1jmJaUkaQ/hqdefault.jpg', 'Mole concept and reaction calculations.', NULL),
    ('CrashCourse Chemistry — Acids and Bases', 'Physical Sciences', 'Chemistry', 'Cambridge', ARRAY[10,11,12], 'https://www.youtube.com/watch?v=vt8fB3MFzLk', 'https://i.ytimg.com/vi/vt8fB3MFzLk/hqdefault.jpg', 'pH, acid-base equilibria and titrations.', NULL),
    -- Biology / Life Sciences
    ('CrashCourse Biology — That''s Why Carbon Is A Tramp', 'Life Sciences', 'Biochemistry', 'CAPS', ARRAY[10,11], 'https://www.youtube.com/watch?v=QnQe0xW_JY4', 'https://i.ytimg.com/vi/QnQe0xW_JY4/hqdefault.jpg', 'Biological molecules and the role of carbon.', NULL),
    ('CrashCourse Biology — DNA, Hot Pockets, & The Longest Word Ever', 'Life Sciences', 'Genetics', 'IEB', ARRAY[11,12], 'https://www.youtube.com/watch?v=8kK2zwjRV0M', 'https://i.ytimg.com/vi/8kK2zwjRV0M/hqdefault.jpg', 'DNA structure, replication, and transcription.', NULL),
    ('CrashCourse Biology — Photosynthesis', 'Life Sciences', 'Plants', 'Cambridge', ARRAY[9,10,11], 'https://www.youtube.com/watch?v=sQK3Yr4Sc_k', 'https://i.ytimg.com/vi/sQK3Yr4Sc_k/hqdefault.jpg', 'Light and dark reactions of photosynthesis.', NULL),
    -- English
    ('CrashCourse Literature — How and Why We Read', 'English', 'Literature', 'CAPS', ARRAY[10,11,12], 'https://www.youtube.com/watch?v=MSYw502dJNY', 'https://i.ytimg.com/vi/MSYw502dJNY/hqdefault.jpg', 'Introduction to literary analysis.', NULL),
    ('CrashCourse Literature — Romeo and Juliet', 'English', 'Shakespeare', 'IEB', ARRAY[10,11], 'https://www.youtube.com/watch?v=Y2H3DXyTSlA', 'https://i.ytimg.com/vi/Y2H3DXyTSlA/hqdefault.jpg', 'Themes and analysis of Romeo and Juliet.', NULL),
    -- Accounting / Economics
    ('CrashCourse Economics — Intro to Economics', 'Economics', 'Microeconomics', 'CAPS', ARRAY[10,11,12], 'https://www.youtube.com/watch?v=3ez10ADR_gM', 'https://i.ytimg.com/vi/3ez10ADR_gM/hqdefault.jpg', 'Scarcity, choice, and supply & demand.', NULL),
    ('CrashCourse Economics — Supply and Demand', 'Economics', 'Microeconomics', 'IEB', ARRAY[10,11,12], 'https://www.youtube.com/watch?v=g9aDayNGVfs', 'https://i.ytimg.com/vi/g9aDayNGVfs/hqdefault.jpg', 'How prices are set by supply and demand.', NULL),
    -- Geography / History
    ('CrashCourse World History — The Agricultural Revolution', 'History', 'World History', 'CAPS', ARRAY[8,9,10], 'https://www.youtube.com/watch?v=Yocja_N5s1I', 'https://i.ytimg.com/vi/Yocja_N5s1I/hqdefault.jpg', 'How farming reshaped human society.', NULL),
    ('CrashCourse Geography — Plate Tectonics', 'Geography', 'Earth Science', 'IEB', ARRAY[8,9,10,11], 'https://www.youtube.com/watch?v=RA2-Vc4PIeo', 'https://i.ytimg.com/vi/RA2-Vc4PIeo/hqdefault.jpg', 'Continental drift and plate boundaries.', NULL),
    ('CrashCourse Geography — Climate and Weather', 'Geography', 'Climate', 'Cambridge', ARRAY[8,9,10,11], 'https://www.youtube.com/watch?v=K0-ENXofxJI', 'https://i.ytimg.com/vi/K0-ENXofxJI/hqdefault.jpg', 'Drivers of weather and global climate.', NULL),
    -- Study skills
    ('Thomas Frank — How to Study Effectively', 'Study Skills', 'Learning', 'CAPS', ARRAY[8,9,10,11,12], 'https://www.youtube.com/watch?v=ukLnPbIffxE', 'https://i.ytimg.com/vi/ukLnPbIffxE/hqdefault.jpg', 'Evidence-based study techniques.', NULL),
    ('Ali Abdaal — How to Take Smart Notes', 'Study Skills', 'Note-taking', 'IEB', ARRAY[10,11,12], 'https://www.youtube.com/watch?v=BUgMl_a4FlA', 'https://i.ytimg.com/vi/BUgMl_a4FlA/hqdefault.jpg', 'A practical guide to note-taking systems.', NULL)
)
INSERT INTO public.library_system_resources
  (title, kind, subject, topic, curriculum, grade_levels, pdf_url, thumbnail_url, description, pages)
SELECT s.title, 'video', s.subject, s.topic, s.curriculum, s.grade_levels, s.pdf_url, s.thumbnail_url, s.description, s.pages
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.library_system_resources r
  WHERE r.title = s.title AND r.curriculum = s.curriculum AND r.kind = 'video'
);