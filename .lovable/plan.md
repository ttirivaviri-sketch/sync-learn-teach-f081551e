
# P12 + P13 + P14 — StudyMode School Intelligence (Finalization)

Builds on the existing P9–P11 stack (context snapshot, school chunks, homework, shared flashcards/quizzes). No new StudyMode product — these are enhancements to the existing engine, gated by `useStudyContext().school`.

## P12 — Daily Tasks Personalization + Gap Detection

### 1. Fuse tutor signals into Daily Tasks
Extend `useDailyTasks` / `useStructuredDailyTask` ranking so when `context.school` is present and a subject matches the student's `subject_ids`:

- **Upcoming tutor bookings (next 7 days)**: read `bookings` joined to `tutor_subjects` where `learner_id = user` and subject matches. Inject a "Prep for your session with {tutor}" task surfacing related concepts/weak topics for that subject. Card-level only — no booking logic touched.
- **Tutor materials**: query `tutor_tutorials` (status=published) and `school_resources` filtered by curriculum + subject + (optional) topic from `topic_mastery`. Surface as a "Recommended clip" task that deep-links to the existing Study Clips viewer.
- **Homework-driven tasks**: if `school_homework_responses` for the student has `status in ('ai_marked','released')` with `ai_score / marks < 0.6`, emit a "Practice {topic}" task using the rubric's `concepts`.

All injection happens client-side inside the existing daily-task ranker — no new edge function for ordering.

### 2. Gap detection → weak-topic reports + practice tasks
New edge function `studymode-detect-gaps` (verify_jwt) that, for the current student:

- Aggregates wrong answers from `quiz_attempts`, `daily_task_attempts`, and `school_homework_responses` over the last 30 days
- Groups by `topic` / `concepts[]`, computes accuracy + attempt count
- Returns `{ weak_topics: [{ topic, subject_id, accuracy, attempts, evidence_source[] }], suggested_tasks: [...] }`

Client hook `useLearningGaps(userId)` caches via React Query (10 min). Renders into a new `WeakTopicReport` panel on the StudyMode dashboard (school context only — solo learners keep existing `AIWeakTopicAlerts`). "Generate practice" button materializes the suggested tasks into the daily-task queue.

### 3. Files (P12)
- `supabase/functions/studymode-detect-gaps/index.ts` (new)
- `supabase/config.toml` — register function (verify_jwt = true)
- `src/hooks/useLearningGaps.ts` (new)
- `src/studymode/hooks/useTutorMaterialRecommendations.ts` (new) — pulls tutorials/resources scoped to context
- `src/studymode/hooks/useDailyTasks.ts` — extend with school-aware fusion (additive)
- `src/studymode/components/WeakTopicReport.tsx` (new) — school-context panel
- `src/studymode/components/Dashboard.tsx` — mount `WeakTopicReport` and `SchoolHomeworkRail` (still unmounted from prior phase) under school context

## P13 — Student Analytics Counters & Trends (school workspace)

### 1. Aggregation
New table `student_analytics_daily` (one row per student per day):
- `tasks_completed`, `homework_completed`, `quiz_avg_score`, `quiz_count`, `flashcards_reviewed`, `flashcard_mastery_avg`, `resources_opened`, `minutes_studied`

Populated incrementally by triggers on `daily_task_attempts`, `school_homework_responses` (status=released), `quiz_attempts`, `flashcards` (last_reviewed_at), `library_access_log` / `tutorial_watch_events`. Plus a `rebuild_student_analytics_today(_user_id)` RPC used on demand.

### 2. RPC for trends
`get_student_analytics(_user_id, _from, _to)` returns daily series + 7d/30d rollups + sparkline values. Teachers/admins may pass any student in their class (RLS via `school_memberships`); students may pass only themselves.

### 3. UI
- Student-facing: `StudentAnalyticsPanel` mounted in `StudentWorkspace.tsx` — 5 counter tiles (tasks / homework / quiz avg / flashcard mastery / resources) + 30-day sparkline per metric.
- Teacher-facing: extend `TeacherClassDetail.tsx` with a "Student analytics" tab listing class students with the same counters; click-through opens that student's detail.
- Admin-facing: `SchoolAnalytics.tsx` gets an aggregated "Learning outcomes" section (avg per metric across the school, last 14d).

### 4. Files (P13)
- `supabase/migrations/<ts>_student_analytics.sql` — table, GRANTs, RLS, triggers, RPC
- `src/hooks/useStudentAnalytics.ts` (new)
- `src/components/school/StudentAnalyticsPanel.tsx` (new)
- `src/pages/school/student/StudentWorkspace.tsx` — mount panel
- `src/pages/school/teacher/TeacherClassDetail.tsx` — add analytics tab
- `src/pages/school/SchoolAnalytics.tsx` — add learning-outcomes block

## P14 — Hardening

### 1. Strict school isolation tests
Add `tests/suite.mjs` cases that hit each edge function with a forged `school_id` and assert 403. Covers: `studymode-context-retrieve`, `studymode-generate-school-flashcards`, `studymode-generate-school-quiz`, `studymode-generate-homework`, `studymode-mark-homework`, `studymode-release-homework`, `studymode-detect-gaps`.

### 2. Rate limits + quota
Wrap every studymode-* school function with `check_school_ai_quota` (already exists) + `increment_school_ai_usage`. Add per-user rate limit via `check_and_increment_ai_usage` (`bucket = 'studymode_school'`, limit per plan).

### 3. Error surfaces
- `lib/schoolContract.ts`: extend so contract denials from new functions render a unified toast + banner (reuses existing P8 contract-gate UI).
- All new hooks return `{ data, error, isLoading }` and surface errors through the existing `useToast` pattern.

### 4. Solo-learner safety
Add an integration test asserting that `context.school === null` users:
- Do not see `WeakTopicReport`, `SchoolHomeworkRail`, tutor-prep daily tasks
- Still get the existing `AIWeakTopicAlerts`
- Continue to see the "Join a school" CTA from prior phase

### 5. Files (P14)
- `tests/suite.mjs` — add suites: `school-isolation`, `studymode-quota`, `solo-learner-fallback`
- `supabase/functions/_shared/school-generators.ts` — add `enforceQuota(school_id, user_id)` helper, wire into all generator functions
- `src/lib/schoolContract.ts` — extend mapper for new function names
- Minor edits across existing studymode hooks for error/empty states

## Technical notes

- **One StudyMode**: every change is additive behind `context.school`. Solo flows are untouched.
- **No second AI system**: gap detection reuses the existing Lovable Gateway client in `studymode/lib/aiClient.ts`; school content retrieval continues to flow through `studymode-context-retrieve`.
- **Cost control**: detect-gaps runs on demand + cached 10 min; analytics aggregation is trigger-based (cheap), with `rebuild_student_analytics_today` for force-refresh.
- **Privacy**: `student_analytics_daily` RLS — student reads own; teacher reads if shares a class (via `school_memberships` + `enrollments`); admin reads if `school_admin` of student's school.

## Out of scope

- No new dashboard product, no second tutor system, no schema changes to `flashcards`/`quizzes` beyond what P10 already added.
- Booking/tutor-marketplace logic is read-only here.
