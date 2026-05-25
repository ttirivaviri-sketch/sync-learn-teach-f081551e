# Study Mode task generation — audit & gaps

The pipeline today has two parallel layers that don't fully talk to each other, plus several feedback loops that aren't wired up. Nothing is catastrophically broken — but a lot of work the AI does is thrown away, and "mastery" doesn't really learn from task answers.

## How it works today (quick map)

```text
useDailyTasks (client)            useStructuredDailyTask (client)
   │ seeds 5 templated tiles         │ calls generate-daily-task
   │ into daily_tasks                │ (4-block bundle: learn / review
   │ (micro-revision, concept,       │  / practice / exam) every mount
   │  flashcards, recall, exam)      │
   ▼                                  ▼
TaskList tile click ──► TaskContentPanel ──► generate-task-content (stream)
                                       OR ──► StructuredDailyTaskRunner
                                              (regenerates bundle)
                                              awards XP, never writes
                                              quiz_attempts / topic_mastery
```

## What's still missing

### 1. The AI bundle is never cached

`daily_tasks` already has `task_payload jsonb`, `selection_reason`, `concepts_covered` columns — none are written. `useStructuredDailyTask` ignores its own `cachedTask` arg and regenerates on every mount, topic switch, and Regenerate click. Every Reveal / replay costs another AI call.

### 2. Task completion doesn't move mastery

`submitPractice` / `submitExam` award XP and update streak, but don't insert into `quiz_attempts` and don't bump `topic_mastery.mastery_percentage`. Result: the AI's `weak_concepts` / `concept_mastery` inputs only reflect the standalone Quiz feature, never the daily-task answers.

### 3. Concept "covered" is permanent

`daily_task_concepts` tracks lifetime coverage with no time window. Once a concept appears once, `selectTargets` drops it from `uncovered` forever — no decay, no spaced repetition. After ~2 weeks every learner ends up stuck in the "syllabus-order" fallback branch.

### 4. The two task systems aren't reconciled

- Finishing the 4-block Runner doesn't mark the 5 templated tiles complete or unlock the next tile.
- `useDailyTasks.completeTask` unlocks "next in array order" instead of next in `TASK_ORDER`, so order drift in DB can desync the gating.
- New subjects added mid-day don't get tiles seeded until tomorrow (`ensureTasks` only seeds when `dbTasks.length === 0`).

### 5. Concepts ≠ subtopics, but treated as such

Runner passes `subject.currentTopic.subtopics` as both `subtopics` and `availableConcepts`. The edge function's "≥1 question per concept" guarantee then operates on subtopic names. We need actual concept lists from `get_subject_context` / syllabus.

### 6. Past-paper patterns silently absent

`generate-daily-task` accepts `past_paper_patterns` but the query filters strictly on `subject_id` and `user_id`. If the learner hasn't uploaded a past paper, the array is empty — no warning, no fallback to global patterns from `paper_blueprints`. Exam-style framing degrades silently.

### 7. No exam-readiness signal feeds task selection

`get_exam_readiness` / `paper_blueprints` already score weak topics by exam weight, but `selectTargets` ignores them. Daily tasks should bias toward blueprint-weighted weak topics, not just whatever's uncovered.

### 8. Validation warnings are cosmetic

The edge function retries once on coverage gaps then emits `coverage_warnings` and proceeds. XP is still awarded in full. There's no telemetry on how often we ship partial-coverage bundles, and no penalty/regen-hint in the UI.

### 9. No regeneration throttle

The Regenerate button (and topic switching) calls the AI with no rate limit, no `check_and_increment_ai_usage`, no last-generated-at check. Cost / abuse vector.

### 10. Bonus tasks are not syllabus-grounded

`addBonusTask` picks a random task_type and builds a static title + `"Extra practice on {topic}"` description. No AI grounding, no concept selection, doesn't share the structured bundle path.

### 11. Empty-state UX

When a subject has no concepts/subtopics, the edge function returns 400 and the runner shows "Failed to generate task". Should route the learner to the syllabus-setup gate instead.

### 12. Auto-advance of `currentTopic`

When all concepts in the current topic reach mastery, `currentTopic` isn't advanced to the next syllabus topic — tasks keep targeting a mastered topic and hit the syllabus-order fallback.

### 13. Generation isn't per-user-day-deduped

Two devices, two tabs, or React StrictMode can trigger concurrent `generate-daily-task` calls for the same `(user, subject, date)`. There's no server-side idempotency.

## Suggested order of fixes (highest leverage first)

1. **Persist the bundle** into `daily_tasks.task_payload` and pass it back as `cachedTask` → kills 60–80% of AI calls and fixes #1, #9, #13 in one move.
2. **Write `quiz_attempts` + bump `topic_mastery**` from practice/exam submissions → closes the mastery feedback loop (#2) and makes #7 viable.
3. **Add a decay window** to `daily_task_concepts` (e.g. concepts re-enter the "uncovered" pool after 14 days, or after mastery drops) → fixes #3.
4. **Reconcile the two task layers** — either retire the 5 templated tiles in favour of the 4-block bundle, or treat the bundle as "today's recommended path" that auto-completes the corresponding tiles (#4).
5. **Pull real concept lists** from `get_subject_context` instead of reusing subtopics (#5), and fall back to blueprint patterns when user-specific past-paper data is empty (#6, #7).
6. **Auto-advance current topic** when mastery threshold reached (#12); route empty-syllabus subjects to the setup gate (#11).
7. **Throttle / quota** regeneration via `check_and_increment_ai_usage` with a `daily_task_gen` bucket (#9).
8. Lower priority: bonus-task grounding (#10), warning telemetry (#8).

## Decision points before building

- Do we keep the 5 templated tiles, or collapse to the single 4-block bundle as the canonical "daily task"? (Ans:Templated)
- Spaced-repetition window for concept coverage — fixed 14 days, or driven by mastery score?(ans:driven by mastery)
- Should daily-task practice answers go into the *same* `quiz_attempts` table the Quiz feature uses, or a separate `daily_task_attempts` so analytics stay clean?(analytics must stay clean

Confirm the three above and I'll plan the implementation pass.

Also fix all log in (learner, tutor,admin) admin  doesn't show users