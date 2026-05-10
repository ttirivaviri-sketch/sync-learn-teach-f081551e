# Personalization, Weekly Insights & Security Hardening

## 1. Fix personalization (root cause)

Tutors, books, past papers, and clips don't show because the matchers do **exact-equality** on grade strings. Real data uses ranges like `"Grade 10-12"`, `"Form 3-4"`, `"Grade 10-12 / Form 3-6"`, and tutors store levels like `"Senior High"` or `"O-Level"`. Curriculum strings are also inconsistent (`"Cambridge"` vs `"CAMB"` vs `"IGCSE"` — IGCSE is a Cambridge level, not curriculum).

### 1a. New shared matcher `src/lib/personalization.ts`

A single source of truth used by both library + tutor hooks:
- `expandGradeTokens(raw: string): string[]` — parses any string into a normalized set of grade tokens. Handles:
  - Numeric ranges: `"Grade 10-12"` → `[grade 10, grade 11, grade 12]`, `"Form 3-4"` → `[form 3, form 4]`.
  - Combined: `"Grade 10-12 / Form 3-6"` split on `/`, `•`, `·`, `,`, `&`.
  - Cross-system synonyms: Form 4 ↔ Grade 10/11 ↔ O-Level ↔ IGCSE; Form 5/6 ↔ Grade 11/12 ↔ A-Level; Senior High = Grade 10-12 + Form 4-6.
  - Bands: `"Senior High"`, `"Junior High"`, `"All Grades"` (matches anything).
- `gradeMatches(resourceGrades: string[], learnerGrade: string): boolean` — true if any expanded resource token intersects expanded learner token.
- `curriculumMatches(...)` — keep existing synonyms but treat IGCSE/O-Level/A-Level as **Cambridge curriculum levels**, not separate curricula.
- `subjectMatches(...)` — case-insensitive trim + canonicalisation (strip parenthetical qualifiers, e.g. `"Mathematics (Pure)"` → `"mathematics"`), reuse existing `subject_canonical_name` SQL helper logic in TS.

### 1b. Replace matchers in:
- `src/hooks/useLibraryResources.ts` (clips, books, past papers)
- `src/hooks/useTutorData.ts` (tutor list filter — replace ad-hoc `gradeSynonyms` map)

### 1c. Fix tutor visibility specifically
- A tutor with `tutor_subjects.level = "Grade 10-12"` will now match a learner on Grade 10, 11, or 12.
- Match is OR across the tutor's subjects (a tutor offering Maths Grade 10-12 + English Grade 8-9 is visible to any Grade 10 maths learner).

### 1d. Library tagging tolerance
- When a resource has no `curriculum` tag, don't auto-fail; treat as "any curriculum" (so cross-curriculum content like NSC + CAMB shows for both). Same when grade is `"All Grades"` / null.
- This satisfies "content that covers more than one curriculum and grade — students don't see their own version".

---

## 2. Weekly auto-scheduled insights

### 2a. Determine "best day"
Add column on `academic_profiles`: `weekly_report_dow smallint` (0–6, default 0 = Sunday). Day picked automatically as the day with the **lowest historical study activity** (so the report lands when the student is least active and parents have time to read). Computed weekly by the cron job from the last 30 days of `study_activity`; falls back to Sunday.

### 2b. Database
Migration:
- New table `scheduled_insight_runs(user_id, week_start, sent_to_guardian bool, sent_to_tutors uuid[], status, created_at)` to dedupe.
- Add `weekly_report_dow` column to `academic_profiles`.
- Enable `pg_cron` + `pg_net` and schedule daily call to a new edge function.

### 2c. Edge function `weekly-insights-dispatch`
- Runs daily at 07:00 UTC.
- For each learner whose `weekly_report_dow` matches today AND no run for current ISO week:
  1. Generate insights via existing `useStudentInsights`/`generate-student-insights` logic (server-side variant).
  2. Email guardian via `send-guardian-report` (already exists).
  3. For each **confirmed/active** booked tutor of the learner, email tutor-scoped insights via `send-progress-report` with `reply_to = student_email`.
  4. Insert `scheduled_insight_runs` row.
- Auth: `CRON_SECRET` header check.

### 2d. Manual flow stays
- `ProgressReportButton` keeps the manual send dialog.
- **Recipient list**: tutors picker is restricted to tutors with a booking row (`status in ('confirmed','completed')`) for that student — no other tutors offered, addressing "Insights should only be available to send to booked tutors".

---

## 3. Security fixes (from scan)

All **error**-level findings + key warns:

| Finding | Fix |
|---|---|
| `send_guardian_report_no_auth` | Require `Authorization: Bearer <CRON_SECRET>` header. |
| `run_migration_hardcoded_token` | Delete the function entirely (migrations now go through Lovable migration tool). |
| `admin_panel_no_auth` | Add session + `has_role('admin')` guard in `AdminLayout.tsx`; remove the bypass button in `AdminAuth.tsx`. |
| `tutor_insights_no_auth` | Verify JWT, confirm caller is the tutor in the booking before returning data. |
| `jitsi_jwt_no_auth` | Verify JWT, derive `userId/userName/userEmail` server-side, force `moderator` from booking record. |
| `parse_document_no_auth` | Verify JWT + ownership of `documentId`. |
| `study_plan_no_auth` | Verify JWT, derive `userId` from token. |
| `sail_agent_no_auth` | Require JWT (admin role) or `SAIL_SECRET` header. |
| `video_player_xss` | Replace `innerHTML` interpolation in `VideoEmbedPlayer.tsx` with safe DOM construction. |
| `profiles_tutor_email_public_exposure` | Drop public tutor select policy; create `public.tutors_public` view (`security_invoker=on`) excluding `email`/`phone`; update `useTutorData` to read the view (auth users keep email). |
| `subject_exams_public_exposure` | Replace SELECT policy USING `true` with `auth.uid() = user_id`. |
| `learner_subjects_public_exposure` | Same fix. |
| `subject_xp_authenticated_mass_exposure` | Restrict SELECT to own row; leaderboards already use `SECURITY DEFINER` RPCs. |
| `academic_profiles_realtime_email_leak` | Remove `academic_profiles` from the realtime publication. |
| `tutor_documents_bucket_no_update_delete` | Add storage UPDATE/DELETE policies scoped to owner folder. |
| `realtime_messages_no_channel_authorization` | Add RLS policy on `realtime.messages` requiring `auth.uid()` matches topic owner. |

A new secret `CRON_SECRET` will be requested before deploying the cron + guardian endpoints.

---

## 4. Order of execution

1. DB migration (matcher column, run-tracking table, RLS fixes, view, realtime publication change).
2. Add `CRON_SECRET` secret.
3. Edge function lockdowns + new `weekly-insights-dispatch` + cron schedule.
4. New `src/lib/personalization.ts` + replace matchers in library/tutor hooks.
5. Restrict manual progress-report recipient list to booked tutors.
6. UI fixes: admin guard, video player XSS.

## Technical notes

- `gradeMatches` complexity is bounded (resources × ~6 tokens) — fine for current dataset.
- Weekly cron uses `net.http_post` against the edge function URL with `CRON_SECRET` header.
- View `tutors_public` exposes: `id, full_name, avatar_url, bio, online_status, last_seen, location_lat, location_lng`. `email`/`phone` only via authenticated direct table access (RLS: own row OR confirmed booking with caller).
