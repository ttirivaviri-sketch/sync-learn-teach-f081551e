Six tracked items. Grouping by surface area so you can approve in one pass.

## 1. Admin Analytics — Study Mode tab
New page `src/pages/admin/StudyAnalytics.tsx`, linked from `AdminLayout`. Three panels driven by Supabase RPCs (added in a migration):

- **Completion rate per subject** — `daily_tasks` grouped by `subject_id`, `is_completed` over last 30d.
- **Regen usage** — count of `daily_tasks` where `task_payload->__meta->>regen_count > 0`, plus avg/max per subject.
- **Mastery progression** — average `mastery_percentage` from `topic_mastery` per subject, with 7d delta sparkline (uses existing `useMasteryHistory` pattern).

Recharts for visuals; cards follow the glassmorphism theme. Admin-only via existing `has_role` gate.

## 2. Regen toasts
In `StructuredDailyTaskRunner.tsx`, wire `sonner` toasts:
- Success: `toast.success("New task generated (X/3 today)")`
- Limit reached: `toast.error("Daily regenerate limit reached — try again tomorrow")` plus inline disabled state with helper text under the button.
- Triggered from the `regenerate()` promise in the hook; hook already returns `error` + `regenCount`.

## 3. Verify quiz mastery reads from `quiz_attempts`
Audit-only — read `useSpacedRepetition`, `useTopicPerformance`, `useConceptMastery`, `useWeakConcepts`, `useRecallEngine`. Confirm each queries `quiz_attempts`. Report findings inline; patch any hook still pointing at the old source.

## 4. Backfill `quiz_attempts` from `daily_task_attempts`
One-time migration that inserts a `quiz_attempts` row for every existing `daily_task_attempts` row missing a mirror (matched on `user_id + question + created_at` to avoid double-mirroring rows created after the mirror change). Default SR fields: `ease_factor=2.5`, `interval_days=1`, `review_count=0`, `next_review_date=created_at::date`.

## 5. Flashcard tile in the bundle
Add a 5th block to the structured bundle:
- Extend `generate-daily-task` edge function prompt + response schema to include `blocks.flashcards: Array<{front, back, concept, hint?}>` (4–6 cards).
- Update `StructuredTaskBundle` type and `StructuredDailyTaskRunner` to render a flashcard step (reuse `FlashcardPanel` styling).
- On flip+self-grade, persist via existing `flashcards` table (so it joins spaced repetition) AND mirror to `quiz_attempts` via `useDailyTaskAttempts` with `block='flashcard'`, so mastery picks it up.

## 6. Per-app auth sessions (learner / tutor / admin)
Today a single Supabase client uses `localStorage` with one key, so login bleeds across surfaces. Fix:

- Replace the singleton in `src/integrations/supabase/client.ts` with a **scoped storage adapter** that prefixes every key by app surface: `sb-learner-…`, `sb-tutor-…`, `sb-admin-…`.
- Surface is detected from the URL path on client init (`/tutor` → tutor, `/admin` → admin, else learner) and locked in for the page lifetime.
- Each app's `AuthProvider` (`useAuth`) reads only its own scoped session. Signing in on `/tutor-auth` writes only the tutor-scoped key; visiting `/admin` shows logged-out unless an admin session exists under the admin key.
- `signOut()` clears only the current scope.
- Migration shim on first load: if legacy `sb-…-auth-token` exists, copy it to the **learner** scope only and remove the original (prevents existing users getting logged out everywhere unexpectedly; tutor/admin stay logged out until they re-auth on those surfaces).

Note: this is session-scoping, not separate accounts. The same email can hold learner + tutor + admin roles; the user simply has to authenticate each surface independently per browser. This matches the requested behaviour.

## Technical details

**New migration files:**
- `..._study_admin_rpcs.sql` — three `security definer` RPCs gated by `has_role('admin')` returning JSON.
- `..._backfill_quiz_attempts.sql` — idempotent backfill.

**Files touched:**
- `src/integrations/supabase/client.ts` — scoped storage adapter
- `src/hooks/useAuth.ts` — scope-aware initialisation
- `src/pages/admin/AdminLayout.tsx` — nav link
- `src/pages/admin/StudyAnalytics.tsx` — new
- `src/studymode/components/StructuredDailyTaskRunner.tsx` — toasts + flashcard step
- `src/studymode/hooks/useStructuredDailyTask.ts` — surface success/limit signals
- `src/studymode/hooks/useDailyTaskAttempts.ts` — flashcard block mirroring
- `supabase/functions/generate-daily-task/index.ts` — flashcard block in schema
- Audit-only reads: `useSpacedRepetition.ts`, `useTopicPerformance.ts`, `useConceptMastery.ts`, `useWeakConcepts.ts`, `useRecallEngine.ts`

**Risks:**
- Scoped-storage change requires re-login on tutor and admin surfaces for existing users. Acceptable per the request.
- Backfill could be large; runs once at migration time inside a single statement with `INSERT … SELECT … WHERE NOT EXISTS`.
