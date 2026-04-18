
## Diagnosis

`useDailyTasks.getTasksForSubject` returns DB tasks in whatever order Postgres yields them (no `ORDER BY` in the query, no client-side sort). After completion mutations and upserts, ordering becomes nondeterministic — that's why "Concept Learning" (should be #2) appears at the bottom and the visible numbers jump 1 → 4.

The canonical order defined by `generateTasksForSubject` is:
1. micro-revision (Quick Review)
2. concept-learning
3. flashcards
4. active-recall
5. exam-question

## Fix (1 file)

**`src/studymode/hooks/useDailyTasks.ts`** — in `getTasksForSubject`, sort the mapped DB tasks by a fixed `TASK_ORDER` array before returning. Bonus tasks (any extra of a given type) sort by `created_at` after the canonical one.

```ts
const TASK_ORDER: DailyTask['type'][] = [
  'micro-revision', 'concept-learning', 'flashcards', 'active-recall', 'exam-question'
];
// sort: primary by TASK_ORDER index, secondary by created_at
```

### Result
Tasks always render 1 → 5 in the same sequence regardless of completion state, locks, or insert order. Completed items keep their slot (just styled as "Done") instead of jumping to the bottom.

