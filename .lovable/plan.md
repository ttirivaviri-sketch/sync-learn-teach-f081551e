# StudySync V2 — School Workspace (LMS) Layer

## 0. Method

This plan is the deliverable. It is built from a live inspection of the running project (routes in `src/App.tsx`, ~80 tables listed by the DB, 8 storage buckets, ~45 edge functions, `app_role` enum = `admin | support | moderator`). Anything I discovered that wasn't in the brief is mapped explicitly in §2.

---

## 1. Discovery — what already exists

### 1.1 Apps & routes (from `src/App.tsx`)
- **Learner app** `/learner` (+ `/learner/auth`, `/learner/onboarding`, `/learner/choose-level`) — 4 tabs: Home, Activity, Library, Profile.
- **Tutor app** `/tutor` (+ `/tutor/auth`) — 4 tabs incl. earnings & insights.
- **Admin** `/admin/*` — 15 sub-pages: Dashboard, Users, Bookings, Payments, Support, Reports, Roles, Security, Refunds, SAIL, Verifications, CurriculumTemplates, Library, Allocations, StudyAnalytics.
- **Payments callbacks** `/payment-success`, `/payment-cancelled` (PayFast + Paystack).
- **Legal**, **Settings**, **/debug/haptics**.
- **StudyMode** is mounted inside the learner app (not a route) via `StudyModeWrapper` → 5-tab dashboard.

### 1.2 Roles & auth
- Supabase Auth (email/password) with separate auth screens per persona.
- `profiles.user_type ∈ {learner, tutor, ...}` is the *persona* (UI routing).
- `user_roles.role app_role ∈ {admin, support, moderator}` is the *privilege* table — used by `has_role(uid, role)` security‑definer fn. **No tenant scope on this table today.**

### 1.3 Database surface (80 tables) — grouped
- **Identity & access**: profiles, user_roles, academic_profiles, user_preferences, security_audit_logs.
- **Marketplace**: tutor_subjects, tutor_availability, tutor_teaching_profile, tutor_verifications, verification_reviews, qualifications, tutor_allocations, topic_tutor_rankings.
- **Booking & lessons**: bookings, lesson_consents, lesson_recordings, lesson_transcripts, lesson_notes, lesson_topic_mapping, lesson_reinforcement_sets, lesson_retention_settings.
- **Payments & wallets**: payments, payout_requests, refund_requests, saved_payment_methods, fx_rates, subscriptions.
- **Messaging**: conversations, messages, message_logs, notifications, support_tickets.
- **StudyMode core**: subjects, learner_subjects, subject_xp, subject_exams, exam_settings, exam_patterns, paper_blueprints, mock_exam_attempts, daily_tasks, daily_task_attempts, daily_task_concepts, concepts, concept_attempts, topic_mastery, weak_concepts, flashcards, quiz_attempts, question_fingerprints, study_activity, study_memory_{events,daily,summary}, study_schedule, user_progress, ai_response_cache, ai_usage_daily.
- **Content library**: library_system_resources, library_saved_items, library_access_log, tutor_tutorials, tutorial_watch_events, documents.
- **Curriculum seed**: curriculum_topic_templates, subject_coverage_audit, seeding_jobs.
- **SAIL agent**: sail_events, sail_detection_signals, sail_tasks, sail_pipelines, sail_agent_logs, scheduled_insight_runs.
- **Telemetry**: landing_events, analytics_reports.
- **Offline channels**: location_codes, offline_booking_requests, ussd_sessions.

### 1.4 Storage buckets (live)
`documents` (private), `library` (public), `library-pdfs` (private), `profile-photos` (public), `question-diagrams` (public), `tutor-documents` (private), `tutor-videos` (public), `ttirivavirisketchsproject` (legacy).

### 1.5 Edge functions (~45) — categories
- AI (StudyMode): generate-quiz, generate-task-content, generate-flashcards, generate-exam-questions, generate-mock-paper, generate-topic-session, generate-concept-review, generate-daily-task, generate-prerequisite-{quiz,theory}, evaluate-topic-answer, explain-answer, grade-answer, photo-solve-grade, map-question-concepts, ai-tutor, render-question-visual, analyze-prerequisites, generate-progress-plan, generate-study-plan, personalise-curriculum-deep-dive, generate-student-insights, generate-tutor-booking-insights, generate-lesson-reinforcement.
- Payments: payfast-{create-payment,charge-token,itn,add-payment-method}, paystack-{initialize,charge-token,webhook}, process-tutor-payout.
- Lessons/media: process-lesson-recording, transcribe-lesson-chunk, process-video-upload, generate-jitsi-jwt, export-lesson-data, purge-expired-lesson-data.
- Curriculum/admin: seed-curriculum-topics, bulk-seed-curriculum, run-migration, send-guardian-report, send-progress-report, library-stream, parse-document, sail-agent.

