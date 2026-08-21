CREATE TABLE IF NOT EXISTS public.gsc_query_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_url text NOT NULL,
  range_days integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  dimension text NOT NULL DEFAULT 'query',
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_url, range_days, dimension)
);

GRANT SELECT ON public.gsc_query_snapshots TO authenticated;
GRANT ALL ON public.gsc_query_snapshots TO service_role;

ALTER TABLE public.gsc_query_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read search query snapshots" ON public.gsc_query_snapshots;
CREATE POLICY "Admins can read search query snapshots"
ON public.gsc_query_snapshots FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_gsc_query_snapshots_lookup
  ON public.gsc_query_snapshots (site_url, range_days, dimension);