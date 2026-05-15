# Fix "Failed to load bookings" error toast on Learner app

## Problem

On the learner home/onboarding screen the user sees a red **"Failed to load bookings"** toast. Console + network show the `/rest/v1/bookings` request failing with Safari's `TypeError: Load failed` — a generic transport error that fires when a fetch is aborted or times out (common on slow LTE).

Two compounding issues:

1. **`useRealtimeBookings` is mounted by many components** (`LearnerApp`, `LearnerActivityTab`, `LearnerProfileTab`, `PendingPaymentCard`, `LiveBookingCard`, `AdvancedBooking`, `RescheduleDialog`, `BookingCard`, …). Each instance fires the same `bookings?select=…` request on mount. Safari sometimes aborts duplicates → `Load failed`.
2. **Every transport failure fires a destructive toast.** A flaky network briefly shows a scary red banner even though the realtime channel will reconnect and refetch successfully a moment later.

## Fix (frontend only)

Edit `src/hooks/useRealtimeBookings.ts`:

- Treat `TypeError: Load failed` / generic network errors as **transient**: set `syncStatus = 'degraded'`, schedule one silent retry (~1.5s), and **do not toast**.
- Only show the destructive toast after 2 consecutive failures (real outage), not on the first blip.
- Add an `AbortController` per `loadBookings` call and abort the previous in-flight request when a new one starts, so the channel-reconnect path doesn't pile up duplicate fetches.

No schema or business-logic changes. Other booking components keep working as-is.

## Files

- `src/hooks/useRealtimeBookings.ts`

## Verification

- Reload learner home on mobile/Safari → no red error toast on first load.
- Disable network → after ~2 retries, a single non-destructive "Reconnecting…" indicator (existing `syncStatus`) shows; no toast spam.
- Re-enable network → bookings load and `syncStatus` returns to `synced`.
