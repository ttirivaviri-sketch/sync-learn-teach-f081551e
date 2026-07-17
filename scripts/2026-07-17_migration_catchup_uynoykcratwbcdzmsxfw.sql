-- ============================================================================
-- StudySync — Migration Catch-Up & History Repair
-- Supabase project: uynoykcratwbcdzmsxfw
-- Generated: 2026-07-17
--
-- WHY THIS EXISTS
--   The Supabase migration history (supabase_migrations.schema_migrations)
--   for this project stops at version 20260704070721 (July 4). Migrations
--   after that date were applied manually via the SQL editor, which does
--   NOT record history rows. This script:
--     1. Idempotently (re)applies all 10 repo migrations newer than
--        20260704070721, in timestamp order.
--     2. Inserts the matching version rows into
--        supabase_migrations.schema_migrations so `supabase db push` /
--        `supabase migration list` are back in sync with the repo.
--     3. Runs verification queries at the end.
--
-- HOW TO RUN
--   Paste the whole file into the Supabase SQL editor and run it once.
--   Every statement is idempotent (guarded DROP ... IF EXISTS,
--   CREATE OR REPLACE, ON CONFLICT DO NOTHING, catalog-driven DO blocks),
--   so re-running after a partial failure or timeout is safe.
--   If the SQL editor times out, split at the "=== MIGRATION:" banners and
--   run the chunks in order.
--
-- EXPECTED NOTICES
--   The 20260717093000 section prints RAISE NOTICE counters (policies
--   wrapped / duplicates dropped / FK indexes created). On a database where
--   these migrations already ran, those counters will typically be 0.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Pre-flight guard: 20260712120000 creates policy "staff read own school"
-- without a same-name DROP IF EXISTS, which would fail on re-run. Guard it.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "staff read own school" ON public.schools;


-- ============================================================================
-- === MIGRATION: 20260712120000 (student_scope_school_rls)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Student-scope My School data access (UI spec §15-17 flag-back)
--
-- Problem: the "members read own school" policy on public.schools let every
-- active member — including school_student — read ALL columns: contact
-- person/email/phone, seat counts, AI/storage quotas, and contract dates.
-- The UI hides billing from students, but nothing stopped a student from
-- querying the table directly.
--
-- Fix:
--   1. public.school_member_directory — a view exposing only identity-safe
--      columns (name, logo, brand color, status, plan label, etc.). It runs
--      with definer rights (security_invoker = false) and re-checks active
--      membership itself, so any active member — student included — can read
--      their own school's public identity but nothing commercial.
--   2. The base-table member read policy is tightened to school_admin and
--      school_teacher only. Students no longer read public.schools directly.
--   3. Platform super-admin and school-admin management policies unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Member-safe directory view (definer rights; membership re-checked inline)
CREATE OR REPLACE VIEW public.school_member_directory AS
SELECT
  s.id,
  s.name,
  s.slug,
  s.logo_url,
  s.brand_color,
  s.country,
  s.school_type,
  s.status,
  s.plan,
  s.created_at
FROM public.schools s
WHERE s.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.school_memberships m
    WHERE m.school_id = s.id
      AND m.user_id   = auth.uid()
      AND m.status    = 'active'
  );

-- Views default to definer rights; make it explicit for future readers.
ALTER VIEW public.school_member_directory SET (security_invoker = false);

REVOKE ALL ON public.school_member_directory FROM PUBLIC, anon;
GRANT SELECT ON public.school_member_directory TO authenticated, service_role;

COMMENT ON VIEW public.school_member_directory IS
  'Identity-safe school columns readable by any ACTIVE member (incl. students). '
  'Excludes contact details, seats, quotas, contract dates and metadata — those '
  'stay on public.schools, readable only by school_admin/school_teacher/platform admin.';

-- 2) Tighten base-table read: staff only (students use the view above)
DROP POLICY IF EXISTS "members read own school" ON public.schools;
CREATE POLICY "staff read own school" ON public.schools
  FOR SELECT TO authenticated
  USING (
    public.is_school_member(id, 'school_admin')
    OR public.is_school_member(id, 'school_teacher')
  );

-- (unchanged, restated for clarity after the drop above:)
--   "super admins manage schools"      — platform admins, FOR ALL
--   "school admins update own school"  — school_admin, FOR UPDATE


-- ============================================================================
-- === MIGRATION: 20260713190000 (fix_library_resource_links)
-- ============================================================================

-- Fix broken / improperly-registered seeded library resources.
-- Every replacement URL below was verified live (HTTP 200/206, or YouTube oEmbed OK)
-- before being written here.
--
-- Bug classes fixed:
--   A. OpenStax renamed several PDFs on their CDN — old asset URLs now return 403.
--   B. Two archive.org past-paper URLs had filename typos ("P 1" vs "P1", "By" vs
--      "by") — 404.
--   C. Five seeded YouTube videos were removed/privated — oEmbed "Not Found".
--   D. Siyavula / CK-12 thumbnail URLs are hotlink-protected (403/404) so cards
--      rendered broken covers; University Physics Vol 1 pointed at the wrong cover.
--
-- The library_resource_classify trigger keeps kind/video_url/pdf_url consistent
-- on every UPDATE below.

-- ── A. OpenStax PDF renames (403 → live) ──────────────────────────────────
UPDATE public.library_system_resources SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/Biology-2e_-_WEB.pdf'
WHERE pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/Biology2e-WEB.pdf';

UPDATE public.library_system_resources SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/Concepts-Biology_-_WEB.pdf'
WHERE pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/ConceptsofBiology-WEB.pdf';

UPDATE public.library_system_resources SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/Psychology2e_WEB.pdf'
WHERE pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/psychology-2e_-_WEB.pdf';

UPDATE public.library_system_resources SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/World_History_Volume_1-WEB.pdf'
WHERE pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/world-history-volume-1-to-1500_-_WEB.pdf';

UPDATE public.library_system_resources SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/WritingGuide-WEB.pdf'
WHERE pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/writing-guide-with-handbook_-_WEB.pdf';

UPDATE public.library_system_resources SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/US_History_-_WEB.pdf'
WHERE pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/us-history_-_WEB.pdf';

-- ── B. archive.org filename typos (404 → live) ────────────────────────────
UPDATE public.library_system_resources
SET pdf_url = 'https://archive.org/download/IGCSEOLevelComputerP1WorkbookByInqilabPatel/IGCSE%20O%20Level%20Computer%20P1%20Workbook%20by%20Inqilab%20Patel.pdf'
WHERE pdf_url = 'https://archive.org/download/IGCSEOLevelComputerP1WorkbookByInqilabPatel/IGCSE%20O%20Level%20Computer%20P%201%20Workbook%20By%20Inqilab%20Patel.pdf';

UPDATE public.library_system_resources
SET pdf_url = 'https://archive.org/download/IGCSEOLevelComputerP2WorkbookByInqilabPatel/IGCSE%20O%20Level%20Computer%20P2%20Workbook%20by%20Inqilab%20Patel.pdf'
WHERE pdf_url = 'https://archive.org/download/IGCSEOLevelComputerP2WorkbookByInqilabPatel/IGCSE%20O%20Level%20Computer%20P%202%20Workbook%20By%20Inqilab%20Patel.pdf';

-- ── C. Removed YouTube videos (oEmbed "Not Found" → verified live) ────────
-- These were originally seeded into pdf_url with kind='video' and later moved
-- to video_url by the classify backfill — match either column to be safe.

-- Romeo and Juliet → CrashCourse Literature #2 (the real episode)
UPDATE public.library_system_resources
SET video_url = 'https://www.youtube.com/watch?v=I4kz-C7GryY',
    pdf_url = NULL,
    thumbnail_url = 'https://i.ytimg.com/vi/I4kz-C7GryY/hqdefault.jpg'
WHERE video_url LIKE '%Y2H3DXyTSlA%' OR pdf_url LIKE '%Y2H3DXyTSlA%';

-- Supply and Demand → CrashCourse Economics #4 (correct ID)
UPDATE public.library_system_resources
SET video_url = 'https://www.youtube.com/watch?v=g9aDizJpd_s',
    pdf_url = NULL,
    thumbnail_url = 'https://i.ytimg.com/vi/g9aDizJpd_s/hqdefault.jpg'
WHERE video_url LIKE '%g9aDayNGVfs%' OR pdf_url LIKE '%g9aDayNGVfs%';

-- Plate Tectonics → CrashCourse Geography #19 "The Plate Tectonics Revolution"
UPDATE public.library_system_resources
SET video_url = 'https://www.youtube.com/watch?v=7CPv0NSIG2M',
    pdf_url = NULL,
    thumbnail_url = 'https://i.ytimg.com/vi/7CPv0NSIG2M/hqdefault.jpg'
WHERE video_url LIKE '%RA2-Vc4PIeo%' OR pdf_url LIKE '%RA2-Vc4PIeo%';

-- Climate and Weather → Crash Course Kids "Weather vs. Climate"
UPDATE public.library_system_resources
SET video_url = 'https://www.youtube.com/watch?v=YbAWny7FV3w',
    pdf_url = NULL,
    thumbnail_url = 'https://i.ytimg.com/vi/YbAWny7FV3w/hqdefault.jpg'
WHERE video_url LIKE '%K0-ENXofxJI%' OR pdf_url LIKE '%K0-ENXofxJI%';

-- "How to Take Smart Notes" → CrashCourse Study Skills #1 "Taking Notes"
UPDATE public.library_system_resources
SET title = 'CrashCourse — Taking Notes (Study Skills #1)',
    video_url = 'https://www.youtube.com/watch?v=E7CwqNHn_Ns',
    pdf_url = NULL,
    thumbnail_url = 'https://i.ytimg.com/vi/E7CwqNHn_Ns/hqdefault.jpg'
WHERE video_url LIKE '%BUgMl_a4FlA%' OR pdf_url LIKE '%BUgMl_a4FlA%';

-- ── D. Broken thumbnails ──────────────────────────────────────────────────
-- Siyavula covers are behind auth (403); CK-12 covers were deleted (404).
-- Replace with reliable placeholder covers matching the original colour scheme.
UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/1a3fc4/ffffff?text=Siyavula%0AMaths%0AGrade+10'
WHERE thumbnail_url = 'https://intl.siyavula.com/read/_static/img/grade10/za-maths-cover.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/7c3aed/ffffff?text=Siyavula%0AMaths+Lit%0AGrade+10'
WHERE thumbnail_url = 'https://intl.siyavula.com/read/_static/img/grade10/za-maths-lit-cover.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/0f766e/ffffff?text=Siyavula%0APhys+Sci%0AGrade+10'
WHERE thumbnail_url = 'https://intl.siyavula.com/read/_static/img/grade10/za-physci-cover.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/15803d/ffffff?text=Siyavula%0ALife+Sci%0AGrade+10'
WHERE thumbnail_url = 'https://intl.siyavula.com/read/_static/img/grade10/za-lifesci-cover.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/1a3fc4/ffffff?text=CK-12%0AAlgebra+I'
WHERE thumbnail_url = 'https://www.ck12.org/flx/show/cover/book/5d574a6e8e0e08762a14fef9.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/1a3fc4/ffffff?text=CK-12%0AGeometry'
WHERE thumbnail_url = 'https://www.ck12.org/flx/show/cover/book/5d574a808e0e08762a14ff2c.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/0f766e/ffffff?text=CK-12%0APhysical%0AScience'
WHERE thumbnail_url = 'https://www.ck12.org/flx/show/cover/book/5d574a988e0e08762a14ff96.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/15803d/ffffff?text=CK-12%0ALife%0AScience'
WHERE thumbnail_url = 'https://www.ck12.org/flx/show/cover/book/5d574a8b8e0e08762a14ff5d.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/1a3fc4/ffffff?text=CK-12%0AMiddle+School%0AMath'
WHERE thumbnail_url = 'https://www.ck12.org/flx/show/cover/book/5d574a778e0e08762a14ff0d.png';

