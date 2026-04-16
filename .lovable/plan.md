

## Plan: Study Mode Task Memory, Persistence & Reminders

### Problem
1. Task completions are only stored in React state — leaving Study Mode loses all progress
2. Tasks regenerate fresh each visit because `SubjectDetail` never calls `completeTask.mutate()`
3. No option to do additional tasks after finishing daily set
4. No reminders about missed tasks or streak before daily reset

### Changes

**1. Wire DB persistence into SubjectDetail (`src/studymode/components/SubjectDetail.tsx`)**
- Accept `onCompleteTask` callback prop (the `completeTask.mutate` from `useDailyTasks`)
- In `handleTaskComplete`, call `onCompleteTask(selectedTask.id)` alongside the local state update
- This ensures completions are persisted to the `daily_tasks` table

**2. Pass completeTask down from Dashboard (`src/studymode/components/Dashboard.tsx`)**
- Pass `completeTask.mutate` as `onCompleteTask` prop to `SubjectDetail`
- Also call `ensureTasks.mutate()` on mount to seed today's tasks if missing

**3. Add "Do Another Task" button (`src/studymode/components/SubjectDetail.tsx`)**
- When all 5 daily tasks for a subject are completed, show a "Practice More" card
- Clicking it generates a bonus task (random type from the task pool) with a unique ID suffix (`-bonus-{timestamp}`)
- Bonus tasks are inserted into `daily_tasks` with `task_date = today` so they persist

**4. Add "Do Another Task" mutation (`src/studymode/hooks/useDailyTasks.ts`)**
- New `addBonusTask` mutation that inserts a single task row for today
- Returns the generated task so it can be added to local state immediately

**5. Missed task & streak reminder banner (`src/studymode/components/Dashboard.tsx`)**
- On load, query yesterday's `daily_tasks` to check if any were incomplete
- Query `user_progress` for current streak and `last_study_date`
- If tasks were missed or streak is at risk (last study date = yesterday), show a banner:
  - "You left 3 tasks unfinished yesterday. Complete today's tasks to keep your 5-day streak!"
- Banner dismissible, shows above the subject cards on the Subjects tab
- If current time is after 8 PM and today's tasks are incomplete, show a softer reminder: "Don't forget to finish today's tasks before midnight!"

### Files Changed
1. `src/studymode/hooks/useDailyTasks.ts` — Add `addBonusTask` mutation; ensure `ensureTasks` runs reliably
2. `src/studymode/components/SubjectDetail.tsx` — Wire `onCompleteTask` to DB; add "Practice More" UI after all tasks done
3. `src/studymode/components/Dashboard.tsx` — Pass `completeTask` down; call `ensureTasks` on mount; add missed-task/streak reminder banner
4. `src/studymode/components/TaskList.tsx` — Add "Do Another Task" button at the bottom when all tasks are completed

