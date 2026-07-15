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
