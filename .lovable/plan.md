

## Goal
Make syllabus parsing complete and accurate, and make the AI tutor teach with proper exam-board strategies (command words, assessment objectives, paper structure) — not just generic explanations.

## Root causes found

1. **`DocumentUpload.tsx`** reads PDFs with `file.text()` — that returns raw PDF bytes, not extracted text. Then it truncates to 50 000 chars. Result: the AI extractor sees garbled, truncated input, so topics from page 12+ of the syllabus are silently lost. This is why Ashlie's Biology subject was missing topics.
2. **`parse-document` edge function** prompt asks for "all topics" but doesn't enforce coverage of every numbered section, and never extracts command words, assessment objectives, practical skills, or paper structure.
3. **`ai-tutor` system prompt** has a generic teaching style. There is nothing about Cambridge IGCSE conventions: command words (state / describe / explain / suggest / compare), AO1 vs AO2 vs AO3, the 6-mark structured-question style, mark scheme keywords, or practical paper expectations. So the AI explains the topic but doesn't teach exam strategy.

## Plan

### 1. Fix PDF text extraction in upload
- In `DocumentUpload.tsx`: detect file type. For PDFs, extract real text using `pdfjs-dist` (already a transitive dep via shadcn/lovable) before sending. For DOCX, use a lightweight client extractor or send bytes to the edge function.
- Remove the 50 000 char truncation; instead chunk if needed and send the full text.
- For very large syllabi (>120 000 chars), chunk into 2–3 passes and merge `topics` arrays in the edge function.

### 2. Strengthen syllabus extraction
In `parse-document/index.ts` (syllabus branch):
- Update the `SYLLABUS_TOOL` schema to also capture: `command_words[]`, `assessment_objectives[] (AO1/AO2/AO3 with descriptions)`, `paper_structure[] (paper name, duration, marks, type)`, `practical_skills[]`, `mathematical_requirements[]`.
- Update the prompt: instruct the model to walk through the document section by section ("Subject content", "Assessment overview", "Details of the assessment", "Command words") and extract each, refusing to skip any numbered topic.
- Persist the new fields on the `subjects` row (JSON column `exam_board_meta`) so the tutor can pull them.

### 3. Make the AI tutor teach with exam strategy
In `ai-tutor/index.ts`:
- When fetching subject data, also pull `exam_board_meta` (command words, AOs, paper structure) and inject into the context block.
- Rewrite the system prompt's TEACHING STYLE section to:
  - Always mention which AO a question targets when giving practice.
  - Always interpret the command word ("explain" → reasoning + linking words; "describe" → observation only; "state" → one-line factual).
  - End every concept explanation with a "How this is examined" mini-block: typical mark allocation, typical command words, paper it appears in.
  - Use mark-scheme-style keywords (the words examiners actually award marks for).

### 4. Re-parse Ashlie's existing Biology syllabus
- After the fix ships, add a one-time button in the syllabus manager: "Re-parse syllabus" that re-runs `parse-document` on the already-uploaded PDF using the new pipeline, so existing students get the fixed topic list without re-uploading.

### 5. Validation
- Re-upload the Bio 2026–2028 PDF in a test account → confirm `subjects.topics` contains all 21 topic groups from the Cambridge subject content section, plus `exam_board_meta` populated.
- Open AI tutor on a Biology topic → confirm responses now reference command words and AOs, and end with "How this is examined".
- Click "Re-parse syllabus" on Ashlie's account → confirm her topic list expands.

## Files touched
- `src/studymode/components/DocumentUpload.tsx` — real PDF text extraction, no truncation, chunking
- `supabase/functions/parse-document/index.ts` — richer schema, stronger prompt, store exam_board_meta
- `supabase/functions/ai-tutor/index.ts` — pull and inject exam_board_meta, new teaching prompt
- `src/components/syllabus/SyllabusEntryCard.tsx` (or sibling) — add "Re-parse syllabus" action
- DB: add `exam_board_meta jsonb` column on `subjects` (migration)

## Technical notes
- Chunking strategy: split text on section headers (`## Page` markers from pdfjs page splits work well). Run extraction per chunk, deep-merge `topics` by `id`, union `subtopics`/`learningObjectives`.
- The 50-page limit on `document--parse_document` is unrelated — that's only the AI's local debug parser; the edge function uses Lovable AI Gateway which has no page cap once we pass real text instead of binary.

