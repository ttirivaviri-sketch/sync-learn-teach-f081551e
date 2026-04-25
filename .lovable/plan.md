## Two issues, both in `ExamModeSession` flow

The user has two complaints. Both trace to the same area: the recall-engine-driven Exam Mode (per-topic exam, not the Mock Paper).

### Issue 1 — Feedback is too thin, doesn't explain examiner expectations
Today `mark-answer` (the `explain-answer` edge function in mark mode) returns a basic JSON: `score, mistakes, correctParts, modelAnswer, markBreakdown, improvementTips`. The exam-strict addendum is short and doesn't ask the AI to:
- Explain WHY the examiner expects each marking point (the underlying principle).
- Flag answers that are correct but missing required workings/steps/units.
- Reference the mark scheme's "must show" requirements per curriculum (ZIMSEC / IGCSE / A-Level command-word conventions).
- Quote the exact phrase / step that lost the mark.

Result: users see a pass/fail number but no examiner-grade explanation of what would have got full marks and why.

### Issue 2 — Questions render as raw markdown, no diagrams
- `ExamModeSession` uses `MathMarkdown` for the question body and presents structured questions as a plain text blob (no part labels, no proper question card styling, the question feels like a chat message).
- `useRecallEngine` strips the `visual` field when mapping AI output → `RecallQuestion`. Even though `generate-quiz` already supports `function-graph`, `data-chart`, `svg-diagram`, `ai-image`, none of them ever reach the screen in Exam Mode (or Active Recall — same hook).
- `ExamQuestionPanel` (used elsewhere) DOES render `<QuestionVisual />`. The Exam Mode session never imports it.

---

## Plan

### 1. Carry `visual` through the recall pipeline
- `src/studymode/engine/recallEngine.ts` → add `visual?: QuestionVisualSpec | null` to `RecallQuestion`.
- `src/studymode/hooks/useRecallEngine.ts` → in the question mapper (line ~211), pass `visual: q.visual ?? null` from the AI response.

### 2. Render diagrams + style questions properly in Exam Mode
- `src/studymode/components/ExamModeSession.tsx`:
  - Import `QuestionVisual` and render `<QuestionVisual visual={q.visual} />` between the question text and the answer area.
  - Replace the raw `MathMarkdown` blob with a structured "exam paper" presentation: question number badge, marks badge, command word badge already exist — wrap question body in a styled card with proper typography (serif-ish exam-paper feel), preserve numbering for multi-part `(a)/(b)/(c)` questions by splitting on those markers and rendering each part in its own block.
  - Same fix for `QuestionResult` (results screen) so the diagram is visible when reviewing.

### 3. Strengthen `generate-quiz` so visuals actually appear when curriculum demands them
- `supabase/functions/generate-quiz/index.ts` — when `examMode: true` is passed, append a stronger directive: "If the topic conventionally appears with a diagram/graph/figure in past papers (Maths function graphs, Physics circuits / forces / ray diagrams, Biology labelled diagrams, Chemistry apparatus, Geography climate graphs / contour maps), you MUST populate the visual field. Do not omit it."
- The client (`useRecallEngine`) already passes `examMode` — surface it into the system prompt instead of just the user prompt.

### 4. Upgrade exam-strict marking to give detailed, examiner-grade feedback
- `supabase/functions/explain-answer/index.ts` — when `examStrict: true`, replace the current short addendum with a richer rubric and richer JSON contract:

  Stricter system instructions:
  - For each marking point: state what the examiner expected and WHY it matters (the underlying principle / common mark-scheme convention).
  - If the final answer is correct but workings/steps/units/diagrams are missing, award full marks for the answer but ADD a `workingsFeedback` field that flags it and quotes the curriculum standard ("ZIMSEC O-Level Maths requires all working to be shown for method marks; in the real exam you would lose method marks here").
  - Quote the student's actual phrase/step that lost the mark, then give the corrected version.
  - Each `markBreakdown` row gains a `whyExpected` field (the examiner's reasoning) and `studentQuote` (what the student wrote for that point, if anything).
  - Add `examinerComment` (1-2 sentences in an examiner's voice, e.g. "A clear answer, but Section B examiners expect you to define terms before using them.").
  - Add `improvementByCurriculum` array — concrete next-time tips tied to the curriculum/command word.

- Update the response normaliser to pass these new fields through, and update the client `SemanticEvaluation` type + `evaluateAnswer` mapper in `useRecallEngine.ts` to read them.

### 5. Display the richer feedback in the results screen
- `src/studymode/components/ExamModeSession.tsx` `QuestionResult` sub-component:
  - Show `examinerComment` at the top of each expanded question (callout style).
  - Each `markBreakdown` row: show `criterion`, marks awarded badge, `whyExpected` underneath in muted text, and the student's quoted attempt if present.
  - Add a "Workings & presentation" callout when `workingsFeedback` is present (yellow warning, even if marks = full).
  - Replace the current "Reasoning errors" plain list with a "Common mistakes the examiner would flag" section.
  - Add a "How to improve next time (curriculum standards)" section showing `improvementByCurriculum`.

---

## Files touched
- `src/studymode/engine/recallEngine.ts` — add `visual`, extend `SemanticEvaluation` shape (workingsFeedback, examinerComment, improvementByCurriculum, richer markBreakdown).
- `src/studymode/hooks/useRecallEngine.ts` — carry `visual` through; map new evaluation fields.
- `src/studymode/components/ExamModeSession.tsx` — render `QuestionVisual`, restyle question presentation, render new feedback fields.
- `supabase/functions/generate-quiz/index.ts` — stronger visual directive when `examMode`.
- `supabase/functions/explain-answer/index.ts` — richer exam-strict prompt + extended JSON response.

## Result
- Exam Mode questions look like real exam paper questions: numbered, marks shown, with diagrams/graphs/charts wherever the curriculum conventionally includes them.
- After submitting, every question shows: examiner's overall comment, point-by-point mark breakdown with WHY each point was expected, the student's quoted attempt, a "workings/presentation" warning when a correct answer would lose method marks in the real exam, and curriculum-specific improvement tips.
- No backend secrets needed — all changes use existing AI Gateway + edge functions.