-- University Physics Volume 1 was seeded with the College Physics cover — use its own.
UPDATE public.library_system_resources
SET thumbnail_url = 'https://openstax.org/exports/cnx/university-physics-volume-1/cover.png'
WHERE title = 'University Physics Volume 1 (OpenStax)'
  AND thumbnail_url = 'https://openstax.org/exports/cnx/college-physics-2e/cover.png';


-- ============================================================================
-- === MIGRATION: 20260714090000 (learning_os_foundations)
-- ============================================================================

-- ═════════════════════════════════════════════════════════════════════════════
-- Learning Operating System foundations — tables, views, RPCs, RLS.
--
-- The LOS client layer (src/integrations/supabase/learning-os-types.ts and
-- src/studymode/lib/learningOps.ts) ships a hand-typed contract for these
-- objects, but the migrations that created them were never committed to the
-- repo. This migration materializes the full contract:
--   • 14 tables   (workspaces, memberships, cohorts, invitations, catalog,
--                  ledger, interventions, automation, ingestion, DAG, plans)
--   • 4 views     (concept trends, intervention outcomes, projected risk,
--                  class at-risk)
--   • 9 RPCs      (invite tokens, ingestion promotion, sweeps, rollups,
--                  DAG materialization, routing, optimizer)
-- Everything is guarded with IF NOT EXISTS so it is safe on databases where
-- part of the surface may already exist.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 1. Workspaces ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.learning_workspaces (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  uuid NOT NULL,
  name           text NOT NULL,
  slug           text NOT NULL UNIQUE,
  workspace_type text NOT NULL DEFAULT 'school'
    CHECK (workspace_type IN ('school','tutoring_org','family','personal')),
  school_name    text,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_workspace_memberships (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.learning_workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  role         text NOT NULL DEFAULT 'student'
    CHECK (role IN ('owner','admin','teacher','tutor','student','guardian')),
  status       text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','invited','suspended')),
  campus       text,
  grade_level  text,
  cohort_name  text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.learning_workspace_cohorts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.learning_workspaces(id) ON DELETE CASCADE,
  name          text NOT NULL,
  curriculum    text,
  grade_level   text,
  subject_names text[] NOT NULL DEFAULT '{}',
  lead_user_id  uuid,
  is_active     boolean NOT NULL DEFAULT true,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_workspace_member_cohorts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.learning_workspaces(id) ON DELETE CASCADE,
  cohort_id     uuid NOT NULL REFERENCES public.learning_workspace_cohorts(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.learning_workspace_memberships(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.learning_workspace_invitations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES public.learning_workspaces(id) ON DELETE CASCADE,
  invited_by_user_id  uuid NOT NULL,
  email               text NOT NULL,
  role                text NOT NULL DEFAULT 'student'
    CHECK (role IN ('owner','admin','teacher','tutor','student','guardian')),
  status              text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','accepted','revoked','expired')),
  cohort_ids          uuid[] NOT NULL DEFAULT '{}',
  invite_note         text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  token               text,
  token_hash          text,
  accepted_at         timestamptz,
  accepted_by_user_id uuid,
  expires_at          timestamptz
);

-- ─── 2. Concept catalog + mastery ledger ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.learning_concept_catalog (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id         uuid,
  curriculum         text NOT NULL,
  subject_name       text NOT NULL,
  topic_name         text NOT NULL,
  subtopic_name      text,
  concept_name       text NOT NULL,
  objective_type     text NOT NULL DEFAULT 'knowledge'
    CHECK (objective_type IN ('knowledge','application','skill','assessment')),
  command_words      text[] NOT NULL DEFAULT '{}',
  prerequisites      text[] NOT NULL DEFAULT '{}',
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  source_document_id uuid,
  source_kind        text
    CHECK (source_kind IS NULL OR source_kind IN ('syllabus','past_paper','notes','manual','topic_seed')),
  ingested_at        timestamptz,
  confidence         numeric,
  UNIQUE NULLS NOT DISTINCT (curriculum, subject_name, topic_name, subtopic_name, concept_name)
);

CREATE TABLE IF NOT EXISTS public.learning_concept_mastery_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  subject_id      uuid,
  concept_id      uuid REFERENCES public.learning_concept_catalog(id) ON DELETE SET NULL,
  subject_name    text NOT NULL,
  topic_name      text NOT NULL,
  concept_name    text NOT NULL,
  evidence_type   text NOT NULL
    CHECK (evidence_type IN ('task','quiz','mock_exam','tutor_note','flashcard','recall','manual')),
  evidence_source text,
  score_delta     numeric NOT NULL DEFAULT 0,
  confidence      numeric NOT NULL DEFAULT 0.5,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lcml_user_recorded
  ON public.learning_concept_mastery_ledger (user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_lcml_user_subject
  ON public.learning_concept_mastery_ledger (user_id, subject_name);

-- ─── 3. Intervention queue + events ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.learning_intervention_queue (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL,
  workspace_id        uuid REFERENCES public.learning_workspaces(id) ON DELETE CASCADE,
  subject_id          uuid,
  intervention_type   text NOT NULL
    CHECK (intervention_type IN ('concept-reteach','guided-practice','prerequisite-repair','exam-sprint','consistency-recovery','tutor-escalation','guardian-alert')),
  priority            text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  status              text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  reason              text NOT NULL,
  recommended_action  text NOT NULL,
  supporting_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  due_at              timestamptz,
  resolved_at         timestamptz,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  assigned_to_user_id uuid,
  assigned_role       text
    CHECK (assigned_role IS NULL OR assigned_role IN ('owner','admin','teacher','tutor','student','guardian')),
  acknowledged_at     timestamptz,
  action_note         text,
  last_action_at      timestamptz,
  resolved_by_user_id uuid
);

CREATE INDEX IF NOT EXISTS idx_liq_user_status
  ON public.learning_intervention_queue (user_id, status);
CREATE INDEX IF NOT EXISTS idx_liq_workspace_status
  ON public.learning_intervention_queue (workspace_id, status);

CREATE TABLE IF NOT EXISTS public.learning_intervention_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.learning_intervention_queue(id) ON DELETE CASCADE,
  actor_user_id   uuid NOT NULL,
  action_type     text NOT NULL
    CHECK (action_type IN ('created','acknowledged','resolved','dismissed','reassigned','noted')),
  note            text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── 4. Automation runs + schedule ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.learning_ops_automation_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name       text NOT NULL,
  status         text NOT NULL DEFAULT 'started'
    CHECK (status IN ('started','succeeded','failed','partial')),
  rows_processed integer NOT NULL DEFAULT 0,
  details        jsonb NOT NULL DEFAULT '{}'::jsonb,
  workspace_id   uuid REFERENCES public.learning_workspaces(id) ON DELETE CASCADE,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  error_message  text
);

CREATE TABLE IF NOT EXISTS public.learning_ops_automation_schedule (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.learning_workspaces(id) ON DELETE CASCADE,
  job_name     text NOT NULL
    CHECK (job_name IN ('nightly_intervention_sweep','weekly_cohort_rollup','guardian_digest','concept_ingestion','study_plan_optimizer','route_interventions_to_teachers')),
  cadence      text NOT NULL DEFAULT 'daily' CHECK (cadence IN ('daily','weekly','manual')),
  enabled      boolean NOT NULL DEFAULT true,
  last_run_at  timestamptz,
  last_status  text CHECK (last_status IS NULL OR last_status IN ('succeeded','failed','partial')),
  last_error   text,
  next_run_at  timestamptz,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (workspace_id, job_name)
);

-- ─── 5. Concept ingestion staging + prerequisite DAG + plan proposals ────────

CREATE TABLE IF NOT EXISTS public.learning_concept_ingestion_staging (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid REFERENCES public.learning_workspaces(id) ON DELETE CASCADE,
  submitted_by_user_id  uuid,
  source_document_id    uuid,
  source_kind           text NOT NULL
    CHECK (source_kind IN ('syllabus','past_paper','notes','manual','topic_seed')),
  curriculum            text NOT NULL,
  subject_id            uuid,
  subject_name          text NOT NULL,
  topic_name            text NOT NULL,
  concept_name          text NOT NULL,
  subtopic_name         text,
  objective_type        text NOT NULL DEFAULT 'knowledge',
  command_words         text[] NOT NULL DEFAULT '{}',
  prerequisites         text[] NOT NULL DEFAULT '{}',
  confidence            numeric NOT NULL DEFAULT 0.6,
  status                text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','promoted')),
  review_note           text,
  reviewed_by_user_id   uuid,
  reviewed_at           timestamptz,
  promoted_catalog_id   uuid REFERENCES public.learning_concept_catalog(id) ON DELETE SET NULL,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_concept_prerequisite_edges (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id               uuid NOT NULL REFERENCES public.learning_concept_catalog(id) ON DELETE CASCADE,
  prerequisite_concept_id  uuid NOT NULL REFERENCES public.learning_concept_catalog(id) ON DELETE CASCADE,
  weight                   numeric NOT NULL DEFAULT 1,
  source_kind              text
    CHECK (source_kind IS NULL OR source_kind IN ('manual','ingested','inferred','template')),
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (concept_id, prerequisite_concept_id),
  CHECK (concept_id <> prerequisite_concept_id)
);

CREATE TABLE IF NOT EXISTS public.learning_ops_plan_proposals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL,
  workspace_id        uuid REFERENCES public.learning_workspaces(id) ON DELETE CASCADE,
  subject_id          uuid,
  subject_name        text NOT NULL,
  topic_name          text NOT NULL,
  proposed_for        date NOT NULL,
  duration_minutes    integer NOT NULL DEFAULT 30,
  reason              text NOT NULL DEFAULT '',
  projected_risk      numeric,
  status              text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','accepted','dismissed','applied')),
  applied_schedule_id uuid,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lopp_user_status
  ON public.learning_ops_plan_proposals (user_id, status, proposed_for);

-- ─── 6. updated_at triggers ──────────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'learning_workspaces','learning_workspace_memberships','learning_workspace_cohorts',
    'learning_workspace_member_cohorts','learning_workspace_invitations',
    'learning_concept_catalog','learning_intervention_queue',
    'learning_ops_automation_schedule','learning_concept_ingestion_staging',
    'learning_concept_prerequisite_edges','learning_ops_plan_proposals'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON public.%I;
       CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
      t, t
    );
  END LOOP;
END $$;

-- ─── 7. Helper: staff check (SECURITY DEFINER avoids RLS recursion) ──────────

CREATE OR REPLACE FUNCTION public.is_los_workspace_staff(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.learning_workspace_memberships m
    WHERE m.workspace_id = _workspace_id
      AND m.user_id = _user_id
      AND m.status = 'active'
      AND m.role IN ('owner','admin','teacher','tutor')
  ) OR EXISTS (
    SELECT 1 FROM public.learning_workspaces w
    WHERE w.id = _workspace_id AND w.owner_user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_los_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.learning_workspace_memberships m
    WHERE m.workspace_id = _workspace_id
      AND m.user_id = _user_id
      AND m.status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.learning_workspaces w
    WHERE w.id = _workspace_id AND w.owner_user_id = _user_id
  );
$$;

-- ─── 8. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.learning_workspaces                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_workspace_memberships       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_workspace_cohorts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_workspace_member_cohorts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_workspace_invitations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_concept_catalog             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_concept_mastery_ledger      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_intervention_queue          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_intervention_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_ops_automation_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_ops_automation_schedule     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_concept_ingestion_staging   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_concept_prerequisite_edges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_ops_plan_proposals          ENABLE ROW LEVEL SECURITY;

-- Workspaces: members read; owners insert/update.
DROP POLICY IF EXISTS los_ws_select ON public.learning_workspaces;
CREATE POLICY los_ws_select ON public.learning_workspaces FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_los_workspace_member(id, auth.uid()));
DROP POLICY IF EXISTS los_ws_insert ON public.learning_workspaces;
CREATE POLICY los_ws_insert ON public.learning_workspaces FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());
DROP POLICY IF EXISTS los_ws_update ON public.learning_workspaces;
CREATE POLICY los_ws_update ON public.learning_workspaces FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_los_workspace_staff(id, auth.uid()));

