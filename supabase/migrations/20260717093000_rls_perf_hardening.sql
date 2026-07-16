-- ═══════════════════════════════════════════════════════════════════════════
-- RLS + FK performance hardening (Supabase advisory remediation, part 2 of 3)
--
--   §1  Rewrite every RLS policy on public tables that calls auth.uid() /
--       auth.role() / auth.jwt() / auth.email() directly, wrapping the call
--       as (SELECT auth.uid()) so Postgres evaluates it ONCE per query
--       (InitPlan) instead of once per row. This is the documented fix for
--       the `auth_rls_initplan` advisory and is semantically identical.
--
--   §2  Drop exact-duplicate RLS policies (same table, command, roles,
--       USING and WITH CHECK after normalization) keeping the first name
--       alphabetically. Only provably identical policies are touched —
--       merely *overlapping* policies are left alone.
--
--   §3  Create covering indexes for every foreign-key constraint on public
--       tables whose referencing column(s) have no supporting index
--       (`unindexed_foreign_keys` advisory).
--
-- Everything is generated from the live catalog, so this migration also
-- covers policies/FKs created outside these migration files.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── §1 InitPlan-wrap auth functions in RLS policies ────────────────────────

DO $$
DECLARE
  pol record;
  new_qual  text;
  new_check text;
  roles_sql text;
  cmd_sql   text;
  rewritten int := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        qual ~ 'auth\.(uid|role|jwt|email)\(\)'
        OR with_check ~ 'auth\.(uid|role|jwt|email)\(\)'
      )
  LOOP
    -- Wrap bare auth.<fn>() calls. pg_get_expr renders already-wrapped calls
    -- as "( SELECT auth.uid() AS uid)"; neutralize those first so they are
    -- not double-processed, wrap the remaining bare calls, then restore.
    -- (Postgres ARE regexes have no lookbehind, hence the placeholder dance.)
    new_qual  := pol.qual;
    new_check := pol.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual,
        '\(\s*SELECT\s+auth\.(uid|role|jwt|email)\(\)\s*(AS\s+\w+\s*)?\)',
        '__PREWRAPPED_\1__', 'g');
      new_qual := regexp_replace(new_qual,
        'auth\.(uid|role|jwt|email)\(\)',
        '(SELECT auth.\1())', 'g');
      new_qual := regexp_replace(new_qual,
        '__PREWRAPPED_(uid|role|jwt|email)__',
        '(SELECT auth.\1())', 'g');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check,
        '\(\s*SELECT\s+auth\.(uid|role|jwt|email)\(\)\s*(AS\s+\w+\s*)?\)',
        '__PREWRAPPED_\1__', 'g');
      new_check := regexp_replace(new_check,
        'auth\.(uid|role|jwt|email)\(\)',
        '(SELECT auth.\1())', 'g');
      new_check := regexp_replace(new_check,
        '__PREWRAPPED_(uid|role|jwt|email)__',
        '(SELECT auth.\1())', 'g');
    END IF;

    -- Skip if nothing actually changed (defensive).
    IF new_qual IS NOT DISTINCT FROM pol.qual
       AND new_check IS NOT DISTINCT FROM pol.with_check THEN
      CONTINUE;
    END IF;

    roles_sql := array_to_string(pol.roles, ', ');
    cmd_sql   := pol.cmd;

    EXECUTE format('DROP POLICY %I ON %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s %s %s',
      pol.policyname, pol.schemaname, pol.tablename,
      pol.permissive,
      cmd_sql,
      roles_sql,
      COALESCE('USING (' || new_qual || ')', ''),
      COALESCE('WITH CHECK (' || new_check || ')', '')
    );

    rewritten := rewritten + 1;
  END LOOP;

  RAISE NOTICE 'InitPlan-wrapped % RLS policies', rewritten;
END $$;

-- ─── §2 Drop exact-duplicate policies ───────────────────────────────────────

DO $$
DECLARE
  dup record;
  dropped int := 0;
BEGIN
  FOR dup IN
    SELECT tablename, policyname
    FROM (
      SELECT
        tablename,
        policyname,
        row_number() OVER (
          PARTITION BY tablename, cmd, permissive,
                       array_to_string(roles, ','),
                       COALESCE(qual, ''), COALESCE(with_check, '')
          ORDER BY policyname
        ) AS rn
      FROM pg_policies
      WHERE schemaname = 'public'
    ) d
    WHERE d.rn > 1
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', dup.policyname, dup.tablename);
    dropped := dropped + 1;
  END LOOP;

  RAISE NOTICE 'Dropped % exact-duplicate RLS policies', dropped;
END $$;

-- ─── §3 Index every unindexed foreign key ───────────────────────────────────

DO $$
DECLARE
  fk record;
  idx_name text;
  created int := 0;
BEGIN
  FOR fk IN
    SELECT
      c.conrelid::regclass::text AS table_name,
      c.conname,
      (SELECT array_agg(a.attname ORDER BY k.ord)
         FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      ) AS cols
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      -- no existing index whose leading columns cover the FK columns
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND (string_to_array(i.indkey::text, ' ')::int2[])[1:array_length(c.conkey, 1)]
              @> c.conkey
          AND (string_to_array(i.indkey::text, ' ')::int2[])[1:array_length(c.conkey, 1)]
              <@ c.conkey
      )
  LOOP
    idx_name := left('idx_fk_' || replace(fk.table_name, 'public.', '')
                     || '_' || array_to_string(fk.cols, '_'), 63);
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%s)',
                     idx_name, fk.table_name,
                     array_to_string(fk.cols, ', '));
      created := created + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not index FK % on %: %', fk.conname, fk.table_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Created % FK covering indexes', created;
END $$;

ANALYZE;
