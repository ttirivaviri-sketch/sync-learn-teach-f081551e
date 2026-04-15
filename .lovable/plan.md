

## Plan: Filter "My Lessons" to Paid, Upcoming-Only Sessions

### Problem
"My Lessons" currently shows all non-completed/non-canceled bookings. It should only show lessons that are:
1. **Confirmed** (status = "confirmed")
2. **Paid** (`!needsPayment(booking.id)`)
3. **Not yet past** (scheduled time + duration is in the future)

Completed lessons and lessons whose scheduled time has already passed must not appear.

### Changes

**`src/pages/LearnerApp.tsx`** — Line 369
- Change the filter from:
  ```
  b.status !== "completed" && b.status !== "canceled"
  ```
  to:
  ```
  b.status === "confirmed" && !needsPayment(b.id) &&
  (new Date(b.scheduled_at).getTime() + b.duration_minutes * 60000) > Date.now()
  ```

**`src/pages/learner/LearnerHomeTab.tsx`**
- Remove the "Pay Now" button branch from lesson cards (all displayed lessons are already paid)
- Update empty state text to: "No confirmed lessons" / "Paid and confirmed sessions will appear here"

### Files Changed
- `src/pages/LearnerApp.tsx` — Update filter on line 369
- `src/pages/learner/LearnerHomeTab.tsx` — Remove pay button, update empty state copy

