## Problem

In Exam Mode (and Active Recall), multiple-choice options render as raw LaTeX text — e.g. `$h = \frac{1}{3}r$` shows literally instead of as a formatted fraction. The question stems already render correctly via `MathMarkdown`; only the MCQ option buttons were left as plain `{opt}` text.

`MockExamRunner` and `ExamQuestionPanel` already render options through `MathMarkdown` correctly — so the fix is consistent with existing patterns.

## Fix

Wrap MCQ option text in `<MathMarkdown>` in the two components that currently render it raw, matching the styling pattern already used in `MockExamRunner.tsx` (inline rendering, no extra paragraph margins).

### 1. `src/studymode/components/ExamModeSession.tsx` (lines ~478–494)

Replace the raw `{opt}` inside the MCQ button with an inline `MathMarkdown` block:

```tsx
<MathMarkdown className="inline [&_p]:inline [&_p]:my-0">
  {opt}
</MathMarkdown>
```

### 2. `src/studymode/components/ActiveRecallSession.tsx` (lines ~382–398)

Same change — replace `{opt}` in the MCQ option button with the inline `MathMarkdown` wrapper above.

## Why this is enough

- `MathMarkdown` already handles bare LaTeX commands and `$...$` delimiters via its `normaliseMath` helper, so options like `$h = \frac{1}{3}r$`, `$h = 4r$`, etc. all render correctly.
- The `inline` + `[&_p]:inline [&_p]:my-0` modifiers keep the option on a single line next to its `A.` / `B.` letter prefix, preserving the current button layout.
- No backend / prompt changes needed — the AI is already emitting valid LaTeX; the UI just wasn't rendering it.

## Out of scope

- Diagrams/graphs in questions (already handled via `QuestionVisual` / `render-question-visual` edge function — separate concern).
- Examiner-grade feedback formatting (already done in the previous turn).
