## Goal

1. Make Photo Solve actually grade the image.
2. Let students answer **any** typed-answer question by snapping a photo instead — exam mode, mock exams, exam questions, active recall, topic sessions, flashcards, daily tasks.

## Part 1 — Fix `photo-solve-grade`

Symptoms: returns nothing/empty. Root causes I'll address:

- **Quota bucket misfire.** It currently uses the `explain` bucket; first‑time users hit a 429 with no UI signal. Switch to `misc` (or skip enforcement when image grading) and surface 429/402 in the panel.
- **Payload too big.** A 6 MB JPEG → ~8 MB base64 → often rejected by Edge Function body limits. Downscale on the client to max 1600 px / ~1.2 MB JPEG before sending.
- **JSON-mode + multimodal occasionally returns prose.** Strengthen `safeJsonParse` fallback path and add a one‑shot retry with `temperature: 0` and a stricter "JSON only" reminder when parsing fails.
- **Model routing.** Force the standard tier model (`google/gemini-3-flash-preview`) regardless of `OPENAI_API_KEY` being set — `gpt-4o-mini` accepts images but the prompt is tuned for Gemini and was returning empty `steps`.
- **Better errors in UI.** Show server error text (`rate_limited`, `credits_exhausted`, `AI gateway error 4xx`) in `PhotoSolvePanel` instead of a generic "Try again".
- Log request/response sizes in the function for future debugging.

No DB or schema changes.

## Part 2 — "Photo Solve" everywhere there's a typed answer

Add a small reusable trigger + sheet that swaps the textarea for the existing `PhotoSolvePanel` flow. The graded result is converted into a string and dropped into the same answer field, so the existing submit/grade pipeline keeps working unchanged.

New shared component:

- `src/studymode/components/PhotoAnswerButton.tsx`
  - Button "Solve with photo" → opens a Sheet/Dialog hosting `PhotoSolvePanel`.
  - Props: `question`, `subject?`, `topic?`, `totalMarks?`, `curriculum?`, `onResult(text, result)`.
  - On `result`, pre-fills the parent's answer textarea with either `final_answer` or a compact "Working:\n<step1>\n<step2>\n…\nAnswer: <final>" string, and (where supported) also stores the raw grading result so the existing examiner UI can show it inline.

Wire into the following surfaces (only add the button next to the existing Textarea — no business‑logic changes to grading flows):

| File | Hook-in |
|---|---|
| `src/studymode/components/ExamModeSession.tsx` (~L523) | Add button above the answer Textarea |
| `src/studymode/components/MockExamRunner.tsx` (~L132) | Add button on non‑MCQ questions |
| `src/studymode/components/ExamQuestionPanel.tsx` (~L525, 535, 554, 589) | Add button on each free‑text Textarea |
| `src/studymode/components/ActiveRecallSession.tsx` (~L429) | Add button above answer area |
| `src/studymode/components/TopicSessionRunner.tsx` (~L161) | Add button on free‑text steps |
| `src/studymode/components/FlashcardPanel.tsx` (~L156) | Add button above "type your answer" |
| `src/studymode/components/StructuredDailyTaskRunner.tsx` (~L379, 441) | Add button on both Textareas |
| `src/studymode/components/TaskContentPanel.tsx` (~L251) | Add button above Textarea |

Behaviour everywhere:

- Button is non-blocking — typing still works.
- Once a photo is graded, its `final_answer` (or working summary) lands in the textarea; the student can edit before submitting.
- Haptics + XP stay handled by `PhotoSolvePanel` exactly as today; no double XP from the host's own grader because the host only awards on its own submit.

## Out of scope

- No new tables, no new edge functions.
- No layout redesign of existing answer surfaces — just one button added per Textarea.
- MCQ questions in MockExam/ExamQuestionPanel keep their current selection UI (no photo).
