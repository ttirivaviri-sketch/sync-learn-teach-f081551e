

## Plan: Add "My Lessons" Button on Home Tab → Opens Lessons Sheet

Instead of adding session cards inline, add a prominent button at the top of the Home tab that opens a bottom sheet with the learner's confirmed/paid upcoming lessons.

### What the Learner Sees

- A prominent "My Lessons" button at the top of the Home tab (above AdvancedBooking), styled with a primary gradient and a badge showing the count of upcoming confirmed sessions
- Tapping it opens a bottom Sheet with their upcoming confirmed bookings — tutor name, subject, date/time, and action buttons (Join / Pay / Chat)
- If no lessons, the sheet shows a friendly empty state
- The button is always visible but the badge count only shows when there are sessions

### Technical Changes

**`src/pages/learner/LearnerHomeTab.tsx`**
- Add new props: `upcomingBookings`, `bookingsNeedingPayment`, `needsPayment`, `onJoinVideoSession`, `onPayNow`, `onStartCheckout`
- Add state for sheet open/close
- Render a "My Lessons" button (with `CalendarCheck` icon + count badge) above `<AdvancedBooking />`
- Render a `<Sheet>` (bottom side) with the list of upcoming confirmed bookings using existing `LiveBookingCard` or a compact lesson card
- Import `Sheet, SheetContent, SheetHeader, SheetTitle` from ui/sheet

**`src/pages/LearnerApp.tsx`**
- Pass `upcomingBookings` (filtered: status !== completed/canceled), `bookingsNeedingPayment`, `needsPayment`, `onJoinVideoSession: handleJoinVideoSession`, `onPayNow: handlePayNow`, `onStartCheckout: handleStartCheckout` to `LearnerHomeTab`

### Files Changed
- `src/pages/learner/LearnerHomeTab.tsx` — Add button + sheet + new props
- `src/pages/LearnerApp.tsx` — Pass additional booking props to LearnerHomeTab

