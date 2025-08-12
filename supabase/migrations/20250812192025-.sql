-- Create enums (idempotent)
DO $$ BEGIN
  CREATE TYPE public.booking_status AS ENUM ('requested','confirmed','completed','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending','succeeded','failed','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_status AS ENUM ('open','in_progress','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.priority_level AS ENUM ('low','medium','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_decision AS ENUM ('approved','rejected','needs_more_info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- bookings
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tutor_subject_id UUID NOT NULL REFERENCES public.tutor_subjects(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  status public.booking_status NOT NULL DEFAULT 'requested',
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.payment_status NOT NULL DEFAULT 'pending',
  provider TEXT,
  provider_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- support_tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status public.support_status NOT NULL DEFAULT 'open',
  priority public.priority_level NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- verification_reviews
CREATE TABLE IF NOT EXISTS public.verification_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES public.tutor_verifications(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  decision public.verification_decision NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers for updated_at
CREATE TRIGGER update_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS enable
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_reviews ENABLE ROW LEVEL SECURITY;

-- Policies: bookings
DROP POLICY IF EXISTS "Participants and admins can view bookings" ON public.bookings;
CREATE POLICY "Participants and admins can view bookings" ON public.bookings
FOR SELECT USING (
  auth.uid() = learner_id OR auth.uid() = tutor_id
  OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role)
);

DROP POLICY IF EXISTS "Learners can create their own bookings" ON public.bookings;
CREATE POLICY "Learners can create their own bookings" ON public.bookings
FOR INSERT WITH CHECK (auth.uid() = learner_id);

DROP POLICY IF EXISTS "Participants can update their bookings" ON public.bookings;
CREATE POLICY "Participants can update their bookings" ON public.bookings
FOR UPDATE USING (
  auth.uid() = learner_id OR auth.uid() = tutor_id
  OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role)
);

DROP POLICY IF EXISTS "Admins can delete bookings" ON public.bookings;
CREATE POLICY "Admins can delete bookings" ON public.bookings
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Enforce limited update surface for non-admin/support: only status may change
CREATE OR REPLACE FUNCTION public.enforce_booking_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role)) THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_booking_update_trigger ON public.bookings;
CREATE TRIGGER enforce_booking_update_trigger
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE PROCEDURE public.enforce_booking_update();

-- Policies: payments
DROP POLICY IF EXISTS "Payer and admins can view payments" ON public.payments;
CREATE POLICY "Payer and admins can view payments" ON public.payments
FOR SELECT USING (
  auth.uid() = payer_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role)
);

DROP POLICY IF EXISTS "Payer can create payments" ON public.payments;
CREATE POLICY "Payer can create payments" ON public.payments
FOR INSERT WITH CHECK (auth.uid() = payer_id);

DROP POLICY IF EXISTS "Only admins/support can update payments" ON public.payments;
CREATE POLICY "Only admins/support can update payments" ON public.payments
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

DROP POLICY IF EXISTS "Only admins can delete payments" ON public.payments;
CREATE POLICY "Only admins can delete payments" ON public.payments
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies: support_tickets
DROP POLICY IF EXISTS "Ticket stakeholders and admins/support can view" ON public.support_tickets;
CREATE POLICY "Ticket stakeholders and admins/support can view" ON public.support_tickets
FOR SELECT USING (
  auth.uid() = creator_id OR auth.uid() = assignee_id
  OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role)
);

DROP POLICY IF EXISTS "Creators can create tickets" ON public.support_tickets;
CREATE POLICY "Creators can create tickets" ON public.support_tickets
FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can update their tickets" ON public.support_tickets;
CREATE POLICY "Creators can update their tickets" ON public.support_tickets
FOR UPDATE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Assignees and admins/support can update tickets" ON public.support_tickets;
CREATE POLICY "Assignees and admins/support can update tickets" ON public.support_tickets
FOR UPDATE USING (auth.uid() = assignee_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

DROP POLICY IF EXISTS "Only admins can delete tickets" ON public.support_tickets;
CREATE POLICY "Only admins can delete tickets" ON public.support_tickets
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies: verification_reviews
DROP POLICY IF EXISTS "Only admins/support can view verification reviews" ON public.verification_reviews;
CREATE POLICY "Only admins/support can view verification reviews" ON public.verification_reviews
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

DROP POLICY IF EXISTS "Only admins/support can insert verification reviews" ON public.verification_reviews;
CREATE POLICY "Only admins/support can insert verification reviews" ON public.verification_reviews
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

DROP POLICY IF EXISTS "Only admins/support can update verification reviews" ON public.verification_reviews;
CREATE POLICY "Only admins/support can update verification reviews" ON public.verification_reviews
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

DROP POLICY IF EXISTS "Only admins can delete verification reviews" ON public.verification_reviews;
CREATE POLICY "Only admins can delete verification reviews" ON public.verification_reviews
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_bookings_learner ON public.bookings(learner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tutor ON public.bookings(tutor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_subject ON public.bookings(tutor_subject_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assignee ON public.support_tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_verification_reviews_verification ON public.verification_reviews(verification_id);