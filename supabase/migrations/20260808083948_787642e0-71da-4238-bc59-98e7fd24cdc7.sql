CREATE TABLE public.manual_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  method text NOT NULL CHECK (method IN ('deposit','eft','ecocash')),
  reference text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'ZAR',
  proof_path text,
  access_days integer NOT NULL DEFAULT 30 CHECK (access_days > 0 AND access_days <= 400),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.manual_payment_requests TO authenticated;
GRANT UPDATE ON public.manual_payment_requests TO authenticated;
GRANT ALL ON public.manual_payment_requests TO service_role;

ALTER TABLE public.manual_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own manual payment requests"
  ON public.manual_payment_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own manual payment requests"
  ON public.manual_payment_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins review manual payment requests"
  ON public.manual_payment_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_mpr_status_created ON public.manual_payment_requests (status, created_at DESC);
CREATE INDEX idx_mpr_user ON public.manual_payment_requests (user_id, created_at DESC);

CREATE TRIGGER update_manual_payment_requests_updated_at
  BEFORE UPDATE ON public.manual_payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS access_until timestamptz;

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

    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (NEW.user_id, 'Payment confirmed',
            'Your payment was confirmed. Study Mode is now unlocked.', 'payment');
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (NEW.user_id, 'Payment needs attention',
            COALESCE(NEW.review_note, 'We could not confirm your payment. Please check your reference and submit again.'), 'payment');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_manual_payment_review
  BEFORE UPDATE ON public.manual_payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.apply_manual_payment_review();