CREATE TABLE public.user_login_days (
  user_id uuid NOT NULL,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Johannesburg')::date,
  sessions integer NOT NULL DEFAULT 1,
  first_at timestamptz NOT NULL DEFAULT now(),
  last_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT ON public.user_login_days TO authenticated;
GRANT ALL ON public.user_login_days TO service_role;
ALTER TABLE public.user_login_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read login days" ON public.user_login_days FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_user_login()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_login_days(user_id) VALUES (auth.uid())
  ON CONFLICT (user_id, day) DO UPDATE SET sessions = user_login_days.sessions + 1, last_at = now();
  UPDATE public.profiles SET last_seen = now() WHERE id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.record_user_login() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_user_login() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_user_login_stats()
RETURNS TABLE(user_id uuid, days_30 integer, sessions_30 integer, total_days integer, last_login timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT d.user_id,
    count(*) FILTER (WHERE d.day >= current_date - 30)::int,
    coalesce(sum(d.sessions) FILTER (WHERE d.day >= current_date - 30),0)::int,
    count(*)::int, max(d.last_at)
  FROM public.user_login_days d GROUP BY d.user_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_user_login_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_login_stats() TO authenticated;