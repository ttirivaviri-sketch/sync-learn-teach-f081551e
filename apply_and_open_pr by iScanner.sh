#!/usr/bin/env bash
# StudySync Learning OS — Phase 1 + 2 PR helper
#
# Run this from the root of your local clone of
#   git@github.com:<owner>/sync-learn-teach-f081551e.git
#   (or HTTPS equivalent).
#
# Prereqs (auto-checked):
#   - You have a git working tree (no untracked changes will be discarded)
#   - You have GitHub CLI installed (`gh`) and authenticated with the
#     ttirivaviri account: `gh auth status`
#   - This script lives alongside the unzipped studysync_pr_bundle/ directory
#
# What it does:
#   1. Verifies prerequisites
#   2. Creates branch feat/learning-ops-phase-1-and-2
#   3. Copies new files from the bundle into the repo
#   4. Reminds you about MANUAL_EDITS.md (small textual edits)
#   5. Commits, pushes, and opens the PR via `gh pr create`

set -euo pipefail

BUNDLE_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="${1:-$(pwd)}"
BRANCH="feat/learning-ops-phase-1-and-2"

echo "→ Bundle  : $BUNDLE_DIR"
echo "→ Repo    : $REPO_DIR"
echo "→ Branch  : $BRANCH"
echo

# ── 1. Prereqs ──────────────────────────────────────────────────────────────
if ! command -v git >/dev/null 2>&1; then
  echo "❌ git not found"; exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "⚠️  GitHub CLI (gh) not found. You can still apply the bundle, but you'll have to open the PR manually in the GitHub web UI."
fi

cd "$REPO_DIR"

if [ ! -d ".git" ]; then
  echo "❌ $REPO_DIR is not a git repository. Run this from the root of sync-learn-teach-f081551e."
  exit 1
fi

if ! git diff-index --quiet HEAD --; then
  echo "❌ Working tree is dirty. Commit or stash changes before running."
  exit 1
fi

# ── 2. Branch ───────────────────────────────────────────────────────────────
echo "→ Creating branch $BRANCH from current HEAD..."
git checkout -b "$BRANCH" || git checkout "$BRANCH"

# ── 3. Copy files ───────────────────────────────────────────────────────────
echo "→ Copying bundle files into repo..."
cp -v -r "$BUNDLE_DIR/src/." "src/"
cp -v -r "$BUNDLE_DIR/supabase/." "supabase/"

# ── 4. Prompt about manual edits ────────────────────────────────────────────
cat <<'EOF'

──────────────────────────────────────────────────────────────────────────────
STOP! Before committing, apply the small textual edits described in:

    studysync_pr_bundle/MANUAL_EDITS.md

These touch:
  - src/App.tsx                              (LOS route imports + routes)
  - src/pages/tutor/TutorHomeTab.tsx         (mount TutorWorkspaceLinkCard)
  - src/pages/learner/LearnerProfileTab.tsx  (mount Guardian + Tutor cards)
  - src/studymode/hooks/useRecallEngine.ts   (add logMasteryEvidence call)
  - src/studymode/hooks/useMockExam.ts       (add logMasteryEvidence call)
  - src/studymode/hooks/useDailyTasks.ts     (add logMasteryEvidence call)
  - src/studymode/components/{StructuredDailyTaskRunner,TaskContentPanel,FlashcardPanel,ExamQuestionPanel}.tsx
                                            (add logMasteryEvidence calls)
  - ARCHITECTURE.md                          (LOS layer section)
  - tests/suite.mjs                          (LOS test section)

After applying them, run:
    npm install
    npm run test:types
    node tests/suite.mjs   # expect 80/80 pass

Then press ENTER here to continue with commit + push + PR.
──────────────────────────────────────────────────────────────────────────────
EOF
read -r _

# ── 5. Commit + push + PR ───────────────────────────────────────────────────
git add -A
git commit -m "feat(los): Phase 1 + 2 — Learning Operating System foundations, Teacher Command Center, School Admin Console

Phase 1 — foundations + typed cleanup
- Add LOS migrations (workspaces, memberships, cohorts, concept catalog,
  mastery ledger, intervention queue) and workflow migration (invitations,
  member_cohorts, intervention_events, queue lifecycle fields).
- Add typed contract module learning-os-types.ts with losFrom() accessor.
- Refactor learningOps.ts off as-any casts.
- Add hooks: useSchoolWorkspace, useLearningInterventions,
  useMasteryIntelligence, useGuardianOverview.
- Add UI: LearningOpsOverview, MasteryIntelligenceCard, GuardianWorkspaceCard.

Phase 2 — Teacher Command Center + School Admin Console
- New routes /teacher and /school.
- TeacherCommandCenter + useTeacherCommandCenter.
- SchoolAdminConsole.
- TutorWorkspaceLinkCard for staff entry from learner/tutor surfaces.

Quality
- 80/80 tests pass including 16 new LOS tests.
- Typecheck clean.
- ARCHITECTURE.md updated with LOS layer section."

echo "→ Pushing branch to origin..."
git push -u origin "$BRANCH"

if command -v gh >/dev/null 2>&1; then
  echo "→ Opening PR via gh..."
  gh pr create \
    --title "feat(los): Phase 1 + 2 — Learning Operating System foundations, Teacher Command Center, School Admin Console" \
    --body-file "$BUNDLE_DIR/PR_DESCRIPTION.md" \
    --base main \
    --head "$BRANCH"
else
  echo "→ Open this URL to create the PR manually:"
  REMOTE_URL="$(git remote get-url origin)"
  echo "  https://github.com/${REMOTE_URL#*github.com[:/]}/compare/main...$BRANCH"
fi

echo "✅ Done."
