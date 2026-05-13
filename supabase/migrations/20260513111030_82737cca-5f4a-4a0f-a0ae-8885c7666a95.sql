
-- 1) Ensure extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) Replace any existing schedule with the same name
do $$
begin
  if exists (select 1 from cron.job where jobname = 'weekly-insights-dispatch') then
    perform cron.unschedule('weekly-insights-dispatch');
  end if;
end $$;

-- 3) Schedule hourly dispatch (the edge function self-gates by day-of-week + idempotency table)
select cron.schedule(
  'weekly-insights-dispatch',
  '0 * * * *',
  $cron$
  select net.http_post(
    url := 'https://uynoykcratwbcdzmsxfw.supabase.co/functions/v1/send-guardian-report',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='CRON_SECRET' limit 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- 4) Seed 25 more free books (idempotent via NOT EXISTS on title)
insert into public.library_system_resources (title, kind, subject, curriculum, grade_levels, pdf_url, thumbnail_url, description)
select * from (values
  -- OpenStax (CC-BY)
  ('University Physics Volume 1 (OpenStax)', 'textbook', 'Physics', 'CAPS', array['Grade 12','A-Level','Form 6'], 'https://openstax.org/details/books/university-physics-volume-1', 'https://openstax.org/exports/cnx/college-physics-2e/cover.png', 'Mechanics, waves and thermodynamics — calculus-based introductory physics.'),
  ('University Physics Volume 2 (OpenStax)', 'textbook', 'Physics', 'CAPS', array['Grade 12','A-Level','Form 6'], 'https://openstax.org/details/books/university-physics-volume-2', 'https://openstax.org/exports/cnx/university-physics-volume-2/cover.png', 'Thermodynamics, electricity and magnetism.'),
  ('University Physics Volume 3 (OpenStax)', 'textbook', 'Physics', 'CAPS', array['Grade 12','A-Level','Form 6'], 'https://openstax.org/details/books/university-physics-volume-3', 'https://openstax.org/exports/cnx/university-physics-volume-3/cover.png', 'Optics and modern physics.'),
  ('Calculus Volume 1 (OpenStax)', 'textbook', 'Mathematics', 'CAPS', array['Grade 12','A-Level','Form 6'], 'https://openstax.org/details/books/calculus-volume-1', 'https://openstax.org/exports/cnx/calculus-volume-1/cover.png', 'Functions, limits, derivatives, and integration.'),
  ('Calculus Volume 2 (OpenStax)', 'textbook', 'Mathematics', 'CAPS', array['A-Level','Form 6'], 'https://openstax.org/details/books/calculus-volume-2', 'https://openstax.org/exports/cnx/calculus-volume-2/cover.png', 'Integration techniques, sequences and series.'),
  ('Calculus Volume 3 (OpenStax)', 'textbook', 'Mathematics', 'CAPS', array['A-Level','Form 6'], 'https://openstax.org/details/books/calculus-volume-3', 'https://openstax.org/exports/cnx/calculus-volume-3/cover.png', 'Multivariable calculus and vector analysis.'),
  ('Anatomy and Physiology (OpenStax)', 'textbook', 'Life Sciences', 'CAPS', array['Grade 11','Grade 12','A-Level'], 'https://openstax.org/details/books/anatomy-and-physiology-2e', 'https://openstax.org/exports/cnx/anatomy-and-physiology-2e/cover.png', 'Comprehensive coverage of human body systems.'),
  ('Principles of Economics 3e (OpenStax)', 'textbook', 'Economics', 'CAPS', array['Grade 11','Grade 12','A-Level'], 'https://openstax.org/details/books/principles-economics-3e', 'https://openstax.org/exports/cnx/principles-economics-3e/cover.png', 'Micro and macroeconomic foundations.'),
  ('Principles of Macroeconomics 3e (OpenStax)', 'textbook', 'Economics', 'CAPS', array['Grade 12','A-Level'], 'https://openstax.org/details/books/principles-macroeconomics-3e', 'https://openstax.org/exports/cnx/principles-macroeconomics-3e/cover.png', 'Macroeconomic theory, policy and global trade.'),
  ('Introduction to Sociology 3e (OpenStax)', 'textbook', 'Sociology', 'CAPS', array['Grade 11','Grade 12','A-Level'], 'https://openstax.org/details/books/introduction-sociology-3e', 'https://openstax.org/exports/cnx/introduction-sociology-3e/cover.png', 'Sociological perspectives on culture and society.'),

  -- Siyavula Grade 10 (CC-BY)
  ('Mathematics Grade 10 (Siyavula)', 'textbook', 'Mathematics', 'CAPS', array['Grade 10','Form 3'], 'https://www.siyavula.com/read/za/mathematics/grade-10', 'https://intl.siyavula.com/read/_static/img/grade10/za-maths-cover.png', 'Full Grade 10 mathematics curriculum.'),
  ('Mathematical Literacy Grade 10 (Siyavula)', 'textbook', 'Mathematical Literacy', 'CAPS', array['Grade 10','Form 3'], 'https://www.siyavula.com/read/za/mathematical-literacy/grade-10', 'https://intl.siyavula.com/read/_static/img/grade10/za-maths-lit-cover.png', 'Real-world maths for daily and financial life.'),
  ('Physical Sciences Grade 10 (Siyavula)', 'textbook', 'Physical Sciences', 'CAPS', array['Grade 10','Form 3'], 'https://www.siyavula.com/read/za/physical-sciences/grade-10', 'https://intl.siyavula.com/read/_static/img/grade10/za-physci-cover.png', 'Physics and chemistry foundations for Grade 10.'),
  ('Life Sciences Grade 10 (Siyavula)', 'textbook', 'Life Sciences', 'CAPS', array['Grade 10','Form 3'], 'https://www.siyavula.com/read/za/life-sciences/grade-10', 'https://intl.siyavula.com/read/_static/img/grade10/za-lifesci-cover.png', 'Cells, tissues, biodiversity and ecology.'),

  -- CK-12 (CC-BY-NC)
  ('CK-12 Algebra I', 'textbook', 'Mathematics', 'CAPS', array['Grade 8','Grade 9','Form 1','Form 2'], 'https://www.ck12.org/book/ck-12-algebra-i-second-edition/', 'https://www.ck12.org/flx/show/cover/book/5d574a6e8e0e08762a14fef9.png', 'Linear equations, functions and quadratics.'),
  ('CK-12 Geometry', 'textbook', 'Mathematics', 'CAPS', array['Grade 9','Grade 10','Form 2','Form 3'], 'https://www.ck12.org/book/ck-12-basic-geometry-concepts/', 'https://www.ck12.org/flx/show/cover/book/5d574a808e0e08762a14ff2c.png', 'Plane geometry, proofs, transformations.'),
  ('CK-12 Physical Science', 'textbook', 'Physical Sciences', 'CAPS', array['Grade 8','Grade 9','Form 1','Form 2'], 'https://www.ck12.org/book/ck-12-physical-science-for-middle-school/', 'https://www.ck12.org/flx/show/cover/book/5d574a988e0e08762a14ff96.png', 'Matter, motion, energy and waves.'),
  ('CK-12 Life Science', 'textbook', 'Life Sciences', 'CAPS', array['Grade 7','Grade 8','Grade 9','Form 1','Form 2'], 'https://www.ck12.org/book/ck-12-life-science-for-middle-school/', 'https://www.ck12.org/flx/show/cover/book/5d574a8b8e0e08762a14ff5d.png', 'Cells, genetics, evolution and ecosystems.'),
  ('CK-12 Middle School Math', 'textbook', 'Mathematics', 'CAPS', array['Grade 6','Grade 7','Grade 8'], 'https://www.ck12.org/book/ck-12-middle-school-math-grade-7/', 'https://www.ck12.org/flx/show/cover/book/5d574a778e0e08762a14ff0d.png', 'Foundational arithmetic, ratios and pre-algebra.'),

  -- Project Gutenberg (public domain)
  ('Macbeth (Shakespeare)', 'textbook', 'English', 'CAPS', array['Grade 11','Grade 12','IGCSE','O-Level','A-Level','Form 4','Form 5','Form 6'], 'https://www.gutenberg.org/ebooks/1533', 'https://www.gutenberg.org/cache/epub/1533/pg1533.cover.medium.jpg', 'Shakespeare''s tragedy of ambition and downfall.'),
  ('Hamlet (Shakespeare)', 'textbook', 'English', 'CAPS', array['Grade 11','Grade 12','A-Level','Form 5','Form 6'], 'https://www.gutenberg.org/ebooks/1524', 'https://www.gutenberg.org/cache/epub/1524/pg1524.cover.medium.jpg', 'The Prince of Denmark''s revenge tragedy.'),
  ('Great Expectations (Dickens)', 'textbook', 'English', 'CAPS', array['Grade 10','Grade 11','IGCSE','O-Level','Form 4','Form 5'], 'https://www.gutenberg.org/ebooks/1400', 'https://www.gutenberg.org/cache/epub/1400/pg1400.cover.medium.jpg', 'Pip''s coming-of-age story in Victorian England.'),
  ('Frankenstein (Shelley)', 'textbook', 'English', 'CAPS', array['Grade 11','Grade 12','A-Level','Form 5','Form 6'], 'https://www.gutenberg.org/ebooks/84', 'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg', 'Mary Shelley''s gothic novel of creation and consequence.'),
  ('Jane Eyre (Brontë)', 'textbook', 'English', 'CAPS', array['Grade 11','Grade 12','A-Level','Form 5','Form 6'], 'https://www.gutenberg.org/ebooks/1260', 'https://www.gutenberg.org/cache/epub/1260/pg1260.cover.medium.jpg', 'Charlotte Brontë''s landmark bildungsroman.'),
  ('Wuthering Heights (Brontë)', 'textbook', 'English', 'CAPS', array['Grade 11','Grade 12','A-Level','Form 5','Form 6'], 'https://www.gutenberg.org/ebooks/768', 'https://www.gutenberg.org/cache/epub/768/pg768.cover.medium.jpg', 'Emily Brontë''s passionate Yorkshire moors saga.')
) as v(title, kind, subject, curriculum, grade_levels, pdf_url, thumbnail_url, description)
where not exists (
  select 1 from public.library_system_resources r where r.title = v.title
);
