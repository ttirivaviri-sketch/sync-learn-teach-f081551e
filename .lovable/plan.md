

## Plan: Improve In-App Payment Notifications

### What Already Exists
- A PostgreSQL trigger (`notify_payment_status`) that creates notification rows when payment status changes to `succeeded` or `failed`
- Real-time subscription in `useNotifications` that pushes new notifications to the UI
- `NotificationCenter` component that displays them in a bell popover
- `PaymentSuccess` and `PaymentCancelled` pages with booking details

### What's Missing / Can Be Improved

**1. Tutor is not notified when payment succeeds**
The current trigger only notifies the `payer_id` (learner). The tutor should also get a "Payment received — session secured" notification.

**Fix**: Add a migration with an updated `notify_payment_status` function that also inserts a notification for the tutor (looked up via `booking.tutor_id`).

**2. No instant sonner toast on payment events**
When a real-time payment update arrives, the notification silently appears in the bell icon. There's no visible toast to grab attention.

**Fix**: In the `useBookingPayments` hook, fire a `sonner` toast when a real-time payment status change is detected (`succeeded` or `failed`).

**3. PaymentSuccess page has no success animation**
The green checkmark is static. A brief celebration animation would feel more premium.

**Fix**: Add a subtle scale-in + pulse CSS animation to the success icon on `PaymentSuccess.tsx`.

**4. Payment failed state lacks a prominent retry button**
The `PaymentCancelled` page has a retry button, but `PaymentSuccess` page's failed state only shows a generic "Try Again" that navigates back.

**Fix**: Add a direct "Retry Payment" button on the failed state in `PaymentSuccess.tsx`.

---

### Files to Change

| File | Change |
|------|--------|
| New migration SQL | Update `notify_payment_status` to also notify the tutor |
| `src/hooks/useBookingPayments.ts` | Add sonner toast on real-time payment status change |
| `src/pages/PaymentSuccess.tsx` | Add success animation + improve failed retry UX |

### Technical Details

**Migration** — Replace the trigger function:
```sql
CREATE OR REPLACE FUNCTION public.notify_payment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
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
  -- ... keep failed notification as-is
END;
$$;
```

**Sonner toast** — In the real-time handler of `useBookingPayments.ts`:
```typescript
import { toast } from "sonner";
// In the postgres_changes callback:
if (newPayment.status === 'succeeded') {
  toast.success("Payment confirmed!", { description: "Your session is now secured." });
} else if (newPayment.status === 'failed') {
  toast.error("Payment failed", { description: "Please try again or use a different card." });
}
```

