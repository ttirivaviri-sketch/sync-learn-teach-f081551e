# StudySync Platform Architecture

StudySync started as a tutoring marketplace and has grown into a full
**Learning Operating System (LOS)** for individual learners, tutors, and
whole schools. It combines a 1:1 marketplace, an adaptive AI Study Mode,
an autonomous background agent runtime (SAIL), and a school workspace
(classes, homework, kernel telemetry, remediation loops).

## High-level layers

```
┌──────────────────────────────────────────────────────────────────────┐
│  Frontend (React 18 + Vite + TS + Tailwind + shadcn)                │
│  ┌──────────┬──────────┬────────────┬───────────┬──────────────┐   │
│  │ Learner  │ Tutor    │ Study Mode │ School    │ Admin        │   │
│  │ App      │ App      │ (adaptive) │ workspace │ console      │   │
│  └────┬─────┴────┬─────┴─────┬──────┴─────┬─────┴──────┬───────┘   │
│       │          │           │            │            │           │
│       ▼          ▼           ▼            ▼            ▼           │
│                React Query + realtime channels                     │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────────┐
│  Supabase                                                           │
│  - Auth (JWT, roles via user_roles + has_role())                    │
│  - Postgres (RLS on every table)                                    │
│  - Storage (documents, avatars, lesson recordings)                  │
│  - Realtime (bookings, messages, kernel snapshots, alerts)          │
│  - Edge Functions (AI, ingestion, automation, payments)             │
│  - pg_cron (nightly rebalance, alert auto-resolve, LOS automation)  │
└──────────────────────────────────────────────────────────────────────┘
```

## Core surfaces

### 1. Tutoring marketplace (original MVP)
- `profiles`, `tutor_subjects`, `tutor_availability`, `bookings`,
  `payments`, `payout_requests`, `conversations` / `messages`, `reviews`,
  `tutor_verifications` / `qualifications`.
- Geolocation-based discovery (Haversine), 30-min slot bookings,
  Jitsi video conferencing, PayFast/Paystack payments via edge functions.
- Offline reach through `offline_booking_requests`, `ussd_sessions`,
  `location_codes`, `message_logs`.

### 2. Adaptive Study Mode (`src/studymode/`)
- Subject-level academic profile (`academic_profiles`,
  `learner_subjects`, `subjects`, `curriculum_topic_templates`).
- Concept mastery & spaced repetition: `concepts`, `concept_attempts`,
  `topic_mastery`, `flashcards`, `weak_concepts`, `subject_xp`.
- Daily tasks / topic sessions: `daily_tasks`, `daily_task_attempts`,
  `daily_task_concepts`, `topic_sessions`, `topic_session_questions`,
  `study_schedule`, `study_activity`.
- Mock exams and paper generation: `mock_exam_attempts`, `exam_patterns`,
  `paper_blueprints`, `subject_exams`, `exam_settings`,
  `quizzes` / `quiz_questions` / `quiz_attempts`.
- AI edge functions: `generate-quiz`, `generate-daily-task`,
  `generate-mock-paper`, `photo-solve-grade`, `explain-answer`,
  `generate-flashcards`, `ai-tutor`, `studymode-context-retrieve`,
  `studymode-detect-gaps`, `personalise-curriculum-deep-dive`, and more.

### 3. SAIL — autonomous background agents (`src/sail/`)
- Event-driven system that detects issues (`sail_detection_signals`),
  spawns tasks (`sail_tasks`), runs agent pipelines (`sail_pipelines`,
  `sail_agent_logs`), and logs outcomes (`sail_events`).
- Deploy pipeline and subscription-aware monetization gating.
- Edge function: `sail-agent`.

### 4. Schools & classroom layer (`src/pages/school/`)
- Tenancy: `schools`, `school_memberships` (owner/admin/teacher/
  student), `school_invitations`, `school_audit_logs`, `school_subjects`,
  `classes`, `class_subjects`, `enrollments`, `timetables` /
  `timetable_slots`, `assignments`, `grades`, `announcements`.
- Teacher tools: `school_homework` (+ `school_homework_questions` /
  `_responses`), `school_quiz_attempts`, `submissions`,
  `teacher_ai_settings`, `school_ai_documents` / `school_ai_chunks`.
