-- Phase 3.1: Automation runtime + document-to-concept ingestion.
--
-- Adds:
--   1. Automation schedule + last-run tracking per workspace
--   2. Concept ingestion staging table with review workflow
--   3. RPCs for running the automation jobs (nightly sweep, weekly rollups,
--      guardian digest) and for approving staged concept nodes into
--      learning_concept_catalog with full provenance
--   4. RLS + grants

-- ─── 1. Automation schedule ─────────────────────────────────────────────────

create table if not exists public.learning_ops_automation_schedule (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.learning_workspaces(id) on delete cascade,
  job_name text not null check (job_name in (
    'nightly_intervention_sweep',
    'weekly_cohort_rollup',
    'guardian_digest',
    'concept_ingestion'
  )),
  cadence text not null default 'daily' check (cadence in ('daily', 'weekly', 'manual')),
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_status text check (last_status in ('succeeded', 'failed', 'partial')),
  last_error text,
  next_run_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, job_name)
);

alter table public.learning_ops_automation_schedule enable row level security;

drop policy if exists "workspace members can view automation schedule"
  on public.learning_ops_automation_schedule;
create policy "workspace members can view automation schedule"
on public.learning_ops_automation_schedule
for select
using (
  workspace_id is null
  or public.user_in_workspace(workspace_id)
);

drop policy if exists "workspace admins manage automation schedule"
  on public.learning_ops_automation_schedule;
create policy "workspace admins manage automation schedule"
on public.learning_ops_automation_schedule
for all
using (
  workspace_id is null
  or public.workspace_user_has_role(workspace_id, array['owner','admin'])
)
with check (
  workspace_id is null
  or public.workspace_user_has_role(workspace_id, array['owner','admin'])
);

drop trigger if exists set_timestamp_learning_ops_automation_schedule
  on public.learning_ops_automation_schedule;
create trigger set_timestamp_learning_ops_automation_schedule
before update on public.learning_ops_automation_schedule
for each row execute function public.set_timestamp();

-- ─── 2. Concept ingestion staging ───────────────────────────────────────────

