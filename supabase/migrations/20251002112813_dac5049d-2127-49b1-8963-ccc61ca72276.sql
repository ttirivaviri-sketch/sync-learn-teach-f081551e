-- Phase 2: Infrastructure Hardening - Database Security Fixes

-- Fix search_path in existing functions to prevent privilege escalation
-- The has_role function already has proper search_path, but let's ensure others do too

-- Update handle_new_user function with proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, user_type)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'learner')
  );
  RETURN NEW;
END;
$function$;

-- Update enforce_booking_update function with proper search_path
CREATE OR REPLACE FUNCTION public.enforce_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    IF (NEW.learner_id IS DISTINCT FROM OLD.learner_id)
       OR (NEW.tutor_id IS DISTINCT FROM OLD.tutor_id)
       OR (NEW.tutor_subject_id IS DISTINCT FROM OLD.tutor_subject_id)
       OR (NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at)
       OR (NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes)
       OR (NEW.price IS DISTINCT FROM OLD.price)
    THEN
      RAISE EXCEPTION 'Only status may be modified by participants';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create audit logging table for security events
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
ON public.security_audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to log security events (callable from edge functions)
CREATE OR REPLACE FUNCTION public.log_security_event(
  _user_id uuid,
  _action text,
  _details jsonb DEFAULT NULL,
  _ip_address inet DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO public.security_audit_logs (user_id, action, details, ip_address, user_agent)
  VALUES (_user_id, _action, _details, _ip_address, _user_agent)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Add indexes for performance on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_online_status ON public.profiles(online_status) WHERE online_status = true;
CREATE INDEX IF NOT EXISTS idx_tutor_subjects_user_id ON public.tutor_subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_learner_id ON public.bookings(learner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tutor_id ON public.bookings(tutor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_at ON public.bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON public.security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON public.security_audit_logs(user_id);