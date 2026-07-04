# feat(learning-ops): Phase 3.1 — automation runtime + document-to-concept ingestion

## Summary

Phase 3.1 turns the automation and concept-graph surfaces shipped in Phase 3 into an **executable, closed-loop runtime**, so schools can actually schedule, run, audit, and act on LOS jobs — and grow the concept graph from real documents with provenance and human review.

**Highlights**

- **Automation runtime.** New per-workspace `learning_ops_automation_schedule` (cadence + enabled + next_run_at) plus SECURITY DEFINER RPCs (`run_nightly_intervention_sweep`, `run_weekly_cohort_rollup`) that both do the work and write into `learning_ops_automation_runs` so the Teacher Command Center's cadence panel becomes a real audit trail.
- **`run-learning-ops-automation` edge function.** Single entry point invoked either from pg_cron (autopilot: picks every enabled + due job across every workspace) or from the UI (targeted: `{ workspace_id, job }`). Handles `nightly_intervention_sweep`, `weekly_cohort_rollup`, and `guardian_digest` (delegates to `send-guardian-report`).
- **Document-to-concept ingestion.** New `learning_concept_ingestion_staging` table (staging → review → promotion), with RLS restricted to submitters + workspace admins/teachers. Ingestion never writes directly to `learning_concept_catalog` — it goes through review.
- **`ingest-document-concepts` edge function.** Reads a processed `documents.parsed_content` row (tolerating multiple parser shapes) and stages concept candidates with per-candidate `confidence`, prerequisites, and full provenance (`source_document_id`, `source_kind`).
- **`promote_concept_ingestion(uuid)` RPC.** Atomically promotes a staged row into `learning_concept_catalog` with `on conflict` upsert on `(curriculum, subject_name, topic_name, subtopic_name, concept_name)` and marks the staging row `promoted`.
- **Typed LOS surface expanded.** `learning-os-types.ts` now types the new tables and RPCs; `losFrom()` and `losSupabase.rpc(...)` remain the sole typed access points — **no new `as any` casts anywhere**.
- **UI wiring.** New `AutomationControlPanel` mounted inside `TeacherCommandCenter` (change cadence, enable/disable, run-now, last-run status). New `ConceptIngestionPanel` mounted inside `SchoolAdminConsole` (pick a processed document, run extraction, review pending, approve/reject/promote).

## Migration

`supabase/migrations/20260702101500_learning_ops_phase3_1_automation_runtime_and_ingestion.sql`

Adds:

1. `learning_ops_automation_schedule` (`workspace_id`, `job_name`, `cadence`, `enabled`, `last_run_at`, `last_status`, `last_error`, `next_run_at`) with unique `(workspace_id, job_name)`, RLS, admin-manage policy, `set_timestamp` trigger.
2. `learning_concept_ingestion_staging` (`workspace_id`, `source_document_id`, `source_kind`, `curriculum`, `subject_*`, `topic_name`, `concept_name`, `subtopic_name`, `objective_type`, `command_words`, `prerequisites`, `confidence`, `status`, `review_note`, `reviewed_by_user_id`, `reviewed_at`, `promoted_catalog_id`) with staging RLS and workspace-scoped indexes.
3. RPCs: `record_automation_run_start`, `record_automation_run_finish` (updates schedule too), `promote_concept_ingestion`, `run_nightly_intervention_sweep`, `run_weekly_cohort_rollup`.
4. Grants for `authenticated` on the new RPCs.

The nightly sweep auto-resolves interventions older than 21 days with zero post-evidence and updates `learning_ops_automation_runs` counts. The weekly rollup aggregates cohort-level intervention pressure + 7-day mastery delta into `details` JSON so the cadence panel can display real numbers.

## New surface

- Migration: `supabase/migrations/20260702101500_learning_ops_phase3_1_automation_runtime_and_ingestion.sql`
- Edge functions:
  - `supabase/functions/run-learning-ops-automation/index.ts`
  - `supabase/functions/ingest-document-concepts/index.ts`
- Service:
  - `src/studymode/lib/learningOps.ts` (added: `loadAutomationSchedule`, `upsertAutomationSchedule`, `runNightlyInterventionSweep`, `runWeeklyCohortRollup`, `stageConceptIngestionBatch`, `loadStagedConceptIngestions`, `reviewStagedConceptIngestion`, `promoteStagedConceptIngestion`, plus `AutomationScheduleSummary`, `StagedConceptRecord`, `ConceptIngestionCandidate`)
- Hooks:
  - `src/studymode/hooks/useAutomationRuntime.ts`
  - `src/studymode/hooks/useConceptIngestion.ts`
- UI:
  - `src/studymode/components/AutomationControlPanel.tsx` — mounted in `TeacherCommandCenter.tsx`
  - `src/studymode/components/ConceptIngestionPanel.tsx` — mounted in `SchoolAdminConsole.tsx`

## Type contract

`src/integrations/supabase/learning-os-types.ts`

- Adds `LosAutomationScheduleRow` / `Insert`, `LosConceptIngestionStagingRow` / `Insert`, and `LosAutomationJobName` / `LosAutomationCadence` unions.
- Registers `learning_ops_automation_schedule` and `learning_concept_ingestion_staging` in `LearningOpsTables`.
- Declares `promote_concept_ingestion`, `run_nightly_intervention_sweep`, and `run_weekly_cohort_rollup` in `LearningOpsFunctions`, so `losSupabase.rpc()` is fully typed.

## Cron wiring (recommended)

```sql
-- Every night at 02:15 UTC
select cron.schedule(
  'los-nightly-automation',
  '15 2 * * *',
  $$
    select net.http_post(
      url := concat(current_setting('app.settings.supabase_url'), '/functions/v1/run-learning-ops-automation'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', concat('Bearer ', current_setting('app.settings.service_role_key'))
      ),
      body := '{}'::jsonb
    );
  $$
);
```

`run-learning-ops-automation` picks up every enabled + due `learning_ops_automation_schedule` row and executes it, so cadence stays a data concern — not a code concern.

## Validation

- Full test suite passes: `node tests/suite.mjs` → **74 passed / 0 failed**
- Section 12 (**Learning Operating System Phase 3.1**) adds 5 new tests:
  1. Migration adds automation runtime + ingestion staging
  2. LOS type contract exposes Phase 3.1 tables and RPCs
  3. `learningOps` exposes the full service surface
  4. Automation + ingestion edge functions exist and handle expected job types
  5. Automation and ingestion panels are mounted in the dashboards + hook invokes the ingestion function

## Backwards compatibility

- Existing invitation, mastery, and intervention data is untouched.
- Automation and ingestion are opt-in: no schedule rows means no jobs run, and no ingestion happens until a document is explicitly submitted.
- No `as any` casts introduced. `losFrom()` and `losSupabase.rpc(...)` remain the sole typed access points.

## Next (Phase 3.2 preview)

1. Concept-trend charts drilldown in the Teacher Command Center (per-concept confidence over time via the `learning_concept_trends` view).
2. Intervention attribution UI — link resolved interventions to the concept + evidence that closed them.
3. Guardian workspace deep link into cohort/intervention detail for opted-in guardians.