-- Memberships: own row or workspace member reads; staff manage.
DROP POLICY IF EXISTS los_wm_select ON public.learning_workspace_memberships;
CREATE POLICY los_wm_select ON public.learning_workspace_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_los_workspace_member(workspace_id, auth.uid()));
DROP POLICY IF EXISTS los_wm_insert ON public.learning_workspace_memberships;
CREATE POLICY los_wm_insert ON public.learning_workspace_memberships FOR INSERT TO authenticated
  WITH CHECK (
    public.is_los_workspace_staff(workspace_id, auth.uid())
    OR (user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.learning_workspaces w
      WHERE w.id = workspace_id AND w.owner_user_id = auth.uid()))
  );
DROP POLICY IF EXISTS los_wm_update ON public.learning_workspace_memberships;
CREATE POLICY los_wm_update ON public.learning_workspace_memberships FOR UPDATE TO authenticated
  USING (public.is_los_workspace_staff(workspace_id, auth.uid()));

-- Cohorts: members read; staff manage.
DROP POLICY IF EXISTS los_wc_select ON public.learning_workspace_cohorts;
CREATE POLICY los_wc_select ON public.learning_workspace_cohorts FOR SELECT TO authenticated
  USING (public.is_los_workspace_member(workspace_id, auth.uid()));
DROP POLICY IF EXISTS los_wc_write ON public.learning_workspace_cohorts;
CREATE POLICY los_wc_write ON public.learning_workspace_cohorts FOR ALL TO authenticated
  USING (public.is_los_workspace_staff(workspace_id, auth.uid()))
  WITH CHECK (public.is_los_workspace_staff(workspace_id, auth.uid()));

-- Member↔cohort links: own row or member reads; staff manage.
DROP POLICY IF EXISTS los_wmc_select ON public.learning_workspace_member_cohorts;
CREATE POLICY los_wmc_select ON public.learning_workspace_member_cohorts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_los_workspace_member(workspace_id, auth.uid()));
DROP POLICY IF EXISTS los_wmc_write ON public.learning_workspace_member_cohorts;
CREATE POLICY los_wmc_write ON public.learning_workspace_member_cohorts FOR ALL TO authenticated
  USING (public.is_los_workspace_staff(workspace_id, auth.uid()))
  WITH CHECK (public.is_los_workspace_staff(workspace_id, auth.uid()));

-- Invitations: staff manage/read.
DROP POLICY IF EXISTS los_wi_all ON public.learning_workspace_invitations;
CREATE POLICY los_wi_all ON public.learning_workspace_invitations FOR ALL TO authenticated
  USING (public.is_los_workspace_staff(workspace_id, auth.uid()))
  WITH CHECK (public.is_los_workspace_staff(workspace_id, auth.uid()));

-- Concept catalog: any signed-in user reads; any signed-in user may seed
-- (writes are upserts keyed on the natural unique constraint).
DROP POLICY IF EXISTS los_cc_select ON public.learning_concept_catalog;
CREATE POLICY los_cc_select ON public.learning_concept_catalog FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS los_cc_write ON public.learning_concept_catalog;
CREATE POLICY los_cc_write ON public.learning_concept_catalog FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS los_cc_update ON public.learning_concept_catalog;
CREATE POLICY los_cc_update ON public.learning_concept_catalog FOR UPDATE TO authenticated USING (true);

-- Mastery ledger: own rows; workspace staff read members' rows.
DROP POLICY IF EXISTS los_ml_select ON public.learning_concept_mastery_ledger;
CREATE POLICY los_ml_select ON public.learning_concept_mastery_ledger FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.learning_workspace_memberships m
      WHERE m.user_id = learning_concept_mastery_ledger.user_id
        AND m.status = 'active'
        AND public.is_los_workspace_staff(m.workspace_id, auth.uid())
    )
  );
DROP POLICY IF EXISTS los_ml_insert ON public.learning_concept_mastery_ledger;
CREATE POLICY los_ml_insert ON public.learning_concept_mastery_ledger FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Intervention queue: own rows read/ack; workspace staff full manage.
DROP POLICY IF EXISTS los_iq_select ON public.learning_intervention_queue;
CREATE POLICY los_iq_select ON public.learning_intervention_queue FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR assigned_to_user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_los_workspace_staff(workspace_id, auth.uid()))
  );
DROP POLICY IF EXISTS los_iq_insert ON public.learning_intervention_queue;
CREATE POLICY los_iq_insert ON public.learning_intervention_queue FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_los_workspace_staff(workspace_id, auth.uid()))
  );
DROP POLICY IF EXISTS los_iq_update ON public.learning_intervention_queue;
CREATE POLICY los_iq_update ON public.learning_intervention_queue FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR assigned_to_user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_los_workspace_staff(workspace_id, auth.uid()))
  );

-- Intervention events: visible where the parent intervention is visible.
DROP POLICY IF EXISTS los_ie_select ON public.learning_intervention_events;
CREATE POLICY los_ie_select ON public.learning_intervention_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learning_intervention_queue q
    WHERE q.id = intervention_id
      AND (q.user_id = auth.uid() OR q.assigned_to_user_id = auth.uid()
           OR (q.workspace_id IS NOT NULL AND public.is_los_workspace_staff(q.workspace_id, auth.uid())))
  ));
DROP POLICY IF EXISTS los_ie_insert ON public.learning_intervention_events;
CREATE POLICY los_ie_insert ON public.learning_intervention_events FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

-- Automation runs/schedule: workspace staff; global rows visible to any staff.
DROP POLICY IF EXISTS los_ar_select ON public.learning_ops_automation_runs;
CREATE POLICY los_ar_select ON public.learning_ops_automation_runs FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR public.is_los_workspace_staff(workspace_id, auth.uid()));
DROP POLICY IF EXISTS los_as_all ON public.learning_ops_automation_schedule;
CREATE POLICY los_as_all ON public.learning_ops_automation_schedule FOR ALL TO authenticated
  USING (workspace_id IS NULL OR public.is_los_workspace_staff(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NULL OR public.is_los_workspace_staff(workspace_id, auth.uid()));

-- Ingestion staging: workspace staff.
DROP POLICY IF EXISTS los_cis_all ON public.learning_concept_ingestion_staging;
CREATE POLICY los_cis_all ON public.learning_concept_ingestion_staging FOR ALL TO authenticated
  USING (workspace_id IS NULL OR public.is_los_workspace_staff(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NULL OR public.is_los_workspace_staff(workspace_id, auth.uid()));

-- Prerequisite edges: read by all signed-in; written via RPC / staff.
DROP POLICY IF EXISTS los_pe_select ON public.learning_concept_prerequisite_edges;
CREATE POLICY los_pe_select ON public.learning_concept_prerequisite_edges FOR SELECT TO authenticated USING (true);

-- Plan proposals: own rows; workspace staff read/manage.
DROP POLICY IF EXISTS los_pp_select ON public.learning_ops_plan_proposals;
CREATE POLICY los_pp_select ON public.learning_ops_plan_proposals FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_los_workspace_staff(workspace_id, auth.uid()))
  );
DROP POLICY IF EXISTS los_pp_update ON public.learning_ops_plan_proposals;
CREATE POLICY los_pp_update ON public.learning_ops_plan_proposals FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_los_workspace_staff(workspace_id, auth.uid()))
  );

GRANT SELECT, INSERT, UPDATE ON
  public.learning_workspaces,
  public.learning_workspace_memberships,
  public.learning_workspace_cohorts,
  public.learning_workspace_member_cohorts,
  public.learning_workspace_invitations,
  public.learning_concept_catalog,
  public.learning_concept_mastery_ledger,
  public.learning_intervention_queue,
  public.learning_intervention_events,
  public.learning_ops_automation_runs,
  public.learning_ops_automation_schedule,
  public.learning_concept_ingestion_staging,
  public.learning_concept_prerequisite_edges,
  public.learning_ops_plan_proposals
TO authenticated;

GRANT ALL ON
  public.learning_workspaces,
  public.learning_workspace_memberships,
  public.learning_workspace_cohorts,
  public.learning_workspace_member_cohorts,
  public.learning_workspace_invitations,
  public.learning_concept_catalog,
  public.learning_concept_mastery_ledger,
  public.learning_intervention_queue,
  public.learning_intervention_events,
  public.learning_ops_automation_runs,
  public.learning_ops_automation_schedule,
  public.learning_concept_ingestion_staging,
  public.learning_concept_prerequisite_edges,
  public.learning_ops_plan_proposals
TO service_role;

-- ─── 9. Views ────────────────────────────────────────────────────────────────

-- Daily evidence trend per concept.
CREATE OR REPLACE VIEW public.learning_concept_trends
WITH (security_invoker = true) AS
SELECT
  user_id,
  subject_id,
  subject_name,
  topic_name,
  concept_name,
  date_trunc('day', recorded_at)::date AS day,
  count(*)::int                        AS evidence_count,
  avg(confidence)                      AS avg_confidence,
  sum(score_delta)                     AS total_score_delta
FROM public.learning_concept_mastery_ledger
GROUP BY user_id, subject_id, subject_name, topic_name, concept_name, date_trunc('day', recorded_at);

-- Intervention outcomes: lifecycle timing + post-intervention evidence.
CREATE OR REPLACE VIEW public.learning_intervention_outcomes
WITH (security_invoker = true) AS
SELECT
  q.id AS intervention_id,
  q.user_id,
  q.workspace_id,
  q.subject_id,
  q.intervention_type,
  q.priority,
  q.status,
  q.created_at,
  q.acknowledged_at,
  q.resolved_at,
  CASE WHEN q.resolved_at IS NOT NULL
       THEN EXTRACT(EPOCH FROM (q.resolved_at - q.created_at)) / 3600.0
  END AS hours_open,
  post.post_score_delta,
  post.post_evidence_count
FROM public.learning_intervention_queue q
LEFT JOIN LATERAL (
  SELECT sum(l.score_delta) AS post_score_delta,
         count(*)::int      AS post_evidence_count
  FROM public.learning_concept_mastery_ledger l
  WHERE l.user_id = q.user_id
    AND l.recorded_at >= q.created_at
) post ON true;

