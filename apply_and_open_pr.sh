#!/usr/bin/env bash
#
# apply_and_open_pr.sh (Phase 3.2)
#
# Applies the Phase 3.2 LOS bundle to a local StudySync clone, commits on a
# new branch (feat/learning-ops-phase-3-2), pushes it, and opens a PR via gh.
#
# Usage:
#   cd ~/code/studysync                   # <-- your local clone
#   bash ../studysync_pr_bundle_phase3_2/apply_and_open_pr.sh
#
# Requirements: git, gh (authenticated)
set -euo pipefail

BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(pwd)}"
BRANCH="feat/learning-ops-phase-3-2"
BASE_BRANCH="${BASE_BRANCH:-main}"

echo "▶ Bundle : $BUNDLE_DIR"
echo "▶ Repo   : $REPO_DIR"
echo "▶ Branch : $BRANCH  (off $BASE_BRANCH)"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "❌ $REPO_DIR is not a git repository. cd into your StudySync clone first."
  exit 1
fi

cd "$REPO_DIR"

# Sanity: Phase 3.1 must already be merged
if [ ! -f "supabase/migrations/20260702101500_learning_ops_phase3_1_automation_runtime_and_ingestion.sql" ]; then
  echo "❌ Phase 3.1 migration missing. Merge/apply Phase 3.1 first."
  exit 1
fi

echo "▶ Fetching latest from origin..."
git fetch origin --prune

echo "▶ Checking out base branch: $BASE_BRANCH"
git checkout "$BASE_BRANCH"
git pull --ff-only origin "$BASE_BRANCH" || true

echo "▶ Creating branch: $BRANCH"
git checkout -B "$BRANCH"

echo "▶ Copying Phase 3.2 files..."
mkdir -p supabase/migrations
mkdir -p supabase/functions/run-learning-ops-automation
mkdir -p src/integrations/supabase
mkdir -p src/pages
mkdir -p src/studymode/components
mkdir -p src/studymode/hooks
mkdir -p src/studymode/lib

cp "$BUNDLE_DIR/supabase/migrations/20260705093000_learning_ops_phase3_2_dag_predictive_risk_class_scoped.sql" supabase/migrations/
cp "$BUNDLE_DIR/supabase/functions/run-learning-ops-automation/index.ts" supabase/functions/run-learning-ops-automation/
cp "$BUNDLE_DIR/src/integrations/supabase/learning-os-types.ts"          src/integrations/supabase/
cp "$BUNDLE_DIR/src/studymode/lib/learningOps.ts"                        src/studymode/lib/
cp "$BUNDLE_DIR/src/studymode/hooks/useAutomationRuntime.ts"             src/studymode/hooks/
cp "$BUNDLE_DIR/src/studymode/hooks/useClassAtRisk.ts"                   src/studymode/hooks/
cp "$BUNDLE_DIR/src/studymode/hooks/usePlanProposals.ts"                 src/studymode/hooks/
cp "$BUNDLE_DIR/src/studymode/components/AutomationControlPanel.tsx"     src/studymode/components/
cp "$BUNDLE_DIR/src/studymode/components/TeacherClassDetail.tsx"         src/studymode/components/
cp "$BUNDLE_DIR/src/pages/TeacherClassDetailPage.tsx"                    src/pages/

echo
echo "⚠️  Two files still need manual edits (see MANUAL_EDITS.md):"
echo "     1) src/App.tsx      — lazy import + /teacher/class/:cohortId route"
echo "     2) tests/suite.mjs  — append Section 13 (Phase 3.2) block"
echo
read -r -p "Have you applied both manual edits? (y/N) " CONFIRM
if [[ "${CONFIRM,,}" != "y" && "${CONFIRM,,}" != "yes" ]]; then
  echo "✋ Stopping so you can apply the manual edits. Re-run this script when done."
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
        src/integrations/supabase/learning-os-types.ts \
        src/studymode/lib/learningOps.ts \
        src/studymode/hooks/useAutomationRuntime.ts \
        src/studymode/hooks/useClassAtRisk.ts \
        src/studymode/hooks/usePlanProposals.ts \
        src/studymode/components/AutomationControlPanel.tsx \
        src/studymode/components/TeacherClassDetail.tsx \
        src/pages/TeacherClassDetailPage.tsx \
        src/App.tsx \
        tests/suite.mjs

git status --short

echo "▶ Committing..."
git commit -m "feat(learning-ops): Phase 3.2 — prerequisite DAG, predictive risk, per-teacher routing, plan optimizer, class detail

- Add learning_concept_prerequisite_edges (real DAG over concept catalog) + RLS
- Add materialize_concept_prerequisite_edges and get_upstream_prerequisites RPCs
- Add learner_projected_risk view (14-day EWMA + slope → 0..100 projected risk)
- Add learning_class_at_risk view (cohort × learner rollup)
- Add workspace_class_teachers and route_interventions_to_teachers RPCs
- Add learning_ops_plan_proposals staging table for study plan optimizer output
- Add run_study_plan_optimizer RPC + register in automation edge function
- Extend automation runtime with study_plan_optimizer and route_interventions_to_teachers jobs
- New service surface: materializeConceptPrerequisiteEdges, loadUpstreamPrerequisites,
  loadProjectedRiskForUsers, loadClassAtRisk, routeInterventionsToTeachers,
  runStudyPlanOptimizer, loadPlanProposals, updatePlanProposalStatus
- New hooks: useClassAtRisk, usePlanProposals
- New UI: TeacherClassDetail + /teacher/class/:cohortId route
- AutomationControlPanel surfaces two new first-class jobs
- 5 new test cases (Section 13) — full suite passes 79/79
- No new as any casts on the LOS surface"

echo "▶ Pushing branch to origin..."
git push -u origin "$BRANCH"

if command -v gh >/dev/null 2>&1; then
  echo "▶ Opening PR via gh..."
  gh pr create \
    --base "$BASE_BRANCH" \
    --head "$BRANCH" \
    --title "feat(learning-ops): Phase 3.2 — prerequisite DAG, predictive risk, per-teacher routing, plan optimizer, class detail" \
    --body-file "$BUNDLE_DIR/PR_DESCRIPTION.md"
else
  echo "⚠️  gh CLI not found. Push succeeded — open the PR manually in your browser."
fi

echo "✅ Done."
