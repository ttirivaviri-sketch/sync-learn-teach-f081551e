# feat(learning-ops): Phase 3.2 — prerequisite DAG, predictive risk, per-teacher routing, plan optimizer, class detail

## Summary

Phase 3.2 hits five of the ten open items from the "Still remaining for full shipment" list, delivered as a coherent LOS increment:

- **#3 Prerequisite/knowledge graph** — real DAG edges + recursive upstream traversal
- **#4 Predictive risk (7-day forward)** — EWMA/slope-based projected risk view
- **#2 Per-teacher alert routing** — assigns open interventions to cohort lead teachers
- **#5 Study plan optimizer** — nightly-capable job that stages plan proposals for review
- **#7 Teacher command center parity for classes** — new `/teacher/class/:cohortId` surface

Everything wires into the existing Phase 3.1 automation runtime, so it's schedulable, auditable, and available from both UI and cron.

## Migration

`supabase/migrations/20260705093000_learning_ops_phase3_2_dag_predictive_risk_class_scoped.sql`

1. **`learning_concept_prerequisite_edges`** — DAG edges over `learning_concept_catalog` with `weight`, `source_kind` (`manual` / `ingested` / `inferred` / `template`), RLS (all authenticated read, staff manage), and a `no_self_edge` check constraint.
2. **`materialize_concept_prerequisite_edges(subject_name?)`** — resolves `learning_concept_catalog.prerequisites text[]` (Phase 3 provenance data) into real graph edges by matching concept names within the same subject + curriculum. Idempotent via `on conflict do nothing`.
3. **`get_upstream_prerequisites(concept_id, max_depth)`** — recursive CTE walking upstream through the DAG, returning `(concept_id, concept_name, subject_name, topic_name, depth, weight)` up to `max_depth` (default 3).
4. **`learner_projected_risk` view** — 14-day per-user/per-subject rollup with:
   - `recent_avg_delta` (mastery ledger `score_delta`)
   - `slope_per_day` (covariance-based slope over the 14-day window)
   - `avg_confidence`
   - `projected_risk` (0..100, higher = worse) = `50 − avg_delta·1.4 − slope·20 − avg_confidence·20 + evidence_penalty`
5. **`learning_class_at_risk` view** — cohort × learner rollup joining projected risk with open intervention counts, so class detail can render one row per learner.
6. **`workspace_class_teachers(workspace_id, user_ids?)`** — returns `(user_id, cohort_id, teacher_user_id)` mapping learners to their cohort's `lead_user_id`.
7. **`route_interventions_to_teachers(workspace_id)`** — assigns `assigned_to_user_id = teacher_user_id` and `assigned_role = 'teacher'` on every open/acknowledged intervention where the learner has a cohort lead. Idempotent.
8. **`learning_ops_plan_proposals`** — staging table for optimizer output (`user_id`, `subject_name`, `topic_name`, `proposed_for`, `duration_minutes`, `reason`, `projected_risk`, `status`, `applied_schedule_id`). RLS: learners see their own; workspace staff see all in their workspace.
9. **`run_study_plan_optimizer(workspace_id)`** — writes proposals from (a) open interventions (weighted by priority) and (b) learners with `projected_risk ≥ 65`. Deduped on `(user_id, subject_name, topic_name, proposed_for=tomorrow, status='proposed')`. Emits a `study_plan_optimizer` run into `learning_ops_automation_runs` for cadence audit.
10. Grants for `authenticated` on all new RPCs and views.

## Automation runtime — new jobs

`supabase/functions/run-learning-ops-automation/index.ts` now handles two additional jobs alongside the Phase 3.1 ones:

- `study_plan_optimizer` — dispatches `run_study_plan_optimizer` and returns `proposals_created`
- `route_interventions_to_teachers` — dispatches routing RPC, wrapped in `record_automation_run_start` / `record_automation_run_finish` so it appears in the cadence audit

`learning_ops_automation_schedule` now legally accepts these two `job_name` values, so cron-driven autopilot picks them up alongside the sweep and rollup jobs.

## Typed LOS surface

`src/integrations/supabase/learning-os-types.ts`:

- New unions: `LosAutomationJobName` extended with `study_plan_optimizer` and `route_interventions_to_teachers`
- New row types: `LosPrerequisiteEdgeRow` / `Insert`, `LosPlanProposalRow` / `Insert`
- New view types: `LosProjectedRiskRow`, `LosClassAtRiskRow` (added to `LearningOpsViews`)
- Registered `learning_concept_prerequisite_edges` and `learning_ops_plan_proposals` in `LearningOpsTables`
- New RPC declarations in `LearningOpsFunctions`: `materialize_concept_prerequisite_edges`, `get_upstream_prerequisites`, `route_interventions_to_teachers`, `run_study_plan_optimizer`

