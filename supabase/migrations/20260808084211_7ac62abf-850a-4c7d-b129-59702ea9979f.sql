CREATE OR REPLACE FUNCTION public.apply_manual_payment_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  NEW.reviewed_at := now();

  IF NEW.status = 'approved' THEN
    INSERT INTO public.subscriptions (user_id, plan, status, access_until, payment_provider, payment_ref, amount, currency)
    VALUES (NEW.user_id, 'premium', 'manual_active',
            GREATEST(now(), COALESCE((SELECT access_until FROM public.subscriptions WHERE user_id = NEW.user_id), now()))
              + (NEW.access_days || ' days')::interval,
            NEW.method, NEW.reference, NEW.amount, NEW.currency)
    ON CONFLICT (user_id) DO UPDATE
      SET plan = 'premium',
          status = 'manual_active',
          access_until = GREATEST(now(), COALESCE(public.subscriptions.access_until, now())) + (NEW.access_days || ' days')::interval,
          payment_provider = NEW.method,
          payment_ref = NEW.reference,
          amount = NEW.amount,
          currency = NEW.currency,
          updated_at = now();

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, 'Payment confirmed',
            'Your payment was confirmed. Study Mode is now unlocked.', 'success');
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, 'Payment needs attention',
            COALESCE(NEW.review_note, 'We could not confirm your payment. Please check your reference and submit again.'), 'warning');
  END IF;

  RETURN NEW;
END;
$$;