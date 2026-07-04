# Manual edits — Phase 3.2

Two files need in-place edits; everything else is a straight file copy.

---

## 1) `src/App.tsx`

Add the lazy import next to the existing LOS page imports:

```diff
 const SchoolInvitationPage = lazy(() => import("./pages/SchoolInvitationPage"));
+const TeacherClassDetailPage = lazy(() => import("./pages/TeacherClassDetailPage"));
```

And the route, right after `/school/join`:

```diff
               <Route path="/school/join" element={<SchoolInvitationPage />} />
+              <Route path="/teacher/class/:cohortId" element={<TeacherClassDetailPage />} />
```

---

## 2) `tests/suite.mjs`

Append a new Section 13 immediately before the SUMMARY divider:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 13. LEARNING OPERATING SYSTEM PHASE 3.2
// ─────────────────────────────────────────────────────────────────────────────
suite('13. Learning Operating System Phase 3.2');

await test('Phase 3.2 migration adds DAG, predictive risk, and optimizer surface', () => {
  const mig = readFileSync(path.join(__dirname, '../supabase/migrations/20260705093000_learning_ops_phase3_2_dag_predictive_risk_class_scoped.sql'), 'utf8');
  const required = [
    'learning_concept_prerequisite_edges',
    'materialize_concept_prerequisite_edges',
    'get_upstream_prerequisites',
    'learner_projected_risk',
    'learning_class_at_risk',
    'route_interventions_to_teachers',
    'run_study_plan_optimizer',
    'learning_ops_plan_proposals',
  ];
  for (const marker of required) {
    assert.ok(mig.includes(marker), `Missing Phase 3.2 marker: ${marker}`);
  }
  return Promise.resolve();
});

await test('LOS type contract exposes Phase 3.2 tables, views, and RPCs', () => {
  const content = readFileSync(path.join(SRC_DIR, 'integrations/supabase/learning-os-types.ts'), 'utf8');
  const required = [
    'learning_concept_prerequisite_edges',
    'learning_ops_plan_proposals',
    'learner_projected_risk',
    'learning_class_at_risk',
    'materialize_concept_prerequisite_edges',
    'get_upstream_prerequisites',
    'route_interventions_to_teachers',
    'run_study_plan_optimizer',
    'study_plan_optimizer',
  ];
  for (const marker of required) {
    assert.ok(content.includes(marker), `Missing LOS type marker: ${marker}`);
  }
  return Promise.resolve();
});

await test('learningOps exposes Phase 3.2 service surface', () => {
  const content = readFileSync(path.join(SRC_DIR, 'studymode/lib/learningOps.ts'), 'utf8');
  const required = [
    'export async function materializeConceptPrerequisiteEdges',
    'export async function loadUpstreamPrerequisites',
    'export async function loadProjectedRiskForUsers',
    'export async function loadClassAtRisk',
    'export async function routeInterventionsToTeachers',
    'export async function runStudyPlanOptimizer',
    'export async function loadPlanProposals',
    'export async function updatePlanProposalStatus',
  ];
  for (const marker of required) {
    assert.ok(content.includes(marker), `Missing LOS service marker: ${marker}`);
  }
  return Promise.resolve();
});

await test('Automation runtime handles new Phase 3.2 jobs', () => {
  const fn = readFileSync(path.join(__dirname, '../supabase/functions/run-learning-ops-automation/index.ts'), 'utf8');
  assert.ok(fn.includes('study_plan_optimizer'), 'Automation must handle study_plan_optimizer job');
  assert.ok(fn.includes('route_interventions_to_teachers'), 'Automation must handle route_interventions_to_teachers job');
  const hook = readFileSync(path.join(SRC_DIR, 'studymode/hooks/useAutomationRuntime.ts'), 'utf8');
  assert.ok(hook.includes('runStudyPlanOptimizer'), 'Hook must dispatch optimizer');
  assert.ok(hook.includes('routeInterventionsToTeachers'), 'Hook must dispatch routing');
  return Promise.resolve();
});

await test('Teacher class detail route and UI are mounted', () => {
  const app = readFileSync(path.join(SRC_DIR, 'App.tsx'), 'utf8');
  const page = readFileSync(path.join(SRC_DIR, 'pages/TeacherClassDetailPage.tsx'), 'utf8');
  const comp = readFileSync(path.join(SRC_DIR, 'studymode/components/TeacherClassDetail.tsx'), 'utf8');
  assert.ok(app.includes('/teacher/class/:cohortId'), 'App must expose /teacher/class/:cohortId route');
  assert.ok(page.includes('TeacherClassDetail'), 'Page must render TeacherClassDetail');
  assert.ok(comp.includes('useClassAtRisk') && comp.includes('usePlanProposals'), 'Class detail must use both new hooks');
  return Promise.resolve();
});
```

---

## Verification

```bash
node tests/suite.mjs
```

Expected: **79 passed / 0 failed** (Section 13 shows 5 additional passing tests).

## Optional: enable the new jobs per workspace

```sql
insert into public.learning_ops_automation_schedule (workspace_id, job_name, cadence, enabled)
values
  ('<workspace_uuid>', 'study_plan_optimizer',            'daily',  true),
  ('<workspace_uuid>', 'route_interventions_to_teachers', 'daily',  true)
on conflict (workspace_id, job_name) do update set enabled = excluded.enabled;
```

The existing `run-learning-ops-automation` cron picks up every due schedule row — no additional cron entry required.
