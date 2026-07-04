# Manual edits — Phase 3.1

Only one file needs an in-place edit; everything else is a straight file copy from this bundle.

---

## `tests/suite.mjs`

Insert a new **Section 12** block immediately before the `SUMMARY` divider at the bottom of the file. Paste this exact block:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 12. LEARNING OPERATING SYSTEM PHASE 3.1
// ─────────────────────────────────────────────────────────────────────────────
suite('12. Learning Operating System Phase 3.1');

await test('Phase 3.1 migration adds automation runtime and ingestion staging', () => {
  const mig = readFileSync(path.join(__dirname, '../supabase/migrations/20260702101500_learning_ops_phase3_1_automation_runtime_and_ingestion.sql'), 'utf8');
  const required = [
    'learning_ops_automation_schedule',
    'learning_concept_ingestion_staging',
    'record_automation_run_start',
    'record_automation_run_finish',
    'promote_concept_ingestion',
    'run_nightly_intervention_sweep',
    'run_weekly_cohort_rollup',
  ];
  for (const marker of required) {
    assert.ok(mig.includes(marker), `Missing Phase 3.1 marker: ${marker}`);
  }
  return Promise.resolve();
});

await test('LOS type contract exposes Phase 3.1 tables and RPCs', () => {
  const content = readFileSync(path.join(SRC_DIR, 'integrations/supabase/learning-os-types.ts'), 'utf8');
  const required = [
    'learning_ops_automation_schedule',
    'learning_concept_ingestion_staging',
    'LosAutomationScheduleRow',
    'LosConceptIngestionStagingRow',
    'promote_concept_ingestion',
    'run_nightly_intervention_sweep',
    'run_weekly_cohort_rollup',
  ];
  for (const marker of required) {
    assert.ok(content.includes(marker), `Missing LOS type marker: ${marker}`);
  }
  return Promise.resolve();
});

await test('learningOps exposes automation + ingestion service surface', () => {
  const content = readFileSync(path.join(SRC_DIR, 'studymode/lib/learningOps.ts'), 'utf8');
  const required = [
    'export async function loadAutomationSchedule',
    'export async function upsertAutomationSchedule',
    'export async function runNightlyInterventionSweep',
    'export async function runWeeklyCohortRollup',
    'export async function stageConceptIngestionBatch',
    'export async function loadStagedConceptIngestions',
    'export async function reviewStagedConceptIngestion',
    'export async function promoteStagedConceptIngestion',
  ];
  for (const marker of required) {
    assert.ok(content.includes(marker), `Missing LOS service marker: ${marker}`);
  }
  return Promise.resolve();
});

await test('Automation edge function and ingestion edge function exist', () => {
  const automation = readFileSync(path.join(__dirname, '../supabase/functions/run-learning-ops-automation/index.ts'), 'utf8');
  const ingestion = readFileSync(path.join(__dirname, '../supabase/functions/ingest-document-concepts/index.ts'), 'utf8');
  assert.ok(automation.includes('nightly_intervention_sweep'), 'Automation function must handle nightly sweep');
  assert.ok(automation.includes('weekly_cohort_rollup'), 'Automation function must handle weekly rollup');
  assert.ok(automation.includes('guardian_digest'), 'Automation function must handle guardian digest');
  assert.ok(ingestion.includes('learning_concept_ingestion_staging'), 'Ingestion function must write to staging table');
  assert.ok(ingestion.includes('record_automation_run_start'), 'Ingestion function must log run start');
  return Promise.resolve();
});

await test('Automation and ingestion panels are mounted in dashboards', () => {
  const teacher = readFileSync(path.join(SRC_DIR, 'studymode/components/TeacherCommandCenter.tsx'), 'utf8');
  const admin = readFileSync(path.join(SRC_DIR, 'studymode/components/SchoolAdminConsole.tsx'), 'utf8');
  const automationPanel = readFileSync(path.join(SRC_DIR, 'studymode/components/AutomationControlPanel.tsx'), 'utf8');
  const ingestionPanel = readFileSync(path.join(SRC_DIR, 'studymode/components/ConceptIngestionPanel.tsx'), 'utf8');
  assert.ok(teacher.includes('<AutomationControlPanel'), 'Teacher dashboard must mount AutomationControlPanel');
  assert.ok(admin.includes('<ConceptIngestionPanel'), 'School admin must mount ConceptIngestionPanel');
  assert.ok(automationPanel.includes('nightly_intervention_sweep'), 'Automation panel must reference sweep job');
  const ingestionHook = readFileSync(path.join(SRC_DIR, 'studymode/hooks/useConceptIngestion.ts'), 'utf8');
  assert.ok(ingestionHook.includes('ingest-document-concepts'), 'Ingestion hook must invoke ingest-document-concepts function');
  assert.ok(ingestionPanel.includes('useConceptIngestion'), 'Ingestion panel must use ingestion hook');
  return Promise.resolve();
});
```

---

## Verification

After copying files and applying the edit:

```bash
node tests/suite.mjs
```

Expected: **74 passed / 0 failed** (Section 12 shows 5 additional passing tests).

## Optional: cron wiring for autopilot

In your Supabase project SQL editor (once the migration is applied and env is set):

```sql
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

The edge function will iterate every enabled + due `learning_ops_automation_schedule` row and run the matching job.
