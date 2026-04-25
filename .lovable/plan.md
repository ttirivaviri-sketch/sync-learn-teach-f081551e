# Plan: Fix Exam Mode Marking

## Root cause

Exam mode submits answers to the `explain-answer` edge function (via the `mark-answer` alias), but `useRecallEngine.evaluateAnswer` sends `mode: 'exam-strict'` for exam sessions:

```ts
mode: state.mode === 'exam' ? 'exam-strict' : 'mark'
```

The `explain-answer` edge function only treats `mode === "mark"` as the JSON-scoring path. Any other value — including `"exam-strict"` — falls through to the default **EXPLAIN** path, which returns a streaming SSE (`text/event-stream`) response.

The client then calls `resp.json()` on that stream, producing the exact errors in the console:

```
WARN [aiClient] Edge function "explain-answer" unavailable: TypeError: Load failed
ERROR [useRecallEngine] Evaluation error: SyntaxError: The string did not match the expected pattern.
```

So every exam answer silently fails to be marked → no scores, no feedback, blank results screen. This is a regression from the day `exam-strict` was introduced; active-recall mode (which sends `mode: 'mark'`) still works, which is why the bug only appears in exam mode.

The previous request to "fix marking in exam mode" updated `grade-answer` (used only by the *Mock Exam* paper flow), not `explain-answer` (used by the *Exam Mode session* on a topic). Different code paths — that's why the fix didn't reach this screen.

## Fix

### 1. `src/studymode/hooks/useRecallEngine.ts`
Change the mode value sent to the grader from `'exam-strict'` to `'mark'` so it routes to the JSON scoring branch. Keep an `examStrict: true` flag in the payload so the prompt can still apply stricter exam grading rules.

```ts
mode: 'mark',
examStrict: state.mode === 'exam',
```

### 2. `supabase/functions/explain-answer/index.ts`
- Accept `examStrict` from the body and, when true, append a stricter rubric to the mark-mode system prompt (no leniency for missing units when units are part of the marking scheme, no method marks for blank working, etc.).
- Defensive: also treat `mode === 'exam-strict'` or `mode === 'mark-strict'` as the mark path so any cached client doesn't break again.

### 3. Verify
- Run the exam mode session on a topic, submit, confirm:
  - Marking progress bar advances 0 → 100%
  - Results screen shows per-question marks awarded, correct concepts, missing concepts, and feedback
  - Console no longer logs the SyntaxError from `[useRecallEngine] Evaluation error`

## Files touched
- `src/studymode/hooks/useRecallEngine.ts`
- `supabase/functions/explain-answer/index.ts`

## Result
Exam mode marks every answered question, shows the grade card, per-question breakdown, and examiner notes — same way it did before the `exam-strict` regression. The mock exam paper grader (`grade-answer`) is untouched since it already works.
