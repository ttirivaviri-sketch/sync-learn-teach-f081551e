-- Phase 3.2: prerequisite DAG, predictive risk, per-teacher alert routing,
-- class-scoped views, and study plan optimizer surface.

-- ─── 1. Concept prerequisite DAG ────────────────────────────────────────────

create table if not exists public.learning_concept_prerequisite_edges (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.learning_concept_catalog(id) on delete cascade,
  prerequisite_concept_id uuid not null references public.learning_concept_catalog(id) on delete cascade,
  weight numeric(4,2) not null default 1.0,
  source_kind text default 'manual' check (source_kind in ('manual','ingested','inferred','template')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_prerequisite_edge unique (concept_id, prerequisite_concept_id),
  constraint no_self_edge check (concept_id <> prerequisite_concept_id)
);

create index if not exists idx_learning_concept_prerequisite_edges_concept
  on public.learning_concept_prerequisite_edges(concept_id);
create index if not exists idx_learning_concept_prerequisite_edges_prereq
  on public.learning_concept_prerequisite_edges(prerequisite_concept_id);

alter table public.learning_concept_prerequisite_edges enable row level security;

drop policy if exists "authenticated read prerequisite edges"
  on public.learning_concept_prerequisite_edges;
create policy "authenticated read prerequisite edges"
on public.learning_concept_prerequisite_edges
for select
using (auth.role() = 'authenticated');

drop policy if exists "staff manage prerequisite edges"
  on public.learning_concept_prerequisite_edges;
create policy "staff manage prerequisite edges"
on public.learning_concept_prerequisite_edges
for all
using (
  exists (
    select 1 from public.learning_workspace_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner','admin','teacher')
  )
)
with check (
  exists (
    select 1 from public.learning_workspace_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner','admin','teacher')
  )
);

drop trigger if exists set_timestamp_prerequisite_edges
  on public.learning_concept_prerequisite_edges;
create trigger set_timestamp_prerequisite_edges
before update on public.learning_concept_prerequisite_edges
for each row execute function public.set_timestamp();

-- Ingest prerequisites text[] on learning_concept_catalog into DAG edges,
-- resolving prerequisite concept names within the same subject.
create or replace function public.materialize_concept_prerequisite_edges(p_subject_name text default null)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer := 0;
begin
  with source as (
    select c.id as concept_id,
           c.subject_name,
           c.curriculum,
           unnest(coalesce(c.prerequisites, array[]::text[])) as prereq_name
    from public.learning_concept_catalog c
    where p_subject_name is null or c.subject_name = p_subject_name
  ),
  resolved as (
    select s.concept_id,
           p.id as prerequisite_concept_id
    from source s
    join public.learning_concept_catalog p
      on lower(p.concept_name) = lower(s.prereq_name)
     and p.subject_name = s.subject_name
     and p.curriculum = s.curriculum
    where p.id <> s.concept_id
  ),
  inserted as (
    insert into public.learning_concept_prerequisite_edges (concept_id, prerequisite_concept_id, source_kind)
    select concept_id, prerequisite_concept_id, 'ingested'
    from resolved
    on conflict (concept_id, prerequisite_concept_id) do nothing
    returning id
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

-- Walk the DAG upstream (recursive CTE) up to a bounded depth.
create or replace function public.get_upstream_prerequisites(p_concept_id uuid, p_max_depth integer default 3)
returns table (
  concept_id uuid,
  concept_name text,
  subject_name text,
  topic_name text,
  depth integer,
  weight numeric
)
language sql
stable
as $$
  with recursive walk as (
    select c.id as concept_id, c.concept_name, c.subject_name, c.topic_name,
           1 as depth, 1.0::numeric as weight
    from public.learning_concept_catalog c
    where c.id in (
      select prerequisite_concept_id
      from public.learning_concept_prerequisite_edges
      where concept_id = p_concept_id
    )
    union all
    select c.id, c.concept_name, c.subject_name, c.topic_name,
           w.depth + 1,
           w.weight * coalesce(e.weight, 1.0)
    from walk w
    join public.learning_concept_prerequisite_edges e on e.concept_id = w.concept_id
    join public.learning_concept_catalog c on c.id = e.prerequisite_concept_id
    where w.depth < p_max_depth
  )
  select concept_id, concept_name, subject_name, topic_name, depth, weight
  from walk;
$$;

-- ─── 2. Predictive risk (EWMA slope, 7-day forward) ─────────────────────────

-- Aggregates per-user recent mastery ledger movement into a projected risk
-- score in the range 0..100 (0 = strong, 100 = severe risk).
create or replace view public.learner_projected_risk as
with recent as (
  select l.user_id, l.subject_id, l.subject_name,
         date_trunc('day', l.recorded_at)::date as day,
         sum(l.score_delta)::numeric as day_delta,
         avg(l.confidence)::numeric as day_confidence,
         count(*) as evidence_count
  from public.learning_concept_mastery_ledger l
  where l.recorded_at > now() - interval '14 days'
  group by 1,2,3,4
),
slope as (
  -- Simple linear slope of day_delta over the 14-day window per subject
  select user_id, subject_id, subject_name,
         avg(day_delta)::numeric as avg_delta,
         (
           -- covariance-based slope: correlate day index with day_delta
           coalesce(
             (
               sum((extract(epoch from age(day, min(day) over (partition by user_id, subject_id)))/86400.0) * day_delta)
               - sum(extract(epoch from age(day, min(day) over (partition by user_id, subject_id)))/86400.0) * avg(day_delta) / nullif(count(*)::numeric, 0)
             ) / nullif(count(*)::numeric, 0)
           , 0)
         ) as slope,
         avg(day_confidence)::numeric as avg_confidence,
         sum(evidence_count) as total_evidence
  from recent
  group by user_id, subject_id, subject_name
)
select user_id, subject_id, subject_name,
       coalesce(avg_delta, 0)::numeric(6,2) as recent_avg_delta,
       coalesce(slope, 0)::numeric(6,3) as slope_per_day,
       coalesce(avg_confidence, 0)::numeric(4,2) as avg_confidence,
       total_evidence,
       greatest(0, least(100,
         50
         - coalesce(avg_delta, 0)::numeric * 1.4
         - coalesce(slope, 0)::numeric * 20
         - (coalesce(avg_confidence, 0)::numeric * 20)
         + case when coalesce(total_evidence, 0) < 3 then 15 else 0 end
       ))::integer as projected_risk
from slope;

-- ─── 3. Class-scoped views (per teacher / per cohort) ───────────────────────

create or replace view public.learning_class_at_risk as
with cohort_students as (
  select c.id as cohort_id,
         c.workspace_id,
         c.name as cohort_name,
         mc.user_id,
         mc.membership_id
  from public.learning_workspace_cohorts c
  left join public.learning_workspace_member_cohorts mc
    on mc.cohort_id = c.id and mc.status = 'active'
  where c.is_active
),
per_student_open as (
  select cs.workspace_id, cs.cohort_id, cs.cohort_name, cs.user_id,
         count(q.id) filter (where q.status in ('open','acknowledged')) as open_count,
         count(q.id) filter (where q.status in ('open','acknowledged') and q.priority = 'high') as high_count,
         max(q.updated_at) as last_alert_at
  from cohort_students cs
  left join public.learning_intervention_queue q
    on q.user_id = cs.user_id
   and q.workspace_id = cs.workspace_id
  group by 1,2,3,4
),
risk as (
  select user_id, avg(projected_risk)::integer as projected_risk
  from public.learner_projected_risk
  group by user_id
)
select ps.workspace_id, ps.cohort_id, ps.cohort_name, ps.user_id,
       ps.open_count, ps.high_count, ps.last_alert_at,
       coalesce(r.projected_risk, 50) as projected_risk
from per_student_open ps
left join risk r on r.user_id = ps.user_id;

-- ─── 4. Per-teacher alert routing helper ────────────────────────────────────
--
-- Given a workspace + optional cohort filter, return the teacher(s) responsible
-- for the affected students (their lead_user_id on the cohort). Callers can use
-- this to route intervention queue rows to the right teacher.
create or replace function public.workspace_class_teachers(
  p_workspace_id uuid,
  p_user_ids uuid[] default null
)
returns table (user_id uuid, cohort_id uuid, teacher_user_id uuid)
language sql
stable
as $$
  select distinct
    mc.user_id,
    c.id as cohort_id,
    c.lead_user_id as teacher_user_id
  from public.learning_workspace_member_cohorts mc
  join public.learning_workspace_cohorts c on c.id = mc.cohort_id
  where mc.status = 'active'
    and c.workspace_id = p_workspace_id
    and (p_user_ids is null or mc.user_id = any(p_user_ids))
    and c.lead_user_id is not null;
$$;

-- Auto-assign the responsible teacher (cohort lead) onto open interventions
-- for a given workspace. Idempotent.
create or replace function public.route_interventions_to_teachers(p_workspace_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer := 0;
begin
  with candidates as (
    select q.id as intervention_id, wct.teacher_user_id
    from public.learning_intervention_queue q
    join public.workspace_class_teachers(p_workspace_id) wct on wct.user_id = q.user_id
    where q.workspace_id = p_workspace_id
      and q.status in ('open','acknowledged')
      and (q.assigned_to_user_id is distinct from wct.teacher_user_id
           or q.assigned_role is null
           or q.assigned_role <> 'teacher')
  ),
  updated as (
    update public.learning_intervention_queue q
    set assigned_to_user_id = c.teacher_user_id,
        assigned_role = 'teacher',
        last_action_at = now()
    from candidates c
    where c.intervention_id = q.id
    returning q.id
  )
  select count(*) into v_count from updated;

  return v_count;
end;
$$;

-- ─── 5. Study plan optimizer surface ────────────────────────────────────────
--
-- A staging table so the nightly optimizer can propose new schedule slots that
-- staff (or the learner) can accept. We do NOT overwrite `study_schedule`
-- directly — proposals are surfaced first.
create table if not exists public.learning_ops_plan_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workspace_id uuid references public.learning_workspaces(id) on delete set null,
  subject_id uuid,
  subject_name text not null,
  topic_name text not null,
  proposed_for date not null,
  duration_minutes integer not null default 30,
  reason text not null,
  projected_risk integer,
  status text not null default 'proposed' check (status in ('proposed','accepted','dismissed','applied')),
  applied_schedule_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_learning_ops_plan_proposals_user_status
  on public.learning_ops_plan_proposals(user_id, status);
create index if not exists idx_learning_ops_plan_proposals_workspace
  on public.learning_ops_plan_proposals(workspace_id, status);

alter table public.learning_ops_plan_proposals enable row level security;

drop policy if exists "learners view own plan proposals"
  on public.learning_ops_plan_proposals;
create policy "learners view own plan proposals"
on public.learning_ops_plan_proposals
for select
using (user_id = auth.uid()
   or (workspace_id is not null and public.user_in_workspace(workspace_id)));

drop policy if exists "learners and staff manage plan proposals"
  on public.learning_ops_plan_proposals;
create policy "learners and staff manage plan proposals"
on public.learning_ops_plan_proposals
for all
using (user_id = auth.uid()
   or (workspace_id is not null and public.workspace_user_has_role(workspace_id, array['owner','admin','teacher'])))
with check (user_id = auth.uid()
   or (workspace_id is not null and public.workspace_user_has_role(workspace_id, array['owner','admin','teacher'])));

drop trigger if exists set_timestamp_learning_ops_plan_proposals
  on public.learning_ops_plan_proposals;
create trigger set_timestamp_learning_ops_plan_proposals
before update on public.learning_ops_plan_proposals
for each row execute function public.set_timestamp();

-- Compute a slate of proposals for a workspace based on projected risk +
-- open interventions. Idempotent (upserts on user/subject/topic/day).
create or replace function public.run_study_plan_optimizer(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_run_id uuid;
  v_created integer := 0;
begin
  v_run_id := public.record_automation_run_start('study_plan_optimizer', p_workspace_id);

  with base as (
    -- Union of "recent open interventions" and "projected high risk"
    select q.user_id, q.subject_id,
           coalesce(nullif(q.metadata->>'subject_name',''), 'General') as subject_name,
           coalesce(nullif(q.metadata->>'topic_name',''), 'Focus review') as topic_name,
           case when q.priority = 'high' then 45 when q.priority = 'medium' then 30 else 20 end as duration_minutes,
           case
             when q.priority = 'high' then 'High-priority intervention outstanding'
             when q.priority = 'medium' then 'Medium-priority intervention outstanding'
             else 'Open intervention — light review recommended'
           end as reason,
           case when q.priority = 'high' then 80 when q.priority = 'medium' then 60 else 40 end as projected_risk
    from public.learning_intervention_queue q
    where q.workspace_id = p_workspace_id
      and q.status in ('open','acknowledged')
    union all
    select lpr.user_id, lpr.subject_id, lpr.subject_name,
           'Slope-driven review' as topic_name,
           40 as duration_minutes,
           'Projected risk rising over the last 14 days' as reason,
           lpr.projected_risk
    from public.learner_projected_risk lpr
    join public.learning_workspace_memberships m
      on m.user_id = lpr.user_id and m.workspace_id = p_workspace_id and m.status = 'active'
    where lpr.projected_risk >= 65
  ),
  scoped as (
    select distinct on (b.user_id, b.subject_name, b.topic_name)
      b.user_id, b.subject_id, b.subject_name, b.topic_name,
      b.duration_minutes, b.reason, b.projected_risk
    from base b
    order by b.user_id, b.subject_name, b.topic_name, b.projected_risk desc
  ),
  inserted as (
    insert into public.learning_ops_plan_proposals (
      user_id, workspace_id, subject_id, subject_name, topic_name,
      proposed_for, duration_minutes, reason, projected_risk, status
    )
    select s.user_id, p_workspace_id, s.subject_id, s.subject_name, s.topic_name,
           (current_date + 1),
           s.duration_minutes, s.reason, s.projected_risk, 'proposed'
    from scoped s
    where not exists (
      select 1 from public.learning_ops_plan_proposals p
      where p.user_id = s.user_id
        and p.workspace_id = p_workspace_id
        and p.subject_name = s.subject_name
        and p.topic_name = s.topic_name
        and p.proposed_for = current_date + 1
        and p.status = 'proposed'
    )
    returning id
  )
  select count(*) into v_created from inserted;

  perform public.record_automation_run_finish(
    v_run_id, 'succeeded', v_created, null,
    jsonb_build_object('proposals_created', v_created)
  );

  return jsonb_build_object('run_id', v_run_id, 'proposals_created', v_created);
end;
$$;

-- ─── 6. Grants ──────────────────────────────────────────────────────────────

grant execute on function public.materialize_concept_prerequisite_edges(text) to authenticated;
grant execute on function public.get_upstream_prerequisites(uuid, integer) to authenticated;
grant execute on function public.workspace_class_teachers(uuid, uuid[]) to authenticated;
grant execute on function public.route_interventions_to_teachers(uuid) to authenticated;
grant execute on function public.run_study_plan_optimizer(uuid) to authenticated;

grant select on public.learner_projected_risk to authenticated;
grant select on public.learning_class_at_risk to authenticated;
