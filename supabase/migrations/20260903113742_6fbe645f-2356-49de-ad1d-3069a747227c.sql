-- ── Welcome email tracking + signup trigger ─────────────────────────────
create table if not exists public.welcome_emails_sent (
  user_id uuid primary key,
  email text not null,
  sent_at timestamptz not null default now()
);

grant select on public.welcome_emails_sent to authenticated;
grant all on public.welcome_emails_sent to service_role;

alter table public.welcome_emails_sent enable row level security;

drop policy if exists welcome_emails_sent_self_select on public.welcome_emails_sent;
create policy welcome_emails_sent_self_select
  on public.welcome_emails_sent for select to authenticated
  using (user_id = (select auth.uid()));

create extension if not exists pg_net;

create or replace function public.notify_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _secret text;
begin
  select decrypted_secret into _secret
  from vault.decrypted_secrets where name = 'CRON_SECRET' limit 1;

  if _secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://uynoykcratwbcdzmsxfw.supabase.co/functions/v1/send-welcome-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _secret
    ),
    body := jsonb_build_object('user_id', new.id)
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_notify_welcome_email on public.profiles;
create trigger trg_notify_welcome_email
  after insert on public.profiles
  for each row execute function public.notify_welcome_email();

-- ── Security fix: prevent privilege escalation on LOS workspaces ─────────
drop policy if exists los_wm_update on public.learning_workspace_memberships;
create policy los_wm_update
  on public.learning_workspace_memberships for update to authenticated
  using (is_los_workspace_staff(workspace_id, (select auth.uid())))
  with check (
    -- Only the workspace owner may grant owner/admin roles
    (role not in ('owner','admin'))
    or exists (
      select 1 from public.learning_workspaces w
      where w.id = learning_workspace_memberships.workspace_id
        and w.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists los_ws_update on public.learning_workspaces;
create policy los_ws_update
  on public.learning_workspaces for update to authenticated
  using (owner_user_id = (select auth.uid()) or is_los_workspace_staff(id, (select auth.uid())))
  with check (
    -- Ownership can only be changed by the current owner
    owner_user_id = (select auth.uid())
    or exists (
      select 1 from public.learning_workspaces w
      where w.id = learning_workspaces.id
        and w.owner_user_id = learning_workspaces.owner_user_id
    )
  );