### 1.6 Shared infra observed
- `pgvector` extension is **already installed** (halfvec/hnsw/sparsevec/embedding ops present) → school RAG can land without enabling extensions.
- Daily AI quotas via `ai_usage_daily` + `check_and_increment_ai_usage` RPC — perfect place to add per-school quotas.
- Notifications fan out via `notifications` table + Postgres triggers + Realtime.

### 1.7 Permission matrix today (compressed)
| Capability | Anon | Learner | Tutor | Admin |
|---|---|---|---|---|
| Browse tutor profiles | ✓ | ✓ | ✓ | ✓ |
| Book/pay | – | ✓ | – | ✓ |
| Accept booking, payout | – | – | ✓ | ✓ |
| StudyMode | – | ✓ | – | ✓ |
| `/admin/*` | – | – | – | ✓ |

### 1.8 Gaps to fix while we're here
- `user_roles.app_role` has no tenant scope — we must add one (or a parallel table) for school roles.
- No "soft delete" or `deleted_at` convention — needed for school-record retention.
- `notifications` lacks `school_id` / topic — needed for tenant‑scoped fan‑out.
- StudyMode `subjects` table is per-user; school subjects need to be sharable across many users.

---

## 2. Impact analysis (A unchanged / B modify / C extend / D migrate)

| Surface | Verdict | Notes |
|---|---|---|
| Marketplace discovery, booking, payments, wallets | **A** | Untouched. Schools never block the public path. |
| `profiles` | **C** | Add nothing required — link via `school_memberships`. |
| `user_roles` | **B** | Add new enum values (`school_admin`, `school_teacher`, `school_student`) + nullable `school_id` column. |
| `notifications` | **C** | Add `school_id`, `audience` (`user|class|grade|school`). |
| `conversations` / `messages` | **C** | Add `scope` (`tutor_booking|school_class|school_dm`) + optional `class_id`. |
| StudyMode (`subjects`, `daily_tasks`, etc.) | **C** | Add optional `school_id`, `class_id`. Public path keeps `NULL`. |
| Library | **C** | Existing buckets stay public; new private `school-content/<school_id>/…` bucket per tenant via path prefix RLS. |
| Tutor videos | **A** | Teachers use a separate `school_videos` table — they may *also* publish to public library if marked. |
| AI edge functions | **C** | Each AI fn accepts optional `{school_id, class_id}` and switches retrieval to the school RAG namespace. No new functions for existing flows. |
| Admin dashboard | **C** | Add `/admin/schools/*` module. |
| Analytics (`analytics_reports`, `study_memory_*`) | **C** | Add `school_id` to rollups. |
| Lesson scheduling (Jitsi) | **A** | Reused as-is for school classes. |
| SAIL | **A** | Out of scope for v2. |
| Offline / USSD | **A** | Out of scope. |

Dependency map: `school_id` flows from `schools → school_memberships → (classes, school_resources, assignments, quizzes, announcements, timetables, school_ai_documents) → notifications → ai_usage_daily`.

---

## 3. New multi-tenant architecture

```
StudySync Platform (public)
└── tenant("school"=<uuid>)
      ├── memberships (user_id, role, school_id)
      ├── academic hierarchy (grade → class → subject)
      ├── private content (resources, videos, assignments, quizzes, announcements, timetable)
      ├── AI namespace (school_ai_documents, school_ai_chunks vector(1536))
      └── tenant analytics
```

Isolation enforced at six layers:
1. **DB** — every new row carries `school_id NOT NULL`; RLS uses `is_school_member(school_id, [role])` security-definer fn.
2. **API/Edge** — every school endpoint extracts JWT, resolves membership, attaches `school_id` to all writes; cross-school refs rejected by RLS even if the function leaks.
3. **Storage** — path-prefix policy `school-content/{school_id}/…`; access checked by storage RLS calling `is_school_member`.
4. **Search** — pgvector queries always filter `WHERE school_id = $1` *before* the `<=>` operator (HNSW + bool filter).
5. **AI** — system prompt receives only chunks from one `school_id`; school context never appended to public StudyMode calls.
6. **Analytics** — rollups partitioned by `school_id`; super-admin views explicitly aggregate.

