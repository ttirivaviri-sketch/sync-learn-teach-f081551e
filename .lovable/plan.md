
# StudyMode School Intelligence Layer

**Guiding rule:** StudyMode stays the flagship. We do **not** fork it, do not build a second AI system, do not duplicate features. We add a **Context Engine** and **school-aware retrieval** that the existing hooks (`useDailyTasks`, `useQuizGenerator`, `useStructuredDailyTask`, `useAITutor`, `useAIStudyIntelligence`, `useStudyMemory`, `useRecallEngine`, etc.) consume through a single new context object.

The School Workspace already built in P1–P8 (memberships, classes, grades, `school_ai_documents`, `school_ai_chunks`, `school-search`, `school-ingest-document`, contract gating, audit logs) becomes the *knowledge + governance* layer that feeds StudyMode — not a parallel product.

---

## Mapping to existing StudyMode (reuse, don't duplicate)

| New capability | Existing piece we extend | What changes |
|---|---|---|
| Student context profile | `useAcademicProfile`, `useSubjects`, `useLearnerSubjects`, `useSyllabusContext` | Wrap into one `useStudyContext` hook that also pulls school/class/teacher data |
| AI retrieval | `useAITutor`, `ChatPanel`, `useTaskContent`, `useQuizGenerator` | All call a new `studymode-context-retrieve` edge fn that runs `school-search` first, then falls back to existing curriculum/general knowledge |
| Daily Tasks | `useDailyTasks`, `useStructuredDailyTask`, `daily_tasks` table | Same table; new task types `homework` and `teacher-review` slot into existing `subject → tasks` rendering in `SubjectDetail` |
| Flashcards | `FlashcardPanel`, `flashcards` table | Add `source_document_id` / `source_school_id` columns; generator accepts teacher-uploaded content as source |
| Quizzes | `useQuizGenerator`, `quizzes`, `quiz_questions`, `quiz_attempts` | Same tables; quizzes can be `scope = personal | class | grade | school` |
| Homework | `assignments`, `submissions` (already exist) | Add AI-generated assignment flow + teacher review queue + per-question AI feedback |
| Weakness detection | `useWeakConcepts`, `useTopicPerformance`, `useConceptMastery` | Unchanged; Context Engine reads from them |
| Exam Mode / Mock exams | `useMockExam`, `MockExamRunner` | Unchanged; gains teacher-content sourcing |
| Dashboard | `studymode/components/Dashboard.tsx` | Adds a "From your school" rail (teacher uploads, homework due, class quizzes) — no new tab tree |
| School ingest | `school-ingest-document`, `school_ai_documents`, `school_ai_chunks` | Unchanged pipeline; new triggers fire generators on success |

Nothing in current StudyMode is removed. Anonymous / non-school learners keep today's behavior — the context just has empty school fields.

---

## Architecture

```text
                ┌─────────────────────────────────────┐
                │       useStudyContext (client)      │
                │ profile + school + class + teachers │
                │   + recent perf + upcoming exams    │
                └───────────────┬─────────────────────┘
                                │  AIContextPayload (extended)
   ┌────────────────────────────┼────────────────────────────┐
   │                            │                            │
useDailyTasks            useQuizGenerator               useAITutor / ChatPanel
   │                            │                            │
   └────────────┬───────────────┴──────────────┬─────────────┘
                ▼                              ▼
   studymode-generate (edge)        studymode-context-retrieve (edge)
   (existing, extended)             ├─ school-search (priority 1–4)
                                    ├─ curriculum_topic_templates (5)
                                    ├─ tutor_tutorials chunks (6)
                                    └─ general LLM knowledge (7)
```

`AIContextPayload` (returned by `useAIStudyIntelligence`) gains a `school` block — every existing hook keeps working because the field is optional.

---

## Data model changes (additive only)

All new objects respect the existing `school_memberships` + `has_role` pattern. Tenant isolation is enforced server-side in retrieval; we never trust `school_id` from the client.

