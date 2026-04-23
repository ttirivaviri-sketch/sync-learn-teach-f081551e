

# Plan: Reduce Replay XP to 3–5 by Difficulty

## Behaviour
When a learner re-opens a task that was already completed today (`task.isCompleted === true`), all XP awarded inside the practice/exam panels gets discounted to a small "practice bonus" instead of full XP. First-time completion XP stays exactly as today.

## XP table (replay mode)

| Question difficulty | First attempt XP | Replay XP |
|---|---|---|
| easy practice | 3 | **2** |
| medium practice | 5 | **3** |
| hard practice | 8 | **5** |
| Exam-question submit | 10 | **5** |
| Active-recall submit (legacy) | 15 | **4** |
| Active-recall reveal-early | −5 | **0** (no penalty on replay) |

This sits inside the user's stated "3–5 depending on difficulty" range for practice questions, with the exam question slightly higher (5) and an early-reveal no-op so replays can't farm or be penalised.

## Changes

### 1. `src/studymode/components/StructuredDailyTaskRunner.tsx`
- Accept the parent's `dailyTask.isCompleted` as the replay flag (already in props as `task: dailyTask`).
- Add a second XP map:
  ```ts
  const DIFFICULTY_XP        = { easy: 3, medium: 5, hard: 8 };
  const DIFFICULTY_XP_REPLAY = { easy: 2, medium: 3, hard: 5 };
  ```
- In `submitPractice`: pick the replay map when `dailyTask.isCompleted`. Still call `addXp.mutate(xp)` and `awardXP.mutate({...})` so leaderboards stay in sync, just with the smaller value. Skip `updateStreak.mutate()` on replays (streak should not extend from replay practice).
- In `submitExam`: award **5 XP** on replay instead of 10, skip streak update.
- Update the inline "+X XP" labels in the success card and the exam submit button so the badge reads the correct number for the current mode (e.g. "Submit & Reveal Mark Scheme (+5 XP)" on replay).
- Add a small "Replay practice — reduced XP" pill near the header when `dailyTask.isCompleted` so the learner understands why XP is lower.

### 2. `src/studymode/components/TaskContentPanel.tsx` (LegacyTaskContentPanel)
- Read `task.isCompleted` as `isReplay`.
- `handleSubmitAnswer`: award **4 XP** instead of 15 on replay; skip `updateStreak.mutate()`.
- `handleRevealEarly`: award **0 XP** on replay (no penalty — the task is already done, penalising a replay would be punitive). Keep −5 penalty for first attempt.
- Update the "+15 XP" / "(−5 XP)" button labels dynamically.

### 3. Subject XP / leaderboard sync
The existing `useSubjectXP.awardXP` mutation is already called from `StructuredDailyTaskRunner` indirectly via `useUserProgress.addXp` only — it is NOT currently per-question. Add a `useSubjectXP().awardXP.mutate({ subject, curriculum, amount: xp })` call alongside `addXp.mutate(xp)` in the practice + exam handlers so subject leaderboards see the reduced replay XP too. Pass `subject.name` and `curriculum` (already accessible via the subject prop / new `curriculum` prop threaded down — the runner currently doesn't take `curriculum`, so add it as an optional prop forwarded from `SubjectDetail` → `TaskContentPanel` → `StructuredDailyTaskRunner`, defaulting to `'ZIMSEC'`).

## What stays the same
- First-completion XP (10 from `SubjectDetail.handleTaskComplete`, 3/5/8 per question, 10 for exam, 15 for active recall) — unchanged.
- Streak only advances on first completion or first-attempt practice; replays never bump streak.
- `completeTask` mutation already short-circuits the DB write for replays — no change needed.
- Quiz attempts, flashcard SR data, mastery updates continue to fire on every replay.

## Files touched
- `src/studymode/components/StructuredDailyTaskRunner.tsx` — add replay XP map, replay pill, dynamic labels, subject-XP sync
- `src/studymode/components/TaskContentPanel.tsx` — replay-discounted active recall XP, no penalty on replay reveal, dynamic labels, propagate `curriculum` prop
- `src/studymode/components/SubjectDetail.tsx` — pass `curriculum` down to `TaskContentPanel`

## Result
Replay practice rewards a small 2–5 XP per question (3–5 for medium/hard) and 5 XP for the exam question, never advances streaks, and never penalises. Leaderboards stay accurate with the reduced amounts. First-time completion economics are untouched.

