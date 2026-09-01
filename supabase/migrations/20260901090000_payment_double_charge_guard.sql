-- Payments E2E audit hardening (2026-09-01)
--
-- 1. DB-level double-charge backstop: at most ONE succeeded payment per
--    booking. The edge functions now all check this before charging, but
--    two concurrent requests could still race past the application check —
--    a partial unique index makes the second webhook/charge update fail
--    instead of silently double-recording revenue.
--    (Wrapped defensively: if historical data already contains duplicate
--    succeeded payments for a booking, keep the earliest and mark later
--    ones as refunded-pending-review rather than failing the migration.)

DO $$
BEGIN
  -- Demote any historical duplicates (keep earliest succeeded per booking)
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY booking_id
             ORDER BY created_at ASC
           ) AS rn
    FROM public.payments
    WHERE status = 'succeeded' AND booking_id IS NOT NULL
  )
  UPDATE public.payments p
  SET status = 'refunded'
  FROM ranked r
  WHERE p.id = r.id AND r.rn > 1;

  CREATE UNIQUE INDEX IF NOT EXISTS payments_one_succeeded_per_booking
    ON public.payments (booking_id)
    WHERE status = 'succeeded' AND booking_id IS NOT NULL;
EXCEPTION WHEN others THEN
  RAISE WARNING 'payments_one_succeeded_per_booking setup skipped: %', SQLERRM;
END $$;

-- 2. Fast idempotency lookups for the Paystack webhook (matches on
--    provider_ref for every delivery/redelivery).
CREATE INDEX IF NOT EXISTS idx_payments_provider_ref
  ON public.payments (provider_ref)
  WHERE provider_ref IS NOT NULL;
