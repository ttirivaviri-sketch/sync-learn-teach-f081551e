-- 1. Payments: amount must match the booking price, currency restricted
DROP POLICY IF EXISTS "Payer can create payments" ON public.payments;
CREATE POLICY "Payer can create payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  payer_id = (SELECT auth.uid())
  AND upper(currency) IN ('ZAR', 'USD')
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = payments.booking_id
      AND b.learner_id = (SELECT auth.uid())
      AND payments.amount = b.price
  )
);

-- 2. library-diagrams: only objects backed by a real diagram resource
DROP POLICY IF EXISTS "Authenticated can read library diagrams" ON storage.objects;
CREATE POLICY "Authenticated can read library diagrams"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'library-diagrams'
  AND EXISTS (
    SELECT 1 FROM public.library_system_resources r
    WHERE r.kind = 'diagram'
      AND r.image_url = storage.objects.name
  )
);

-- 3. Remove stale study-resources reference from the admin policy
DROP POLICY IF EXISTS "admin select on public buckets" ON storage.objects;
CREATE POLICY "admin select on public buckets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = ANY (ARRAY['library','library-pdfs','profile-photos','question-diagrams','tutor-videos','tutorial-videos','tutorial-thumbnails'])
  AND has_role((SELECT auth.uid()), 'admin'::app_role)
);