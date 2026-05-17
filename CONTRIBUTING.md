# Contributing to StudySync

This guide standardizes how a multi-developer team works in this repository.

## Engineering Principles

- **Security first**: assume learner/tutor/payment data is sensitive. Every DB change must preserve or improve RLS.
- **Small, reversible changes**: prefer focused PRs over sweeping refactors.
- **Type safety and explicitness**: avoid `any`, prefer discriminated unions and shared types.
- **Operational readiness**: changes should include logs, monitoring events, or migration safety notes where relevant.

## Branching & PR Workflow

1. Create a branch from `main`: `feature/<scope>` or `fix/<scope>`.
2. Keep PRs focused on one concern.
3. Include in PR description:
   - Problem statement
   - Scope of changes
   - Risk + rollback plan
   - Validation commands and results
4. Request at least one reviewer for app logic and one for security-sensitive SQL/migrations.

## Local Setup

```bash
npm install
npm run dev
```

## Required Checks Before Merge

Run all of the following locally:

```bash
npm run test:types
npm run lint
npm run test
npm run build
```

If a check cannot run due to environment limitations, document why in the PR.

## Code Standards

- Use existing path aliases (`@/`) and project utilities.
- Keep components focused; move complex logic to hooks/libs.
- Prefer pure helper functions for business rules.
- Do not wrap imports in `try/catch`.
- Preserve accessibility semantics for interactive UI.

## Database & RLS Standards

For any schema/RLS change:

- Add a **new migration**; never edit historical migrations.
- Use explicit policies per operation (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) for sensitive tables.
- Avoid broad `FOR ALL` unless service-role-only and justified.
- Include idempotency (`DROP POLICY IF EXISTS`, `IF NOT EXISTS`, or guarded DO blocks).
- Document expected actor matrix (learner/tutor/admin/service_role).

## Security Review Checklist (mandatory for auth/data changes)

- [ ] Could this expose cross-user data?
- [ ] Are reads restricted to owner/participant/admin as intended?
- [ ] Are writes restricted and auditable?
- [ ] Are service-role capabilities separated from client capabilities?
- [ ] Are sensitive fields excluded from public views/responses?

## Testing Guidance

- Add or update tests when changing domain logic.
- For migrations, include a brief validation note in PR (tables/policies affected and expected access behavior).
- For onboarding/auth changes, verify route transitions for:
  - unauthenticated user
  - newly authenticated user
  - returning user with completed onboarding

## Documentation Expectations

If behavior/contracts change, update one or more of:

- `README.md` (developer-facing quickstart)
- `ARCHITECTURE.md` (system behavior, trust boundaries)
- `docs/*` (feature-specific playbooks or runbooks)

