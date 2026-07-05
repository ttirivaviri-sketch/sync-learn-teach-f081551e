# Database Schema

StudySync runs on Supabase Postgres with Row Level Security enabled on
**every** public table. This document groups the ~115 live tables into
functional domains. For column-level detail, use `supabase--read_query`
against `information_schema.columns` or open the table in the Supabase
dashboard — this file focuses on *what lives where and why*.

Conventions used everywhere:

- `id uuid primary key default gen_random_uuid()` unless a natural key
  (`profiles.id = auth.users.id`, `location_codes.code`).
- `created_at` / `updated_at timestamptz default now()` with an
  `update_updated_at_column()` trigger where the row is mutable.
- RLS ON + explicit `GRANT` per role. `authenticated` gets scoped CRUD,
  `service_role` gets `ALL`, `anon` only where the surface is public.
- Roles live in `user_roles(app_role)`; check with
  `public.has_role(uid, role)` (SECURITY DEFINER, `search_path=public`).

---

## 1. Identity, roles, verification

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`. Basic profile + `user_type`, location, `online_status`, `study_level`, avatar. |
| `user_roles` | `(user_id, app_role)`. `app_role` enum: `admin`, `support`, `moderator`. |
| `academic_profiles` | Learner curriculum context (board, year, targets, exam date, subjects seeded). |
| `learner_subjects` | Per-learner subject enrollment. |
| `tutor_subjects` | Tutor expertise + hourly rate. |
| `tutor_teaching_profile`, `tutor_availability` | Tutor onboarding surface & 30-min slot windows. |
| `tutor_verifications`, `verification_reviews`, `qualifications` | ID / police-clearance / academic docs and admin decisions. |
| `user_preferences`, `notification_preferences`, `device_push_tokens` | Personal settings & push tokens. |

---

## 2. Marketplace: bookings, payments, comms

| Table | Purpose |
|---|---|
| `bookings` | 30-min session bookings (`booking_status` enum). |
| `payments` | Session payments (`payment_status` enum, provider ref). |
| `saved_payment_methods` | PayFast/Paystack tokenised methods. |
| `payout_requests`, `withdrawals` | Tutor payouts. |
| `refund_requests` | Learner refund flow. |
| `conversations`, `messages` | 1:1 chat threads (RLS scopes to participants). |
| `reviews` | Post-session rating + comment. |
| `tutor_booking_insights` | AI-generated tutor-facing insight per booking. |
| `location_codes`, `offline_booking_requests`, `ussd_sessions`, `message_logs` | Offline (SMS/USSD/WhatsApp) reach. |
| `fx_rates` | Cross-currency display. |

---

## 3. Adaptive Study Mode

| Group | Tables |
|---|---|
| Curriculum | `subjects`, `curriculum_topic_templates`, `subject_coverage_audit` |
| Session runtime | `daily_tasks`, `daily_task_attempts`, `daily_task_concepts`, `topic_sessions`, `topic_session_questions`, `study_schedule`, `study_activity` |
| Concept mastery | `concepts`, `concept_attempts`, `topic_mastery`, `weak_concepts`, `flashcards`, `subject_xp`, `user_progress` |
| Quizzes & exams | `quizzes`, `quiz_questions`, `quiz_attempts`, `mock_exam_attempts`, `subject_exams`, `exam_patterns`, `exam_settings`, `paper_blueprints` |
| AI memory | `study_memory_events`, `study_memory_daily`, `study_memory_summary`, `question_fingerprints`, `ai_response_cache`, `ai_usage_daily` |
| Notifications | `notifications`, `notification_preferences` |

---

## 4. SAIL — autonomous agents

| Table | Purpose |
|---|---|
| `sail_detection_signals` | Signals raised by the detection system. |
| `sail_tasks` | Queue of agent tasks (with risk classification). |
| `sail_pipelines` | Higher-order pipelines composed of tasks. |
| `sail_agent_logs`, `sail_events` | Per-run audit trail. |

---

## 5. Schools & classroom layer

| Group | Tables |
|---|---|
| Tenancy | `schools`, `school_memberships`, `school_invitations`, `school_audit_logs`, `school_subjects` |
| Classroom | `classes`, `class_subjects`, `enrollments`, `timetables`, `timetable_slots`, `assignments`, `grades`, `announcements` |
| Homework & submissions | `school_homework`, `school_homework_questions`, `school_homework_responses`, `school_quiz_attempts`, `submissions`, `homework_reminder_sent` |
| AI over school content | `school_ai_documents`, `school_ai_chunks`, `school_ai_usage_daily`, `teacher_ai_settings`, `documents` |
| Content library | `library_system_resources`, `library_saved_items`, `library_access_log`, `school_resources`, `school_videos` |
| Live lessons | `lesson_recordings`, `lesson_transcripts`, `lesson_consents`, `lesson_retention_settings`, `lesson_reinforcement_sets`, `lesson_topic_mapping`, `lesson_notes` |
| Analytics | `school_analytics_daily`, `student_analytics_daily`, `analytics_reports`, `progress_reports`, `student_context_snapshots` |

---

## 6. Learning OS kernel (cross-cutting)

| Table | Purpose |
|---|---|
| `learning_events` | Canonical event log across every learning surface. |
| `learner_state` | Per-learner + subject EWMA / risk vector. |
| `topic_tutor_rankings` | Tutor ranking per topic derived from outcomes. |
| `school_kernel_snapshots` | Rolled-up school-level kernel state. |
| `kernel_alerts` | Actionable risk cohorts (statuses: `new`, `acknowledged`, `assigned`, `resolved`, `dismissed`). |
| `remediation_baselines` | Baseline EWMA/risk captured when a remediation homework is created. |
| `scheduled_insight_runs`, `seeding_jobs` | Async processing state. |
| `security_audit_logs` | Admin & sensitive action audit. |
| `landing_events` | Public marketing funnel analytics. |
| `subscriptions` | Subscription state + trial gating. |

### Key kernel functions

| Function | Notes |
|---|---|
| `has_role(uid, role)` | SECURITY DEFINER role check used by all RLS. |
| `handle_new_user()` | Trigger on `auth.users` → seeds `profiles`. |
| `capture_remediation_baseline()` | Trigger on `school_homework` insert when `is_remediation`. |
| `remediation_effectiveness(school_id)` | Before/after EWMA comparison per remediation homework. |
| `auto_resolve_kernel_alerts()` | Hourly `pg_cron` job that closes alerts once the cohort shrinks. |
| `learner_weekly_digest(user_id)` | 7-day rollup for the learner Home tab + guardian digest. |
| Study-mode analytics RPCs | `get_student_analytics`, `detect_learning_gaps`, all SECURITY DEFINER + locked `search_path`. |

---

## 7. LOS Phase 3.x extension (workspace model)

A parallel workspace-scoped LOS layer defined in
`src/integrations/supabase/learning-os-types.ts` and
`src/studymode/lib/learningOps.ts`. Migrations for it live at the
project root (`20260623113000_…`, `20260627143000_…`,
`20260628090000_…`, `20260702101500_…`, `20260705093000_…`) and are
**not** applied on this Supabase project — the school layer above is
used instead. The bundle is kept in-tree for future integration and is
consumed only by the class-scoped route `/teacher/class/:cohortId` via
`useClassAtRisk` + `usePlanProposals`.

Concepts in that bundle:

- `learning_workspaces`, `workspace_memberships`, `workspace_cohorts`,
  `workspace_invitations`, `workspace_member_cohort_assignments`
- `concept_catalog`, `mastery_evidence_ledger`
- `intervention_queue`, `intervention_events`
- `learning_ops_automation_schedule`, `learning_ops_automation_runs`,
  `learning_ops_concept_ingestions`, `learning_ops_plan_proposals`
- Views: `learning_class_at_risk`, `learner_projected_risk`
- Prerequisite DAG: `learning_concept_prerequisite_edges` +
  `materialize_concept_prerequisite_edges()` / `get_upstream_prerequisites()`
- RPCs: `route_interventions_to_teachers`, `run_study_plan_optimizer`

---

## 8. Custom enums (selected)

```sql
booking_status         -- requested, accepted, declined, in_progress, completed, cancelled
payment_status         -- pending, processing, completed, failed, refunded
study_level            -- primary, secondary, tertiary, professional
app_role               -- admin, support, moderator
support_status         -- open, in_progress, resolved, closed
priority_level         -- low, medium, high, urgent
verification_decision  -- approved, rejected, needs_revision
offline_channel        -- sms, ussd, whatsapp
message_channel        -- sms, ussd, whatsapp, email
message_direction      -- inbound, outbound
```

School membership roles are stored as text (`school_admin`,
`school_teacher`, `school_student`) on `school_memberships.role`; LOS
workspace roles (`owner`, `admin`, `teacher`, `tutor`, `student`) live
on the Phase 3.x contract in `learning-os-types.ts`.

---

## 9. Realtime channels

Tables published to `supabase_realtime`:

- `bookings`, `messages`, `conversations` (marketplace)
- `notifications` (learner + tutor)
- `kernel_alerts`, `school_kernel_snapshots` (LOS kernel)
- `learning_events`, `learner_state` where used by `useLearningKernel`

All subscriptions are mounted inside `useEffect` and torn down with
`supabase.removeChannel(channel)`.

---

## 10. Security posture

- **RLS on every table.** Public reads (e.g. tutor discovery) are
  explicitly modelled with narrow policies + `GRANT SELECT TO anon`.
- **Roles never live on `profiles`.** Only in `user_roles`; checked via
  `has_role()` to avoid recursive RLS.
- **AI quota** enforced per user (`ai_usage_daily`) and per school
  (`school_ai_usage_daily`).
- **Sensitive endpoints** (`studymode-detect-gaps`, `school-analytics`,
  `school-ingest-document`, `school-search`) require JWT, scope all
  queries to the caller, and never accept a client-supplied `user_id`.
- **Audit trails** in `school_audit_logs` and `security_audit_logs`.
- **Lesson data retention** governed by `lesson_retention_settings` and
  the `purge-expired-lesson-data` cron function.
