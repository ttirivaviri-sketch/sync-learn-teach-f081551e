# AI Homework: current state and the curriculum gap

## What already works

- **Real AI calls.** `studymode-generate-homework` calls the Lovable AI Gateway (via the shared `callAIJson` helper), with an examiner-grade system prompt: per-question model answer, mark-by-mark examiner notes, common mistakes, concepts tested, marks, LaTeX for maths, and optional visuals (function graphs, charts, SVG diagrams).
- **Real persistence.** It writes one `school_homework` row plus N `school_homework_questions`, computes total marks, honours teacher AI defaults, and records AI usage against the school quota.
- **Functional UI.** Teachers generate a draft in the class Homework tab, review/edit/reorder/delete questions in the editor, set a due date, and publish. Students see only published homework in their workspace and submit responses against the same question rows.
- **Security.** Teacher/admin membership is verified server-side and school contract gating is enforced before any AI spend.

## The gap

Generation is **document-grounded, not curriculum-grounded**. The function requires `document_id` and builds the prompt from ingested `school_ai_chunks`. If a school has not uploaded and ingested teaching material, the picker is empty and the teacher cannot generate anything — even though the platform already holds seeded curriculum topic trees for ZIMSEC, Cambridge, IEB and NSC.

## Proposed change: curriculum-sourced homework

1. **Source mode selector** in the generate card: "From document" (existing) or "From curriculum topic".
2. In curriculum mode the teacher picks curriculum → subject → topic/subtopics, using the class's curriculum, grade and subject as defaults so it is usually one click.
3. **Edge function**: make `document_id` optional. When absent, require `curriculum`, `grade`, `subject` and topic(s); load the topic tree rows (topic, subtopic, learning objectives) and build the grounding block from them instead of document chunks. Keep every other rule identical — same rubric, same LaTeX, same visuals, same JSON shape, same insert path.
4. **Provenance**: store the chosen curriculum/topic on the homework row so the class list and the student view can show "ZIMSEC · Grade 11 · Stoichiometry" instead of a document title.
5. **Empty-state fix**: replace "No ingested documents yet" with a prompt to generate from the curriculum instead.

## Technical notes

- Files touched: `supabase/functions/studymode-generate-homework/index.ts`, a new curriculum-loader helper in `supabase/functions/_shared/school-generators.ts`, `src/components/school/AiHomeworkPanel.tsx`, `src/hooks/useSchoolStudyMode.ts`, and a small migration for the provenance columns on `school_homework`.
- No change to the student submission or grading flow — it reads the same question rows.
- Verification: generate one document-sourced and one curriculum-sourced set on a real class, publish, and open it as a student.