---

## 4. RBAC

New enum values added to `app_role`: `school_admin`, `school_teacher`, `school_student` (existing `admin|support|moderator` keep behaviour). `user_roles` gets nullable `school_id` (legacy rows stay NULL = global). Multiple memberships allowed: same user can hold `learner` persona + `school_student` role in school A and `school_teacher` in school B.

Helper functions:
- `has_role(uid, role)` — kept as-is for global roles.
- `is_school_member(school_id, _role app_role default null)` — new, security definer; returns true if `user_roles` row exists.
- `current_school_ids()` — returns array of school_ids the caller belongs to (for list views).

| Capability | Super Admin | School Admin | Teacher | School Student | Public Learner | Tutor |
|---|---|---|---|---|---|---|
| Create school | ✓ | – | – | – | – | – |
| Manage school users | ✓ | ✓ (own) | – | – | – | – |
| Create class/subject | ✓ | ✓ | – | – | – | – |
| Assign teacher to class | ✓ | ✓ | – | – | – | – |
| Upload class resource | ✓ | ✓ | ✓ (own classes) | – | – | – |
| Create homework/quiz | ✓ | ✓ | ✓ (own classes) | – | – | – |
| Submit homework | – | – | – | ✓ (enrolled) | – | – |
| View class analytics | ✓ | ✓ | ✓ (own) | self only | – | – |
| Send class announcement | ✓ | ✓ | ✓ | – | – | – |
| Use public StudyMode/library | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| Book tutors/pay | – | optional | optional | ✓ | ✓ | – |

---

## 5. New schema (ERD summary)

```
schools(id, name, slug, logo_url, country, school_type, contact_*, status, plan,
        seats_teachers, seats_students, ai_quota_daily, storage_quota_mb,
        contract_start, contract_end, created_at, deleted_at)

school_memberships(id, school_id→schools, user_id→profiles, role app_role,
        status enum('active','invited','suspended'), invited_email,
        joined_at, created_at, unique(school_id,user_id,role))

grades(id, school_id, name, sort_order)
classes(id, school_id, grade_id, name, homeroom_teacher_id, code)
school_subjects(id, school_id, name, code, color)
class_subjects(id, class_id, subject_id, teacher_id)  -- teacher_assignments
enrollments(id, class_id, student_id, status, enrolled_at)
departments(id, school_id, name, head_id)

timetables(id, school_id, class_id, name)
timetable_slots(id, timetable_id, weekday, start_min, end_min, subject_id, teacher_id, location)

school_resources(id, school_id, class_id NULL, grade_id NULL, subject_id NULL,
        teacher_id, kind enum('pdf','doc','ppt','image','note','video','past_paper'),
        title, description, storage_path, mime, size_bytes, version,
        visibility enum('school','grade','class','subject','custom'),
        custom_audience uuid[] NULL, status enum('draft','published','archived'),
        created_at, updated_at, deleted_at)

school_videos(id, school_id, class_id NULL, subject_id NULL, teacher_id,
        title, description, storage_path, thumbnail_url, duration_seconds,
        visibility, also_public bool default false, status, created_at, updated_at)

assignments(id, school_id, class_id, subject_id, teacher_id, title, instructions,
        due_at, max_score numeric, attachment_resource_ids uuid[],
        allow_late bool, status, created_at, updated_at, deleted_at)

submissions(id, assignment_id, student_id, submitted_at, status
        enum('not_started','draft','submitted','late','graded'),
        text_response, attachment_paths text[], score numeric, feedback,
        graded_by, graded_at, version int)

quizzes(id, school_id, class_id, subject_id, teacher_id, title, instructions,
        time_limit_min, attempts_allowed, ai_generated bool, source_resource_id,
        status, due_at, created_at, deleted_at)
quiz_questions(id, quiz_id, ord, type enum('mcq','short','tf','long'),
        prompt, options jsonb, answer jsonb, marks)
school_quiz_attempts(id, quiz_id, student_id, started_at, submitted_at,
        score, max_score, per_question jsonb)

announcements(id, school_id, audience enum('school','grade','class'),
        grade_id NULL, class_id NULL, author_id, title, body, pinned,
        created_at, deleted_at)

school_ai_documents(id, school_id, resource_id, status enum('queued','parsed','embedded','failed'),
        page_count, total_tokens, error, created_at, updated_at)
school_ai_chunks(id, school_id, document_id, ord, content text,
        embedding vector(1536), metadata jsonb)   -- HNSW on (embedding) WHERE school_id=$
school_ai_usage_daily(school_id, usage_date, bucket, requests, tokens_in, tokens_out)

school_invitations(id, school_id, email, role, token, expires_at, accepted_by)
school_audit_logs(id, school_id, actor_id, action, target_table, target_id, diff jsonb, created_at)
```

