CREATE TABLE IF NOT EXISTS public.enquiry_status (
  event_id UUID PRIMARY KEY REFERENCES public.landing_events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','answered','cancelled')),
  note TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquiry_status TO authenticated;
GRANT ALL ON public.enquiry_status TO service_role;

ALTER TABLE public.enquiry_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage enquiry status"
ON public.enquiry_status FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));