1. **`student_context_snapshots`** — cached materialized view of a learner's context (school, grade, class, teacher_ids, subject_ids, weak topics, upcoming exams). Refreshed by trigger on enrollment / quiz_attempt / submission. One row per user, JSONB body.
2. **`school_homework`** — wraps `assignments` for AI-generated homework:
   - `assignment_id` FK, `source_document_id` FK to `school_ai_documents`, `auto_release_grades bool`, `auto_feedback bool`, `generation_prompt`, `topic`, `difficulty`.
3. **`school_homework_questions`** — per-question AI rubric (`expected_answer`, `examiner_notes`, `marks`, `common_mistakes`). Same questions for every student in the (grade, class, subject, teacher) tuple — generated once, reused.
4. **`school_homework_responses`** — per-student per-question: `student_answer`, `ai_score`, `ai_feedback`, `teacher_score`, `teacher_comment`, `status` (`submitted | ai_marked | teacher_reviewed | released`).
5. **`flashcards`** + `quizzes` — add columns: `school_id`, `class_id`, `source_document_id`, `scope`.
6. **`teacher_ai_settings`** — per-teacher toggles: `auto_release_grades`, `auto_release_feedback`, `feedback_style` (`concise|examiner|encouraging`), `homework_difficulty_default`.
7. **`school_ai_chunks`** already has `school_id, class_id, subject_id` — add `grade_id`, `teacher_id`, `priority` (1–4) for the knowledge hierarchy.

RLS: every new table follows the existing pattern — `has_role(auth.uid(), 'school_admin'|'school_teacher')` for writes, membership-scoped reads, learner can read their own response rows.

---

## Knowledge hierarchy & retrieval

One edge function: `studymode-context-retrieve`. Input `{ query, user_id, subject_id?, topic? }`. Steps:

1. Load `student_context_snapshots` for the user (school_id, class_id, grade_id, teacher_ids).
2. Run `match_school_chunks` four times with progressively widening filters: teacher → class → grade → school. Stop early once `k` hits are gathered with similarity ≥ threshold.
3. If still short, query `curriculum_topic_templates` for the learner's curriculum + subject.
4. If still short, query `tutor_tutorials` chunks the learner has access to (existing booking-based ACL).
5. Fall back to model general knowledge.

`school-search` stays untouched; the retrieve fn calls it via RPC. **No cross-school leakage** — the snapshot's `school_id` is the only school filter ever passed.

---

## Homework flow (the new headline feature)

```text
Teacher uploads resource ──► school-ingest-document (existing)
        │
        ▼
school_ai_documents.status = 'embedded'
        │
        ▼
Teacher clicks "Generate homework" (one-click panel on the doc card)
        │
        ▼
studymode-generate-homework (new edge fn)
  • pulls chunks for that doc
  • produces N questions + rubric (Output.object schema)
  • inserts ONE row in school_homework + N in school_homework_questions
  • fans out one assignment row per enrolled student (or one shared assignment + per-student response rows — we use the latter for cost)
        │
        ▼
Student opens StudyMode → SubjectDetail shows new daily task type 'homework'
        │
        ▼
Student answers → studymode-mark-homework (edge fn)
  • AI scores against rubric, writes school_homework_responses.ai_*
  • If teacher_ai_settings.auto_release_grades → status='released'
  • Else status='ai_marked', queued for teacher review
        │
        ▼
Teacher Review screen: list of pending responses, can override score / comment, click Release
        │
        ▼
Student sees grade + per-question feedback (highlights, examiner expectations, concept corrections)
```

Per-question feedback uses a fixed schema:
```ts
{ correct: boolean, awarded: number, examiner_expects: string,
  what_you_missed: string, concept_fix: string, references: { doc_id, chunk_ids } }
```

---

## Daily Tasks extension

`daily_tasks.task_type` enum gains: `homework`, `homework-review`, `teacher-note-review`. Generator (`useStructuredDailyTask` / its edge fn) consumes the school context block and prefers:
1. Open homework due today
2. Teacher uploads from last 7 days the student hasn't opened
3. Weak topics from `weak_concepts` cross-referenced with class syllabus
4. Existing generic tasks (unchanged)

