# StudySync App Development Standards

This document defines implementation standards for a team environment.

## 1. Architecture Boundaries

- **Pages**: route-level composition and orchestration only.
- **Components**: presentational/UI behavior with minimal data coupling.
- **Hooks**: async data fetching, caching, and domain workflows.
- **Lib/Utils**: pure reusable logic.
- **Supabase migrations**: schema, policies, and DB-side guards.

## 2. Naming & Structure

- Components: `PascalCase.tsx`
- Hooks: `useXxx.ts`
- Utilities: `camelCase.ts`
- Migrations: timestamp prefix + concise action name

Keep files cohesive. If a component exceeds ~250 lines with mixed concerns, split UI and logic.

## 3. Security-by-Default Rules

- Every new table must have RLS enabled.
- Every table must have an explicit access model documented in migration comments.
- Sensitive domains (profiles, bookings, payments, payouts, messages, analytics) require least-privilege rules.
- Prefer participant/owner predicates over global read rules.

## 4. Frontend Quality Rules

- Avoid duplicated API calls in effects; guard with readiness/loading flags.
- Persist user-specific state with user-scoped keys.
- Handle loading/empty/error states explicitly.
- Use typed Supabase responses and avoid unsafe assumptions on nullable fields.

## 5. Observability Standards

For critical flows (auth, onboarding, booking, payment, messaging):

- Emit analytics event on success/failure transitions.
- Log actionable error context without leaking secrets/PII.
- Prefer structured logs for easier incident triage.

## 6. Migration Standards

Each migration should:

1. Be idempotent where practical.
2. Avoid destructive changes without fallback/rollback notes.
3. Include comments for intent, especially security policies.
4. Keep policies explicit and reviewable.

## 7. PR Standards

A PR is merge-ready when it includes:

- Clear scope and rationale
- Screenshots for visible UX changes (if applicable)
- Validation commands with outcomes
- Risk notes for security or data-layer changes

## 8. Definition of Done

- Code compiles and passes required checks.
- Tests updated or rationale provided.
- Docs updated for behavior or contract changes.
- Security checklist completed for auth/data modifications.
