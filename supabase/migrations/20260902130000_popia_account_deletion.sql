-- POPIA compliance: make account deletion actually work + archive table.
--
-- 1. Fix FK contradictions that would make `auth.admin.deleteUser()` FAIL:
--    • broadcasts.created_by / resources.created_by were
--      `NOT NULL ... ON DELETE SET NULL` — SET NULL into a NOT NULL column
--      raises an error and aborts the whole deletion.
--    • refund_requests.reviewed_by, sail_tasks.approved_by and
--      app_settings.updated_by had the default NO ACTION — deleting any
--      admin/reviewer who ever touched a row would be blocked.
--
-- 2. Create `account_deletion_archive`: POPIA s24 allows deletion OR
--    de-identification, and SA tax law requires financial records for 5
--    years. Before hard-deleting a user, the delete-account edge function
--    snapshots their payments/payouts (de-identified, keyed by a SHA-256
--    hash of the user id) into this table, then deletes the auth user so
--    every personal record cascades away.
--
-- RLS: enabled with NO policies — only the service role can read/write.

-- ── 1a. Drop the NOT NULL that contradicts ON DELETE SET NULL ────────────────
ALTER TABLE public.broadcasts ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.resources  ALTER COLUMN created_by DROP NOT NULL;

-- ── 1b. Re-point NO ACTION auth.users FKs to ON DELETE SET NULL ─────────────
DO $$
DECLARE
  rec record;
  cname text;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('public.refund_requests', 'reviewed_by'),
      ('public.sail_tasks',      'approved_by'),
      ('public.app_settings',    'updated_by')
    ) AS t(tbl, col)
  LOOP
    -- Skip if the table doesn't exist in this environment.
    IF to_regclass(rec.tbl) IS NULL THEN CONTINUE; END IF;

    SELECT conname INTO cname
    FROM pg_constraint
    WHERE conrelid = rec.tbl::regclass
      AND contype = 'f'
      AND confrelid = 'auth.users'::regclass
      AND conkey = ARRAY[(
        SELECT attnum FROM pg_attribute
        WHERE attrelid = rec.tbl::regclass AND attname = rec.col
      )]::smallint[]
      AND confdeltype = 'a';  -- NO ACTION only; leave SET NULL/CASCADE alone

    IF cname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', rec.tbl, cname);
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',
        rec.tbl,
        replace(rec.tbl, 'public.', '') || '_' || rec.col || '_fkey',
        rec.col
      );
    END IF;

    cname := NULL;
  END LOOP;
END $$;

-- ── 2. De-identified financial archive for deleted accounts ─────────────────
CREATE TABLE IF NOT EXISTS public.account_deletion_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 hash of the deleted auth.users id — lets us answer "was this
  -- user deleted and when" without storing any direct identifier.
  user_hash text NOT NULL,
  -- Payments / payouts snapshot kept for the 5-year tax retention window.
  financial_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  had_financial_records boolean NOT NULL DEFAULT false,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_archive_deleted_at
  ON public.account_deletion_archive (deleted_at);

-- RLS on, zero policies: service-role access only.
ALTER TABLE public.account_deletion_archive ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.account_deletion_archive IS
  'De-identified financial snapshots of deleted accounts. POPIA s24 de-identification + 5-year tax retention. Service role only.';
