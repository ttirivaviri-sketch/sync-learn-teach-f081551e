-- Harden RLS to prevent cross-user data exposure.

-- 1) Profiles: remove unauthenticated/public tutor-profile access.
DROP POLICY IF EXISTS "Anyone can view tutor profiles for discovery" ON public.profiles;

DROP POLICY IF EXISTS "Authenticated users can view tutor profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view tutor profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (user_type = 'tutor');

-- 2) Tutor subjects: remove broad public/anonymous read.
DROP POLICY IF EXISTS "Anyone can view tutor subjects for discovery" ON public.tutor_subjects;
DROP POLICY IF EXISTS "Limited public access for individual tutor subjects" ON public.tutor_subjects;
DROP POLICY IF EXISTS "Authenticated users can view subjects for booking" ON public.tutor_subjects;

CREATE POLICY "Authenticated users can view tutor subjects"
  ON public.tutor_subjects
  FOR SELECT
  TO authenticated
  USING (true);

-- 3) Payments: ensure only admins can mutate; users may only read payments for their own bookings.
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;

CREATE POLICY "Users can view their own payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = payments.booking_id
        AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
    )
  );

CREATE POLICY "Admins can view all payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert payments"
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payments"
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete payments"
  ON public.payments
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) Payouts: explicitly block non-admin mutation and limit tutor reads to self.
DROP POLICY IF EXISTS "Tutors can view their own payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins can manage all payouts" ON public.payouts;

CREATE POLICY "Tutors can view their own payouts"
  ON public.payouts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = tutor_id);

CREATE POLICY "Admins can insert payouts"
  ON public.payouts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payouts"
  ON public.payouts
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete payouts"
  ON public.payouts
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
