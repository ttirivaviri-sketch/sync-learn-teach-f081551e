# Quality & Interpretability Upgrade — 5 Priorities

Builds on the current architecture. Additive schema only; no existing rows break. Each phase ships independently and the app stays green between phases.

## Surfaces in scope

11 edge functions return JSON today and are reachable with minimal change: `generate-daily-task`, `generate-quiz`, `generate-flashcards`, `generate-mock-paper`, `generate-exam-questions`, `generate-prerequisite-quiz`, `generate-concept-review`, `generate-topic-session`, `generate-progress-plan`, `generate-study-plan`, `grade-answer`, `evaluate-topic-answer`.

Two stream markdown (`ai-tutor`, `generate-task-content`) — out of scope for structured rewrite in this pass; they get provenance via a post-stream meta event only.

---

## Phase 1 — Schema foundation (one migration)

Additive only. Safe to ship before any function changes.

- `concepts` table — canonical registry: `(subject_id, topic, label, slug, syllabus_ref)`, unique on `(subject_id, slug)`.
- `concept_attempts` table — unified per-attempt log keyed by `concept_id`: `(user_id, concept_id, surface, was_correct, marks_awarded, marks_possible, source_id, source_table, created_at)`. Replaces the split between `quiz_attempts.concepts_tested[]` and `daily_task_attempts`.
- `question_fingerprints` table — `(user_id, subject_id, fingerprint, surface, embedding, seen_at)`, unique `(user_id, fingerprint)`. `embedding vector(768)` column gated on `pgvector` extension; if extension unavailable, ship without it and add later.
- `generation_meta jsonb` column on `daily_tasks`, `quiz_attempts`, `flashcards`, `mock_exam_attempts`, `topic_session_questions`.
- `concept_id uuid` (nullable, FK → concepts) on `daily_task_concepts` and `weak_concepts` — backfill comes later, no rewrite of existing rows.
- RLS + GRANTs per platform rules. `concepts` is readable by all authenticated; `concept_attempts` and `question_fingerprints` are user-scoped.

## Phase 2 — Provenance everywhere

A single shared helper `_shared/provenance.ts` builds the meta object:

```
{
  model, fn_name, fn_version, prompt_hash,
  generated_at, ai_latency_ms,
  syllabus_objectives: string[],
  subtopic, concept_ids: uuid[],
  weak_area_triggers: string[],
  paper_blueprint_id?: uuid,
  past_paper_style_source?: string,
  novelty_reason: 'fresh' | 'regenerated' | 'cache_hit',
  validator_warnings: string[]
}
```

Wired into every JSON generator. Stored in the new `generation_meta` column (or inside `task_payload.__meta` for `daily_tasks` to keep one source of truth there). For the streaming functions, the meta object is emitted as a final SSE `event: meta` frame and dropped on the floor by clients that don't care.

## Phase 3 — Structured outputs for the laggards

Move every JSON-returning generator from "JSON.parse + ad-hoc normalise" to **Zod parse against a shared schema**, and use **OpenAI tool-calls** (response_format: json_schema) where the model supports it. Schemas live in `_shared/schemas/` and are imported by both the edge function and the client (via a re-export from `src/integrations/ai/schemas.ts`).

Shared schema fields every question carries:

- `id`, `question`, `marks`, `command_word`
- `concept_ids: uuid[]` (required, non-empty)
- `syllabus_objective_refs: string[]`
- `difficulty: 'foundation'|'standard'|'stretch'`
- `novelty: { fingerprint, reason }`
- `rationale` (why this question, why now)

Generators converted in this phase: `generate-quiz`, `generate-flashcards`, `generate-mock-paper`, `generate-exam-questions`, `generate-prerequisite-quiz`. `generate-daily-task` already uses tool-calls — just gets the shared schema + provenance fields.

## Phase 4 — Novelty engine

Server-side service, two layers:

1. **Exact fingerprint** — SHA-256 of a normalised question stem (lowercase, strip whitespace + punctuation, strip numbers in word problems). Query `question_fingerprints` by `(user_id, fingerprint)` — reject duplicate.
2. **Semantic similarity** — embed question stem via Lovable AI Gateway (`text-embedding-3-small` or Gemini equivalent). Compare against last N=200 fingerprints for that `(user_id, subject_id)` using cosine distance; reject if `> 0.92`.

Flow lives in `_shared/novelty.ts`:

- `await checkNovelty(userId, subjectId, questionText, surface)` → `{ ok, reason, fingerprint, embedding }`
- On reject, the generator retries up to 2× with the failed stems passed back into the prompt as a `do_not_repeat` list.
- On accept, fingerprint + embedding are persisted in the same transaction as the artifact write.

Behind a feature flag (`NOVELTY_ENGINE_ENABLED` env var) so rollout is reversible.

