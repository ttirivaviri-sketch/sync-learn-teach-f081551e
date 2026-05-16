
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'ZAR',
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text;

CREATE TABLE IF NOT EXISTS public.fx_rates (
  base text NOT NULL,
  quote text NOT NULL,
  rate numeric NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base, quote)
);
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fx_rates readable by all" ON public.fx_rates;
CREATE POLICY "fx_rates readable by all" ON public.fx_rates FOR SELECT USING (true);

INSERT INTO public.fx_rates (base, quote, rate) VALUES
  ('ZAR','ZAR',1),
  ('ZAR','USD',0.054),
  ('ZAR','GBP',0.043)
ON CONFLICT (base, quote) DO NOTHING;
