#!/usr/bin/env bash
#
# apply_and_open_pr.sh (Phase 3.1)
#
# Applies the Phase 3.1 LOS bundle to a local StudySync clone, commits on a
# new branch (feat/learning-ops-phase-3-1), pushes it, and opens a PR via gh.
#
# Usage:
#   cd ~/code/studysync                   # <-- your local clone
#   bash ../studysync_pr_bundle_phase3_1/apply_and_open_pr.sh
#
# Requirements: git, gh (authenticated)
set -euo pipefail

BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(pwd)}"
BRANCH="feat/learning-ops-phase-3-1"
BASE_BRANCH="${BASE_BRANCH:-main}"

echo "▶ Bundle : $BUNDLE_DIR"
echo "▶ Repo   : $REPO_DIR"
echo "▶ Branch : $BRANCH  (off $BASE_BRANCH)"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "❌ $REPO_DIR is not a git repository. cd into your StudySync clone first."
  exit 1
fi

cd "$REPO_DIR"

# Sanity check: Phase 3 must already be in the tree
if ! grep -q "accept_workspace_invitation" supabase/migrations/20260628090000_learning_ops_phase3_automation_and_invites.sql 2>/dev/null; then
  echo "❌ Phase 3 migration missing. Merge/apply Phase 3 first."
  exit 1
fi

echo "▶ Fetching latest from origin..."
git fetch origin --prune

echo "▶ Checking out base branch: $BASE_BRANCH"
git checkout "$BASE_BRANCH"
git pull --ff-only origin "$BASE_BRANCH" || true

echo "▶ Creating branch: $BRANCH"
git checkout -B "$BRANCH"

echo "▶ Copying Phase 3.1 files..."
mkdir -p supabase/migrations
mkdir -p supabase/functions/run-learning-ops-automation
mkdir -p supabase/functions/ingest-document-concepts
mkdir -p src/integrations/supabase
mkdir -p src/studymode/components
mkdir -p src/studymode/hooks
mkdir -p src/studymode/lib

cp "$BUNDLE_DIR/supabase/migrations/20260702101500_learning_ops_phase3_1_automation_runtime_and_ingestion.sql" supabase/migrations/
cp "$BUNDLE_DIR/supabase/functions/run-learning-ops-automation/index.ts" supabase/functions/run-learning-ops-automation/
cp "$BUNDLE_DIR/supabase/functions/ingest-document-concepts/index.ts"    supabase/functions/ingest-document-concepts/
cp "$BUNDLE_DIR/src/integrations/supabase/learning-os-types.ts"          src/integrations/supabase/
cp "$BUNDLE_DIR/src/studymode/lib/learningOps.ts"                        src/studymode/lib/
cp "$BUNDLE_DIR/src/studymode/hooks/useAutomationRuntime.ts"             src/studymode/hooks/
cp "$BUNDLE_DIR/src/studymode/hooks/useConceptIngestion.ts"              src/studymode/hooks/
cp "$BUNDLE_DIR/src/studymode/components/AutomationControlPanel.tsx"     src/studymode/components/
cp "$BUNDLE_DIR/src/studymode/components/ConceptIngestionPanel.tsx"      src/studymode/components/
cp "$BUNDLE_DIR/src/studymode/components/TeacherCommandCenter.tsx"       src/studymode/components/
cp "$BUNDLE_DIR/src/studymode/components/SchoolAdminConsole.tsx"         src/studymode/components/

echo
echo "⚠️  One file still needs a manual edit (see MANUAL_EDITS.md):"
echo "     tests/suite.mjs — append Section 12 (Phase 3.1) block before SUMMARY divider"
echo
read -r -p "Have you applied the manual edit? (y/N) " CONFIRM
if [[ "${CONFIRM,,}" != "y" && "${CONFIRM,,}" != "yes" ]]; then
  echo "✋ Stopping so you can apply the manual edit. Re-run this script when done, or"
  echo "   continue manually with:"
  echo "     git add -A && git commit -m '...' && git push -u origin $BRANCH"
  exit 0
fi

echo "▶ Running test suite..."
if [ -f package.json ] && grep -q '"test"' package.json; then
  npm test || { echo "❌ Tests failed. Fix before pushing."; exit 1; }
else
  node tests/suite.mjs || { echo "❌ Tests failed. Fix before pushing."; exit 1; }
fi

echo "▶ Staging changes..."
git add supabase/migrations \
        supabase/functions/run-learning-ops-automation \
        supabase/functions/ingest-document-concepts \
        src/integrations/supabase/learning-os-types.ts \
        src/studymode/lib/learningOps.ts \
        src/studymode/hooks/useAutomationRuntime.ts \
        src/studymode/hooks/useConceptIngestion.ts \
        src/studymode/components/AutomationControlPanel.tsx \
        src/studymode/components/ConceptIngestionPanel.tsx \
        src/studymode/components/TeacherCommandCenter.tsx \
        src/studymode/components/SchoolAdminConsole.tsx \
        tests/suite.mjs

git status --short

echo "▶ Committing..."
git commit -m "feat(learning-ops): Phase 3.1 — automation runtime + document-to-concept ingestion

- Add learning_ops_automation_schedule (cadence + enabled + next_run_at) with RLS
- Add SECURITY DEFINER RPCs: record_automation_run_start/finish,
  run_nightly_intervention_sweep, run_weekly_cohort_rollup
- Add run-learning-ops-automation edge function (cron autopilot + targeted mode)
- Add learning_concept_ingestion_staging table (staging → review → promotion) with RLS
- Add ingest-document-concepts edge function (parsed_content → staged concepts with provenance)
- Add promote_concept_ingestion RPC (atomic staged → catalog with upsert)
- Expand typed LOS surface with new tables and RPCs (no as any casts)
- New service surface: loadAutomationSchedule, upsertAutomationSchedule, runNightlyInterventionSweep,
  runWeeklyCohortRollup, stageConceptIngestionBatch, loadStagedConceptIngestions,
  reviewStagedConceptIngestion, promoteStagedConceptIngestion
- New hooks: useAutomationRuntime, useConceptIngestion
- New UI: AutomationControlPanel (in TeacherCommandCenter), ConceptIngestionPanel (in SchoolAdminConsole)
- 5 new test cases (Section 12) — full suite passes 74/74"

echo "▶ Pushing branch to origin..."
git push -u origin "$BRANCH"

if command -v gh >/dev/null 2>&1; then
  echo "▶ Opening PR via gh..."
  gh pr create \
    --base "$BASE_BRANCH" \
    --head "$BRANCH" \
    --title "feat(learning-ops): Phase 3.1 — automation runtime + document-to-concept ingestion" \
    --body-file "$BUNDLE_DIR/PR_DESCRIPTION.md"
else
  echo "⚠️  gh CLI not found. Push succeeded — open the PR manually in your browser."
fi

echo "✅ Done."