## Phase 5 — Concept-level mastery + validator

**Concept extraction replacement** (`src/studymode/hooks/useTopicPerformance.ts`, `useWeakConcepts.ts`):

- Stop deriving weak concepts from "wrong-question keywords".
- Mastery now reads directly from `concept_attempts`. A concept is weak when `mastery_score < 0.6`, where mastery uses an EWMA over the last 10 attempts (recency-weighted accuracy, capped at 1.0).
- `weak_concepts.weakness_score` becomes a materialised view over `concept_attempts` rather than a hand-maintained table. Old table stays for backward compatibility but writes go through a trigger.

**Concept ID resolution** at generation time:

- Generators receive the full `concepts` list for `(subject, topic)` and are required to return `concept_ids` chosen from that list (validated by Zod enum).
- For free-text inputs from older artifacts, a tiny `resolveConceptId(label, subject_id)` does case-insensitive slug match, then falls back to embedding nearest-neighbour against the `concepts` table.

**Validator pass** (`_shared/validators/`):
Pure functions, no AI calls. Run after Zod parse, before persistence. Outputs `{ ok, warnings[], blocking_errors[] }`.

Checks:

1. Topic adherence — every `concept_id` in the response is in the requested topic's concept set.
2. Syllabus mapping — every `syllabus_objective_refs[]` entry exists in `curriculum_topic_templates` for that subject+grade.
3. Stem repetition — no two questions in the same artifact share a fingerprint; no question matches a fingerprint from the user's last 50 attempts.
4. Mark-scheme arithmetic — `markingScheme[].marks.sum() === question.marks`; `paper.questions.marks.sum() === paper.total_marks`.
5. Command-word legality — `question.command_word` in the per-subject allow-list (define, explain, calculate, evaluate, etc.).

Blocking errors trigger one regeneration with the errors fed back into the prompt; persistent failure surfaces a clear error to the client instead of silently shipping bad content.

---

## Technical details

### Migration order

1. Phase 1 migration — schema only, no code touches.
2. Phase 2 — code-only PR, deploys provenance helper + wires every JSON generator. No schema changes.
3. Phase 3 — code-only PR, schemas + Zod. Bumps `fn_version` in provenance so old vs new outputs are distinguishable in analytics.
4. Phase 4 — migration to enable `pgvector` (if not present) + code PR + env flag rollout.
5. Phase 5 — migration for the materialised view + trigger + concept seeding job + code PR.

### Concept seeding

A one-time job (`supabase/functions/seed-concepts/index.ts`, admin-only) walks `curriculum_topic_templates` for every `(curriculum, grade, subject)` and creates `concepts` rows from each subtopic's learning objectives. Idempotent on `(subject_id, slug)`.

### Streaming generators

`ai-tutor` and `generate-task-content` are not rewritten. They emit a final `event: meta\ndata: {...provenance}` SSE frame. The `generate-task-content` markdown is fingerprinted post-stream and added to `question_fingerprints` so it participates in novelty checks even without a structured shape.

### What does NOT change

- Existing `daily_tasks.task_payload` shape stays — provenance is added under `__meta`, existing readers ignore unknown keys.
- `quiz_attempts` and `flashcards` reads stay backward compatible — `generation_meta` is nullable.
- `weak_concepts` table keeps its current columns and reads; only the write path changes (trigger).
- No client API breaks: every Supabase function keeps the same name, request shape, and response top-level shape.

### Files touched (high level)

- `supabase/migrations/` — 3 new migrations (Phase 1, 4, 5)
- `supabase/functions/_shared/` — new files: `provenance.ts`, `novelty.ts`, `schemas/`, `validators/`
- `supabase/functions/generate-*` — every JSON generator gets a ~30-line diff to wire the helpers
- `supabase/functions/seed-concepts/` — new admin function (Phase 5)
- `src/integrations/ai/schemas.ts` — re-export Zod schemas to the client for type safety
- `src/studymode/hooks/useTopicPerformance.ts`, `useWeakConcepts.ts` — switch to `concept_attempts`-driven mastery

---

## Open questions before I start

1. **pgvector** — happy for me to enable the `vector` extension for semantic novelty, or keep Phase 4 to exact fingerprints only? Vector extension 
2. **Concept seeding scope** — seed `concepts` for ZIMSEC + the just-added CAPS / IEB / Cambridge templates, or ZIMSEC only first and the rest after admins verify the templates? All templates
3. **Validator on regenerate-fail** — when validation blocks twice in a row, do you want the user to see a "couldn't generate fresh content — try again" message, or do you want a relaxed-mode fallback that ships the content with `validator_warnings` attached?  Try again
4. **Phase ordering** — ship all five in sequence (≈one phase per session), or batch Phase 1+2 together since they're the smallest and unlock everything else? Phase 1+2
5. Study sync is not loading (white blank page)