Triggers/indexes:
- `updated_at` trigger on every mutable table.
- Soft delete pattern (`deleted_at`) on resources/assignments/quizzes/announcements; queries filter via view `v_active_*`.
- Indexes: `(school_id, …)` composite on every tenant table; HNSW vector index on `school_ai_chunks` with `vector_cosine_ops`.

---

## 6. Supabase design

### 6.1 RLS — pattern
```sql
-- example for school_resources
alter table school_resources enable row level security;

create policy "members read by visibility"
on school_resources for select to authenticated using (
  is_school_member(school_id) and (
    visibility = 'school'
    or (visibility='grade'   and exists (select 1 from enrollments e
          join classes c on c.id=e.class_id
          where e.student_id=auth.uid() and c.grade_id = school_resources.grade_id))
    or (visibility='class'   and exists (select 1 from enrollments e
          where e.student_id=auth.uid() and e.class_id = school_resources.class_id))
    or (visibility='subject' and exists (select 1 from enrollments e
          join class_subjects cs on cs.class_id=e.class_id
          where e.student_id=auth.uid() and cs.subject_id = school_resources.subject_id))
    or (visibility='custom'  and auth.uid() = any(custom_audience))
    or is_school_member(school_id, 'school_teacher')
    or is_school_member(school_id, 'school_admin')
  )
);

create policy "teachers write own classes"
on school_resources for insert to authenticated with check (
  is_school_member(school_id, 'school_teacher')
  and teacher_id = auth.uid()
);
```
Same pattern repeats for assignments, quizzes, announcements, videos. Every policy first checks `is_school_member` so cross-tenant reads are impossible.

### 6.2 Storage
New private bucket `school-content`. Object policy:
```sql
create policy "school members read own files"
on storage.objects for select to authenticated using (
  bucket_id='school-content'
  and is_school_member((storage.foldername(name))[1]::uuid)
);
```
Path convention: `school-content/{school_id}/{class_id or 'shared'}/{kind}/{uuid}.{ext}`.

### 6.3 Edge functions (new)
- `school-import-csv` — bulk teacher/student onboarding (creates auth users + memberships).
- `school-invite` — email invite via existing transactional pipeline.
- `school-ingest-document` — orchestrates `parse-document` → chunk → embed → insert `school_ai_chunks`.
- `school-search` — RAG retrieval helper used by AI fns when `school_id` provided.
- `school-quota-check` — wraps `ai_usage_daily` with `school_ai_usage_daily` for per‑tenant caps.
- Extended (not new): every StudyMode AI fn accepts `{school_id?, class_id?}` and, when present, calls `school-search` and injects retrieved chunks into the prompt.

### 6.4 Realtime
Add to publication: `assignments`, `submissions`, `school_quiz_attempts`, `announcements`, `notifications` (already). Channels subscribed per `school_id` to limit fanout.

### 6.5 Auth
No new providers. Onboarding via magic-link invitation; new users land on `/learner` by default but see a **School** tab the moment a `school_memberships` row exists.

---

## 7. AI knowledge architecture

Hierarchy (priority order, top wins in retrieval ranking):
```
1. Student performance memory (existing study_memory_*)
2. Teacher content (school_ai_chunks for the student's classes)
3. School-wide content (school_ai_chunks visible to all)
4. National curriculum (curriculum_topic_templates)
5. Global model knowledge
```
Ingestion pipeline:
```
Upload → school_resources row (status=draft)
      → school-ingest-document edge fn
          → parse-document (existing) → text
          → chunk (1k chars, 150 overlap)
          → embed via Lovable AI Gateway (google/gemini-embedding-001, dimensions=1536)
          → insert school_ai_chunks
          → set school_ai_documents.status='embedded'
```
Retrieval: `school-search(school_id, class_id?, query, k=8)` returns top-k chunks filtered by RLS-visible class/subject. Results stuffed into the system prompt with a citation block. The AI function never sees rows from a different `school_id` because the query is constructed server-side from the JWT, not the client.

