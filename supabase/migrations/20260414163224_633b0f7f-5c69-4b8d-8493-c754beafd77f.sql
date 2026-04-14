CREATE OR REPLACE FUNCTION public.notify_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tutor_id UUID;
BEGIN
  IF NEW.status = 'succeeded' AND OLD.status = 'pending' THEN
    -- Notify learner
    INSERT INTO public.notifications (user_id, title, message, type, related_booking_id)
    VALUES (NEW.payer_id, 'Payment Successful', 'Your payment of R' || NEW.amount || ' has been processed. Your session is confirmed!', 'success', NEW.booking_id);
    -- Notify tutor
    SELECT tutor_id INTO v_tutor_id FROM public.bookings WHERE id = NEW.booking_id;
    IF v_tutor_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_booking_id)
      VALUES (v_tutor_id, 'Payment Received', 'A student has paid R' || NEW.amount || ' for your session. You''re all set!', 'success', NEW.booking_id);
    END IF;
  END IF;

  IF NEW.status = 'failed' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_booking_id)
    VALUES (NEW.payer_id, 'Payment Failed', 'Your payment of R' || NEW.amount || ' has failed. Please try again.', 'error', NEW.booking_id);
  END IF;

  RETURN NEW;
END;
$$;