-- =====================================================
-- Payout (withdrawal) requests + tutor payment visibility
-- =====================================================

-- Allow tutors to view payments for their own bookings (receipts)
DO $$ BEGIN
  CREATE POLICY "Tutors can view payments for their bookings"
    ON public.payments FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = payments.booking_id
          AND b.tutor_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- payout_requests table
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  method text NOT NULL DEFAULT 'bank_transfer',
  bank_account_holder text NOT NULL,
  bank_name text NOT NULL,
  bank_account_number text NOT NULL,
  bank_branch_code text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payout_requests_amount_positive CHECK (amount > 0),
  CONSTRAINT payout_requests_status_valid CHECK (
    status IN ('pending','approved','paid','rejected','cancelled')
  ),
  CONSTRAINT payout_requests_method_valid CHECK (method IN ('bank_transfer'))
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_tutor ON public.payout_requests(tutor_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON public.payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created ON public.payout_requests(created_at DESC);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Tutors view own payout requests"
    ON public.payout_requests FOR SELECT
    USING (auth.uid() = tutor_id OR has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins update payout requests"
    ON public.payout_requests FOR UPDATE
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tutors cancel own pending requests"
    ON public.payout_requests FOR UPDATE
    USING (auth.uid() = tutor_id AND status = 'pending')
    WITH CHECK (auth.uid() = tutor_id AND status IN ('pending','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Note: INSERT only via SECURITY DEFINER function below (no direct INSERT policy on purpose)

CREATE TRIGGER trg_payout_requests_updated_at
  BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- request_tutor_withdrawal: atomically debit wallet + create row
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_tutor_withdrawal(
  _amount numeric,
  _bank_account_holder text,
  _bank_name text,
  _bank_account_number text,
  _bank_branch_code text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_balance numeric;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _amount IS NULL OR _amount < 50 THEN
    RAISE EXCEPTION 'Minimum withdrawal is R50';
  END IF;

  IF coalesce(trim(_bank_account_holder),'') = ''
     OR coalesce(trim(_bank_name),'') = ''
     OR coalesce(trim(_bank_account_number),'') = '' THEN
    RAISE EXCEPTION 'Bank details are required';
  END IF;

  -- Lock the wallet row to prevent double-spend
  SELECT balance INTO v_balance
  FROM public.tutor_wallets
  WHERE tutor_id = v_uid
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.tutor_wallets
  SET balance = balance - _amount,
      updated_at = now()
  WHERE tutor_id = v_uid;

  INSERT INTO public.payout_requests (
    tutor_id, amount, bank_account_holder, bank_name,
    bank_account_number, bank_branch_code, status
  ) VALUES (
    v_uid, _amount, _bank_account_holder, _bank_name,
    _bank_account_number, _bank_branch_code, 'pending'
  ) RETURNING id INTO v_id;

  -- Notify the tutor
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_uid,
    'Withdrawal Requested',
    'Your withdrawal of R' || _amount || ' is pending review.',
    'info'
  );

  RETURN v_id;
END;
$$;

-- ============================================================
-- resolve_payout_request: admin approve / paid / reject; or
-- tutor cancel (status change handled by RLS UPDATE policy above
-- triggers this for cancellation flow as well)
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_payout_request(
  _request_id uuid,
  _new_status text,
  _admin_note text DEFAULT NULL
) RETURNS public.payout_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.payout_requests;
  v_is_admin boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_is_admin := has_role(v_uid, 'admin'::app_role);

  SELECT * INTO v_req
  FROM public.payout_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- Authorization
  IF _new_status = 'cancelled' THEN
    IF NOT (v_req.tutor_id = v_uid OR v_is_admin) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    IF v_req.status <> 'pending' THEN
      RAISE EXCEPTION 'Only pending requests can be cancelled';
    END IF;
  ELSE
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Admin only';
    END IF;
    IF _new_status NOT IN ('approved','paid','rejected') THEN
      RAISE EXCEPTION 'Invalid status';
    END IF;
    -- Allowed transitions
    IF v_req.status = 'paid' OR v_req.status = 'cancelled' OR v_req.status = 'rejected' THEN
      RAISE EXCEPTION 'Request already finalised';
    END IF;
    IF _new_status = 'paid' AND v_req.status NOT IN ('pending','approved') THEN
      RAISE EXCEPTION 'Cannot mark paid from current status';
    END IF;
  END IF;

  -- Wallet adjustments
  IF _new_status IN ('rejected','cancelled') THEN
    -- Refund the held amount back to the wallet
    UPDATE public.tutor_wallets
    SET balance = balance + v_req.amount,
        updated_at = now()
    WHERE tutor_id = v_req.tutor_id;
  ELSIF _new_status = 'paid' THEN
    UPDATE public.tutor_wallets
    SET total_withdrawn = total_withdrawn + v_req.amount,
        last_withdrawal_at = now(),
        updated_at = now()
    WHERE tutor_id = v_req.tutor_id;
  END IF;

  UPDATE public.payout_requests
  SET status = _new_status,
      admin_note = COALESCE(_admin_note, admin_note),
      processed_by = v_uid,
      processed_at = now(),
      updated_at = now()
  WHERE id = _request_id
  RETURNING * INTO v_req;

  -- Notify the tutor
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_req.tutor_id,
    CASE _new_status
      WHEN 'approved' THEN 'Withdrawal Approved'
      WHEN 'paid' THEN 'Withdrawal Paid'
      WHEN 'rejected' THEN 'Withdrawal Rejected'
      WHEN 'cancelled' THEN 'Withdrawal Cancelled'
    END,
    'Your withdrawal of R' || v_req.amount || ' is now ' || _new_status || '.',
    CASE _new_status
      WHEN 'paid' THEN 'success'
      WHEN 'approved' THEN 'success'
      WHEN 'rejected' THEN 'error'
      ELSE 'info'
    END
  );

  RETURN v_req;
END;
$$;