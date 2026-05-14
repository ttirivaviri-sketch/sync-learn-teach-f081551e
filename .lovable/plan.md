## StudyMode Curriculum Topic Seeding

Build the `seed-curriculum-topics` edge function and a one-shot bulk runner that populates `curriculum_topic_templates` for every (curriculum, grade, subject) combination across ZIMSEC, CAMB, IEB, and NSC. Learners then copy from templates instead of paying AI cost per signup.

### 1. Edge function: `seed-curriculum-topics`

Path: `supabase/functions/seed-curriculum-topics/index.ts` (verify_jwt = false, gated by `CRON_SECRET` header).

Input: `{ curriculum, grade, subject, force?: boolean }`

Flow:
1. Skip if template already exists for `(curriculum, grade, subject)` unless `force=true`.
2. Look for an official syllabus document in `documents` table matching curriculum/grade/subject (`type='syllabus'`). If found, extract topics from `parsed_content`.
3. Look for past papers (`type='past_paper'`) for same key → extract recurring topics into `exam_patterns`-style hints.
4. Call Lovable AI Gateway (`google/gemini-2.5-flash`) with a strict prompt: "Generate the COMPLETE official syllabus topic tree for {curriculum} {grade} {subject}. Output JSON `{topics:[{name, subtopics[], learning_objectives[], key_concepts[], exam_weight, prerequisites[]}]}`. Cover EVERY topic in the official syllabus — do not abbreviate."
5. Run a second AI validator pass that scores each topic against syllabus context and drops/merges low-confidence ones.
6. Upsert into `curriculum_topic_templates` with `source` = `syllabus` | `ai` | `hybrid`, `verified_at=now()`.

Uses `safeJsonParse` for repair. Uses `LOVABLE_API_KEY`.

### 2. Edge function: `bulk-seed-curriculum`

Path: `supabase/functions/bulk-seed-curriculum/index.ts` (CRON_SECRET-gated).

- Iterates `CURRICULUM_SUBJECTS` × `GRADE_LEVELS_BY_CURRICULUM` from `src/types/academicProfile.ts` (mirrored as a Deno constant in `_shared/curriculum-matrix.ts`).
- Calls `seed-curriculum-topics` per combo with concurrency=3, retry on failure.
- Returns progress summary: `{ total, succeeded, failed, skipped }`.
- Writes a `seeding_jobs` row tracking progress so the admin UI can poll.

Run as: `curl -H "x-cron-secret: …" .../bulk-seed-curriculum`. One-shot, not on cron (idempotent — skips existing).

### 3. Schema additions

```text
seeding_jobs (NEW)
  id uuid PK, kind text, status text ('running'|'done'|'failed')
  total int, succeeded int, failed int, skipped int
  started_at, finished_at, error text
  RLS: admin only
```

(`curriculum_topic_templates` already exists from the prior migration.)

### 4. Wire into learner flow

On learner subject pick (StudyMode `useSubjects` first-load or `LearnerOnboarding` profile step):
- For each subject, copy `curriculum_topic_templates.topics` into `subjects.topics` for that user. No AI call at runtime.
- If template missing (edge case), fall back to lazy `seed-curriculum-topics` for that one combo.

Add `src/studymode/hooks/useSeedSubjectsFromProfile.ts` that runs on first StudyMode entry.

### 5. Admin trigger

Add a "Seed Curriculum Templates" button on `/admin/curriculum-templates` (new minimal page) that POSTs to `bulk-seed-curriculum` and polls `seeding_jobs` for progress (table + per-row status, with a retry button per failed combo).

### 6. Execution

After deploy:
1. Apply schema migration for `seeding_jobs`.
2. Hit `bulk-seed-curriculum` once from admin UI (or curl). Estimate ~4 curricula × ~10 grades × ~15 subjects ≈ 600 AI calls; with skip-existing it's safe to re-run.
3. Spot-check 5 random templates in admin UI; mark `verified_by` once reviewed.

### Open questions

1. **Validator pass** — run it now (doubles AI cost, ~1200 calls) or only on subjects with no syllabus doc? Default suggestion: only when `source='ai'` (no syllabus available).
2. **Topic granularity** — target ~8–15 top-level topics per subject, with 3–8 subtopics each. OK?
3. **Admin verification UI** — minimal "view JSON + approve" for v1, or full topic-tree editor? Suggest minimal first; editor later.

Once you confirm, I'll create the migration + both edge functions + admin trigger page.
