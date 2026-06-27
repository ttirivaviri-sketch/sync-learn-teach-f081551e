# Manual edits to existing files

Apply these surgical edits after extracting the bundle. They're small enough to be applied by search-and-replace.

---

## 1. `src/App.tsx`

### 1a. Add lazy imports next to the existing admin/auth imports

```ts
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
// ── ADD BELOW ──
const TeacherCommandCenterPage = lazy(() => import("./pages/TeacherCommandCenterPage"));
const SchoolAdminPage = lazy(() => import("./pages/SchoolAdminPage"));
```

### 1b. Add the LOS routes next to the payment routes

```tsx
{/* Payment routes */}
<Route path="/payment-success" element={<PaymentSuccess />} />
<Route path="/payment-cancelled" element={<PaymentCancelled />} />

{/* Learning Operating System routes */}
<Route path="/teacher" element={<TeacherCommandCenterPage />} />
<Route path="/school" element={<SchoolAdminPage />} />
```

---

## 2. `src/pages/tutor/TutorHomeTab.tsx`

### 2a. Import the workspace link card

```ts
import { supabase } from "@/integrations/supabase/client";
import type { BookingRequest } from "@/hooks/useRealtimeBookings";
// ── ADD BELOW ──
import { TutorWorkspaceLinkCard } from "@/studymode/components/TutorWorkspaceLinkCard";
```

### 2b. Mount it right after the greeting block

```tsx
{/* Greeting */}
<div>
  <h2 className="text-xl font-bold">{greeting}, {tutorName} 👋</h2>
  <p className="text-sm text-muted-foreground">Here's your overview for today</p>
</div>

{/* Workspace operations entry point (only renders when user is workspace staff) */}
<TutorWorkspaceLinkCard />
```

---

## 3. `src/pages/learner/LearnerProfileTab.tsx`

### 3a. Add the imports next to the existing imports

```ts
import { ProgressReportButton } from "@/components/ProgressReportButton";
// ── ADD BELOW ──
import { GuardianWorkspaceCard } from "@/studymode/components/GuardianWorkspaceCard";
import { TutorWorkspaceLinkCard } from "@/studymode/components/TutorWorkspaceLinkCard";
```

### 3b. Mount both cards immediately before the existing "Menu Rows" block

```tsx
{session?.user?.id && (
  <GuardianWorkspaceCard userId={session.user.id} />
)}

<TutorWorkspaceLinkCard />

{/* ── Menu Rows ── */}
```

---

## 4. Mastery evidence callsites

These existing files should each get a `logMasteryEvidence(...)` call so the mastery ledger captures evidence from every kind of learner interaction. The exact call shapes are in the bundle's `learningOps.ts` (search for `logMasteryEvidence`). Add a single call in each of:

- `src/studymode/hooks/useRecallEngine.ts` — after a quiz attempt is graded.
- `src/studymode/hooks/useMockExam.ts` — after `submitAndGrade()` awards marks (per question).
- `src/studymode/hooks/useDailyTasks.ts` — after a task is marked completed.
- `src/studymode/components/StructuredDailyTaskRunner.tsx` — once per practice submission and once per exam submission.
- `src/studymode/components/TaskContentPanel.tsx` — once per attempt-first task submission.
- `src/studymode/components/FlashcardPanel.tsx` — once per flashcard result.
- `src/studymode/components/ExamQuestionPanel.tsx` — three callsites: AI-marked, self-assessed, MCQ submissions.

Each call follows the same shape:

```ts
await logMasteryEvidence({
  userId,
  subjectId,
  subjectName,
  topicName,
  concepts: [/* concept names involved */],
  evidenceType: 'quiz' | 'flashcard' | 'mock_exam' | 'task' | 'recall',
  evidenceSource: 'short text source identifier',
  scoreDelta: <integer roughly in -20..+20>,
  confidence: <0..1>,
  metadata: { /* any context */ },
});
```

These integrations are essential for the Mastery Intelligence card and the Teacher Command Center to have data.

---

## 5. `ARCHITECTURE.md`

Add a new "Learning Operating System Layer" section at the top of the System Overview. Suggested content is in the bundle's PR_DESCRIPTION.md.

---

## 6. `tests/suite.mjs`

Append a new suite section before the SUMMARY block. Suggested content is in the PR_DESCRIPTION.md and the test names should match:

- Foundation migration defines `learning_workspaces`, `learning_workspace_memberships`, `learning_workspace_cohorts`, `learning_concept_catalog`, `learning_concept_mastery_ledger`, `learning_intervention_queue`
- Workflow migration defines `learning_workspace_invitations`, `learning_workspace_member_cohorts`, `learning_intervention_events`
- Intervention queue lifecycle fields exist (`assigned_to_user_id`, `assigned_role`, `acknowledged_at`, `action_note`, `last_action_at`, `resolved_by_user_id`)
- LOS types file exposes `losFrom` and `losSupabase`
- `learningOps.ts` exposes the full LOS service surface
- LOS hooks are present
- LOS pages are mounted in App.tsx
- LOS layer is free of `as any` casts (block-comment safe)
- Mastery rollup arithmetic clamps confidence between 0 and 100