create table if not exists public.learning_concept_ingestion_staging (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.learning_workspaces(id) on delete set null,
  submitted_by_user_id uuid references auth.users(id) on delete set null,
  source_document_id uuid references public.documents(id) on delete set null,
  source_kind text not null check (source_kind in ('syllabus', 'past_paper', 'notes', 'manual', 'topic_seed')),
  curriculum text not null,
  subject_id uuid,
  subject_name text not null,
  topic_name text not null,
  concept_name text not null,
  subtopic_name text,
  objective_type text not null default 'knowledge',
  command_words text[] not null default array[]::text[],
  prerequisites text[] not null default array[]::text[],
  confidence numeric(4,2) not null default 0.6,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'promoted')),
  review_note text,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  promoted_catalog_id uuid references public.learning_concept_catalog(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_learning_concept_ingestion_staging_workspace_status
  on public.learning_concept_ingestion_staging(workspace_id, status);
create index if not exists idx_learning_concept_ingestion_staging_source
  on public.learning_concept_ingestion_staging(source_document_id, source_kind);

alter table public.learning_concept_ingestion_staging enable row level security;

drop policy if exists "workspace members view ingestion staging"
  on public.learning_concept_ingestion_staging;
create policy "workspace members view ingestion staging"
on public.learning_concept_ingestion_staging
for select
using (
  submitted_by_user_id = auth.uid()
  or (workspace_id is not null and public.user_in_workspace(workspace_id))
);

drop policy if exists "submitters and workspace admins manage ingestion staging"
  on public.learning_concept_ingestion_staging;
create policy "submitters and workspace admins manage ingestion staging"
on public.learning_concept_ingestion_staging
for all
using (
  submitted_by_user_id = auth.uid()
  or (workspace_id is not null and public.workspace_user_has_role(workspace_id, array['owner','admin','teacher']))
)
with check (
  submitted_by_user_id = auth.uid()
  or (workspace_id is not null and public.workspace_user_has_role(workspace_id, array['owner','admin','teacher']))
);

drop trigger if exists set_timestamp_learning_concept_ingestion_staging
  on public.learning_concept_ingestion_staging;
create trigger set_timestamp_learning_concept_ingestion_staging
before update on public.learning_concept_ingestion_staging
for each row execute function public.set_timestamp();

-- ─── 3. Helper: mark automation run start / finish ──────────────────────────

create or replace function public.record_automation_run_start(
  p_job_name text,
  p_workspace_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_run_id uuid;
begin
  insert into public.learning_ops_automation_runs (job_name, workspace_id, status, details)
  values (p_job_name, p_workspace_id, 'started', coalesce(p_details, '{}'::jsonb))
  returning id into v_run_id;

  return v_run_id;
end;
$$;

create or replace function public.record_automation_run_finish(
  p_run_id uuid,
  p_status text,
  p_rows_processed integer default 0,
  p_error_message text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
as $$
declare
  v_job_name text;
  v_workspace_id uuid;
begin
  update public.learning_ops_automation_runs
  set status = p_status,
      rows_processed = coalesce(p_rows_processed, 0),
      finished_at = now(),
      error_message = p_error_message,
      details = coalesce(public.learning_ops_automation_runs.details, '{}'::jsonb) || coalesce(p_details, '{}'::jsonb)
  where id = p_run_id
  returning job_name, workspace_id into v_job_name, v_workspace_id;

  if v_job_name is not null then
    update public.learning_ops_automation_schedule
    set last_run_at = now(),
        last_status = case when p_status in ('succeeded','partial','failed') then p_status else 'succeeded' end,
        last_error = p_error_message,
        next_run_at = case
          when cadence = 'daily' then now() + interval '1 day'
          when cadence = 'weekly' then now() + interval '7 days'
          else null
        end
    where job_name = v_job_name
      and coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid) =
          coalesce(v_workspace_id, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;
end;
$$;

-- ─── 4. Promote staged concept to catalog ───────────────────────────────────

create or replace function public.promote_concept_ingestion(p_staging_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_row public.learning_concept_ingestion_staging%rowtype;
  v_catalog_id uuid;
begin
  select * into v_row
  from public.learning_concept_ingestion_staging
  where id = p_staging_id;

  if v_row.id is null then
    raise exception 'ingestion staging row % not found', p_staging_id;
  end if;

  if v_row.workspace_id is not null and not public.workspace_user_has_role(
    v_row.workspace_id,
    array['owner','admin','teacher']
  ) then
    raise exception 'not authorised to promote ingestion into catalog';
  end if;

  insert into public.learning_concept_catalog (
    subject_id, curriculum, subject_name, topic_name, subtopic_name,
    concept_name, objective_type, command_words, prerequisites,
    source_document_id, source_kind, ingested_at, confidence
  )
  values (
    v_row.subject_id, v_row.curriculum, v_row.subject_name, v_row.topic_name,
    coalesce(v_row.subtopic_name, v_row.concept_name), v_row.concept_name,
    v_row.objective_type, v_row.command_words, v_row.prerequisites,
    v_row.source_document_id, v_row.source_kind, now(), v_row.confidence
  )
  on conflict (curriculum, subject_name, topic_name, coalesce(subtopic_name, ''), concept_name)
  do update set
    prerequisites = excluded.prerequisites,
    command_words = excluded.command_words,
    source_document_id = excluded.source_document_id,
    source_kind = excluded.source_kind,
    ingested_at = excluded.ingested_at,
    confidence = excluded.confidence
  returning id into v_catalog_id;

  update public.learning_concept_ingestion_staging
  set status = 'promoted',
      reviewed_by_user_id = auth.uid(),
      reviewed_at = now(),
      promoted_catalog_id = v_catalog_id
  where id = p_staging_id;

  return v_catalog_id;
end;
$$;

-- ─── 5. Nightly intervention sweep ──────────────────────────────────────────
-- Auto-resolves stale open interventions older than 21 days with no evidence
-- movement, and returns the counts observed for the given workspace.

create or replace function public.run_nightly_intervention_sweep(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_run_id uuid;
  v_resolved integer := 0;
  v_open integer := 0;
  v_high integer := 0;
begin
  v_run_id := public.record_automation_run_start('nightly_intervention_sweep', p_workspace_id);

  -- Auto-resolve interventions that have been open >21 days with zero new evidence
  with candidates as (
    select q.id, q.user_id, q.subject_id, q.created_at
    from public.learning_intervention_queue q
    where q.workspace_id = p_workspace_id
      and q.status = 'open'
      and q.created_at < now() - interval '21 days'
  ),
  post_activity as (
    select c.id,
           (select count(*) from public.learning_concept_mastery_ledger l
            where l.user_id = c.user_id
              and (c.subject_id is null or l.subject_id = c.subject_id)
              and l.recorded_at > c.created_at) as evidence_count
    from candidates c
  ),
  to_close as (
    select id from post_activity where evidence_count = 0
  ),
  closed as (
    update public.learning_intervention_queue q
    set status = 'resolved',
        resolved_at = now(),
        last_action_at = now(),
        action_note = 'Auto-resolved by nightly sweep (stale, no post-evidence).'
    where q.id in (select id from to_close)
    returning q.id
  )
  select count(*) into v_resolved from closed;

  select count(*), coalesce(sum(case when priority = 'high' then 1 else 0 end), 0)
  into v_open, v_high
  from public.learning_intervention_queue
  where workspace_id = p_workspace_id
    and status in ('open','acknowledged');

  perform public.record_automation_run_finish(
    v_run_id,
    'succeeded',
    v_resolved,
    null,
    jsonb_build_object('open_after', v_open, 'high_priority_after', v_high, 'auto_resolved', v_resolved)
  );

  return jsonb_build_object(
    'run_id', v_run_id,
    'auto_resolved', v_resolved,
    'open_after', v_open,
    'high_priority_after', v_high
  );
end;
$$;

-- ─── 6. Weekly cohort rollup ────────────────────────────────────────────────
-- Aggregates cohort-level intervention pressure + mastery Δ into the run's
-- details JSON so it becomes visible in the automation cadence panel.

create or replace function public.run_weekly_cohort_rollup(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_run_id uuid;
  v_result jsonb;
  v_count integer := 0;
begin
  v_run_id := public.record_automation_run_start('weekly_cohort_rollup', p_workspace_id);

  with cohort_students as (
    select c.id as cohort_id, c.name as cohort_name, mc.user_id
    from public.learning_workspace_cohorts c
    left join public.learning_workspace_member_cohorts mc
      on mc.cohort_id = c.id and mc.status = 'active'
    where c.workspace_id = p_workspace_id and c.is_active
  ),
  intervention_stats as (
    select cs.cohort_id,
           cs.cohort_name,
           count(distinct cs.user_id) filter (where cs.user_id is not null) as student_count,
           count(q.id) filter (where q.status in ('open','acknowledged')) as open_count,
           count(q.id) filter (where q.status in ('open','acknowledged') and q.priority = 'high') as high_count
    from cohort_students cs
    left join public.learning_intervention_queue q
      on q.user_id = cs.user_id and q.workspace_id = p_workspace_id
    group by cs.cohort_id, cs.cohort_name
  ),
  mastery_stats as (
    select cs.cohort_id,
           coalesce(sum(l.score_delta), 0)::numeric(10,2) as total_delta,
           count(l.id) as evidence_count
    from cohort_students cs
    left join public.learning_concept_mastery_ledger l
      on l.user_id = cs.user_id
     and l.recorded_at > now() - interval '7 days'
    group by cs.cohort_id
  )
  select jsonb_agg(
    jsonb_build_object(
      'cohort_id', i.cohort_id,
      'cohort_name', i.cohort_name,
      'student_count', i.student_count,
      'open_interventions', i.open_count,
      'high_priority_interventions', i.high_count,
      'weekly_mastery_delta', coalesce(m.total_delta, 0),
      'weekly_evidence_count', coalesce(m.evidence_count, 0)
    )
    order by i.cohort_name
  ), count(*)
  into v_result, v_count
  from intervention_stats i
  left join mastery_stats m on m.cohort_id = i.cohort_id;

  perform public.record_automation_run_finish(
    v_run_id,
    'succeeded',
    coalesce(v_count, 0),
    null,
    jsonb_build_object('cohorts', coalesce(v_result, '[]'::jsonb))
  );

  return jsonb_build_object('run_id', v_run_id, 'cohorts', coalesce(v_result, '[]'::jsonb));
end;
$$;

-- ─── 7. Grants ──────────────────────────────────────────────────────────────

grant execute on function public.record_automation_run_start(text, uuid, jsonb) to authenticated;
grant execute on function public.record_automation_run_finish(uuid, text, integer, text, jsonb) to authenticated;
grant execute on function public.promote_concept_ingestion(uuid) to authenticated;
grant execute on function public.run_nightly_intervention_sweep(uuid) to authenticated;
grant execute on function public.run_weekly_cohort_rollup(uuid) to authenticated;