Leakage prevention checklist:
- Embeddings table partitioned conceptually by `school_id`; RLS denies cross-school reads.
- `ai_response_cache` extended with `school_id` (cache key must include tenant).
- Prompt scrubbed of school names before sending to the model (use anonymised tags).

---

## 8. Content permission model

Every content row holds `(school_id, grade_id?, class_id?, subject_id?, teacher_id, visibility, custom_audience?)`. The single RLS predicate above handles all five visibility levels. The teacher UI maps these to friendly chips: *Whole school / Whole grade / Specific class / Specific subject / Pick students*.

---

## 9. Admin dashboard (super-admin) IA

`/admin/schools` (list) → `/admin/schools/new`, `/admin/schools/:id` with tabs:
- Overview (status, plan, contract dates, last activity)
- Users (counts vs seats, suspend/restore)
- Subscription & billing (plan, seat caps, AI quota, storage cap)
- Usage (AI calls/day, storage MB, active classes)
- Audit log
- Danger zone (suspend, archive)

Sidebar gets a new top-level "Schools" item next to existing Users/Bookings.

---

## 10. School Admin portal — `/school/:slug/admin`

Tabs: Dashboard · Users (Teachers/Students/Invites/CSV) · Academic (Grades/Classes/Subjects/Departments) · Timetable · Announcements · Resource moderation · Analytics · Settings.

CSV importers reuse one edge fn (`school-import-csv`) with column maps for teacher vs student. Validation errors returned per row.

---

## 11. Teacher Workspace — `/school/:slug/teach`

Bottom-nav (mobile, matches existing pill-nav rule): **Classes · Library · Tasks · Inbox**.

Per-class screen:
- Stream (announcements + recent activity)
- Materials (upload PDF/DOC/PPT/Image/Video → goes through ingest)
- Homework (create/assign/track) with submission grid
- Quizzes (manual or *Generate with AI* using class materials as context)
- Students (roster + per-student analytics: homework completion, quiz avg, StudyMode XP delta, weak topics)
- Insights (engagement, video watch %, AI usage)

Messaging: a class becomes a `conversations` row with `scope='school_class'` so existing chat UI is reused.

---

## 12. Student School experience

Existing learner bottom nav stays 4 tabs. When `school_memberships` exists, the **Home** tab gains a "School" card section at the top, and Profile shows a "Switch to School view" entry that opens `/school/:slug` with a dedicated 5-tab view: **Today · Classes · Homework · Library · Timetable**.

StudyMode keeps its own button; when launched from a school context it automatically passes `{school_id, class_id}` so the AI uses teacher materials. From public Home, StudyMode behaves exactly as today.

---

## 13. Notifications

Add `school_id`, `audience`, `audience_ref` to `notifications`. Triggers:
- New `assignments` → fan out to enrolled students.
- `submissions.status='graded'` → notify student.
- New `announcements` → fan out per audience.
- Quiz due in 24h → scheduled cron via `pg_cron` job calling an edge fn.

Push: piggyback on existing in-app notification UI; web push is out of scope for v2.

---

## 14. API inventory (new)

| Endpoint (edge fn) | Method | Purpose | Auth | Body | Returns | Rate |
|---|---|---|---|---|---|---|
| `schools-create` | POST | Super-admin creates school | `has_role(admin)` | school fields | school row | 30/min |
| `school-update` | POST | School admin edits own school | school_admin | partial | school row | 60/min |
| `school-import-csv` | POST | Bulk users | school_admin | csv text + role | report | 5/min |
| `school-invite` | POST | Email invite | school_admin/teacher | email,role,class? | invite | 60/min |
| `school-ingest-document` | POST | Parse+embed | teacher | resource_id | doc status | 30/min |
| `school-search` | POST | RAG | member | query, class_id? | chunks[] | 120/min |
| `school-quota-check` | POST | (internal) | service | school_id,bucket | allowed/used | n/a |
| `school-analytics` | POST | Aggregated stats | admin/teacher | scope,date_range | metrics | 60/min |