-- Per-learner projected risk from recent mastery-ledger trajectory (14 days).
CREATE OR REPLACE VIEW public.learner_projected_risk
WITH (security_invoker = true) AS
WITH recent AS (
  SELECT
    user_id,
    subject_id,
    subject_name,
    score_delta,
    confidence,
    EXTRACT(EPOCH FROM (now() - recorded_at)) / 86400.0 AS days_ago
  FROM public.learning_concept_mastery_ledger
  WHERE recorded_at >= now() - interval '14 days'
),
agg AS (
  SELECT
    user_id,
    subject_id,
    subject_name,
    avg(score_delta)                              AS recent_avg_delta,
    COALESCE(
      COVAR_SAMP(score_delta, -days_ago) / NULLIF(VAR_SAMP(-days_ago), 0),
      0
    )                                             AS slope_per_day,
    avg(confidence)                               AS avg_confidence,
    count(*)::int                                 AS total_evidence
  FROM recent
  GROUP BY user_id, subject_id, subject_name
)
SELECT
  user_id,
  subject_id,
  subject_name,
  recent_avg_delta,
  slope_per_day,
  avg_confidence,
  total_evidence,
  GREATEST(0, LEAST(1,
    0.5
    - (recent_avg_delta * 0.35)
    - (slope_per_day    * 0.25)
    + ((0.5 - avg_confidence) * 0.4)
  )) AS projected_risk
FROM agg;

-- Cohort-level at-risk rollup: open interventions + projected risk per member.
CREATE OR REPLACE VIEW public.learning_class_at_risk
WITH (security_invoker = true) AS
SELECT
  mc.workspace_id,
  mc.cohort_id,
  c.name AS cohort_name,
  mc.user_id,
  COALESCE(iq.open_count, 0)  AS open_count,
  COALESCE(iq.high_count, 0)  AS high_count,
  iq.last_alert_at,
  COALESCE(risk.max_risk, 0)  AS projected_risk
FROM public.learning_workspace_member_cohorts mc
JOIN public.learning_workspace_cohorts c ON c.id = mc.cohort_id
LEFT JOIN LATERAL (
  SELECT count(*)::int                                        AS open_count,
         count(*) FILTER (WHERE q.priority = 'high')::int     AS high_count,
         max(q.created_at)                                    AS last_alert_at
  FROM public.learning_intervention_queue q
  WHERE q.user_id = mc.user_id
    AND q.workspace_id = mc.workspace_id
    AND q.status IN ('open','acknowledged')
) iq ON true
LEFT JOIN LATERAL (
  SELECT max(r.projected_risk) AS max_risk
  FROM public.learner_projected_risk r
  WHERE r.user_id = mc.user_id
) risk ON true
WHERE mc.status = 'active';

GRANT SELECT ON
  public.learning_concept_trends,
  public.learning_intervention_outcomes,
  public.learner_projected_risk,
  public.learning_class_at_risk
TO authenticated;

-- ─── 10. RPCs ────────────────────────────────────────────────────────────────

