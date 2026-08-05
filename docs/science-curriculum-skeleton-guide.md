# Science Curriculum Skeleton — Fill-in Guide

`science-curriculum-skeleton.json` is a ready-to-fill template for the **17
science curriculum combinations** that cannot be auto-generated. Once filled
in, it imports directly through **Admin → Curriculum Templates → Import
verified topic trees** — no migration or deploy needed.

## Combinations covered

| Curriculum | Grade    | Subjects                              |
|------------|----------|---------------------------------------|
| ZIMSEC     | Form 4   | Physics, Chemistry, Biology, Combined Science |
| CAMB       | IGCSE    | Physics, Chemistry, Biology            |
| CAMB       | O-Level  | Physics, Chemistry, Biology            |
| CAMB       | A-Level  | Physics, Chemistry, Biology            |
| NSC        | Grade 12 | Physical Sciences, Life Sciences       |
| IEB        | Grade 12 | Physical Sciences, Life Sciences       |

Curriculum/grade/subject names already match the app's canonical values —
**do not change them**, only fill in the topic content.

## How to fill it in

Every string starting with `REPLACE:` must be rewritten. Each template ships
with **8 topic stubs** — add or delete whole topic objects freely to match the
real syllabus structure (a strand-per-topic layout works well; see any merged
non-science template in the Curriculum Templates admin page for a live
example of the target quality).

Per topic:

| Field | What to write |
|-------|---------------|
| `name` | Official strand/topic title from the syllabus (e.g. "Forces and Motion") |
| `subtopics` | The syllabus sub-headings under this topic |
| `learning_objectives` | Verb-led outcomes: "Calculate…", "Describe…", "Explain…" |
| `key_concepts` | Core terms/ideas: "Newton's second law", "moles", "osmosis" |
| `assessment_objectives` | How the exam board assesses it (AO1 recall, AO2 application, AO3 analysis/practical) |
| `typical_question_styles` | e.g. "short structured 3-mark calculation", "6-mark extended response with diagram" |
| `exam_weight` | Whole-number % — **must sum to 100 across all topics in the template** (stubs pre-sum to 100; rebalance if you add/remove topics) |
| `prerequisites` | Earlier topics or foundations. **Never leave empty** — use e.g. "Lower secondary science foundations" for opening topics |
| `common_misconceptions` | Wrong ideas learners typically hold ("heavier objects fall faster") |
| `exemplar_question_stems` | **Original stems you write yourself** — never copy exam-board questions or wording |

For CAMB A-Level, prefix topic names with `AS:` / `A2:` to match the
convention used by the merged non-science A-Level templates.

## Content policy (important)

- Strand structure, topic lists and weightings are **factual syllabus
  information** — fine to state.
- All exemplar question stems must be **original**. Do not reproduce past
  paper questions, mark schemes, or verbatim syllabus text.

## Importing

1. You can split the file — the panel accepts a single template, an array, or
   the full `{ "templates": [...] }` wrapper. Importing one subject at a time
   is fine; the panel upserts per (curriculum, grade, subject).
2. In **Admin → Curriculum Templates**, open the import panel, upload the
   .json (or paste it), and fix any validation issues it flags.
3. Click **Check against database** — new rows show `new`, AI rows show
   `upgrades AI row`. Then **Import**.
4. Imported rows are stored as `verified` and immediately become ground truth
   for quizzes, topic sessions, flashcards and mock papers.

> Any leftover `REPLACE:` text will import as literal content — search the
> file for `REPLACE:` before importing and make sure there are zero hits.
