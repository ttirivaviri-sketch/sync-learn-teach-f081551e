# Manual edits — Phase 3

Only two files need in-place edits. Every other Phase 3 file is fully replaced by copies from this bundle.

---

## 1) `src/App.tsx`

**Add the lazy import** next to the existing LOS page lazy imports:

```diff
 const TeacherCommandCenterPage = lazy(() => import("./pages/TeacherCommandCenterPage"));
 const SchoolAdminPage = lazy(() => import("./pages/SchoolAdminPage"));
+const SchoolInvitationPage = lazy(() => import("./pages/SchoolInvitationPage"));
```

**Add the route** inside the `<Routes>` block, right after the existing LOS routes:

```diff
               {/* Learning Operating System routes */}
               <Route path="/teacher" element={<TeacherCommandCenterPage />} />
               <Route path="/school" element={<SchoolAdminPage />} />
+              <Route path="/school/join" element={<SchoolInvitationPage />} />
```

---

## 2) `tests/suite.mjs`

Insert a new **Section 11** block immediately before the `SUMMARY` divider at the bottom of the file. Paste this exact block:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 11. LEARNING OPERATING SYSTEM PHASE 3
// ─────────────────────────────────────────────────────────────────────────────
suite('11. Learning Operating System Phase 3');

await test('Phase 3 migration defines automation and invitation acceptance flow', () => {
  const mig = readFileSync(path.join(__dirname, '../supabase/migrations/20260628090000_learning_ops_phase3_automation_and_invites.sql'), 'utf8');
  const required = [
    'learning_ops_automation_runs',
    'learning_concept_trends',
    'learning_intervention_outcomes',
    'generate_workspace_invite_token',
    'accept_workspace_invitation',
  ];
  for (const marker of required) {
    assert.ok(mig.includes(marker), `Missing Phase 3 marker: ${marker}`);
  }
  return Promise.resolve();
});

await test('learning-os-types exposes Phase 3 tables, views, and helpers', () => {
  const content = readFileSync(path.join(SRC_DIR, 'integrations/supabase/learning-os-types.ts'), 'utf8');
  const required = [
    'learning_ops_automation_runs',
    'learning_concept_trends',
    'learning_intervention_outcomes',
    'generate_workspace_invite_token',
    'accept_workspace_invitation',
    'export function losView',
  ];
  for (const marker of required) {
    assert.ok(content.includes(marker), `Missing LOS type marker: ${marker}`);
  }
  return Promise.resolve();
});

await test('learningOps exports invitation acceptance and analytics surface', () => {
  const content = readFileSync(path.join(SRC_DIR, 'studymode/lib/learningOps.ts'), 'utf8');
  const required = [
    'export async function generateWorkspaceInvitationToken',
    'export async function acceptWorkspaceInvitation',
    'automationRuns',
    'conceptTrendLeaders',
    'interventionOutcomeSummary',
  ];
  for (const marker of required) {
    assert.ok(content.includes(marker), `Missing LOS service marker: ${marker}`);
  }
  return Promise.resolve();
});

await test('Phase 3 pages and routes are mounted', () => {
  const app = readFileSync(path.join(SRC_DIR, 'App.tsx'), 'utf8');
  const page = readFileSync(path.join(SRC_DIR, 'pages/SchoolInvitationPage.tsx'), 'utf8');
  assert.ok(app.includes('"/school/join"'), 'Missing /school/join route');
  assert.ok(page.includes('acceptInvitationToken'), 'Invitation page must accept token');
  assert.ok(page.includes('Join school workspace'), 'Invitation page heading missing');
  return Promise.resolve();
});

await test('School admin and teacher dashboards expose Phase 3 UI', () => {
  const schoolAdmin = readFileSync(path.join(SRC_DIR, 'studymode/components/SchoolAdminConsole.tsx'), 'utf8');
  const teacher = readFileSync(path.join(SRC_DIR, 'studymode/components/TeacherCommandCenter.tsx'), 'utf8');
  assert.ok(schoolAdmin.includes('Generate join link'), 'School admin join-link action missing');
  assert.ok(teacher.includes('Automation cadence'), 'Teacher automation cadence section missing');
  assert.ok(teacher.includes('Concept momentum'), 'Teacher concept momentum section missing');
  return Promise.resolve();
});
```

---

## 3) Verification

After applying edits and copying files:

```bash
node tests/suite.mjs
```

Expected: **69 passed / 0 failed** (Phase 3 section shows 5 additional passing tests).

If your local `test:types` runs (`npm run test:types`), it should also complete cleanly — Phase 3 adds no `as any` casts.
