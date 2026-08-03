
-- Map a school membership role to a learning workspace role
create or replace function public.los_map_school_role(_role text)
returns text
language sql
immutable
set search_path = public
as $$
  select case _role
    when 'school_owner' then 'owner'
    when 'school_admin' then 'admin'
    when 'school_teacher' then 'teacher'
    when 'school_tutor' then 'tutor'
    when 'school_student' then 'student'
    when 'school_guardian' then 'guardian'
    else 'student'
  end
$$;

create or replace function public.los_map_school_status(_status text)
returns text
language sql
immutable
set search_path = public
as $$
  select case _status
    when 'active' then 'active'
    when 'invited' then 'invited'
    when 'pending' then 'invited'
    else 'suspended'
  end
$$;

-- Ensure a learning workspace exists for a school; returns workspace id
create or replace function public.ensure_learning_workspace_for_school(_school_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  s record;
  owner uuid;
begin
  select id, name, slug, created_by into s from public.schools where id = _school_id;
  if s.id is null then
    return null;
  end if;

  select id into ws_id
  from public.learning_workspaces
  where (metadata->>'school_id')::uuid = _school_id
  limit 1;

  if ws_id is not null then
    return ws_id;
  end if;

  owner := coalesce(
    s.created_by,
    (select user_id from public.school_memberships
      where school_id = _school_id and user_id is not null
      order by case role::text when 'school_owner' then 0 when 'school_admin' then 1 when 'school_teacher' then 2 else 3 end
      limit 1)
  );

  if owner is null then
    return null;
  end if;

  insert into public.learning_workspaces (owner_user_id, name, slug, workspace_type, school_name, metadata)
  values (
    owner,
    s.name,
    coalesce(nullif(s.slug, ''), 'school-' || replace(_school_id::text, '-', '')),
    'school',
    s.name,
    jsonb_build_object('school_id', _school_id, 'source', 'school_layer')
  )
  on conflict (slug) do update set updated_at = now()
  returning id into ws_id;

  -- default automation schedule
  insert into public.learning_ops_automation_schedule (workspace_id, job_name, cadence, enabled)
  values
    (ws_id, 'study_plan_optimizer', 'daily', true),
    (ws_id, 'route_interventions_to_teachers', 'daily', true)
  on conflict (workspace_id, job_name) do nothing;

  return ws_id;
end;
$$;

-- Mirror one school membership into the learning workspace
create or replace function public.sync_school_membership_to_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  if new.user_id is null then
    return new;
  end if;

  ws_id := public.ensure_learning_workspace_for_school(new.school_id);
  if ws_id is null then
    return new;
  end if;

  insert into public.learning_workspace_memberships (workspace_id, user_id, role, status, metadata)
  values (
    ws_id,
    new.user_id,
    public.los_map_school_role(new.role::text),
    public.los_map_school_status(new.status::text),
    jsonb_build_object('school_membership_id', new.id, 'school_id', new.school_id)
  )
  on conflict (workspace_id, user_id) do update
    set role = excluded.role,
        status = excluded.status,
        metadata = excluded.metadata,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_school_membership_to_workspace on public.school_memberships;
create trigger trg_sync_school_membership_to_workspace
after insert or update of role, status, user_id on public.school_memberships
for each row execute function public.sync_school_membership_to_workspace();

-- Provision workspace when a school is created
create or replace function public.provision_workspace_for_new_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_learning_workspace_for_school(new.id);
  return new;
end;
$$;

drop trigger if exists trg_provision_workspace_for_new_school on public.schools;
create trigger trg_provision_workspace_for_new_school
after insert on public.schools
for each row execute function public.provision_workspace_for_new_school();

-- Backfill existing schools + memberships
do $$
declare
  r record;
  ws_id uuid;
begin
  for r in select id from public.schools where deleted_at is null loop
    ws_id := public.ensure_learning_workspace_for_school(r.id);
    if ws_id is null then
      continue;
    end if;
    insert into public.learning_workspace_memberships (workspace_id, user_id, role, status, metadata)
    select ws_id,
           m.user_id,
           public.los_map_school_role(m.role::text),
           public.los_map_school_status(m.status::text),
           jsonb_build_object('school_membership_id', m.id, 'school_id', m.school_id)
    from public.school_memberships m
    where m.school_id = r.id and m.user_id is not null
    on conflict (workspace_id, user_id) do update
      set role = excluded.role,
          status = excluded.status,
          updated_at = now();
  end loop;
end;
$$;

-- Ensure every existing workspace has the Phase 3.2 automation jobs enabled
insert into public.learning_ops_automation_schedule (workspace_id, job_name, cadence, enabled)
select w.id, j.job_name, 'daily', true
from public.learning_workspaces w
cross join (values ('study_plan_optimizer'), ('route_interventions_to_teachers')) as j(job_name)
on conflict (workspace_id, job_name) do nothing;
