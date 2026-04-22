

# Plan: Syllabus-Grounded Daily Task Generator

Replace the per-block markdown generation with a single **structured JSON task** that follows your exact spec — one bundle per generation that hits every selected concept across 4 mandatory blocks, with server-side coverage validation before it ever reaches the UI.

This runs alongside (not replacing) the existing `generate-task-content` markdown flow, so today's UI continues to work while the new pipeline powers the upgraded daily task experience.

---

## 1. New edge function: `generate-daily-task`

**Inputs** (from client):
- `subject`, `curriculum`, `topic`, `subtopics[]` (from parsed syllabus)
- `concept_mastery` map (`{concept: 0–100}`) — from `topic_mastery` + `weak_concepts`
- `completed_concepts[]` — concepts already covered in prior daily tasks
- `past_paper_patterns` — pulled from existing `exam_patterns` table

**Pipeline (server-side, in order):**

1. **Target selection** — implements your exact rule:
   ```
   IF uncovered concepts exist → pick those
   ELSE IF weak concepts exist → pick lowest mastery
   ELSE → next subtopic in syllabus order
   ```
2. **Scope lock** — max 1–2 subtopics, max 5 concepts.
3. **AI generation** via Lovable Gateway (`google/gemini-3-flash-preview`) with **strict tool-calling** so the model returns exactly:
   ```json
   {
     "topic": "...",
     "subtopic": "...",
     "concepts": [...],
     "blocks": {
       "concept_learning": "...",
       "quick_review": "...",
       "practice_questions": [
         { "question", "concept", "difficulty", "type", "answer", "marks" }
       ],
       "exam_question": { "question", "concepts", "marks", "expected_steps" }
     }
   }
   ```
4. **Coverage validator (server)** — before returning:
   - Every selected concept must appear in ≥1 `practice_questions[i].concept`. If missing → ask AI to fill the gap (1 retry).
   - Difficulty must include at least 2 distinct levels across practice questions. If all same → request `medium` + `hard` top-up.
   - `exam_question.concepts` must contain ≥2 of the selected concepts.
   - On retry failure, return a `coverage_warnings[]` field so the UI can show a "regenerate" prompt instead of silently failing.
5. **Response**: the validated JSON, plus `selection_reason` (`"uncovered" | "weak" | "syllabus-order"`) for analytics.

System prompt enforces every "DO NOT" rule from your spec (no inventing topics, no skipping, no merging, no over-explaining, exam wording only).

---

## 2. Database (1 migration)

**New table `daily_task_concepts`** — tracks which concepts have been covered per user/subject so target selection can find "uncovered" reliably.
- `id`, `user_id`, `subject_id`, `topic`, `subtopic`, `concept`, `last_covered_at`, `coverage_count`
- Unique on `(user_id, subject_id, concept)`
- RLS: user owns rows
- Written by the edge function on every successful generation

**Extend `daily_tasks`** — add columns:
- `task_payload jsonb` — stores the full structured task bundle returned by the new function
- `selection_reason text`
- `concepts_covered text[]`

(Existing rows continue to work — new columns nullable.)

---

## 3. Client integration

**New hook `useStructuredDailyTask(subjectId, topic)`**:
- Fetches concept mastery + completed concepts.
- Calls `generate-daily-task`.
- Returns `{ task, isLoading, error, regenerate, coverageWarnings }`.

**New component `StructuredDailyTaskRunner.tsx`** — renders the 4 blocks in order:
1. **Concept Learning** card (markdown, KaTeX-rendered).
2. **Quick Review** bullets.
3. **Practice Questions** — one at a time, supports `mcq`/`short`/`structured`, shows answer + marks after submission, awards XP per correct answer (reuses the +5 / +8 / +3 scale already in place).
4. **Exam Question** — multi-step question with `expected_steps[]` checklist for self-marking.

Wired into the existing daily-tasks UI: when a task with `task_payload` exists, the runner opens that JSON; otherwise it falls back to the current markdown flow. Zero disruption to existing tasks.

**Updated `useDailyTasks.ensureTasks`** — when seeding today's tasks, if `aiContext` indicates the student has a parsed syllabus, queue ONE structured task per subject (calls `generate-daily-task` lazily on first open, not at seed time, to avoid burning credits).

---

## 4. Files

**Edge function (new)**: `supabase/functions/generate-daily-task/index.ts`

**Migration (new)**: `daily_task_concepts` table + 3 columns on `daily_tasks` + RLS.

**Hook (new)**: `src/studymode/hooks/useStructuredDailyTask.ts`

**Component (new)**: `src/studymode/components/StructuredDailyTaskRunner.tsx`

**Modified**:
- `src/studymode/hooks/useDailyTasks.ts` — seed structured task slot
- `src/studymode/components/TaskContentPanel.tsx` — branch to `StructuredDailyTaskRunner` when `task_payload` exists
- `src/studymode/lib/aiClient.ts` — register `generate-daily-task`

---

## Result

- A **single AI call per task** returns a fully-structured, syllabus-locked, coverage-validated bundle — no more multiple round-trips per block.
- **Concept tracking** means every concept gets covered before any concept gets repeated, exactly per your selection logic.
- **Server-side validation** enforces the coverage + difficulty diversity rules before the JSON ever reaches the client; the UI never sees an unbalanced task.
- **Strict tool-calling JSON schema** means the AI cannot return free-text or skip blocks — the response either matches the spec or the function retries.
- Existing markdown task flow stays untouched as a fallback for subjects without parsed syllabus data.

