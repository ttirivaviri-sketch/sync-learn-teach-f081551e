-- ═══════════════════════════════════════════════════════════════════════════
-- Merge multiple permissive policies (advisor: multiple_permissive_policies)
--
-- Postgres evaluates EVERY permissive policy for a (table, role, action) on
-- every row — N policies means N expression evaluations per row. Because
-- permissive policies combine with OR, merging each group into one policy
-- with an OR'd condition is semantically identical and evaluated once.
--
-- Catalog-driven (reads pg_policies at run time), so it consolidates the
-- live database's actual policies regardless of which migration created
-- them. Idempotent: on re-run every group has a single policy and the
-- HAVING count(*) > 1 filter matches nothing.
--
-- Scope & safety:
--   • public schema only (storage.objects policies are intentionally split
--     between Supabase-managed and app-defined; left untouched).
--   • Groups by (table, action, EXACT roles array) — merging across
--     different role arrays could widen grants, so we never do it.
--   • UPDATE/ALL policies without an explicit WITH CHECK fall back to
--     their USING clause; the merge preserves that by coalescing.
--   • Expressions are taken verbatim from pg_policies (already
--     InitPlan-wrapped by 20260717093000).
-- ═══════════════════════════════════════════════════════════════════════════

do $merge$
declare
  g record;
  p record;
  quals  text[];
  checks text[];
  has_open_qual  boolean;  -- some policy had NULL qual (= allow all rows)
  has_open_check boolean;  -- some policy had NULL effective check (= allow all)
  merged_qual  text;
  merged_check text;
  new_name text;
  groups_merged int := 0;
  policies_dropped int := 0;
begin
  for g in
    select tablename, cmd, roles
    from pg_policies
    where schemaname = 'public'
      and permissive = 'PERMISSIVE'
    group by tablename, cmd, roles
    having count(*) > 1
  loop
    quals  := array[]::text[];
    checks := array[]::text[];
    has_open_qual  := false;
    has_open_check := false;

    for p in
      select policyname, qual, with_check
      from pg_policies
      where schemaname = 'public'
        and tablename  = g.tablename
        and cmd        = g.cmd
        and roles      = g.roles
        and permissive = 'PERMISSIVE'
      order by policyname
    loop
      -- NULL qual on a permissive policy means "all rows". If any policy
      -- in the group is open, the OR is trivially true — the merged policy
      -- must stay open (no USING clause), never the OR of the others.
      if p.qual is null then
        has_open_qual := true;
      else
        quals := quals || format('(%s)', p.qual);
      end if;

      -- Effective WITH CHECK: explicit, else (for UPDATE/ALL) falls back
      -- to the USING clause. NULL effective check likewise means open.
      if p.with_check is not null then
        checks := checks || format('(%s)', p.with_check);
      elsif g.cmd in ('UPDATE', 'ALL') then
        if p.qual is not null then
          checks := checks || format('(%s)', p.qual);
        else
          has_open_check := true;
        end if;
      elsif g.cmd = 'INSERT' then
        has_open_check := true;  -- INSERT with NULL check = allow all
      end if;

      execute format('drop policy %I on public.%I', p.policyname, g.tablename);
      policies_dropped := policies_dropped + 1;
    end loop;

    merged_qual  := case when has_open_qual  then null
                         else nullif(array_to_string(quals,  ' OR '), '') end;
    merged_check := case when has_open_check then null
                         else nullif(array_to_string(checks, ' OR '), '') end;

    -- Policy names are unique per table; two groups can share table+cmd
    -- with different role arrays, so include a short role digest.
    new_name := left(
      g.tablename || '_' || lower(g.cmd) || '_'
        || substr(md5(array_to_string(g.roles, ',')), 1, 6) || '_merged',
      63
    );

    execute format(
      'create policy %I on public.%I as permissive for %s to %s %s %s',
      new_name,
      g.tablename,
      g.cmd,
      array_to_string(g.roles, ', '),
      case when merged_qual  is not null then 'using ('      || merged_qual  || ')' else '' end,
      case when merged_check is not null then 'with check (' || merged_check || ')' else '' end
    );

    groups_merged := groups_merged + 1;
  end loop;

  raise notice 'merge_permissive_policies: merged % groups, dropped % original policies',
    groups_merged, policies_dropped;
end
$merge$;

-- Refresh planner statistics after the policy reshuffle.
ANALYZE;