All other features reuse existing tables via PostgREST + RLS (no new HTTP endpoint needed for CRUD).

---

## 15. Migration plan (8 phases, each independently rollback-able)

| Phase | Scope | Risk | Rollback |
|---|---|---|---|
| **P1 — Schema foundation** | Add enum values, `is_school_member`, schools, school_memberships, school_audit_logs, soft-delete cols on new tables only. **No changes to existing tables yet.** | Low | `drop table … cascade`; enum values are additive and can be left in place. |
| **P2 — Role system** | Add `school_id` to `user_roles`, expose `current_school_ids()`. Update admin Roles screen. Existing roles unaffected (NULL `school_id`). | Low | Drop column. |
| **P3 — School onboarding** | Super-admin Schools module + school admin portal scaffolding (Users, Academic, Invites). CSV import + magic-link invites. | Med | Remove route + module; data dropped via cascade. |
| **P4 — Teacher tools** | Resources, assignments, quizzes, announcements, timetable + storage bucket + RLS. Teacher UI. | Med | Bucket retained for forensic export, tables truncated, UI hidden behind feature flag. |
| **P5 — Student experience** | School tab inside learner app + homework submission + quiz attempts + announcements feed. | Med | Hide tab via feature flag; tables remain. |
| **P6 — AI knowledge** | `school_ai_documents/chunks`, ingest pipeline, `school-search`, extend StudyMode AI fns to accept `school_id`. | High | Disable extension via env flag in fns; vectors retained but unused. |
| **P7 — Analytics** | Add `school_id` rollups, school analytics screens, quotas. | Low | Drop views; analytics endpoint behind flag. |
| **P8 — Production rollout** | Lift feature flag for paying schools, contract-state checks, billing wiring. | Low | Flip flag off. |

A single env flag `FEATURE_SCHOOLS=on` gates the new UI everywhere; existing public users never see it when off.

---

## 16. UI/UX (high-level)

- **Mobile-first** — every new surface uses the project's existing pill-nav pattern; school-admin desktop uses the existing `/admin` layout to inherit theme.
- **Navigation hooks** — add detection in `LearnerApp` and `TutorApp`: if `current_school_ids().length > 0`, render a "School" entry. Otherwise render nothing.
- **Theming** — schools optionally override accent colour with `schools.brand_color`.
- **Wireframe summary** — Teacher class detail = upper question/announcement composer, middle materials list (cards), bottom student grid; Student "Today" = three cards (Due today, Announcements, Suggested AI tasks); Super-admin school detail = KPI strip + tabs.

---

## 17. Risks & mitigations

| Risk | Mitigation |
|---|---|
| RLS regression leaks tenant data | Every new policy ships with a Deno test that runs as user A and asserts denial for school B rows. |
| AI prompts accidentally include cross-school chunks | `school-search` always called with `school_id` from JWT, never from client body. |
| `app_role` enum growth breaks `has_role` callers | Add values at the end; legacy `has_role(uid,'admin')` keeps working. |
| Storage cost from teacher videos | Per-school storage quota enforced by `school-quota-check`; reject uploads above cap. |
| Existing 80 tables make migration noisy | Phase 1 is purely additive — no ALTER on existing tables until P2 (only `user_roles`). |
| `notifications` triggers fire on every assignment for large classes | Use `INSERT … SELECT` batch + `pg_cron` for scheduled reminders; cap fanout per minute. |
| Schools want SSO | Out of v2; design leaves room for Supabase Auth SAML later — memberships keyed by `auth.uid()` regardless. |

---

## 18. Out of scope for v2

SAIL school integration, USSD/SMS school flows, parent/guardian portal, custom domains per school, SCIM provisioning, SSO/SAML, billing automation (manual invoicing until P8).

---

## 19. Final deliverables map (per the original brief)

- Architecture assessment → §1, §2
- Existing system map → §1
- Gap analysis → §1.8
- Multi-tenant architecture → §3
- Database schema + ERD → §5
- Supabase design + RLS → §6
- API design → §14
- Navigation maps → §9–§12, §16
- User flows → §10–§12
- AI architecture → §7
- Migration plan → §15
- Risk analysis → §17
- Implementation roadmap → §15 + §18

Ready to start with **Phase 1 (schema foundation)** on approval — that single migration is small, fully reversible, and unlocks everything else.
