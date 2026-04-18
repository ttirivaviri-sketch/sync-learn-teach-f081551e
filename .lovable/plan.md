

## Current state

- `useQuizGenerator` already supports `questionType: 'multiple_choice' | 'short_answer' | 'structured'` with `options[]` and `correctOption` fields.
- `generate-quiz` edge function authors questions but always asks for "structured" style — MCQ is rarely produced even for subjects whose papers are multiple-choice (e.g. ZIMSEC Bio Paper 1, IGCSE Maths P1 MCQ, Physics P1).
- `ExamQuestionPanel` only renders a free-text answer box (`Textarea`) — no A/B/C/D selector exists, so even when AI returns MCQ data, learners can't click an option.
- `ExamModeSession` runs through `useQuizGenerator` → same gap.
- Mastery + readiness pipeline already keys off `quiz_attempts.was_correct` + `marks_awarded`, so MCQ submissions just need to write to the same table for everything (topic_mastery, get_exam_readiness, paper_blueprints) to update automatically.
- `paper_blueprints.question_type_distribution` already stores the per-paper MCQ vs structured ratio — perfect signal for telling the AI when to mix MCQs.

## Plan

### 1. Tell the AI to mix MCQ + structured based on the paper blueprint
**`supabase/functions/generate-quiz/index.ts`**
- Server-side: load the user's `paper_blueprints` for this subject. Extract `question_type_distribution` (e.g. `{ multiple_choice: 40, structured: 60 }`).
- Pass to prompt: "This subject's papers are X% multiple-choice and Y% structured. Pick `questionType` to roughly match that distribution across attempts. If multiple-choice, return 4 options labeled A–D and `correctOption` as 'A'|'B'|'C'|'D'."
- Strengthen MCQ schema in the response contract: `options: string[4]`, `correctOption: 'A'|'B'|'C'|'D'`, `explanation` mandatory.
- Same change to **`supabase/functions/generate-exam-questions/index.ts`** for Exam Mode parity.

### 2. Render an A/B/C/D selector in the question panel
**`src/studymode/components/ExamQuestionPanel.tsx`**
- When `question.questionType === 'multiple_choice'`: render a `RadioGroup` with the 4 options as tappable cards (A/B/C/D letter + option text), styled like past-paper MCQ cells.
- "Submit Answer" stays the same button; on submit, set `userAnswer` to the chosen letter.
- Skip the existing free-text grading path for MCQ — grade locally: `wasCorrect = chosen === correctOption`. Award full marks if correct, 0 if wrong. Show `explanation` + `modelAnswer` in the result view.
- Keep free-text/structured flow unchanged.

### 3. Persist MCQ attempts so mastery + readiness update
**`src/studymode/components/ExamQuestionPanel.tsx`** (existing `quiz_attempts` insert path)
- For MCQ: insert `{ user_answer: letter, model_answer: correctOption, was_correct, marks_awarded: was_correct ? marks : 0, marks_possible: marks, command_word: 'multiple_choice', concepts_tested, topic_name, subject_id }` into `quiz_attempts`.
- Existing `useTopicMastery` / `useTopicPerformance` / `get_exam_readiness` already aggregate from `quiz_attempts.was_correct` — no schema change needed.

### 4. Daily tasks and exam mode parity
- Daily task `exam-question` already uses `ExamQuestionPanel` → fix flows there automatically.
- **`src/studymode/components/ExamModeSession.t