No new `as any` casts. `losFrom()`, `losView()`, and `losSupabase.rpc()` remain the sole typed access points.

## Service layer

`src/studymode/lib/learningOps.ts` — added:

- `materializeConceptPrerequisiteEdges(subjectName?)`
- `loadUpstreamPrerequisites(conceptId, maxDepth=3)` returning `UpstreamPrerequisite[]`
- `loadProjectedRiskForUsers(userIds)` returning `ProjectedRiskRow[]`
- `loadClassAtRisk(workspaceId, cohortId?)` returning `ClassAtRiskRow[]`
- `routeInterventionsToTeachers(workspaceId)` returning routed count
- `runStudyPlanOptimizer(workspaceId)` returning RPC payload
- `loadPlanProposals({ workspaceId?, userId?, status? })` returning `PlanProposalSummary[]`
- `updatePlanProposalStatus({ proposalId, status })`

## Hooks + UI

- **`src/studymode/hooks/useClassAtRisk.ts`** — cohort-scoped risk load + route/optimize actions
- **`src/studymode/hooks/usePlanProposals.ts`** — proposals list with accept/dismiss
- **`src/studymode/components/TeacherClassDetail.tsx`** — class-scoped panel: KPI tiles (students, open interventions, high projected risk), roster with projected risk chips, plan proposals with accept/dismiss, action buttons for route + optimize
- **`src/pages/TeacherClassDetailPage.tsx`** — mounted at `/teacher/class/:cohortId` with auth + workspace guard
- **`src/App.tsx`** — new lazy import + route
- **`src/studymode/components/AutomationControlPanel.tsx`** — `study_plan_optimizer` and `route_interventions_to_teachers` visible as first-class jobs in the automation panel

## Gap analysis vs the 10 open items

| # | Item | Status after 3.2 |
|---|---|---|
| 1 | Guardian portal (RLS + weekly digest cron) | Still open — planned for 3.3 |
| 2 | Per-teacher alert routing | **✅ shipped** (`route_interventions_to_teachers` + automation job) |
| 3 | Prerequisite/knowledge graph DAG | **✅ shipped** (edges table + traversal RPC + `materialize_concept_prerequisite_edges`) |
| 4 | Predictive risk (7-day forward) | **✅ shipped** (`learner_projected_risk` view + service surface) |
| 5 | Study plan optimizer | **✅ shipped** (`run_study_plan_optimizer` + proposals staging + accept/dismiss UI) |
| 6 | Mobile density pass | Still open — planned for 3.3 |
| 7 | Teacher command center parity in class detail | **✅ shipped** (`TeacherClassDetail` + `/teacher/class/:cohortId`) |
| 8 | Cross-school SuperAdmin analytics | Still open — planned for 3.3 |
| 9 | Instrumentation coverage audit | Still open — planned for 3.3 |
| 10 | A/B evaluation with control cohort | Still open — planned for 3.3 |

## Validation

Full test suite passes: `node tests/suite.mjs` → **79 passed / 0 failed**.

Section 13 (**Learning Operating System Phase 3.2**) adds 5 new tests:
1. Migration adds DAG, predictive risk, optimizer surface
2. LOS type contract exposes Phase 3.2 tables, views, and RPCs
3. `learningOps` exposes the Phase 3.2 service surface
4. Automation runtime + hook handle the two new jobs
5. Teacher class detail route and UI are mounted

## Cron wiring (recommended)

Add the two new jobs to your existing schedule. From your Supabase project SQL editor, per workspace you want on autopilot:

```sql
insert into public.learning_ops_automation_schedule (workspace_id, job_name, cadence, enabled)
values
  ('<workspace_uuid>', 'study_plan_optimizer',            'daily',  true),
  ('<workspace_uuid>', 'route_interventions_to_teachers', 'daily',  true)
on conflict (workspace_id, job_name) do update set enabled = excluded.enabled;
```

The existing `run-learning-ops-automation` cron already picks up every due schedule row — no additional cron entry required.

## Backwards compatibility

- No columns dropped, no policies loosened.
- New tables and views are additive.
- The optimizer never overwrites `study_schedule` directly — it stages proposals; existing schedule logic is untouched.
- No new `as any` casts.
