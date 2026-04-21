

## Plan: Fix Maths lock + add per-subject & global leaderboards

### Part 1 — Fix "Mathematics is locked"

**Root cause** (`src/studymode/hooks/useSubjects.ts`, line 93): when no `topic_mastery` row exists, every topic past index 0 defaults to `isLocked: true`. If Maths topics aren't ordered the way you expect, or topic[0] never gets unlocked via `topic_mastery`, the `currentTopic` falls back to a locked one and the whole card is overlaid.

**Fix**: Default new topics to **unlocked** (Duolingo-style, you can attempt anything; mastery still gates "ready"). Change line 93 from `mastery?.is_locked ?? index > 0` to `mastery?.is_locked ?? false`. Also remove the full-card "Topic Locked" overlay in `SubjectCard.tsx` — it's misleading; only individual *tasks* should ever show locked.

### Part 2 — Leaderboards (per-subject + overall)

Duolingo-style: real-time XP rankings, your position visible even outside top 10, streak per subject, updates whenever a task/quiz is completed.

#### Database (1 new table + 1 RPC)

**`subject_xp` table** — tracks XP and streak per (user, subject, curriculum):
```
id uuid pk
user_id uuid not null
subject text not null            -- e.g. "Mathematics"
curriculum text not null         -- e.g. "ZIMSEC" (from academic_profiles)
xp integer not null default 0
streak integer not null default 0
last_activity_date date
updated_at timestamptz
unique (user_id, subject, curriculum)
```
RLS: users can SELECT all rows (leaderboard is public-by-curriculum-and-subject), INSERT/UPDATE only their own. Index on `(curriculum, subject, xp desc)` for fast top-N.

**`get_subject_leaderboard(p_curriculum, p_subject, p_limit)` RPC** (SECURITY DEFINER): returns top N rows joined with `profiles` (full_name, avatar_url) + the caller's own rank+xp+streak even when outside top N. Returns `{ top: [...], me: { rank, xp, streak, total_participants } }`.

**`get_overall_leaderboard(p_curriculum, p_limit)` RPC**: same shape but aggregates `SUM(xp)` and `MAX(streak)` per user across all subjects in that curriculum.

#### XP awarding (server-side via small edge function or client upsert)

Hook into existing completion paths:
- `useDailyTasks` task completion → +10 XP for that subject
- `quiz_attempts` insert (correct) → +25 XP, (incorrect) → +5 XP
- Mock exam submitted → +50 XP

Add `src/studymode/hooks/useSubjectXP.ts` with `awardXP(subject, curriculum, amount)` that upserts `subject_xp`, recomputes streak (same logic as existing `useUserProgress.updateStreak` but per subject), and invalidates leaderboard queries.

Wire it in:
- `src/studymode/hooks/useDailyTasks.ts` — on `is_completed: true` update
- `src/studymode/components/ActiveRecallSession.tsx` / `ExamModeSession.tsx` — after each grade
- `src/studymode/hooks/useMockExam.ts` — on submit

#### UI

**1. New component `src/studymode/components/Leaderboard.tsx`** — modal/sheet showing:
- Header: subject name + curriculum badge + "🏆 Leaderboard"
- Top 10 list: rank, avatar, name, XP, streak (🔥 N)
- Highlighted "your row" pinned at bottom if user not in top 10 (e.g. "#247 of 1,832")
- Live updates via Supabase realtime channel on `subject_xp` filtered by `subject + curriculum`

**2. Trigger button in `SubjectDetail.tsx`** — small "🏆 Leaderboard" button in the header next to the subject title, opens the sheet for that subject.

**3. Overall leaderboard** — add a "🏆 Global" button on the **Subjects tab** of `Dashboard.tsx` (top-right). Opens the same component in "overall" mode (no subject filter).

**4. Hook `useLeaderboard(subject?, curriculum)`** — wraps the RPC + sets up realtime subscription, returns `{ top, me, isLoading }`.

#### Real-time behaviour

- Subscribe to `postgres_changes` on `subject_xp` with filter `curriculum=eq.X` (and `subject=eq.Y` for per-subject view).
- On any change, refetch the RPC (debounced 500ms). User position recalculates instantly.
- Optimistic update on own XP award so the user sees their bar move before the network round-trip.

### Files

**DB**: 1 migration (`subject_xp` table, 2 RPCs, RLS, index, realtime publication)

**New**:
- `src/studymode/hooks/useSubjectXP.ts`
- `src/studymode/hooks/useLeaderboard.ts`
- `src/studymode/components/Leaderboard.tsx`

**Modified**:
- `src/studymode/hooks/useSubjects.ts` (unlock fix)
- `src/studymode/components/SubjectCard.tsx` (remove lock overlay)
- `src/studymode/components/SubjectDetail.tsx` (Leaderboard button)
- `src/studymode/components/Dashboard.tsx` (Global Leaderboard button on Subjects tab)
- `src/studymode/hooks/useDailyTasks.ts`, `useMockExam.ts`, recall/exam session components (award XP on completion)

### Result

- Mathematics (and every subject) is no longer locked — topics are attemptable from day one; only mastery-progression badges gate.
- Each subject card has a "🏆 Leaderboard" button → top 10 by XP + your rank + streak, real-time per (subject, curriculum).
- A "🏆 Global" button on the Subjects tab shows overall XP across all subjects in your curriculum.
- Every task/quiz/exam completion bumps XP and the leaderboard updates live for everyone watching.

