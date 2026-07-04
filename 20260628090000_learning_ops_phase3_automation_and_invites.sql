-- Phase 3: invitation acceptance flow, automation runs log,
-- concept graph ingestion provenance, and analytics views.

-- ─── 1. Invitation acceptance tokens ────────────────────────────────────────

alter table public.learning_workspace_invitations
  add column if not exists token text,
  add column if not exists token_hash text,
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists expires_at timestamptz;

create unique index if not exists uq_learning_workspace_invitations_token
  on public.learning_workspace_invitations(token)
  where token is not null;

-- ─── 2. Automation runs log ─────────────────────────────────────────────────

create table if not exists public.learning_ops_automation_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null default 'started' check (status in ('started', 'succeeded', 'failed', 'partial')),
  rows_processed integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  workspace_id uuid references public.learning_workspaces(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text
);

create index if not exists idx_learning_ops_automation_runs_job_started
  on public.learning_ops_automation_runs(job_name, started_at desc);

alter table public.learning_ops_automation_runs enable row level security;

drop policy if exists "workspace members can view automation runs" on public.learning_ops_automation_runs;
create policy "workspace members can view automation runs"
on public.learning_ops_automation_runs
for select
using (
  workspace_id is null
  or public.user_in_workspace(workspace_id)
);

-- ─── 3. Concept graph ingestion provenance ──────────────────────────────────

alter table public.learning_concept_catalog
  add column if not exists source_document_id uuid references public.documents(id) on delete set null,
  add column if not exists source_kind text check (source_kind in ('syllabus', 'past_paper', 'notes', 'manual', 'topic_seed')),
  add column if not exists ingested_at timestamptz default now(),
  add column if not exists confidence numeric(4,2) default 0.7;

create index if not exists idx_learning_concept_catalog_source
  on public.learning_concept_catalog(source_document_id, source_kind);

-- ─── 4. Outcome analytics — concept trendlines ──────────────────────────────

create or replace view public.learning_concept_trends as
select
  user_id,
  subject_id,
  subject_name,
  topic_name,
  concept_name,
  date_trunc('day', recorded_at)::date as day,
  count(*) as evidence_count,
  avg(confidence)::numeric(4,2) as avg_confidence,
  sum(score_delta)::numeric(8,2) as total_score_delta
from public.learning_concept_mastery_ledger
group by user_id, subject_id, subject_name, topic_name, concept_name, date_trunc('day', recorded_at);

-- ─── 5. Intervention outcome attribution view ───────────────────────────────

create or replace view public.learning_intervention_outcomes as
select
  q.id as intervention_id,
  q.user_id,
  q.workspace_id,
  q.subject_id,
  q.intervention_type,
  q.priority,
  q.status,
  q.created_at,
  q.acknowledged_at,
  q.resolved_at,
  case
    when q.resolved_at is not null then extract(epoch from (q.resolved_at - q.created_at)) / 3600
    else null
  end as hours_open,
  (
    select coalesce(sum(l.score_delta), 0)
    from public.learning_concept_mastery_ledger l
    where l.user_id = q.user_id
      and (q.subject_id is null or l.subject_id = q.subject_id)
      and l.recorded_at > q.created_at
      and (q.resolved_at is null or l.recorded_at <= q.resolved_at + interval '14 days')
  ) as post_score_delta,
  (
    select count(*)
    from public.learning_concept_mastery_ledger l
    where l.user_id = q.user_id
      and (q.subject_id is null or l.subject_id = q.subject_id)
      and l.recorded_at > q.created_at
  ) as post_evidence_count
from public.learning_intervention_queue q;

-- ─── 6. Helper functions ────────────────────────────────────────────────────

-- Generate URL-safe invite token (server-side helper)
create or replace function public.generate_workspace_invite_token(p_invitation_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_token text;
  v_owner_id uuid;
begin
  -- ensure caller can manage this workspace
  select lw.owner_user_id into v_owner_id
  from public.learning_workspace_invitations lwi
  join public.learning_workspaces lw on lw.id = lwi.workspace_id
  where lwi.id = p_invitation_id;

  if v_owner_id is null then
    raise exception 'invitation not found';
  end if;

  if not (
    auth.uid() = v_owner_id
    or public.workspace_user_has_role((select workspace_id from public.learning_workspace_invitations where id = p_invitation_id), array['owner','admin','teacher'])
  ) then
    raise exception 'not authorised to issue invite token';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  update public.learning_workspace_invitations
  set
    token = v_token,
    token_hash = encode(digest(v_token, 'sha256'), 'hex'),
    expires_at = coalesce(expires_at, now() + interval '30 days')
  where id = p_invitation_id;

  return v_token;
end;
$$;

-- Accept an invitation: matches token, creates membership + cohort assignments
create or replace function public.accept_workspace_invitation(p_token text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_invite public.learning_workspace_invitations%rowtype;
  v_user_id uuid;
  v_membership_id uuid;
  v_cohort_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'must be signed in to accept an invitation';
  end if;

  select * into v_invite
  from public.learning_workspace_invitations
  where token = p_token
    and status = 'invited'
    and (expires_at is null or expires_at > now());

  if v_invite.id is null then
    raise exception 'invitation not found or expired';
  end if;

  -- create or update membership
  insert into public.learning_workspace_memberships (workspace_id, user_id, role, status)
  values (v_invite.workspace_id, v_user_id, v_invite.role, 'active')
  on conflict (workspace_id, user_id) do update
    set role = excluded.role,
        status = 'active'
  returning id into v_membership_id;

  -- assign to invited cohorts
  if v_invite.cohort_ids is not null and array_length(v_invite.cohort_ids, 1) > 0 then
    foreach v_cohort_id in array v_invite.cohort_ids
    loop
      insert into public.learning_workspace_member_cohorts (workspace_id, cohort_id, membership_id, user_id, status)
      values (v_invite.workspace_id, v_cohort_id, v_membership_id, v_user_id, 'active')
      on conflict (cohort_id, user_id) do update set status = 'active';
    end loop;
  end if;

  -- mark invitation accepted
  update public.learning_workspace_invitations
  set status = 'accepted',
      accepted_at = now(),
      accepted_by_user_id = v_user_id
  where id = v_invite.id;

  return v_membership_id;
end;
$$;

grant execute on function public.generate_workspace_invite_token(uuid) to authenticated;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