- Live delivery & consent: `lesson_recordings`, `lesson_transcripts`,
  `lesson_consents`, `lesson_retention_settings`,
  `lesson_reinforcement_sets`, `lesson_topic_mapping`, `lesson_notes`.
- Analytics: `school_analytics_daily`, `student_analytics_daily`,
  `analytics_reports`, `progress_reports`.

### 5. Learning Operating System kernel (Phase 4–6)
- `learning_events` — canonical event log (photo-solve, flashcards,
  quiz, mock exam, tutor chat, lesson).
- `learner_state` — unified EWMA / risk vector per learner + subject.
- `student_context_snapshots` and `topic_tutor_rankings` — the substrate
  the next-action engine and school kernel read from.
- Kernel rollups: `school_kernel_snapshots`, `kernel_alerts`,
  `remediation_baselines` (+ `remediation_effectiveness` RPC).
- Automation: `auto_resolve_kernel_alerts()` (hourly), plan rebalance
  (`learning-plan-rebalance`), next-action engine
  (`learning-next-action`), and `send-guardian-report`.
- Hooks: `useLearningKernel`, `useLearnerArtifacts`, `useNextAction`,
  `useLearningGaps`, `useLearningTimeline`, `useClassKernel`,
  `useSchoolKernel`, `useSchoolKernelRealtime`, `useKernelAlerts`,
  `useRemediationTracker`, `useRemediationEffectiveness`,
  `useLearnerWeeklyDigest`, `usePlanRebalance`.
- UI: `MasteryIntelligenceCard`, `WeeklyDigestCard`,
  `GuardianWorkspaceCard`, `NextActionCard`, `SmartSuggestionStrip`,
  `StruggleRecRail`, `ClassKernelPanel`, `SchoolKernelPanel`,
  `KernelAlertsPanel`, `RemediationTrackerPanel`,
  `RemediationEffectivenessPanel`.

### 6. Phase 3.x LOS bundle (`src/studymode/{lib,hooks,components}/`)
A parallel, workspace-scoped LOS layer (workspaces, memberships,
concept catalog, mastery ledger, intervention queue, plan proposals,
prerequisite DAG, predictive risk, per-teacher routing, plan optimizer).
It ships behind a hand-typed contract (`learning-os-types.ts`) and the
`run-learning-ops-automation` edge function; a class-scoped detail
page is mounted at `/teacher/class/:cohortId`. The rest of the bundle
is kept in-tree for future integration but is not wired into the live
school pages, which currently use the `school_*` schema above.

## Frontend conventions

- **State**: React Query for server data + realtime; Context for global
  UI state; localStorage for lightweight persistence.
- **Routing**: React Router v6 with lazy routes and role-gated redirects.
- **Design**: glass mesh internal theme, white-dominant landing; strict
  logo rules; KaTeX for all math; `safeJsonParse` on AI JSON.
- **PWA**: manifest, service worker, offline indicators.

## Backend conventions

- Every public table has RLS + explicit GRANTs to
  `authenticated` / `service_role` (+ `anon` only for public data).
- Roles live in `user_roles` and are checked via
  `public.has_role(uid, role)` (SECURITY DEFINER).
- Edge functions validate JWTs in code (`verify_jwt = false` in TOML),
  validate input with Zod, and never accept SQL from clients.
- Secrets are only read via `Deno.env.get(...)`; the service-role key
  never leaves an edge function.
- Realtime subscriptions are always mounted in `useEffect` and cleaned
  up with `removeChannel`.

## Deployment

- Vite build; Supabase manages DB, storage, functions.
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_SUPABASE_PROJECT_ID` (auto-populated).
- Cron: hourly (`auto_resolve_kernel_alerts`), nightly plan rebalance,
  workspace-scheduled LOS automation via `run-learning-ops-automation`.
- Monitoring via Supabase dashboard, error boundaries, and Web Vitals.

## Security

- RLS on every table, SECURITY DEFINER helpers with locked
  `search_path`, per-user AI quota (`ai_usage_daily`,
  `school_ai_usage_daily`), and `security_audit_logs` for admin actions.
- Sensitive documents live in Supabase Storage with signed URLs and
  short retention (`lesson_retention_settings`, `purge-expired-lesson-data`).
