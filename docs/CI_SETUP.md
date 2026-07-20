# CI Setup — one manual step required

The CI workflow could not be pushed by the automation (the GitHub App token
lacks the `workflows` permission). To activate CI:

**Option A — GitHub UI (30 seconds):**
1. In the repo, click **Add file → Create new file**
2. Name it exactly: `.github/workflows/ci.yml`
3. Paste the contents of [`docs/github-workflow-ci.yml`](./github-workflow-ci.yml)
4. Commit directly to `main`

**Option B — locally:**
```bash
mkdir -p .github/workflows
cp docs/github-workflow-ci.yml .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "ci: activate workflow"
git push
```

Once added, every PR and push to `main` runs: typecheck (`tsc --noEmit`),
unit tests (`vitest run`), and a production build (`vite build`).
