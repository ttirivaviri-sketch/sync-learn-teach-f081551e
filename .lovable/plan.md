
Looking at the screenshot: tasks 1 & 5 are both "Quick Review" (same description, same subject), and "Flashcard Review" appears twice. Let me check the task generation logic.
<lov-tool-use id="toolu_vrtx_01TYXMBKQpw1sDmtANpBeadb" name="code--view" integration-id="code" data="{\"file_path\": \"src/studymode/hooks/useDailyTasks.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_019k2TEWxmxQgyTkXbzsLMQt" name="code--view" integration-id="code" data="{\"file_path\": \"src/studymode/hooks/useDailyTasks.ts\"}">
</lov-tool-use>
The screenshot shows "Quick Review" appearing twice (#1 and #5), and "Flashcard Review" appearing twice (#4 and a locked one below). Looking at the code, `generateTasksForSubject` only returns 5 unique tasks per subject. So duplicates would only occur if `ensureTasks` ran multiple times, OR multiple subjects exist, OR `addBonusTask` was called.

Let me check Dashboard / where ensureTasks is called.
<lov-tool-use id="toolu_vrtx_014F35C3y9ZjKS3CY3hQfXw9" name="code--search_files" integration-id="code" data="{\"query\": \"ensureTasks\", \"include_patterns\": \"*.tsx,*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01PGGbjFnbfhkmc54tcZQgSa" name="code--view" integration-id="code" data="{\"file_path\": \"src/studymode/components/Dashboard.tsx\", \"lines\": \"100-180\"}">
</lov-tool-use>
Looking at the screenshot: tasks numbered #1-#6 with "Quick Review" at #1 and #5, and two "Flashcard Review" entries. The 5-task template in `generateTasksForSubject` produces only one of each type. So duplicates indicate either:

1. **Multiple subjects** are showing tasks combined into a single list (each subject generates its own Quick Review + Flashcard Review etc.) — this would be expected.
2. OR `ensureTasks` ran multiple times due to a race condition (no unique constraint preventing duplicate inserts).

Looking at the image more carefully — tasks all reference "Cells as the Units of Life" (same topic). If they were from different subjects, the topic names would differ. So they're duplicates from the SAME subject — that's a bug.

Cause: `ensureTasks.mutate()` fires on mount before `dbTasks` query has finished loading (or before insert completes), so the dedup check `if (dbTasks && dbTasks.length > 0) return;` fails. Multiple renders/StrictMode double-invoke cause double inserts. No DB unique constraint.

<lov-plan>
## Diagnosis: Bug, not intentional

The screenshot shows two **Quick Review** and two **Flashcard Review** tasks for the same subject + same topic ("Cells as the Units of Life"). The template in `useDailyTasks.generateTasksForSubject` only produces ONE of each type per subject, so these are true duplicates from a single subject — not multi-subject overlap.

### Root cause
`ensureTasks` in `useDailyTasks.ts` guards against re-inserting with:
```ts
if (dbTasks && dbTasks.length > 0) return;
```
But `dbTasks` is from a React Query that may still be loading (or stale) when `ensureTasks.mutate()` fires from `Dashboard.tsx`'s mount effect. Combined with React StrictMode double-invoke and re-renders triggered by `subjects.length` changing, the insert runs twice and there is **no DB-level uniqueness** to stop it.

Secondary contributor: each daily-task row gets a fresh `gen_random_uuid()`, so even identical (user, subject, date, task_type, title) rows coexist.

### Fix (2 small changes)

1. **DB migration** — add a partial unique index so duplicates can never persist:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS daily_tasks_unique_per_day
     ON public.daily_tasks (user_id, subject_id, task_date, task_type, title);
   ```
   Plus a one-time cleanup deleting older duplicate rows (keep earliest `created_at`).

2. **Hook hardening** in `src/studymode/hooks/useDailyTasks.ts`:
   - Wait for the query to settle before seeding: only run `ensureTasks` when `isLoading === false` AND `dbTasks?.length === 0`.
   - Add an in-flight guard (`useRef`) so concurrent mounts can't double-fire.
   - Use `.upsert(..., { onConflict: 'user_id,subject_id,task_date,task_type,title', ignoreDuplicates: true })` instead of plain `insert`.

3. **Dashboard.tsx** mount effect — gate it on `!isLoading` so the guard above is meaningful.

### Files
- new migration (unique index + dedupe cleanup)
- `src/studymode/hooks/useDailyTasks.ts`
- `src/studymode/components/Dashboard.tsx`

### Result
Today's Tasks shows exactly one of each task type per subject. Existing duplicates are removed on migration.
