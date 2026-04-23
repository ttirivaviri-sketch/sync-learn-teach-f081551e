

# Plan: Persist Completion + Keep Tasks Replayable Until Midnight

## Problem
Today, when a learner completes a daily task, it gets marked **Done** in the DB (good — that already persists until midnight via `task_date = CURRENT_DATE`), **but** the UI then makes the completed task tile non-clickable. Same for locked tiles after the chain breaks. So learners can't re-enter Active Recall, Flashcards, Concept Learning, or AI Exam Question for the rest of the day even though they want to keep practising.

The DB-side memory already works (tasks for today are loaded on every session). The fix is purely about **letting completed tasks be re-opened** and **unlocking everything once the daily set is finished**.

## Changes

### 1. `src/studymode/components/TaskList.tsx`
- Allow clicks on **completed** tasks (not just incomplete unlocked ones). Keep the green "Done" styling and check icon, but make the row `cursor-pointer` and fire `onTaskClick`. Show a subtle "Replay" hint instead of hiding the chevron.
- When `allCompleted` is true, also force-unlock any task still flagged `isLocked` in the rendered list so the learner can freely jump between all 5 components.
- Keep the existing "Practice More — Add Another Task" button as-is.

### 2. `src/studymode/components/SubjectDetail.tsx`
- `handleTaskComplete`: stop awarding XP / updating streak / writing `study_activity` if `selectedTask.isCompleted` was already true at open time (i.e. this is a replay). Replays should still let the learner *do* the activity but must NOT re-award XP or inflate streak — otherwise the leaderboard becomes farmable.
- Remove the auto-`setSelectedTask(null)` close behaviour for replays so the learner can keep iterating inside (e.g. Flashcards, Active Recall) without being kicked back to the task list. The completion card only shows on first completion.
- After a task finishes loading, if `currentTasks.every(t => t.isCompleted)`, mark all `isLocked = false` in local state so the chain is fully open.

### 3. `src/studymode/hooks/useDailyTasks.ts`
- `completeTask` mutation: if the task being completed is already `is_completed`, short-circuit (no DB write, no unlock-next). This protects against double-XP from replays.
- Add a derived helper `allSubjectTasksDone(subjectId)` returning `true` once every task for that subject today has `is_completed = true`. Export it so `SubjectDetail` can rely on it instead of recomputing.
- In `getTasksForSubject`: when all of a subject's tasks for today are completed, return them with `isLocked = false` across the board (defensive — covers any task that was seeded locked but never reached because the learner replayed earlier ones).

### 4. Replay XP guard (server-side belt-and-braces)
- No DB schema change needed — `daily_tasks.completed_at` already records the original completion timestamp. The `completeTask` short-circuit above ensures replays don't bump XP/streak/activity rows.
- `ActiveRecallSession`, `FlashcardPanel`, `ExamQuestionPanel`, `TaskContentPanel` already write their own per-attempt rows (`quiz_attempts`, flashcard SR data, etc.) — those SHOULD continue to fire on replays so spaced-repetition and mastery keep updating from real practice. Only the **task-completion XP** is suppressed.

## What stays the same
- Tasks still reset at midnight via `task_date = CURRENT_DATE` filter — already correct.
- Quick Launch tiles (Active Recall, Exam Mode, Mastery, Insights) are already freely accessible at any time.
- Bonus task button still appears when all are done.
- "Continue to Next Task" auto-advance still works on first completion.

## Files touched
- `src/studymode/components/TaskList.tsx` — allow replay clicks, unlock all when complete
- `src/studymode/components/SubjectDetail.tsx` — suppress XP on replay, keep panel open during replay, force-unlock when all done
- `src/studymode/hooks/useDailyTasks.ts` — short-circuit `completeTask` for already-done tasks, expose `allSubjectTasksDone`, defensive unlock in `getTasksForSubject`

## Result
- Completed tasks visibly stay "Done ✓" but are tappable, opening the same Active Recall / Flashcards / Exam Question / Concept panels for unlimited replays until midnight.
- Once all tasks for a subject are complete, every component is unlocked — learner has full freedom.
- XP and streak award **once per task per day**, no farming.
- Underlying practice data (quiz attempts, flashcard reviews, mastery) keeps updating on every replay so the AI engine still benefits.

