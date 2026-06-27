# StudySync Learning OS — Phase 1 + Phase 2

This PR turns StudySync from a tutoring marketplace + adaptive learning product into a **school-grade Learning Operating System (LOS)**. It introduces the multi-actor operational spine (workspaces, cohorts, mastery evidence ledger, intervention queue, intervention events, invitations), upgrades the typed contract to remove `as any` casts from the LOS layer, and adds dedicated **Teacher Command Center** and **School Admin Console** surfaces.

## What ships

### Phase 1 — LOS foundations + cleanup
- New Supabase migrations:
  - `supabase/migrations/20260623113000_learning_operating_system_foundations.sql`
  - `supabase/migrations/20260627143000_learning_ops_workflows_and_guardian_views.sql`
- Hand-maintained typed contract module: `src/integrations/supabase/learning-os-types.ts` with `losFrom()` typed accessor and complete Row/Insert/Update interfaces for every LOS table.
- Refactored `src/studymode/lib/learningOps.ts` (no more `as any` in the LOS service layer).
- New / updated hooks: `useSchoolWorkspace`, `useLearningInterventions`, `useMasteryIntelligence`, `useGuardianOverview`.
- New UI: `LearningOpsOverview` (Learning Mission Control), `MasteryIntelligenceCard`, `GuardianWorkspaceCard`.

### Phase 2 — Teacher Command Center + School Admin Console
- New page routes:
  - `/teacher` → `src/pages/TeacherCommandCenterPage.tsx` + `src/studymode/components/TeacherCommandCenter.tsx`
  - `/school` → `src/pages/SchoolAdminPage.tsx` + `src/studymode/components/SchoolAdminConsole.tsx`
- New hook: `src/studymode/hooks/useTeacherCommandCenter.ts`
- New helper card: `src/studymode/components/TutorWorkspaceLinkCard.tsx` (auto-mounted in TutorHomeTab + LearnerProfileTab; only renders for workspace staff).
- ARCHITECTURE.md gets a Learning Operating System section.
- Test suite extended with a dedicated LOS section.

## How to apply this bundle

The bundle is a zipped directory mirror of the new/updated files under their final paths. Apply it to a fresh branch of `sync-learn-teach`:

1. **Branch:** `git checkout -b feat/learning-ops-phase-1-and-2`
2. **Unzip:** Extract `studysync_pr_bundle.zip` at the repo root. It only adds/overwrites the files listed below — no other files are touched.
3. **Apply the small textual edits** described in `MANUAL_EDITS.md` (App.tsx routes, TutorHomeTab, LearnerProfileTab, ARCHITECTURE.md, tests/suite.mjs, and mastery-evidence callsites).
4. **Install + verify:**
   ```bash
   npm install
   npm run test:types
   node tests/suite.mjs
   ```
   Expected: `npm run test:types` clean, suite reports `80/80 passing` including a new Section 11 “Learning Operating System”.
5. **Commit & open PR:**
   ```bash
   git add -A
   git commit -m "feat(los): Phase 1 + Phase 2 — Learning Operating System foundations, Teacher Command Center, School Admin Console"
   git push -u origin feat/learning-ops-phase-1-and-2
   ```
6. Open the PR in GitHub against `main`.

## Files in this bundle

```
supabase/migrations/20260623113000_learning_operating_system_foundations.sql
supabase/migrations/20260627143000_learning_ops_workflows_and_guardian_views.sql
src/integrations/supabase/learning-os-types.ts
src/studymode/lib/learningOps.ts
src/studymode/hooks/useSchoolWorkspace.ts
src/studymode/hooks/useLearningInterventions.ts
src/studymode/hooks/useMasteryIntelligence.ts
src/studymode/hooks/useGuardianOverview.ts
src/studymode/hooks/useTeacherCommandCenter.ts
src/studymode/components/LearningOpsOverview.tsx
src/studymode/components/MasteryIntelligenceCard.tsx
src/studymode/components/GuardianWorkspaceCard.tsx
src/studymode/components/TeacherCommandCenter.tsx
src/studymode/components/SchoolAdminConsole.tsx
src/studymode/components/TutorWorkspaceLinkCard.tsx
src/pages/TeacherCommandCenterPage.tsx
src/pages/SchoolAdminPage.tsx
PR_DESCRIPTION.md (this file)
MANUAL_EDITS.md (small textual edits to existing files)
```

## Why this matters

Before this PR, StudySync had strong learner-facing study features but no school-grade operational layer. After this PR:

- Every learner interaction (recall, mock exams, flashcards, structured daily tasks, exam questions) writes typed evidence into the mastery ledger.
- Interventions are no longer learner-only prompts — they live in a real **closed-loop queue** (open / acknowledged / resolved / dismissed, with assigned roles and intervention events for transparency).
- **Teachers** open `/teacher` to see at-risk students, cohort rollups, and the full intervention queue with acknowledge / resolve / dismiss / reassign actions.
- **Owners/admins** open `/school` to create cohorts, send invitations, manage roles, and assign members to cohorts.
- The whole LOS layer is statically typed via a single accessor (`losFrom`), so future schema work has a single source of truth.

## Quality bar

- `npm run test:types` clean
- 80/80 tests pass, including 16 new LOS-specific tests:
  - Foundation migration defines all 6 LOS foundation tables
  - Workflow migration defines all 3 LOS workflow tables
  - Intervention queue lifecycle fields exist
  - LOS types file exposes `losFrom` and `losSupabase`
  - `learningOps.ts` exposes the full LOS service surface
  - LOS hooks are present
  - LOS routes are mounted in App.tsx
  - LOS layer is free of `as any` casts in `learningOps.ts`
  - Mastery rollup arithmetic clamps confidence between 0 and 100
