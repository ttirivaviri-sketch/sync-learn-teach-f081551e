## Goal
Begin unifying the ecosystem by introducing a single learning timeline that every surface (learner, tutor, school) reads and writes. This is steps 1–4 of §4 from the audit and unlocks the rest of the cross-surface work.

## Scope of this first PR

### 1. New `learning_events` table (migration)
One append-only spine row per meaningful learning action.

Columns:
- `id`, `user_id` (auth user), `school_id` (nullable), `subject_id` (nullable), `topic_name` (text, nullable)
- `source` (enum-ish text: `topic_session`, `school_homework`, `lesson_reinforcement`, `school_quiz`, `daily_task`, `mock_exam`, `booking_completed`)
- `score_pct` (numeric, nullable), `mastery_delta` (numeric, nullable)
- `payload` (jsonb), `occurred_at` (timestamptz, default now())

RLS: user reads own rows; service_role full; school staff can read rows where `school_id` matches a school they belong to (via existing `has_school_role` helper). GRANTs in the same migration.

Index on `(user_id, occurred_at desc)` and `(school_id, occurred_at desc)`.

### 2. `logLearningEvent()` client helper
`src/lib/learningEvents.ts` — single typed insert helper used everywhere. No throwing on failure (best-effort, logged).

### 3. Wire the first three writers
- `useTopicSessionRunner.endSession()` — logs `topic_session` with accuracy + xp.
- School homework submit (`useSchoolStudyMode` submit path) — logs `school_homework` with score.
- Lesson reinforcement completion — logs `lesson_reinforcement` with quiz score.

### 4. Shared read hook
`src/hooks/useLearningTimeline.ts` — `useLearningTimeline({ userId, schoolId?, limit? })` with one React Query key `['learning-timeline', userId, schoolId]`. Becomes the single source for future widgets (StudentBriefingCard, learner activity, school analytics).

## Out of scope (next PRs)
- `<StudentBriefingCard>` in TutorHomeTab/VideoMeeting
- Migrating `topic_mastery` reads to a shared key
- Notification system consolidation
- Subscription gating sweep
- PayFast/Paystack adapter extraction

## Technical notes
- No edge function changes needed yet — all writes happen client-side from existing hooks.
- `learning_events` is additive; nothing in current code breaks.
- Future server-side writers (edge functions awarding XP, SAIL) can insert with `service_role`.
