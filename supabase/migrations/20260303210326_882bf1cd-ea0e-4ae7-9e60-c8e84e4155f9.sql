
-- Notifications table for in-app notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN NOT NULL DEFAULT false,
  related_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Refund requests table
CREATE TABLE public.refund_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own refund requests"
  ON public.refund_requests FOR SELECT
  USING (auth.uid() = requester_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create refund requests"
  ON public.refund_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Admin can update refund requests"
  ON public.refund_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to create notifications on booking status changes
CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Notify learner when booking is confirmed
  IF NEW.status = 'confirmed' AND OLD.status = 'requested' THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_booking_id)
    VALUES (NEW.learner_id, 'Booking Confirmed', 'Your tutor has accepted your booking request. Please complete payment to secure your session.', 'success', NEW.id);
  END IF;

  -- Notify learner when booking is canceled by tutor
  IF NEW.status = 'canceled' AND OLD.status IN ('requested', 'confirmed') THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_booking_id)
    VALUES (NEW.learner_id, 'Booking Cancelled', 'Your booking has been cancelled.', 'warning', NEW.id);
  END IF;

  -- Notify tutor when a new booking request comes in
  IF NEW.status = 'requested' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_booking_id)
    VALUES (NEW.tutor_id, 'New Booking Request', 'You have a new booking request from a student.', 'info', NEW.id);
  END IF;

  -- Notify both when session is completed
  IF NEW.status = 'completed' AND OLD.status = 'confirmed' THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_booking_id)
    VALUES (NEW.learner_id, 'Session Completed', 'Your session has been completed. Please leave a review!', 'success', NEW.id);
    INSERT INTO public.notifications (user_id, title, message, type, related_booking_id)
    VALUES (NEW.tutor_id, 'Session Completed', 'Session completed. Earnings will be added to your balance.', 'success', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_booking_status_change
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_status_change();

-- Trigger for new booking creation notification
CREATE OR REPLACE FUNCTION public.notify_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, related_booking_id)
  VALUES (NEW.tutor_id, 'New Booking Request', 'You have a new booking request from a student.', 'info', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_booking();

-- Trigger for payment status notifications
CREATE OR REPLACE FUNCTION public.notify_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'succeeded' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_booking_id)
    VALUES (NEW.payer_id, 'Payment Successful', 'Your payment of R' || NEW.amount || ' has been processed successfully.', 'success', NEW.booking_id);
  END IF;

  IF NEW.status = 'failed' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_booking_id)
    VALUES (NEW.payer_id, 'Payment Failed', 'Your payment of R' || NEW.amount || ' has failed. Please try again.', 'error', NEW.booking_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_status_change
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_status();

-- Make qualifications viewable by all authenticated users (for tutor discovery)
DROP POLICY IF EXISTS "Users can view their own qualifications" ON public.qualifications;
CREATE POLICY "Anyone can view qualifications"
  ON public.qualifications FOR SELECT
  USING (true);

-- Make reviews viewable by anyone (for tutor discovery)
DROP POLICY IF EXISTS "Users can view reviews for themselves" ON public.reviews;
CREATE POLICY "Anyone can view reviews"
  ON public.reviews FOR SELECT
  USING (true);

-- Create index for faster notification queries
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX idx_refund_requests_requester ON public.refund_requests(requester_id);
