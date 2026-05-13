## Where we are

Last turn we shipped the branded Insights template, recipient gating, weekly dispatcher, and seeded 25 books. Three follow-ups were offered: schedule the cron, set up the email domain, add 25 more books. You said skip domain.

## On `/start-trial` placement

It should **stay at the top level**, not under `/learner`. Reason: `TrialSignupFlow` is shared — `?role=learner` and `?role=tutor` both route through it (see `HeroSection.tsx` calling it for both roles). Moving it under `/learner` would either break the tutor signup path or force a duplicate route. Top-level `/start-trial` is the right shape for a role-agnostic onboarding entry.

If you want a cosmetic tidy, I can co-locate the file at `src/pages/onboarding/TrialSignupFlow.tsx` without changing the URL — but functionally nothing's wrong.

## This turn

### 1. Activate the weekly cron

Schedule `send-guardian-report` to run hourly via `pg_cron` + `pg_net`, gated by `CRON_SECRET`. The function already:
- Iterates learners whose local DOW matches `weekly_report_dow`
- Skips learners with an existing `scheduled_insight_runs` row for the current week
- Sends one guardian email + one per booked tutor, then upserts the run row

Migration adds:
```sql
select cron.schedule(
  'weekly-insights-dispatch',
  '0 * * * *',
  $$ select net.http_post(
       url := '<project>/functions/v1/send-guardian-report',
       headers := jsonb_build_object(
         'Content-Type','application/json',
         'Authorization','Bearer ' || current_setting('app.cron_secret', true)
       ),
       body := '{}'::jsonb
     ); $$
);
```
`CRON_SECRET` will be set as a Postgres GUC via the migration (value taken from the existing edge-function secret).

Note: until the email domain is verified, sends still only deliver to the Resend account owner. The cron is harmless to enable now and will start delivering the moment the domain is set up.

### 2. Seed 25 more free books

Add a second idempotent `INSERT … ON CONFLICT (title) DO NOTHING` migration covering gaps in the current library:

- **OpenStax**: University Physics Vol 1–3, Calculus Vol 1–3, Anatomy & Physiology, Economics 3e, Principles of Macroeconomics, Sociology 3e, US History (10 books)
- **Siyavula**: Maths/Phys-Sci/Life-Sci/Maths-Lit Grade 10 (already had 11/12 — fills Grade 10 gap, 4 books)
- **CK-12**: Algebra I, Geometry, Physical Science, Life Science, Middle School Math (5 books)
- **Project Gutenberg**: *Things Fall Apart* (where PD), *Animal Farm* extract, *Macbeth*, *Hamlet*, *Great Expectations*, *Frankenstein* (6 books — set-work coverage)

Each row: real cover URL, `grade_levels` array spanning Form/Grade/IGCSE/O-Level/A-Level, curriculum tags (`ZIMSEC`/`CAMB`/`IEB`/`NSC`).

## Out of scope this turn
- Email domain DNS setup (you said skip)
- Moving `TrialSignupFlow` file location (no functional benefit)

## Order of operations
1. Migration: cron schedule + GUC for `CRON_SECRET`
2. Migration: 25 additional library books