-- 10.1 Invitation token issue + accept.
CREATE OR REPLACE FUNCTION public.generate_workspace_invite_token(p_invitation_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ws uuid;
  v_token text;
BEGIN
  SELECT workspace_id INTO v_ws FROM learning_workspace_invitations WHERE id = p_invitation_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF NOT public.is_los_workspace_staff(v_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to issue invitation tokens';
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');
  UPDATE learning_workspace_invitations
  SET token = v_token,
      token_hash = encode(digest(v_token, 'sha256'), 'hex'),
      expires_at = now() + interval '14 days',
      updated_at = now()
  WHERE id = p_invitation_id;
  RETURN v_token;
END $$;

CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(p_token text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite learning_workspace_invitations%ROWTYPE;
  v_membership_id uuid;
  v_cohort uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_invite
  FROM learning_workspace_invitations
  WHERE (token = p_token OR token_hash = encode(digest(p_token, 'sha256'), 'hex'))
    AND status = 'invited'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Invitation not found or expired'; END IF;

  INSERT INTO learning_workspace_memberships (workspace_id, user_id, role, status)
  VALUES (v_invite.workspace_id, auth.uid(), v_invite.role, 'active')
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = now()
  RETURNING id INTO v_membership_id;

  -- Attach to any cohorts named on the invitation.
  FOREACH v_cohort IN ARRAY COALESCE(v_invite.cohort_ids, '{}'::uuid[]) LOOP
    INSERT INTO learning_workspace_member_cohorts (workspace_id, cohort_id, membership_id, user_id, status)
    VALUES (v_invite.workspace_id, v_cohort, v_membership_id, auth.uid(), 'active')
    ON CONFLICT (cohort_id, user_id) DO UPDATE SET status = 'active', updated_at = now();
  END LOOP;

  UPDATE learning_workspace_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by_user_id = auth.uid(), updated_at = now()
  WHERE id = v_invite.id;

  RETURN v_invite.workspace_id;
END $$;

-- 10.2 Promote an approved staged concept into the catalog.
CREATE OR REPLACE FUNCTION public.promote_concept_ingestion(p_staging_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row learning_concept_ingestion_staging%ROWTYPE;
  v_catalog_id uuid;
BEGIN
  SELECT * INTO v_row FROM learning_concept_ingestion_staging WHERE id = p_staging_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Staged concept not found'; END IF;
  IF v_row.workspace_id IS NOT NULL AND NOT public.is_los_workspace_staff(v_row.workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to promote concepts for this workspace';
  END IF;
  IF v_row.status NOT IN ('approved','pending') THEN
    RAISE EXCEPTION 'Only pending/approved staged concepts can be promoted';
  END IF;

  INSERT INTO learning_concept_catalog (
    subject_id, curriculum, subject_name, topic_name, subtopic_name, concept_name,
    objective_type, command_words, prerequisites,
    source_document_id, source_kind, ingested_at, confidence
  ) VALUES (
    v_row.subject_id, v_row.curriculum, v_row.subject_name, v_row.topic_name,
    v_row.subtopic_name, v_row.concept_name,
    COALESCE(NULLIF(v_row.objective_type, ''), 'knowledge'),
    v_row.command_words, v_row.prerequisites,
    v_row.source_document_id, v_row.source_kind, now(), v_row.confidence
  )
  ON CONFLICT (curriculum, subject_name, topic_name, subtopic_name, concept_name)
  DO UPDATE SET
    command_words = EXCLUDED.command_words,
    prerequisites = EXCLUDED.prerequisites,
    confidence    = GREATEST(learning_concept_catalog.confidence, EXCLUDED.confidence),
    updated_at    = now()
  RETURNING id INTO v_catalog_id;

  UPDATE learning_concept_ingestion_staging
  SET status = 'promoted',
      promoted_catalog_id = v_catalog_id,
      reviewed_by_user_id = COALESCE(reviewed_by_user_id, auth.uid()),
      reviewed_at = COALESCE(reviewed_at, now()),
      updated_at = now()
  WHERE id = p_staging_id;

  RETURN v_catalog_id;
END $$;

-- 10.3 Materialize name-based prerequisites into DAG edges.
CREATE OR REPLACE FUNCTION public.materialize_concept_prerequisite_edges(p_subject_name text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  WITH ins AS (
    INSERT INTO learning_concept_prerequisite_edges (concept_id, prerequisite_concept_id, weight, source_kind)
    SELECT DISTINCT c.id, p.id, 1, 'ingested'
    FROM learning_concept_catalog c
    CROSS JOIN LATERAL unnest(c.prerequisites) AS prereq_name
    JOIN learning_concept_catalog p
      ON lower(p.concept_name) = lower(prereq_name)
     AND p.subject_name = c.subject_name
     AND p.id <> c.id
    WHERE (p_subject_name IS NULL OR c.subject_name = p_subject_name)
    ON CONFLICT (concept_id, prerequisite_concept_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;
  RETURN v_count;
END $$;

-- 10.4 Walk the DAG upstream.
CREATE OR REPLACE FUNCTION public.get_upstream_prerequisites(p_concept_id uuid, p_max_depth integer DEFAULT 3)
RETURNS TABLE (
  concept_id uuid,
  concept_name text,
  subject_name text,
  topic_name text,
  depth integer,
  weight numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE walk AS (
    SELECT e.prerequisite_concept_id AS concept_id, 1 AS depth, e.weight
    FROM learning_concept_prerequisite_edges e
    WHERE e.concept_id = p_concept_id
    UNION ALL
    SELECT e.prerequisite_concept_id, w.depth + 1, e.weight
    FROM learning_concept_prerequisite_edges e
    JOIN walk w ON e.concept_id = w.concept_id
    WHERE w.depth < LEAST(p_max_depth, 8)
  )
  SELECT DISTINCT ON (c.id)
    c.id, c.concept_name, c.subject_name, c.topic_name, w.depth, w.weight
  FROM walk w
  JOIN learning_concept_catalog c ON c.id = w.concept_id
  ORDER BY c.id, w.depth;
$$;

-- 10.5 Nightly sweep: auto-resolve stale interventions with positive follow-up
--      evidence; escalate stale high-priority items.
CREATE OR REPLACE FUNCTION public.run_nightly_intervention_sweep(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_resolved integer := 0;
  v_escalated integer := 0;
BEGIN
  -- Auto-resolve: open >3 days with net-positive evidence since creation.
  WITH candidates AS (
    SELECT q.id
    FROM learning_intervention_queue q
    WHERE q.workspace_id = p_workspace_id
      AND q.status IN ('open','acknowledged')
      AND q.created_at < now() - interval '3 days'
      AND (
        SELECT COALESCE(sum(l.score_delta), 0)
        FROM learning_concept_mastery_ledger l
        WHERE l.user_id = q.user_id AND l.recorded_at >= q.created_at
      ) > 0.5
  ),
  upd AS (
    UPDATE learning_intervention_queue q
    SET status = 'resolved', resolved_at = now(),
        action_note = COALESCE(action_note, 'Auto-resolved: positive follow-up evidence'),
        last_action_at = now(), updated_at = now()
    FROM candidates c WHERE q.id = c.id
    RETURNING q.id
  )
  SELECT count(*) INTO v_resolved FROM upd;

  -- Escalate: medium/low open >7 days become high.
  WITH esc AS (
    UPDATE learning_intervention_queue
    SET priority = 'high', last_action_at = now(), updated_at = now()
    WHERE workspace_id = p_workspace_id
      AND status = 'open'
      AND priority IN ('medium','low')
      AND created_at < now() - interval '7 days'
    RETURNING id
  )
  SELECT count(*) INTO v_escalated FROM esc;

  RETURN jsonb_build_object('auto_resolved', v_resolved, 'escalated', v_escalated);
END $$;

-- 10.6 Weekly cohort rollup: summarize interventions + mastery per cohort.
CREATE OR REPLACE FUNCTION public.run_weekly_cohort_rollup(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cohorts jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_cohorts
  FROM (
    SELECT
      c.id   AS cohort_id,
      c.name AS cohort_name,
      count(DISTINCT mc.user_id)::int AS member_count,
      COALESCE(sum(CASE WHEN q.status IN ('open','acknowledged') THEN 1 ELSE 0 END), 0)::int AS open_interventions,
      COALESCE(avg(l.score_delta), 0) AS avg_mastery_delta_7d
    FROM learning_workspace_cohorts c
    LEFT JOIN learning_workspace_member_cohorts mc
      ON mc.cohort_id = c.id AND mc.status = 'active'
    LEFT JOIN learning_intervention_queue q
      ON q.user_id = mc.user_id AND q.workspace_id = c.workspace_id
    LEFT JOIN learning_concept_mastery_ledger l
      ON l.user_id = mc.user_id AND l.recorded_at >= now() - interval '7 days'
    WHERE c.workspace_id = p_workspace_id AND c.is_active
    GROUP BY c.id, c.name
  ) r;

  RETURN jsonb_build_object('cohorts', v_cohorts, 'generated_at', now());
END $$;

-- 10.7 Route open unassigned interventions to cohort leads / teachers.
CREATE OR REPLACE FUNCTION public.route_interventions_to_teachers(p_workspace_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0;
BEGIN
  WITH target AS (
    -- Prefer the student's cohort lead; fall back to any active teacher.
    SELECT DISTINCT ON (q.id)
      q.id AS intervention_id,
      COALESCE(c.lead_user_id, t.user_id) AS teacher_id
    FROM learning_intervention_queue q
    LEFT JOIN learning_workspace_member_cohorts mc
      ON mc.user_id = q.user_id AND mc.workspace_id = q.workspace_id AND mc.status = 'active'
    LEFT JOIN learning_workspace_cohorts c ON c.id = mc.cohort_id
    LEFT JOIN LATERAL (
      SELECT m.user_id
      FROM learning_workspace_memberships m
      WHERE m.workspace_id = q.workspace_id
        AND m.status = 'active' AND m.role IN ('teacher','admin','owner')
      ORDER BY m.created_at
      LIMIT 1
    ) t ON true
    WHERE q.workspace_id = p_workspace_id
      AND q.status = 'open'
      AND q.assigned_to_user_id IS NULL
  ),
  upd AS (
    UPDATE learning_intervention_queue q
    SET assigned_to_user_id = tg.teacher_id,
        assigned_role = 'teacher',
        last_action_at = now(),
        updated_at = now()
    FROM target tg
    WHERE q.id = tg.intervention_id AND tg.teacher_id IS NOT NULL
    RETURNING q.id
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END $$;

-- 10.8 Study-plan optimizer: propose sessions for the riskiest subjects of
--      workspace members (skipping users who already have open proposals).
CREATE OR REPLACE FUNCTION public.run_study_plan_optimizer(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_created integer := 0;
BEGIN
  WITH members AS (
    SELECT m.user_id
    FROM learning_workspace_memberships m
    WHERE m.workspace_id = p_workspace_id
      AND m.status = 'active' AND m.role = 'student'
  ),
  risky AS (
    SELECT r.user_id, r.subject_id, r.subject_name, r.projected_risk
    FROM learner_projected_risk r
    JOIN members mm ON mm.user_id = r.user_id
    WHERE r.projected_risk >= 0.55
  ),
  topic_pick AS (
    SELECT DISTINCT ON (rk.user_id, rk.subject_name)
      rk.user_id, rk.subject_id, rk.subject_name, rk.projected_risk,
      l.topic_name
    FROM risky rk
    JOIN learning_concept_mastery_ledger l
      ON l.user_id = rk.user_id AND l.subject_name = rk.subject_name
    WHERE l.recorded_at >= now() - interval '14 days'
    ORDER BY rk.user_id, rk.subject_name, l.score_delta ASC
  ),
  ins AS (
    INSERT INTO learning_ops_plan_proposals
      (user_id, workspace_id, subject_id, subject_name, topic_name, proposed_for,
       duration_minutes, reason, projected_risk, status)
    SELECT
      tp.user_id, p_workspace_id, tp.subject_id, tp.subject_name, tp.topic_name,
      (now() + interval '1 day')::date,
      30,
      format('Projected risk %s%% in %s — focused session on weakest topic', round(tp.projected_risk * 100), tp.subject_name),
      tp.projected_risk,
      'proposed'
    FROM topic_pick tp
    WHERE NOT EXISTS (
      SELECT 1 FROM learning_ops_plan_proposals ex
      WHERE ex.user_id = tp.user_id
        AND ex.subject_name = tp.subject_name
        AND ex.status = 'proposed'
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_created FROM ins;

  RETURN jsonb_build_object('proposals_created', v_created, 'generated_at', now());
END $$;

GRANT EXECUTE ON FUNCTION
  public.is_los_workspace_staff(uuid, uuid),
  public.is_los_workspace_member(uuid, uuid),
  public.generate_workspace_invite_token(uuid),
  public.accept_workspace_invitation(text),
  public.promote_concept_ingestion(uuid),
  public.materialize_concept_prerequisite_edges(text),
  public.get_upstream_prerequisites(uuid, integer),
  public.run_nightly_intervention_sweep(uuid),
  public.run_weekly_cohort_rollup(uuid),
  public.route_interventions_to_teachers(uuid),
  public.run_study_plan_optimizer(uuid)
TO authenticated;


-- ============================================================================
-- === MIGRATION: 20260715080000 (learning_ops_automation_cron)
-- ============================================================================

-- ============================================================================
-- Learning OS automation cron
--
-- Wires the LOS automation runtime to pg_cron so scheduled jobs actually run
-- without manual triggering. The `run-learning-ops-automation` edge function
-- already supports cron mode: `POST {}` iterates every enabled row in
-- `learning_ops_automation_schedule` whose `next_run_at` is due and executes
-- its job (nightly_intervention_sweep, weekly_cohort_rollup, guardian_digest,
-- study_plan_optimizer, route_interventions_to_teachers).
--
-- Follows the same pattern as `weekly-insights-dispatch`
-- (20260513111030_*.sql): hourly tick + vault CRON_SECRET bearer.
-- The edge function self-gates via the schedule table (next_run_at), so an
-- hourly tick is cheap — most invocations no-op.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace any existing schedule with the same name (idempotent re-run)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'learning-ops-automation-tick') then
    perform cron.unschedule('learning-ops-automation-tick');
  end if;
end $$;

-- Hourly tick at minute 7 (offset from other jobs to spread load)
select cron.schedule(
  'learning-ops-automation-tick',
  '7 * * * *',
  $cron$
  select net.http_post(
    url := 'https://uynoykcratwbcdzmsxfw.supabase.co/functions/v1/run-learning-ops-automation',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='CRON_SECRET' limit 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- ----------------------------------------------------------------------------
-- Default schedules for existing workspaces.
--
-- The automation runtime only runs jobs that have an enabled row in
-- `learning_ops_automation_schedule`. Seed sensible defaults for every
-- workspace that has none, so LOS automation is on-by-default:
--   - nightly_intervention_sweep      daily   (next run: tonight 02:00 UTC)
--   - route_interventions_to_teachers daily   (03:00 UTC)
--   - weekly_cohort_rollup            weekly  (Sunday 04:00 UTC)
--   - study_plan_optimizer            weekly  (Sunday 05:00 UTC)
-- Workspace admins can disable or re-tune these from the Automation panel.
-- New workspaces get the same defaults via the trigger below.
-- ----------------------------------------------------------------------------

create or replace function public.seed_learning_ops_default_schedules(_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.learning_ops_automation_schedule
    (workspace_id, job_name, cadence, enabled, next_run_at, metadata)
  values
    (_workspace_id, 'nightly_intervention_sweep', 'daily',
      true, date_trunc('day', now()) + interval '1 day 2 hours', '{}'::jsonb),
    (_workspace_id, 'route_interventions_to_teachers', 'daily',
      true, date_trunc('day', now()) + interval '1 day 3 hours', '{}'::jsonb),
    (_workspace_id, 'weekly_cohort_rollup', 'weekly',
      true, date_trunc('week', now()) + interval '1 week 4 hours', '{}'::jsonb),
    (_workspace_id, 'study_plan_optimizer', 'weekly',
      true, date_trunc('week', now()) + interval '1 week 5 hours', '{}'::jsonb)
  on conflict (workspace_id, job_name) do nothing;
end;
$$;

-- Seed defaults for all existing workspaces that have no schedule rows yet
do $$
declare
  ws record;
begin
  for ws in
    select w.id
    from public.learning_workspaces w
    where not exists (
      select 1 from public.learning_ops_automation_schedule s
      where s.workspace_id = w.id
    )
  loop
    perform public.seed_learning_ops_default_schedules(ws.id);
  end loop;
end $$;

-- Auto-seed for new workspaces
create or replace function public.tg_seed_los_schedules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_learning_ops_default_schedules(new.id);
  return new;
end;
$$;

drop trigger if exists trg_seed_los_schedules on public.learning_workspaces;
create trigger trg_seed_los_schedules
  after insert on public.learning_workspaces
  for each row execute function public.tg_seed_los_schedules();


-- ============================================================================
-- === MIGRATION: 20260716090000 (homework_mastery_and_companion_feedback)
-- ============================================================================

-- ============================================================================
-- Homework → Mastery pipeline + Companion feedback loop
--
-- 1. Graded school homework now feeds the LOS concept-mastery ledger:
--    a trigger on school_homework_responses converts every AI/teacher-marked
--    response into learning_concept_mastery_ledger evidence rows (one per
--    concept tagged on the question, falling back to homework topic). This
--    connects the classic schools system to the Learning OS intervention
--    engine — homework performance now drives risk projection, nightly
--    sweeps, and study-plan optimization.
--
-- 2. companion_interactions: outcome tracking for the Study Companion.
--    Records shown / clicked / dismissed / booked events so suggestions can
--    learn from what students actually engage with.
-- ============================================================================

-- ─── 1. Homework → mastery ledger trigger ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_homework_mastery_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hw          record;
  v_question    record;
  v_subject     text;
  v_topic       text;
  v_score       numeric;
  v_marks       numeric;
  v_ratio       numeric;
  v_delta       numeric;
  v_confidence  numeric;
  v_concept     text;
  v_concepts    text[];
BEGIN
  -- Only act when a response transitions into a marked state.
  IF NEW.status NOT IN ('ai_marked', 'released') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('ai_marked', 'released')
     AND COALESCE(OLD.teacher_score, -1) = COALESCE(NEW.teacher_score, -1) THEN
    -- Already recorded and score unchanged — avoid duplicate evidence.
    RETURN NEW;
  END IF;

  SELECT h.subject_id, h.topic, h.title, s.name AS subject_name
    INTO v_hw
    FROM public.school_homework h
    LEFT JOIN public.subjects s ON s.id = h.subject_id
   WHERE h.id = NEW.homework_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT q.concepts, q.marks, q.prompt
    INTO v_question
    FROM public.school_homework_questions q
   WHERE q.id = NEW.question_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_marks := GREATEST(COALESCE(v_question.marks, 1), 1);
  -- Teacher score wins over AI score when present.
  v_score := COALESCE(NEW.teacher_score, NEW.ai_score, 0);
  v_ratio := GREATEST(0, LEAST(1, v_score / v_marks));
  -- Map 0..1 ratio to -1..+1 delta centred at 0.5.
  v_delta := round(((v_ratio - 0.5) * 2)::numeric, 3);
  v_confidence := CASE WHEN NEW.teacher_score IS NOT NULL THEN 0.85 ELSE 0.6 END;

  v_subject := COALESCE(v_hw.subject_name, 'General');
  v_topic := COALESCE(NULLIF(trim(v_hw.topic), ''), v_hw.title, 'Homework');

  v_concepts := v_question.concepts;
  IF v_concepts IS NULL OR array_length(v_concepts, 1) IS NULL THEN
    v_concepts := ARRAY[v_topic];
  END IF;

  FOREACH v_concept IN ARRAY v_concepts LOOP
    CONTINUE WHEN NULLIF(trim(v_concept), '') IS NULL;
    INSERT INTO public.learning_concept_mastery_ledger
      (user_id, subject_id, subject_name, topic_name, concept_name,
       evidence_type, evidence_source, score_delta, confidence, metadata)
    VALUES
      (NEW.student_id, v_hw.subject_id, v_subject, v_topic, trim(v_concept),
       'task', 'school_homework',
       v_delta, v_confidence,
       jsonb_build_object(
         'homework_id', NEW.homework_id,
         'question_id', NEW.question_id,
         'response_id', NEW.id,
         'score', v_score,
         'marks', v_marks,
         'graded_by', CASE WHEN NEW.teacher_score IS NOT NULL THEN 'teacher' ELSE 'ai' END
       ));
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_homework_mastery_evidence ON public.school_homework_responses;
CREATE TRIGGER trg_homework_mastery_evidence
  AFTER INSERT OR UPDATE OF status, teacher_score ON public.school_homework_responses
  FOR EACH ROW EXECUTE FUNCTION public.record_homework_mastery_evidence();

-- ─── 2. Companion interactions (feedback loop) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.companion_interactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  suggestion_id  text NOT NULL,
  suggestion_kind text NOT NULL
    CHECK (suggestion_kind IN ('resource', 'tutor', 'homework', 'encourage')),
  event          text NOT NULL
    CHECK (event IN ('shown', 'clicked', 'dismissed', 'booked')),
  topic          text,
  subject        text,
  resource_id    uuid,
  tutor_id       uuid,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companion_interactions_user
  ON public.companion_interactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companion_interactions_suggestion
  ON public.companion_interactions (user_id, suggestion_id, event);

ALTER TABLE public.companion_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companion_interactions_own_insert" ON public.companion_interactions;
CREATE POLICY "companion_interactions_own_insert"
  ON public.companion_interactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "companion_interactions_own_select" ON public.companion_interactions;
CREATE POLICY "companion_interactions_own_select"
  ON public.companion_interactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT ON public.companion_interactions TO authenticated;
GRANT ALL ON public.companion_interactions TO service_role;


-- ============================================================================
-- === MIGRATION: 20260716120000 (assessment_mastery_evidence)
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- Assessment → Mastery evidence pipeline (tier 4)
--
-- PR #70 wired school homework into learning_concept_mastery_ledger. This
-- migration closes the remaining gaps so *every* graded assessment feeds the
-- mastery model that drives run_study_plan_optimizer, MasteryIntelligenceCard
-- and guardian digests:
--
--   §1  mock_exam_attempts   → per-topic evidence on submission ('mock_exam')
--   §2  quiz_attempts        → per-concept evidence on insert     ('quiz')
--       (personal quizzes, structured daily tasks, flashcard mirrors)
--   §3  school_quiz_attempts → whole-quiz evidence on submission  ('quiz')
--
-- All functions are SECURITY DEFINER (ledger RLS is deny-by-default for
-- direct writes) and defensive: they never raise, so grading flows can't be
-- broken by evidence bookkeeping.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── §1 Mock exams → mastery ledger ─────────────────────────────────────────
-- grading_json.graded is an array of per-question results carrying
-- {topic, marks_awarded, marks_possible}. Aggregate per topic so one exam
-- yields one evidence row per topic examined.

CREATE OR REPLACE FUNCTION public.record_mock_exam_mastery_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  v_ratio numeric;
  v_delta numeric;
BEGIN
  -- Only when the attempt transitions into 'submitted' (never re-fires).
  IF NEW.status IS DISTINCT FROM 'submitted' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN
    RETURN NEW;
  END IF;

  BEGIN
    FOR rec IN
      SELECT
        COALESCE(NULLIF(trim(g.value->>'topic'), ''), 'General') AS topic,
        SUM(COALESCE((g.value->>'marks_awarded')::numeric, 0))   AS awarded,
        SUM(COALESCE((g.value->>'marks_possible')::numeric, 0))  AS possible
      FROM jsonb_array_elements(COALESCE(NEW.grading_json->'graded', '[]'::jsonb)) AS g(value)
      GROUP BY 1
    LOOP
      IF rec.possible <= 0 THEN
        CONTINUE;
      END IF;
      v_ratio := LEAST(GREATEST(rec.awarded / rec.possible, 0), 1);
      v_delta := round(((v_ratio - 0.5) * 2)::numeric, 3);  -- −1 .. +1

      INSERT INTO public.learning_concept_mastery_ledger
        (user_id, subject_id, subject_name, topic_name, concept_name,
         evidence_type, evidence_source, score_delta, confidence, metadata)
      VALUES
        (NEW.user_id,
         NEW.subject_id,
         COALESCE(NULLIF(trim(NEW.subject_name), ''), 'General'),
         rec.topic,
         rec.topic,
         'mock_exam',
         'mock_exam_attempt',
         v_delta,
         0.75,  -- exam conditions: stronger than practice, weaker than teacher marks
         jsonb_build_object(
           'attempt_id',   NEW.id,
           'paper_code',   NEW.paper_code,
           'grade_band',   NEW.grade_band,
           'percent',      NEW.percent,
           'topic_awarded', rec.awarded,
           'topic_possible', rec.possible
         ));
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_mock_exam_mastery_evidence skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mock_exam_mastery_evidence ON public.mock_exam_attempts;
CREATE TRIGGER trg_mock_exam_mastery_evidence
  AFTER INSERT OR UPDATE OF status
  ON public.mock_exam_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.record_mock_exam_mastery_evidence();

-- ─── §2 Personal quiz / daily-task / flashcard attempts → mastery ledger ────
-- quiz_attempts is insert-only from the app (quizzes, structured daily tasks,
-- flashcard mirrors). Each row is one graded answer with optional
-- concepts_tested[]; fall back to the topic when no concepts were mapped.

CREATE OR REPLACE FUNCTION public.record_quiz_attempt_mastery_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject  text;
  v_topic    text;
  v_ratio    numeric;
  v_delta    numeric;
  v_concepts text[];
  v_concept  text;
BEGIN
  -- Need an owner and some grading signal.
  IF NEW.user_id IS NULL
     OR (NEW.was_correct IS NULL AND NEW.marks_awarded IS NULL) THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT s.name INTO v_subject FROM public.subjects s WHERE s.id = NEW.subject_id;
    v_subject := COALESCE(NULLIF(trim(v_subject), ''), 'General');
    v_topic   := COALESCE(NULLIF(trim(NEW.topic_name), ''), 'General');

    IF COALESCE(NEW.marks_possible, 0) > 0 THEN
      v_ratio := LEAST(GREATEST(COALESCE(NEW.marks_awarded, 0)::numeric / NEW.marks_possible, 0), 1);
    ELSIF NEW.was_correct IS NOT NULL THEN
      v_ratio := CASE WHEN NEW.was_correct THEN 1 ELSE 0 END;
    ELSE
      RETURN NEW;
    END IF;
    v_delta := round(((v_ratio - 0.5) * 2)::numeric, 3);

    v_concepts := NEW.concepts_tested;
    IF v_concepts IS NULL OR array_length(v_concepts, 1) IS NULL THEN
      v_concepts := ARRAY[v_topic];
    END IF;

    FOREACH v_concept IN ARRAY v_concepts LOOP
      IF v_concept IS NULL OR trim(v_concept) = '' THEN
        CONTINUE;
      END IF;
      INSERT INTO public.learning_concept_mastery_ledger
        (user_id, subject_id, subject_name, topic_name, concept_name,
         evidence_type, evidence_source, score_delta, confidence, metadata)
      VALUES
        (NEW.user_id, NEW.subject_id, v_subject, v_topic, trim(v_concept),
         'quiz', 'quiz_attempt', v_delta, 0.55,
         jsonb_build_object(
           'attempt_id',     NEW.id,
           'was_correct',    NEW.was_correct,
           'marks_awarded',  NEW.marks_awarded,
           'marks_possible', NEW.marks_possible,
           'command_word',   NEW.command_word
         ));
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_quiz_attempt_mastery_evidence skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quiz_attempt_mastery_evidence ON public.quiz_attempts;
CREATE TRIGGER trg_quiz_attempt_mastery_evidence
  AFTER INSERT
  ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.record_quiz_attempt_mastery_evidence();

-- ─── §3 School quizzes → mastery ledger ─────────────────────────────────────
-- Auto-graded on submission (score / max_score); long answers may be
-- re-graded by the teacher later (status → 'graded' with a new score), which
-- records a second, higher-confidence evidence row.

CREATE OR REPLACE FUNCTION public.record_school_quiz_mastery_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz    record;
  v_subject text;
  v_topic   text;
  v_ratio   numeric;
  v_delta   numeric;
BEGIN
  IF NEW.status NOT IN ('submitted', 'graded') THEN
    RETURN NEW;
  END IF;
  -- Skip no-op updates (same status, unchanged score).
  IF TG_OP = 'UPDATE'
     AND OLD.status = NEW.status
     AND OLD.score IS NOT DISTINCT FROM NEW.score THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.max_score, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT q.title, ss.name AS subject_name
      INTO v_quiz
      FROM public.quizzes q
      LEFT JOIN public.school_subjects ss ON ss.id = q.subject_id
     WHERE q.id = NEW.quiz_id;

    v_subject := COALESCE(NULLIF(trim(v_quiz.subject_name), ''), 'General');
    v_topic   := COALESCE(NULLIF(trim(v_quiz.title), ''), 'Class quiz');

    v_ratio := LEAST(GREATEST(COALESCE(NEW.score, 0)::numeric / NEW.max_score, 0), 1);
    v_delta := round(((v_ratio - 0.5) * 2)::numeric, 3);

    INSERT INTO public.learning_concept_mastery_ledger
      (user_id, subject_id, subject_name, topic_name, concept_name,
       evidence_type, evidence_source, score_delta, confidence, metadata)
    VALUES
      (NEW.student_id, NULL, v_subject, v_topic, v_topic,
       'quiz', 'school_quiz',
       v_delta,
       CASE WHEN NEW.status = 'graded' THEN 0.8 ELSE 0.6 END,
       jsonb_build_object(
         'attempt_id', NEW.id,
         'quiz_id',    NEW.quiz_id,
         'school_id',  NEW.school_id,
         'score',      NEW.score,
         'max_score',  NEW.max_score,
         'graded_by',  CASE WHEN NEW.status = 'graded' THEN 'teacher' ELSE 'auto' END
       ));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_school_quiz_mastery_evidence skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_school_quiz_mastery_evidence ON public.school_quiz_attempts;
CREATE TRIGGER trg_school_quiz_mastery_evidence
  AFTER INSERT OR UPDATE OF status, score
  ON public.school_quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.record_school_quiz_mastery_evidence();


-- ============================================================================
-- === MIGRATION: 20260716150000 (tutor_evidence_and_companion_effectiveness)
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- Tutor-lesson mastery evidence + companion effectiveness analytics (tier 5)
--
--   §1  lesson_topic_mapping → 'tutor_note' evidence in the mastery ledger.
--       process-lesson-recording already AI-maps each tutor lesson to a
--       topic, concepts[] and weak_concepts[] with a coverage score — but
--       none of it reached the mastery model. Now covered concepts add
--       positive evidence and weak concepts add negative evidence.
--
--   §2  companion_suggestion_effectiveness view — aggregates the
--       companion_interactions telemetry (PR #70) into per-kind funnel
--       stats (shown → clicked/booked vs dismissed) so the recommendation
--       engine and future dashboards can rank suggestion kinds by what
--       students actually engage with.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── §1 Tutor lessons → mastery ledger ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_lesson_mastery_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject   text;
  v_topic     text;
  v_conf      numeric;
  v_coverage  numeric;
  v_concept   text;
  v_weak      text[];
BEGIN
  BEGIN
    v_subject  := COALESCE(NULLIF(trim(NEW.subject_name), ''), 'General');
    v_topic    := COALESCE(NULLIF(trim(NEW.topic), ''), 'Tutor lesson');
    -- coverage_score is 0..1; treat missing as neutral-positive.
    v_coverage := LEAST(GREATEST(COALESCE(NEW.coverage_score, 0.6), 0), 1);
    -- Blend the mapper's own confidence into the evidence confidence,
    -- capped below teacher-marked homework (0.85).
    v_conf     := LEAST(GREATEST(COALESCE(NEW.confidence, 0.6), 0.3), 0.8);
    v_weak     := COALESCE(NEW.weak_concepts, ARRAY[]::text[]);

    -- Concepts covered in the lesson: positive evidence scaled by coverage.
    -- A concept flagged weak is skipped here (handled below).
    IF NEW.concepts IS NOT NULL THEN
      FOREACH v_concept IN ARRAY NEW.concepts LOOP
        IF v_concept IS NULL OR trim(v_concept) = '' OR trim(v_concept) = ANY (v_weak) THEN
          CONTINUE;
        END IF;
        INSERT INTO public.learning_concept_mastery_ledger
          (user_id, subject_id, subject_name, topic_name, concept_name,
           evidence_type, evidence_source, score_delta, confidence, metadata)
        VALUES
          (NEW.learner_id, NEW.subject_id, v_subject, v_topic, trim(v_concept),
           'tutor_note', 'lesson_topic_mapping',
           round((v_coverage * 0.5)::numeric, 3),          -- gentle positive: 0 .. +0.5
           v_conf,
           jsonb_build_object(
             'booking_id',     NEW.booking_id,
             'mapping_id',     NEW.id,
             'coverage_score', NEW.coverage_score,
             'signal',         'covered'
           ));
      END LOOP;
    END IF;

    -- Concepts the tutor/AI flagged as weak: negative evidence.
    FOREACH v_concept IN ARRAY v_weak LOOP
      IF v_concept IS NULL OR trim(v_concept) = '' THEN
        CONTINUE;
      END IF;
      INSERT INTO public.learning_concept_mastery_ledger
        (user_id, subject_id, subject_name, topic_name, concept_name,
         evidence_type, evidence_source, score_delta, confidence, metadata)
      VALUES
        (NEW.learner_id, NEW.subject_id, v_subject, v_topic, trim(v_concept),
         'tutor_note', 'lesson_topic_mapping',
         -0.4,
         v_conf,
         jsonb_build_object(
           'booking_id',     NEW.booking_id,
           'mapping_id',     NEW.id,
           'coverage_score', NEW.coverage_score,
           'signal',         'weak'
         ));
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_lesson_mastery_evidence skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lesson_mastery_evidence ON public.lesson_topic_mapping;
CREATE TRIGGER trg_lesson_mastery_evidence
  AFTER INSERT
  ON public.lesson_topic_mapping
  FOR EACH ROW
  EXECUTE FUNCTION public.record_lesson_mastery_evidence();

-- ─── §2a Fix companion_interactions kind constraint ─────────────────────────
-- The original CHECK only allowed category names ('resource','tutor',
-- 'homework','encourage') but the client records the real suggestion kinds
-- ('struggle_video', 'homework_book', …), so every insert was silently
-- rejected. Widen the constraint to accept both vocabularies.

ALTER TABLE public.companion_interactions
  DROP CONSTRAINT IF EXISTS companion_interactions_suggestion_kind_check;

ALTER TABLE public.companion_interactions
  ADD CONSTRAINT companion_interactions_suggestion_kind_check
  CHECK (suggestion_kind IN (
    'struggle_video', 'struggle_book', 'struggle_tutor',
    'homework_video', 'homework_book',
    'mastery_video', 'mastery_book',
    'resource', 'tutor', 'homework', 'encourage'
  ));

-- ─── §2b Companion suggestion effectiveness ─────────────────────────────────
-- Per-user, per-kind funnel over the last 60 days. security_invoker keeps
-- the underlying table's own-rows RLS in force, so students only see their
-- own stats (service role / definer contexts see everything).

CREATE OR REPLACE VIEW public.companion_suggestion_effectiveness
WITH (security_invoker = true) AS
SELECT
  user_id,
  suggestion_kind,
  count(*) FILTER (WHERE event = 'shown')::int     AS shown_count,
  count(*) FILTER (WHERE event = 'clicked')::int   AS clicked_count,
  count(*) FILTER (WHERE event = 'booked')::int    AS booked_count,
  count(*) FILTER (WHERE event = 'dismissed')::int AS dismissed_count,
  CASE WHEN count(*) FILTER (WHERE event = 'shown') > 0
       THEN round(
         (count(*) FILTER (WHERE event IN ('clicked', 'booked')))::numeric
         / count(*) FILTER (WHERE event = 'shown'), 3)
  END AS engagement_rate,
  max(created_at) AS last_interaction_at
FROM public.companion_interactions
WHERE created_at >= now() - interval '60 days'
GROUP BY user_id, suggestion_kind;

GRANT SELECT ON public.companion_suggestion_effectiveness TO authenticated;


-- ============================================================================
-- === MIGRATION: 20260717090000 (security_hardening)
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- Security hardening (Supabase advisory remediation, part 1 of 3)
--
--   §1  learning_concept_catalog — close the any-authenticated-user write
--       hole. Writes now require platform admin OR active LOS-workspace
--       staff (owner/admin/teacher/tutor).
--   §2  school_member_directory — replace the SECURITY DEFINER view
--       (ERROR-level advisory) with a definer FUNCTION + invoker view.
--       Same columns, same client API, same membership gating — but the
--       linter-flagged pattern is gone and the privilege boundary is an
--       auditable function instead of an implicit view property.
--   §3  storage.objects — stop anonymous/blanket enumeration of public
--       buckets (library, profile-photos, question-diagrams, tutor-videos,
--       tutorial-videos, tutorial-thumbnails, study-resources, library-pdfs).
--       Files stay fetchable via their public CDN URLs (that path bypasses
--       RLS); what goes away is `.list()` — enumerating every student's
--       photo or every file name. Owners keep SELECT on their own folder,
--       platform admins keep SELECT on everything.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── §1 Concept catalog: staff-only writes ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_any_los_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.learning_workspace_memberships m
    WHERE m.user_id = _user_id
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin', 'teacher', 'tutor')
  );
$$;

REVOKE ALL ON FUNCTION public.is_any_los_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_any_los_staff(uuid) TO authenticated, service_role;

-- Read stays open to all signed-in users (the catalog is shared reference
-- data); INSERT/UPDATE require admin or LOS staff. DELETE was never granted.
DROP POLICY IF EXISTS los_cc_write ON public.learning_concept_catalog;
CREATE POLICY los_cc_write ON public.learning_concept_catalog
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_any_los_staff((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS los_cc_update ON public.learning_concept_catalog;
CREATE POLICY los_cc_update ON public.learning_concept_catalog
  FOR UPDATE TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_any_los_staff((SELECT auth.uid()))
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_any_los_staff((SELECT auth.uid()))
  );

-- ─── §2 Member directory: definer function + invoker view ───────────────────

CREATE OR REPLACE FUNCTION public.school_member_directory_rows()
RETURNS TABLE (
  id          uuid,
  name        text,
  slug        text,
  logo_url    text,
  brand_color text,
  country     text,
  school_type text,
  status      public.school_status,
  plan        public.school_plan,
  created_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.name, s.slug, s.logo_url, s.brand_color,
    s.country, s.school_type, s.status, s.plan, s.created_at
  FROM public.schools s
  WHERE s.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.school_memberships m
      WHERE m.school_id = s.id
        AND m.user_id   = auth.uid()
        AND m.status    = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.school_member_directory_rows() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_member_directory_rows() TO authenticated, service_role;

DROP VIEW IF EXISTS public.school_member_directory;
CREATE VIEW public.school_member_directory
WITH (security_invoker = true) AS
SELECT * FROM public.school_member_directory_rows();

REVOKE ALL ON public.school_member_directory FROM PUBLIC, anon;
GRANT SELECT ON public.school_member_directory TO authenticated, service_role;

COMMENT ON VIEW public.school_member_directory IS
  'Identity-safe school columns readable by any ACTIVE member (incl. students). '
  'security_invoker view over a SECURITY DEFINER function that re-checks '
  'membership inline — no definer-view RLS bypass.';

-- ─── §3 Storage: kill blanket enumeration of public buckets ─────────────────

DO $$
DECLARE
  p record;
  dropped int := 0;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND cmd        = 'SELECT'
      AND (
        qual ILIKE '%''library''%'
        OR qual ILIKE '%''library-pdfs''%'
        OR qual ILIKE '%''profile-photos''%'
        OR qual ILIKE '%''question-diagrams''%'
        OR qual ILIKE '%''tutor-videos''%'
        OR qual ILIKE '%''tutorial-videos''%'
        OR qual ILIKE '%''tutorial-thumbnails''%'
        OR qual ILIKE '%''study-resources''%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
    dropped := dropped + 1;
  END LOOP;
  RAISE NOTICE 'Dropped % enumerating SELECT policies on storage.objects', dropped;
END $$;

-- Owners can still list/inspect their own folder (uploads use
-- <user_id>/<file> convention where ownership applies).
DROP POLICY IF EXISTS "own folder select on public buckets" ON storage.objects;
CREATE POLICY "own folder select on public buckets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('profile-photos', 'tutor-videos', 'tutorial-videos', 'tutorial-thumbnails')
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

-- Platform admins keep full visibility for moderation/curation.
DROP POLICY IF EXISTS "admin select on public buckets" ON storage.objects;
CREATE POLICY "admin select on public buckets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('library', 'library-pdfs', 'profile-photos', 'question-diagrams',
                  'tutor-videos', 'tutorial-videos', 'tutorial-thumbnails', 'study-resources')
    AND public.has_role((SELECT auth.uid()), 'admin')
  );


-- ============================================================================
-- === MIGRATION: 20260717093000 (rls_perf_hardening)
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS + FK performance hardening (Supabase advisory remediation, part 2 of 3)
--
--   §1  Rewrite every RLS policy on public tables that calls auth.uid() /
--       auth.role() / auth.jwt() / auth.email() directly, wrapping the call
--       as (SELECT auth.uid()) so Postgres evaluates it ONCE per query
--       (InitPlan) instead of once per row. This is the documented fix for
--       the `auth_rls_initplan` advisory and is semantically identical.
--
--   §2  Drop exact-duplicate RLS policies (same table, command, roles,
--       USING and WITH CHECK after normalization) keeping the first name
--       alphabetically. Only provably identical policies are touched —
--       merely *overlapping* policies are left alone.
--
--   §3  Create covering indexes for every foreign-key constraint on public
--       tables whose referencing column(s) have no supporting index
--       (`unindexed_foreign_keys` advisory).
--
-- Everything is generated from the live catalog, so this migration also
-- covers policies/FKs created outside these migration files.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── §1 InitPlan-wrap auth functions in RLS policies ────────────────────────

DO $$
DECLARE
  pol record;
  new_qual  text;
  new_check text;
  roles_sql text;
  cmd_sql   text;
  rewritten int := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        qual ~ 'auth\.(uid|role|jwt|email)\(\)'
        OR with_check ~ 'auth\.(uid|role|jwt|email)\(\)'
      )
  LOOP
    -- Wrap bare auth.<fn>() calls. pg_get_expr renders already-wrapped calls
    -- as "( SELECT auth.uid() AS uid)"; neutralize those first so they are
    -- not double-processed, wrap the remaining bare calls, then restore.
    -- (Postgres ARE regexes have no lookbehind, hence the placeholder dance.)
    new_qual  := pol.qual;
    new_check := pol.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual,
        '\(\s*SELECT\s+auth\.(uid|role|jwt|email)\(\)\s*(AS\s+\w+\s*)?\)',
        '__PREWRAPPED_\1__', 'g');
      new_qual := regexp_replace(new_qual,
        'auth\.(uid|role|jwt|email)\(\)',
        '(SELECT auth.\1())', 'g');
      new_qual := regexp_replace(new_qual,
        '__PREWRAPPED_(uid|role|jwt|email)__',
        '(SELECT auth.\1())', 'g');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check,
        '\(\s*SELECT\s+auth\.(uid|role|jwt|email)\(\)\s*(AS\s+\w+\s*)?\)',
        '__PREWRAPPED_\1__', 'g');
      new_check := regexp_replace(new_check,
        'auth\.(uid|role|jwt|email)\(\)',
        '(SELECT auth.\1())', 'g');
      new_check := regexp_replace(new_check,
        '__PREWRAPPED_(uid|role|jwt|email)__',
        '(SELECT auth.\1())', 'g');
    END IF;

    -- Skip if nothing actually changed (defensive).
    IF new_qual IS NOT DISTINCT FROM pol.qual
       AND new_check IS NOT DISTINCT FROM pol.with_check THEN
      CONTINUE;
    END IF;

    roles_sql := array_to_string(pol.roles, ', ');
    cmd_sql   := pol.cmd;

    EXECUTE format('DROP POLICY %I ON %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s %s %s',
      pol.policyname, pol.schemaname, pol.tablename,
      pol.permissive,
      cmd_sql,
      roles_sql,
      COALESCE('USING (' || new_qual || ')', ''),
      COALESCE('WITH CHECK (' || new_check || ')', '')
    );

    rewritten := rewritten + 1;
  END LOOP;

  RAISE NOTICE 'InitPlan-wrapped % RLS policies', rewritten;
END $$;

-- ─── §2 Drop exact-duplicate policies ───────────────────────────────────────

DO $$
DECLARE
  dup record;
  dropped int := 0;
BEGIN
  FOR dup IN
    SELECT tablename, policyname
    FROM (
      SELECT
        tablename,
        policyname,
        row_number() OVER (
          PARTITION BY tablename, cmd, permissive,
                       array_to_string(roles, ','),
                       COALESCE(qual, ''), COALESCE(with_check, '')
          ORDER BY policyname
        ) AS rn
      FROM pg_policies
      WHERE schemaname = 'public'
    ) d
    WHERE d.rn > 1
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', dup.policyname, dup.tablename);
    dropped := dropped + 1;
  END LOOP;

  RAISE NOTICE 'Dropped % exact-duplicate RLS policies', dropped;
END $$;

-- ─── §3 Index every unindexed foreign key ───────────────────────────────────

DO $$
DECLARE
  fk record;
  idx_name text;
  created int := 0;
BEGIN
  FOR fk IN
    SELECT
      c.conrelid::regclass::text AS table_name,
      c.conname,
      (SELECT array_agg(a.attname ORDER BY k.ord)
         FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      ) AS cols
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      -- no existing index whose leading columns cover the FK columns
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND (string_to_array(i.indkey::text, ' ')::int2[])[1:array_length(c.conkey, 1)]
              @> c.conkey
          AND (string_to_array(i.indkey::text, ' ')::int2[])[1:array_length(c.conkey, 1)]
              <@ c.conkey
      )
  LOOP
    idx_name := left('idx_fk_' || replace(fk.table_name, 'public.', '')
                     || '_' || array_to_string(fk.cols, '_'), 63);
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%s)',
                     idx_name, fk.table_name,
                     array_to_string(fk.cols, ', '));
      created := created + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not index FK % on %: %', fk.conname, fk.table_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Created % FK covering indexes', created;
END $$;

ANALYZE;


-- ============================================================================
-- === MIGRATION: 20260717100000 (seat_scaled_quota_and_tokens)
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- Seat-scaled school AI quota + token accounting (part 3 of 3)
--
--   §1  check_school_ai_quota now derives the effective daily limit from the
--       school's student seats:  effective = GREATEST(ai_quota_daily,
--       seats_students × per-seat allowance). ai_quota_daily becomes a FLOOR
--       (and can still be raised for bespoke contracts); the pool scales
--       automatically as seats grow. Per-seat allowance defaults to 5/day
--       and is overridable per school via metadata.ai_per_seat_daily.
--
--   §2  record_ai_token_usage(): single RPC the edge functions call after
--       every model response to persist real tokens_in/tokens_out into
--       ai_usage_daily (per user) and school_ai_usage_daily (per school,
--       when applicable) — replacing the always-zero placeholders.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── §1 Seat-scaled quota ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_school_ai_quota(_school_id uuid)
RETURNS TABLE(allowed boolean, used int, "limit" int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _floor    int;
  _seats    int;
  _per_seat int;
  _limit    int;
  _used     int;
BEGIN
  SELECT
    COALESCE(s.ai_quota_daily, 0),
    COALESCE(s.seats_students, 0),
    COALESCE((s.metadata->>'ai_per_seat_daily')::int, 5)
  INTO _floor, _seats, _per_seat
  FROM public.schools s
  WHERE s.id = _school_id;

  -- Effective limit: the larger of the contractual floor and the
  -- seat-derived pool. A floor of 0 still means "unlimited" only when the
  -- seat pool is also 0 (no seats configured).
  _limit := GREATEST(_floor, _seats * _per_seat);

  SELECT COALESCE(sum(requests), 0)::int INTO _used
  FROM public.school_ai_usage_daily
  WHERE school_id = _school_id AND usage_date = current_date;

  RETURN QUERY SELECT (_limit = 0 OR _used < _limit), _used, _limit;
END $$;

COMMENT ON FUNCTION public.check_school_ai_quota(uuid) IS
  'Effective daily AI limit = GREATEST(ai_quota_daily floor, seats_students × '
  'per-seat allowance). Per-seat allowance = metadata.ai_per_seat_daily (default 5).';

-- ─── §2 Token accounting RPC ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_ai_token_usage(
  _user_id    uuid,
  _bucket     text,
  _tokens_in  int DEFAULT 0,
  _tokens_out int DEFAULT 0,
  _school_id  uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NOT NULL THEN
    INSERT INTO public.ai_usage_daily (user_id, usage_date, bucket, requests, tokens_in, tokens_out)
    VALUES (_user_id, current_date, COALESCE(_bucket, 'misc'), 0,
            GREATEST(COALESCE(_tokens_in, 0), 0), GREATEST(COALESCE(_tokens_out, 0), 0))
    ON CONFLICT (user_id, usage_date, bucket) DO UPDATE
      SET tokens_in  = ai_usage_daily.tokens_in  + GREATEST(COALESCE(_tokens_in, 0), 0),
          tokens_out = ai_usage_daily.tokens_out + GREATEST(COALESCE(_tokens_out, 0), 0),
          updated_at = now();
  END IF;

  IF _school_id IS NOT NULL THEN
    INSERT INTO public.school_ai_usage_daily (school_id, usage_date, bucket, requests, tokens_in, tokens_out)
    VALUES (_school_id, current_date, COALESCE(_bucket, 'misc'), 0,
            GREATEST(COALESCE(_tokens_in, 0), 0), GREATEST(COALESCE(_tokens_out, 0), 0))
    ON CONFLICT (school_id, usage_date, bucket) DO UPDATE
      SET tokens_in  = school_ai_usage_daily.tokens_in  + GREATEST(COALESCE(_tokens_in, 0), 0),
          tokens_out = school_ai_usage_daily.tokens_out + GREATEST(COALESCE(_tokens_out, 0), 0),
          updated_at = now();
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.record_ai_token_usage(uuid, text, int, int, uuid) FROM PUBLIC, anon;
-- service_role only: edge functions report usage; clients must not self-report.
GRANT EXECUTE ON FUNCTION public.record_ai_token_usage(uuid, text, int, int, uuid) TO service_role;


-- ============================================================================
-- === HISTORY REPAIR: record the versions above in schema_migrations
-- ============================================================================
-- Wrapped defensively: schema/column shape of supabase_migrations can vary
-- slightly across platform versions. If the insert fails for any reason it
-- raises a WARNING instead of aborting the applied DDL above.
do $history$
begin
  insert into supabase_migrations.schema_migrations (version, name)
  values
    ('20260712120000', 'student_scope_school_rls'),
    ('20260713190000', 'fix_library_resource_links'),
    ('20260714090000', 'learning_os_foundations'),
    ('20260715080000', 'learning_ops_automation_cron'),
    ('20260716090000', 'homework_mastery_and_companion_feedback'),
    ('20260716120000', 'assessment_mastery_evidence'),
    ('20260716150000', 'tutor_evidence_and_companion_effectiveness'),
    ('20260717090000', 'security_hardening'),
    ('20260717093000', 'rls_perf_hardening'),
    ('20260717100000', 'seat_scaled_quota_and_tokens')
  on conflict (version) do nothing;
  raise notice 'History repair complete: schema_migrations now includes all versions through 20260717100000.';
exception
  when undefined_column then
    -- Older platform layout without a "name" column: insert version only.
    insert into supabase_migrations.schema_migrations (version)
    values
      ('20260712120000'), ('20260713190000'), ('20260714090000'),
      ('20260715080000'), ('20260716090000'), ('20260716120000'),
      ('20260716150000'), ('20260717090000'), ('20260717093000'),
      ('20260717100000')
    on conflict (version) do nothing;
    raise notice 'History repair complete (version-only insert; "name" column absent).';
  when others then
    raise warning 'History repair insert failed (%). The DDL above still applied; insert the version rows manually.', sqlerrm;
end;
$history$;

-- ============================================================================
-- === VERIFICATION
-- ============================================================================

-- 1. Migration history should now end at 20260717100000 (12 newest rows).
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 12;

-- 2. Mastery-ledger triggers from the July 16 migrations should all exist.
select tgname, tgrelid::regclass as on_table
from pg_trigger
where tgname in (
  'trg_homework_mastery_evidence',
  'trg_mock_exam_mastery_evidence',
  'trg_quiz_attempt_mastery_evidence',
  'trg_school_quiz_mastery_evidence',
  'trg_lesson_mastery_evidence'
)
order by tgname;

-- 3. Key functions from the July 17 migrations should all exist.
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'is_any_los_staff',
    'school_member_directory_rows',
    'check_school_ai_quota',
    'record_ai_token_usage'
  )
order by proname;

-- 4. Cron job from 20260715080000 should be scheduled.
select jobname, schedule
from cron.job
where jobname = 'learning-ops-automation-tick';

-- 5. The re-applied companion_interactions CHECK should be the widened one
--    (contains 'struggle_video').
select conname,
       position('struggle_video' in pg_get_constraintdef(oid)) > 0 as widened
from pg_constraint
where conname = 'companion_interactions_suggestion_kind_check';
