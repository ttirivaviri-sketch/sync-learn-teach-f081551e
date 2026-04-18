
## Diagnosis

The "Check My Prerequisites" button opens `PrerequisiteRemediationFlow`, which calls three edge functions:
- `analyze-prerequisites`
- `generate-prerequisite-theory`
- `generate-prerequisite-quiz`

**None of these exist** in `supabase/functions/`. They're listed in `aiClient.ts`'s `EDGE_FUNCTION_MAP` but were never deployed. So every request 404s, the catch block toasts a generic error and immediately fires `onComplete()` — which is why the feature appears to silently do nothing.

A second weakness in the existing component: even when `analyze-prerequisites` did exist, it was called with only `{ subject, topic }` — no curriculum, no syllabus topic list, no past-paper question types. So the breakdown couldn't be tailored to the curriculum/exam style the user is asking for.

## Fix

### 1. Create the 3 missing edge functions
All use the shared AI config + `callAI` + `safeJsonParse` pattern already used by `generate-quiz`/`generate-flashcards`.

**`supabase/functions/analyze-prerequisites/index.ts`**
- Inputs: `subject`, `topic`, `curriculum`, `grade`, `gradeLevel`, plus `subjectContext` (built server-side via existing `get_subject_context` RPC: syllabus topics, past-paper question types, command words, exam patterns).
- Prompt: "For curriculum X at grade Y, list the foundational topics a student MUST know before attempting `topic`. Ground each gap in the question types asked in past papers (e.g. for differentiation: algebraic simplification, indices, basic trig identities, function notation). Return 1–4 gaps."
- Output: `{ gaps: [{ topic, description, missingConcepts: string[], exampleQuestions: string[], tiedToQuestionType?: string }] }`.

**`supabase/functions/generate-prerequisite-theory/index.ts`**
- Inputs: `subject`, `prerequisiteTopic`, `missingConcepts`, `curriculum`, `grade`.
- Output: `{ theory: string }` — concise markdown/LaTeX refresher (KaTeX-ready), worked mini-example, links to the parent topic.

**`supabase/functions/generate-prerequisite-quiz/index.ts`**
- Inputs: `subject`, `topic` (the prerequisite), `curriculum`, `grade`, `difficulty: 'basic'`, `questionCount: 3`.
- Output: `{ questions: [{ question, options[], correctAnswer (index), explanation }] }` — multiple-choice, basic difficulty, mirrors past-paper command words at foundation level.

All 3 use Lovable AI Gateway via `callAI`, public CORS, JWT verification on (so `auth.uid()` is available for `get_subject_context`).

### 2. Wire grounding into the component
Update `PrerequisiteRemediationFlow.tsx`:
- Pull curriculum + grade from `useAcademicProfile`.
- Pass `subjectId` (already known from the parent `SubjectDetail`) so the edge function can call `get_subject_context` for syllabus-aware analysis.
- Update `SubjectDetail.tsx` to forward `subjectId` to the flow.

### 3. Small UX fix
In `PrerequisiteRemediationFlow.tsx`, the existing flow swallows errors and exits. Change so a true failure shows a retry button instead of silently calling `onComplete()`.

### Files
- `supabase/functions/analyze-prerequisites/index.ts` (new)
- `supabase/functions/generate-prerequisite-theory/index.ts` (new)
- `supabase/functions/generate-prerequisite-quiz/index.ts` (new)
- `src/studymode/components/PrerequisiteRemediationFlow.tsx` (edit: pass curriculum/grade/subjectId, retry on error)
- `src/studymode/components/SubjectDetail.tsx` (edit: forward `subject.id`)

### Result
"Check My Prerequisites" actually runs an end-to-end flow:
1. Detects 1–4 real gaps grounded in the user's curriculum and the question types asked in past papers for that topic (e.g. "differentiation" → algebraic simplification, indices, basic trig).
2. Shows a focused theory refresher per gap.
3. Quizzes the student (3 basic MCQs) before letting them proceed.
4. On full pass, returns the user to the original topic ready to attempt it.
