DO $$
BEGIN
  IF to_regclass('public.broadcasts') IS NOT NULL THEN
    ALTER TABLE public.broadcasts ALTER COLUMN created_by DROP NOT NULL;
  END IF;
  IF to_regclass('public.resources') IS NOT NULL THEN
    ALTER TABLE public.resources ALTER COLUMN created_by DROP NOT NULL;
  END IF;
END $$;

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
      AND confdeltype = 'a';

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

CREATE TABLE IF NOT EXISTS public.account_deletion_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_hash text NOT NULL,
  financial_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  had_financial_records boolean NOT NULL DEFAULT false,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.account_deletion_archive TO service_role;

CREATE INDEX IF NOT EXISTS idx_account_deletion_archive_deleted_at
  ON public.account_deletion_archive (deleted_at);

ALTER TABLE public.account_deletion_archive ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.account_deletion_archive IS
  'De-identified financial snapshots of deleted accounts. POPIA s24 de-identification + 5-year tax retention. Service role only.';