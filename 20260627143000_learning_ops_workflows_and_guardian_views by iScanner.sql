-- Learning Operating System v1 workflow layer
-- Adds workspace invitations, cohort assignments, intervention action logs,
-- and queue ownership fields for closed-loop study operations.

create table if not exists public.learning_workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.learning_workspaces(id) on delete cascade,
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'student' check (role in ('owner', 'admin', 'teacher', 'tutor', 'student', 'guardian')),
  status text not null default 'invited' check (status in ('invited', 'accepted', 'revoked', 'expired')),
  cohort_ids uuid[] not null default '{}',
  invite_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_workspace_member_cohorts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.learning_workspaces(id) on delete cascade,
  cohort_id uuid not null references public.learning_workspace_cohorts(id) on delete cascade,
  membership_id uuid not null references public.learning_workspace_memberships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'removed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, user_id)
);

alter table public.learning_intervention_queue
  add column if not exists assigned_to_user_id uuid references auth.users(id) on delete set null,
  add column if not exists assigned_role text check (assigned_role in ('owner', 'admin', 'teacher', 'tutor', 'student', 'guardian')),
  add column if not exists acknowledged_at timestamptz,
  add column if not exists action_note text,
  add column if not exists last_action_at timestamptz,
  add column if not exists resolved_by_user_id uuid references auth.users(id) on delete set null;

create table if not exists public.learning_intervention_events (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.learning_intervention_queue(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('created', 'acknowledged', 'resolved', 'dismissed', 'reassigned', 'noted')),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_learning_workspace_invites_workspace_status
  on public.learning_workspace_invitations(workspace_id, status, created_at desc);
create unique index if not exists uq_learning_workspace_active_invites
  on public.learning_workspace_invitations(workspace_id, lower(email))
  where status = 'invited';
create index if not exists idx_learning_member_cohorts_workspace_user
  on public.learning_workspace_member_cohorts(workspace_id, user_id, status);
create index if not exists idx_learning_intervention_queue_assignee
  on public.learning_intervention_queue(assigned_to_user_id, assigned_role, status);
create index if not exists idx_learning_intervention_events_intervention
  on public.learning_intervention_events(intervention_id, created_at desc);

create or replace function public.workspace_user_has_role(p_workspace_id uuid, allowed_roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.learning_workspace_memberships lwm
    where lwm.workspace_id = p_workspace_id
      and lwm.user_id = auth.uid()
      and lwm.status = 'active'
      and lwm.role = any(allowed_roles)
  );
$$;

alter table public.learning_workspace_invitations enable row level security;
alter table public.learning_workspace_member_cohorts enable row level security;
alter table public.learning_intervention_events enable row level security;

drop policy if exists "workspace members can view invitations" on public.learning_workspace_invitations;
create policy "workspace members can view invitations"
on public.learning_workspace_invitations
for select
using (public.user_in_workspace(workspace_id));

drop policy if exists "workspace managers can manage invitations" on public.learning_workspace_invitations;
create policy "workspace managers can manage invitations"
on public.learning_workspace_invitations
for all
using (public.workspace_user_has_role(workspace_id, array['owner','admin','teacher']))
with check (public.workspace_user_has_role(workspace_id, array['owner','admin','teacher']));

drop policy if exists "workspace members can view member cohorts" on public.learning_workspace_member_cohorts;
create policy "workspace members can view member cohorts"
on public.learning_workspace_member_cohorts
for select
using (public.user_in_workspace(workspace_id));

drop policy if exists "workspace managers can manage member cohorts" on public.learning_workspace_member_cohorts;
create policy "workspace managers can manage member cohorts"
on public.learning_workspace_member_cohorts
for all
using (public.workspace_user_has_role(workspace_id, array['owner','admin','teacher']))
with check (public.workspace_user_has_role(workspace_id, array['owner','admin','teacher']));

drop policy if exists "participants can view intervention events" on public.learning_intervention_events;
create policy "participants can view intervention events"
on public.learning_intervention_events
for select
using (
  exists (
    select 1
    from public.learning_intervention_queue liq
    where liq.id = intervention_id
      and (
        liq.user_id = auth.uid()
        or (liq.workspace_id is not null and public.user_in_workspace(liq.workspace_id))
      )
  )
);

drop policy if exists "participants can insert intervention events" on public.learning_intervention_events;
create policy "participants can insert intervention events"
on public.learning_intervention_events
for insert
with check (
  actor_user_id = auth.uid()
  and exists (
    select 1
    from public.learning_intervention_queue liq
    where liq.id = intervention_id
      and (
        liq.user_id = auth.uid()
        or (liq.workspace_id is not null and public.user_in_workspace(liq.workspace_id))
      )
  )
);

drop trigger if exists set_timestamp_learning_workspace_invitations on public.learning_workspace_invitations;
create trigger set_timestamp_learning_workspace_invitations
before update on public.learning_workspace_invitations
for each row execute function public.set_timestamp();

drop trigger if exists set_timestamp_learning_workspace_member_cohorts on public.learning_workspace_member_cohorts;
create trigger set_timestamp_learning_workspace_member_cohorts
before update on public.learning_workspace_member_cohorts
for each row execute function public.set_timestamp();
