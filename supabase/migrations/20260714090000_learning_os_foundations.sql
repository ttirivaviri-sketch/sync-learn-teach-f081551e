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
