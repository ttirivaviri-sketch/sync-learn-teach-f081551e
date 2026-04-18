

## Goal
Make the AI fully comprehend uploaded **past papers + their mark schemes together** (per subject, per curriculum), map every Q→answer→topic, learn structural patterns per paper, and use that to (a) generate study-mode tasks modelled on real exam style, and (b) score the student's **Exam Readiness** per paper.

Today the system already parses syllabi, past papers, and mark schemes individually — but **mark schemes are stored as loose "key points"** with no link back to the matching past paper. The AI never sees a question paired with its correct answer, so it can't truly model exam reasoning or score readiness per paper.

## What's missing today
1. **No Q↔Answer pairing.** `mark_scheme` extraction returns topics + key points only; never linked to a `past_paper` row.
2. **No per-paper readiness score.** Mastery is per topic, but a CIE Bio Paper 2 (MCQ) and Paper 4 (structured) test the same topics very differently — readiness must be paper-aware.
3. **Quiz generator** uses exam-pattern *frequency* but not the actual Q+answer pairs as templates.

## Plan

### 1. Upgrade mark-scheme extraction (parse-document)
Replace the thin `MARK_SCHEME_TOOL` with a richer schema:
- `paper_year`, `paper_variant`, `paper_code` (to match the past_paper)
- `answers[]` per `question_number` with: model_answer, marking_points (mark-by-mark), accept/reject notes, command_word, marks, topic.

After extraction, **auto-link** the mark scheme to its past paper by matching `(subject, paper_year, paper_variant, paper_code)` and merge `answers[]` into the past paper's `parsed_content.questions[]` so each question carries its official answer + marking scheme.

### 2. New table: `paper_blueprints`
One row per (subject_id, paper_code) capturing the learned **structure** of a paper:
- `paper_code` (e.g. "Paper 2", "Paper 4"), `total_marks`, `duration_minutes`
- `question_type_distribution` (e.g. `{mcq: 40}` or `{structured: 8, free_response: 2}`)
- `topic_coverage` (jsonb: per-topic % of marks across analysed papers)
- `command_word_frequency` (jsonb)
- `difficulty_distribution`
- `years_analysed` (text[])

Populated/updated every time a past_paper is parsed — gives the AI a true blueprint of *each* paper, not just aggregated patterns.

### 3. New RPC: `get_exam_readiness(subject_id, paper_code)`
Returns per-paper readiness:
- For each topic in the paper's `topic_coverage`, multiply `topic_mastery.mastery_percentage` by topic weight.
- Weight by `question_type_distribution` vs the student's accuracy on those question types (from `task_attempts`/quiz history).
- Output: `{ readiness_percent, weakest_topics[], weakest_question_types[], confidence_band }`.

### 4. Wire it into Study Mode
- `useSyllabusContext` extended with `paperBlueprints` and `linkedPastPapers` (Q+answer pairs).
- `generate-quiz` edge function: when generating, sample 1–2 real past Q+answer pairs as **few-shot exemplars** for the model, so output mirrors authentic style/marking scheme.
- `useDailyTasks`: when student is within X days of an exam (from `exam_dates`), shift task mix toward that paper's blueprint (more MCQ practice for Paper 2, more structured response for Paper 4).
- New widget **"Exam Readiness"** in `Dashboard.tsx`: per-paper bar with %, "ready"/"more practice" label, and weakest-topics list. Powered by `get_exam_readiness`.

### 5. Curriculum-agnostic
All of the above keys off `subject`, `paper_code`, and the syllabus's `paper_structure` (already extracted). Works the same for IGCSE / ZIMSEC / NSC / IEB / CAMB without per-curriculum branching.

## Files

**New**
- migration: create `paper_blueprints` table + RLS, create `get_exam_readiness` RPC
- `src/studymode/components/ExamReadinessWidget.tsx`
- `src/studymode/hooks/useExamReadiness.ts`

**Edited**
- `supabase/functions/parse-document/index.ts` — new MARK_SCHEME_TOOL schema + auto-link to past paper + populate `paper_blueprints`
- `supabase/functions/generate-quiz/index.ts` — accept `pastPaperExemplars[]` and inject as few-shot
- `src/studymode/hooks/useSyllabusContext.ts` — return `paperBlueprints` + `linkedPastPapers`
- `src/studymode/hooks/useQuizGenerator.ts` — pass exemplars (real Q+A) into payload
- `src/studymode/hooks/useDailyTasks.ts` — paper-aware task mix near exam
- `src/studymode/components/Dashboard.tsx` — mount `ExamReadinessWidget`

## What you'll see after build
1. Upload Bio Paper 2 + its mark scheme + Paper 4 + its mark scheme. The system links each Q to its official answer.
2. Dashboard shows: **Paper 2 readiness 62% — weakest: Genetics, Coordination & Response. Paper 4 readiness 48% — weakest: Inheritance, Practical skills.**
3. Generated quiz tasks pull authentic past Q styles (verbatim command words, real mark allocations) and the marking scheme is the actual examiner one.
4. Same flow auto-applies to any subject/curriculum the student adds.

## Out of scope (next round)
- Auto-grading student's free-text answer against mark scheme (would need a separate `grade-answer` function).
- Generating a full mock-paper PDF.

