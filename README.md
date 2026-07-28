# StudySync

StudySync is an AI-powered study platform for Southern-African curricula (ZIMSEC, Cambridge, IEB, NSC). It combines a curriculum-aligned AI study engine, a tutor booking marketplace, and a school workspace in one product.

Status: **Prototype / Early product.** Actively developed; not yet production-hardened.

---

## What actually exists

### AI StudyMode (learner)
- Quiz, flashcard, active-recall, and exam-mode generation per subject/topic
- Mock exam papers with AI marking, grade bands, and per-topic breakdowns
- Photo Solve: photograph a worked answer, get step-by-step AI marking, then
  practice the correction with 5 method-isomorphic variant questions
- AI tutor chat, explain-answer marking, daily tasks, topic sessions
- Concept mastery tracking (concept catalog, mastery ledger, prerequisite
  graph, weak-topic remediation)
- Spaced repetition, XP/streaks/leaderboards, exam countdowns, predicted grades
- Study plans and AI-generated student insights
- In-app product feedback capture (output thumbs + session pulse ratings)

### Tutor marketplace
- Tutor onboarding, verification, availability, and booking flows
- Payments via PayFast and Paystack (cards + saved tokens), wallets, payouts,
  refund requests
- Live sessions via Jitsi (JWT-gated), lesson recording, transcription, and
  AI lesson-reinforcement sets
- Reviews, session history, tutor tutorials/creator tools

### School workspace (B2B, feature-flagged via `VITE_FEATURE_SCHOOLS`)
- Multi-tenant schools with memberships, classes, enrollments, invitations,
  announcements, audit logs
- Document ingestion → chunked retrieval for AI generation grounded in the
  school's own materials
- AI homework: teacher generates from documents, students submit, AI marks,
  teacher reviews flagged items, then releases grades
- School quizzes/flashcards, per-school analytics dashboards

### Admin console
- Users, roles, verifications, bookings, payments, refunds, support tickets,
  curriculum templates, library, study analytics, school management

### Guardian reporting
- Weekly guardian email reports (no guardian login) via Resend

---

## Explicitly NOT implemented (yet)

To keep expectations honest — the following are sometimes assumed but do
**not** exist in this codebase today:

- LTI / SCORM import or export
- Zapier or generic webhook connectors
- Google/Outlook calendar sync
- Offline-first sync (a PWA manifest exists; low-data mode is in progress)
- SMS or USSD channels (a `ussd_sessions` table exists with no backend)
- Threaded discussions / peer review
- Plugin system

---

## Tech stack

- **Frontend**: React 18 + TypeScript + Vite, Tailwind CSS, shadcn/ui,
  TanStack Query, React Router
- **Backend**: Supabase — Postgres with RLS (130+ migrations), Auth,
  Storage, and 60+ Deno edge functions
- **AI**: Lovable AI gateway (Gemini models) with per-user daily quota
  buckets, response caching, and usage logging
- **Payments**: PayFast (ZA) and Paystack, ITN/webhook driven
- **Video**: Jitsi with server-issued JWTs
- **Email**: Resend
- **Observability**: Sentry (frontend + selected edge functions)

## Local development

```bash
npm install
npm run dev        # Vite dev server
npm run test       # vitest unit suite
npm run build      # production build
```

Environment variables (see `.env.example` if present):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase project
- `VITE_SENTRY_DSN` — optional error reporting
- `VITE_FEATURE_SCHOOLS` — set `off` to hide the school workspace

Database changes ship as SQL files in `supabase/migrations/` and are applied
with the Supabase CLI (`supabase db push`). Edge functions live in
`supabase/functions/` and deploy with
`supabase functions deploy <name> --project-ref <ref>`.

Secrets used by edge functions (AI gateway key, Resend key, payment gateway
keys, Jitsi keys) are configured as Supabase function secrets — never in the
repo.

## Testing

- `npm run test` runs the vitest unit suite
- Edge functions are typechecked by Deno at deploy time
- There is **no e2e suite yet** — this is a known gap

## Production readiness

Not production ready by default. Known gaps: no e2e coverage, no load
testing, accessibility audit pending, and operational runbooks (backup /
restore drills, on-call) are not in place. See the issue tracker for the
current hardening plan.

## Contributing

- Open an issue describing the feature or bug
- Branch per feature, PR with a clear description
- All schema changes must be additive migrations with RLS policies
