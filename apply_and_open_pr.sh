#!/usr/bin/env bash
#
# apply_and_open_pr.sh
#
# Applies the Phase 3 LOS bundle to a local StudySync clone, commits it on a
# new branch (feat/learning-ops-phase-3), pushes it, and opens a PR via the
# GitHub CLI.
#
# Usage:
#   Run this script from OUTSIDE your studysync clone, with the bundle folder
#   sitting alongside it. Example layout:
#
#     ~/code/
#       studysync/                       <-- your local clone
#       studysync_pr_bundle_phase3/      <-- this bundle
#
#   Then:
#     cd ~/code/studysync
#     bash ../studysync_pr_bundle_phase3/apply_and_open_pr.sh
#
# Requirements:
#   - git
#   - gh (GitHub CLI) authenticated as the account that owns the repo
#
set -euo pipefail

BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(pwd)}"
BRANCH="feat/learning-ops-phase-3"
BASE_BRANCH="${BASE_BRANCH:-main}"

echo "▶ Bundle : $BUNDLE_DIR"
echo "▶ Repo   : $REPO_DIR"
echo "▶ Branch : $BRANCH  (off $BASE_BRANCH)"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "❌ $REPO_DIR is not a git repository. cd into your StudySync clone first."
  exit 1
fi

cd "$REPO_DIR"

# Sanity check: expect Phase 1-2 to already be in the tree
if [ ! -f "src/studymode/lib/learningOps.ts" ]; then
  echo "❌ Phase 1-2 files are missing (src/studymode/lib/learningOps.ts not found)."
  echo "   Apply the Phase 1-2 bundle first, or check you're in the right repo."
  exit 1
fi

echo "▶ Fetching latest from origin..."
git fetch origin --prune

echo "▶ Checking out base branch: $BASE_BRANCH"
git checkout "$BASE_BRANCH"
git pull --ff-only origin "$BASE_BRANCH" || true

echo "▶ Creating branch: $BRANCH"
git checkout -B "$BRANCH"

echo "▶ Copying Phase 3 files..."
mkdir -p supabase/migrations
mkdir -p src/integrations/supabase
mkdir -p src/pages
mkdir -p src/studymode/components
mkdir -p src/studymode/hooks
mkdir -p src/studymode/lib

cp "$BUNDLE_DIR/supabase/migrations/20260628090000_learning_ops_phase3_automation_and_invites.sql" supabase/migrations/
cp "$BUNDLE_DIR/src/integrations/supabase/learning-os-types.ts"    src/integrations/supabase/
cp "$BUNDLE_DIR/src/studymode/lib/learningOps.ts"                  src/studymode/lib/
cp "$BUNDLE_DIR/src/studymode/hooks/useSchoolWorkspace.ts"         src/studymode/hooks/
cp "$BUNDLE_DIR/src/studymode/components/SchoolAdminConsole.tsx"   src/studymode/components/
cp "$BUNDLE_DIR/src/studymode/components/TeacherCommandCenter.tsx" src/studymode/components/
cp "$BUNDLE_DIR/src/pages/SchoolInvitationPage.tsx"                src/pages/

echo
echo "⚠️  Two files still need manual edits (see MANUAL_EDITS.md):"
echo "     1) src/App.tsx  — add lazy import + /school/join route"
echo "     2) tests/suite.mjs — append Section 11 (Phase 3) block"
echo
read -r -p "Have you applied both manual edits? (y/N) " CONFIRM
if [[ "${CONFIRM,,}" != "y" && "${CONFIRM,,}" != "yes" ]]; then
  echo "✋ Stopping so you can apply the manual edits."
  echo "   When done, re-run this script or continue manually with:"
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
        src/integrations/supabase/learning-os-types.ts \
        src/studymode/lib/learningOps.ts \
        src/studymode/hooks/useSchoolWorkspace.ts \
        src/studymode/components/SchoolAdminConsole.tsx \
        src/studymode/components/TeacherCommandCenter.tsx \
        src/pages/SchoolInvitationPage.tsx \
        src/App.tsx \
        tests/suite.mjs

git status --short

echo "▶ Committing..."
git commit -m "feat(learning-ops): Phase 3 — invitation acceptance, automation cadence, concept trends, outcome analytics

- Add real workspace invitation acceptance flow (secure token RPC + /school/join page)
- Add learning_ops_automation_runs table + RLS for automation cadence audit log
- Add concept graph provenance (source_document_id, source_kind, ingested_at, confidence)
- Add learning_concept_trends and learning_intervention_outcomes SQL views
- Extend typed LOS surface with new tables/views/functions and losView() helper
- Teacher Command Center: Automation cadence, Concept momentum, outcome KPIs
- School Admin Console: Generate/copy secure join links + expiry visibility
- Add 5 new test cases (Section 11) — full suite passes 69/69"

echo "▶ Pushing branch to origin..."
git push -u origin "$BRANCH"

if command -v gh >/dev/null 2>&1; then
  echo "▶ Opening PR via gh..."
  gh pr create \
    --base "$BASE_BRANCH" \
    --head "$BRANCH" \
    --title "feat(learning-ops): Phase 3 — invitation acceptance, automation cadence, concept trends, outcome analytics" \
    --body-file "$BUNDLE_DIR/PR_DESCRIPTION.md"
else
  echo "⚠️  gh CLI not found. Push succeeded — open the PR manually in your browser."
fi

echo "✅ Done."
