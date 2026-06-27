-- Learning Operating System foundations
-- Adds school workspaces, cohort membership, concept catalog, mastery evidence ledger,
-- and an intervention queue so StudySync can evolve into a multi-actor learning OS.

create extension if not exists pgcrypto;

create or replace function public.set_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.learning_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  workspace_type text not null default 'school' check (workspace_type in ('school', 'tutoring_org', 'family', 'personal')),
  school_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.learning_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('owner', 'admin', 'teacher', 'tutor', 'student', 'guardian')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  campus text,
  grade_level text,
  cohort_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.learning_workspace_cohorts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.learning_workspaces(id) on delete cascade,
  name text not null,
  curriculum text,
  grade_level text,
  subject_names text[] not null default '{}',
  lead_user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.learning_concept_catalog (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete set null,
  curriculum text not null,
  subject_name text not null,
  topic_name text not null,
  subtopic_name text,
  concept_name text not null,
  objective_type text not null default 'knowledge' check (objective_type in ('knowledge', 'application', 'skill', 'assessment')),
  command_words text[] not null default '{}',
  prerequisites text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_concept_mastery_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  concept_id uuid references public.learning_concept_catalog(id) on delete set null,
  subject_name text not null,
  topic_name text not null,
  concept_name text not null,
  evidence_type text not null check (evidence_type in ('task', 'quiz', 'mock_exam', 'tutor_note', 'flashcard', 'recall', 'manual')),
  evidence_source text,
  score_delta numeric(6,2) not null default 0,
  confidence numeric(4,2) not null default 0.5,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.learning_intervention_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.learning_workspaces(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  intervention_type text not null check (intervention_type in ('concept-reteach', 'guided-practice', 'prerequisite-repair', 'exam-sprint', 'consistency-recovery', 'tutor-escalation', 'guardian-alert')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  reason text not null,
  recommended_action text not null,
  supporting_evidence jsonb not null default '[]'::jsonb,
  due_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_learning_workspace_memberships_user on public.learning_workspace_memberships(user_id, status);
create index if not exists idx_learning_workspace_memberships_workspace on public.learning_workspace_memberships(workspace_id, role);
create index if not exists idx_learning_workspace_cohorts_workspace on public.learning_workspace_cohorts(workspace_id, is_active);
create index if not exists idx_learning_concept_catalog_subject_topic on public.learning_concept_catalog(subject_name, topic_name);
create unique index if not exists uq_learning_concept_catalog_scope on public.learning_concept_catalog(curriculum, subject_name, topic_name, coalesce(subtopic_name, ''), concept_name);
create index if not exists idx_learning_mastery_ledger_user_subject on public.learning_concept_mastery_ledger(user_id, subject_name, topic_name, recorded_at desc);
create index if not exists idx_learning_interventions_user_status on public.learning_intervention_queue(user_id, status, priority);

create or replace function public.user_in_workspace(p_workspace_id uuid)
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
  );
$$;

alter table public.learning_workspaces enable row level security;
alter table public.learning_workspace_memberships enable row level security;
alter table public.learning_workspace_cohorts enable row level security;
alter table public.learning_concept_catalog enable row level security;
alter table public.learning_concept_mastery_ledger enable row level security;
alter table public.learning_intervention_queue enable row level security;

drop policy if exists "workspace members can view workspaces" on public.learning_workspaces;
create policy "workspace members can view workspaces"
on public.learning_workspaces
for select
using (owner_user_id = auth.uid() or public.user_in_workspace(id));

drop policy if exists "workspace owners can manage workspaces" on public.learning_workspaces;
create policy "workspace owners can manage workspaces"
on public.learning_workspaces
for all
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "members can view memberships in their workspace" on public.learning_workspace_memberships;
create policy "members can view memberships in their workspace"
on public.learning_workspace_memberships
for select
using (user_id = auth.uid() or public.user_in_workspace(workspace_id));

drop policy if exists "workspace owners can manage memberships" on public.learning_workspace_memberships;
create policy "workspace owners can manage memberships"
on public.learning_workspace_memberships
for all
using (
  exists (
    select 1 from public.learning_workspaces lw
    where lw.id = workspace_id and lw.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.learning_workspaces lw
    where lw.id = workspace_id and lw.owner_user_id = auth.uid()
  )
);

drop policy if exists "workspace members can view cohorts" on public.learning_workspace_cohorts;
create policy "workspace members can view cohorts"
on public.learning_workspace_cohorts
for select
using (public.user_in_workspace(workspace_id));

drop policy if exists "workspace owners manage cohorts" on public.learning_workspace_cohorts;
create policy "workspace owners manage cohorts"
on public.learning_workspace_cohorts
for all
using (
  exists (
    select 1 from public.learning_workspaces lw
    where lw.id = workspace_id and lw.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.learning_workspaces lw
    where lw.id = workspace_id and lw.owner_user_id = auth.uid()
  )
);

drop policy if exists "authenticated users can view concept catalog" on public.learning_concept_catalog;
create policy "authenticated users can view concept catalog"
on public.learning_concept_catalog
for select
using (auth.uid() is not null);

drop policy if exists "owners and admins manage concept catalog" on public.learning_concept_catalog;
create policy "owners and admins manage concept catalog"
on public.learning_concept_catalog
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "users view their mastery ledger" on public.learning_concept_mastery_ledger;
create policy "users view their mastery ledger"
on public.learning_concept_mastery_ledger
for select
using (user_id = auth.uid());

drop policy if exists "users insert their mastery ledger" on public.learning_concept_mastery_ledger;
create policy "users insert their mastery ledger"
on public.learning_concept_mastery_ledger
for insert
with check (user_id = auth.uid());

drop policy if exists "users update their mastery ledger" on public.learning_concept_mastery_ledger;
create policy "users update their mastery ledger"
on public.learning_concept_mastery_ledger
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users view their intervention queue" on public.learning_intervention_queue;
create policy "users view their intervention queue"
on public.learning_intervention_queue
for select
using (user_id = auth.uid() or (workspace_id is not null and public.user_in_workspace(workspace_id)));

drop policy if exists "users manage their intervention queue" on public.learning_intervention_queue;
create policy "users manage their intervention queue"
on public.learning_intervention_queue
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop trigger if exists set_timestamp_learning_workspaces on public.learning_workspaces;
create trigger set_timestamp_learning_workspaces
before update on public.learning_workspaces
for each row execute function public.set_timestamp();

drop trigger if exists set_timestamp_learning_workspace_memberships on public.learning_workspace_memberships;
create trigger set_timestamp_learning_workspace_memberships
before update on public.learning_workspace_memberships
for each row execute function public.set_timestamp();

drop trigger if exists set_timestamp_learning_workspace_cohorts on public.learning_workspace_cohorts;
create trigger set_timestamp_learning_workspace_cohorts
before update on public.learning_workspace_cohorts
for each row execute function public.set_timestamp();

drop trigger if exists set_timestamp_learning_concept_catalog on public.learning_concept_catalog;
create trigger set_timestamp_learning_concept_catalog
before update on public.learning_concept_catalog
for each row execute function public.set_timestamp();

drop trigger if exists set_timestamp_learning_intervention_queue on public.learning_intervention_queue;
create trigger set_timestamp_learning_intervention_queue
before update on public.learning_intervention_queue
for each row execute function public.set_timestamp();
