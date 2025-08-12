-- Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE public.message_channel AS ENUM ('sms','ussd','whatsapp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_direction AS ENUM ('inbound','outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.offline_request_status AS ENUM (
    'received','parsed','notified_tutor','tutor_confirmed','tutor_declined','synced','failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tables
CREATE TABLE IF NOT EXISTS public.location_codes (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  region TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offline_booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel public.message_channel NOT NULL,
  learner_msisdn TEXT NOT NULL,
  tutor_msisdn TEXT,
  learner_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tutor_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject_code TEXT,
  subject_name TEXT,
  scheduled_at TIMESTAMPTZ,
  location_code TEXT REFERENCES public.location_codes(code) ON DELETE SET NULL,
  cell_tower_id TEXT,
  location_pin TEXT,
  raw_payload JSONB,
  status public.offline_request_status NOT NULL DEFAULT 'received',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel public.message_channel NOT NULL,
  direction public.message_direction NOT NULL,
  from_msisdn TEXT,
  to_msisdn TEXT,
  body TEXT NOT NULL,
  provider_message_id TEXT,
  related_request_id UUID REFERENCES public.offline_booking_requests(id) ON DELETE SET NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ussd_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msisdn TEXT NOT NULL,
  provider_session_id TEXT NOT NULL,
  current_step TEXT,
  data JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider_session_id)
);

-- Triggers for updated_at
CREATE TRIGGER update_location_codes_updated_at
BEFORE UPDATE ON public.location_codes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_offline_booking_requests_updated_at
BEFORE UPDATE ON public.offline_booking_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ussd_sessions_updated_at
BEFORE UPDATE ON public.ussd_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.location_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ussd_sessions ENABLE ROW LEVEL SECURITY;

-- Policies: location_codes
DROP POLICY IF EXISTS "Anyone can view location codes" ON public.location_codes;
CREATE POLICY "Anyone can view location codes" ON public.location_codes
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admin can modify location codes" ON public.location_codes;
CREATE POLICY "Only admin can modify location codes" ON public.location_codes
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policies: offline_booking_requests
DROP POLICY IF EXISTS "Users can view their related offline requests" ON public.offline_booking_requests;
CREATE POLICY "Users can view their related offline requests" ON public.offline_booking_requests
FOR SELECT USING (
  auth.uid() = created_by_profile_id
  OR auth.uid() = learner_profile_id
  OR auth.uid() = tutor_profile_id
  OR has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Only admin can write offline requests" ON public.offline_booking_requests;
CREATE POLICY "Only admin can write offline requests" ON public.offline_booking_requests
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policies: message_logs (admin only)
DROP POLICY IF EXISTS "Only admin can access message logs" ON public.message_logs;
CREATE POLICY "Only admin can access message logs" ON public.message_logs
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policies: ussd_sessions (admin only)
DROP POLICY IF EXISTS "Only admin can access ussd sessions" ON public.ussd_sessions;
CREATE POLICY "Only admin can access ussd sessions" ON public.ussd_sessions
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_location_codes_active ON public.location_codes(active);
CREATE INDEX IF NOT EXISTS idx_offline_requests_learner_msisdn ON public.offline_booking_requests(learner_msisdn);
CREATE INDEX IF NOT EXISTS idx_offline_requests_tutor_msisdn ON public.offline_booking_requests(tutor_msisdn);
CREATE INDEX IF NOT EXISTS idx_offline_requests_status ON public.offline_booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_message_logs_related_request ON public.message_logs(related_request_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_provider_id ON public.message_logs(provider_message_id);