Tasks render in the existing `SubjectDetail` list — no new UI tree.

---

## Teacher one-click automation

On each `school_ai_documents` card in `TeacherWorkspace`, a popover offers:
Generate → [Homework | Flashcards | Quiz | Exam Questions | Revision Notes | Daily Tasks | Study Guide].
All call `studymode-generate-*` edge fns sharing one helper that:
- loads chunks from that doc,
- writes outputs scoped to (school, class, subject, teacher),
- inherits the doc's RLS (students in `enrollments` for that class can read).

---

## Dashboard additions (minimal UI surface)

`studymode/components/Dashboard.tsx` gets one new section above existing tabs **only when `context.school` is non-null**:
- "From your school" rail: Homework due (count + CTA), Recent teacher uploads (3), Class quiz invites.
Everything else (Subjects/Calendar/Exams/Progress/Setup tabs) is untouched. Solo learners see no change.

---

## Analytics (reuse existing)

`school_analytics_daily` already tracks AI requests, submissions, quiz attempts. We add three counters via existing `increment_school_ai_usage` buckets: `homework_generated`, `homework_marked`, `feedback_released`. The `SchoolAnalytics` page gains two cards driven by the same query; no new pipeline.

---

## Security & isolation

- Server-side: every generate/retrieve fn re-reads membership and `school_id` from the JWT user, never from the body.
- `enforceSchoolContract` already wraps `school-search` / `school-ingest-document`; new fns reuse the shared helper.
- New tables get the same `GRANT … TO authenticated` + RLS pattern documented in our security memory.
- Audit: every homework release writes to `school_audit_logs` with action `homework_released` (admin can filter on existing AuditLogs page).

---

## Implementation roadmap (phased, each phase ships independently)

**P9 — Context Engine** (foundation, no UX change)
- `student_context_snapshots` table + refresh trigger
- `useStudyContext` hook + extend `AIContextPayload.school`
- `studymode-context-retrieve` edge fn (wraps `school-search`)
- Wire `useAITutor` and `ChatPanel` to use it (school students get teacher-grounded answers)

**P10 — Teacher knowledge → StudyMode artifacts**
- `studymode-generate-flashcards` and `-quiz` edge fns
- Flashcards/quizzes table column additions
- Teacher doc-card "Generate" popover
- Student flashcards/quizzes pick up school-sourced cards automatically

**P11 — Homework with AI marking + teacher review**
- `school_homework*` tables + RLS
- `studymode-generate-homework` + `studymode-mark-homework` fns
- `teacher_ai_settings` + settings UI (`auto_release_grades`, `auto_release_feedback`, `feedback_style`)
- Student homework UI inside `SubjectDetail` (uses existing task runner)
- Teacher Review queue page

**P12 — Daily Tasks personalization**
- Extend `daily_tasks.task_type`
- Update generator to prioritize school homework + teacher uploads
- "From your school" dashboard rail

**P13 — Analytics + audit**
- New buckets in `increment_school_ai_usage`
- Two cards on `SchoolAnalytics`
- `homework_released` audit action

**P14 — Hardening**
- Cache embeddings/snapshots
- Rate limits per school plan
- E2E tests for cross-school isolation
- Cost telemetry on generate fns

---

## What I need from you before I start P9

1. **Scope of first build:** start with **P9 + P10** (context engine + teacher-knowledge-grounded flashcards/quizzes) so school students immediately feel the difference, then move to homework in a follow-up? Or jump straight to **P11 homework** because that's the headline?
2. **Homework granularity:** one shared `assignments` row + per-student `school_homework_responses` (cheaper, recommended) — confirm OK.
3. **Feedback defaults:** ship with `auto_release_grades = false` and `auto_release_feedback = true` (students see AI feedback immediately, grades wait for teacher) — confirm.
4. **Solo learners:** confirm zero UX change for non-school users in every phase.
