-- Product feedback loop: capture per-AI-output thumbs feedback and
-- 1-question session pulse ratings so we can measure whether each study
-- surface is actually helping students (week-3 churn antidote).
--
-- Two kinds of rows share one table, discriminated by `kind`:
--   kind = 'output'  -> thumbs up/down on a specific AI output
--   kind = 'pulse'   -> 1-5 "did this session help?" rating
--
-- `surface` identifies where feedback came from, e.g.:
--   photo_solve, photo_solve_practice, quiz, mock_exam, topic_session,
--   school_homework, flashcards, ai_tutor, daily_task, explain_answer

create table public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('output', 'pulse')),
  surface text not null,
  -- output feedback
  sentiment text check (sentiment in ('up', 'down')),
  reason text,        -- optional chip: wrong_answer | too_easy | too_hard | confusing | off_syllabus | slow | other
  comment text,       -- optional free text (short)
  -- pulse feedback
  rating smallint check (rating between 1 and 5),
  -- context
  subject_name text,
  topic_name text,
  context jsonb not null default '{}'::jsonb, -- e.g. { attempt_id, question_id, score_pct }
  created_at timestamptz not null default now(),
  -- shape guards
  constraint feedback_output_shape check (
    kind <> 'output' or sentiment is not null
  ),
  constraint feedback_pulse_shape check (
    kind <> 'pulse' or rating is not null
  )
);

alter table public.feedback_events enable row level security;

-- Students insert their own feedback and can read it back.
create policy "Users insert own feedback"
  on public.feedback_events
  for insert
  with check (auth.uid() = user_id);

create policy "Users read own feedback"
  on public.feedback_events
  for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

grant select, insert on public.feedback_events to authenticated;

-- Analytics access patterns: per-surface trend, per-user dedupe checks.
create index idx_feedback_events_surface_created
  on public.feedback_events (surface, created_at desc);
create index idx_feedback_events_user_created
  on public.feedback_events (user_id, created_at desc);
