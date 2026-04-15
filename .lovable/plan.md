

## Plan: Auto-Join Session After Successful Payment

### Problem
After paying for a booking, `PaymentCheckout` calls `onBack()` which dismisses the checkout screen and returns the user to the home tab. There's no transition to the video session — the user has to manually find the lesson and click "Join."

### Solution
After payment succeeds, automatically open the video meeting for the paid booking (if the session is within the joinable window), or show a clear "Join Now" prompt.

### Changes

**`src/pages/LearnerApp.tsx`**
- Replace the empty `onPaymentInitiated={() => {}}` with a handler that:
  1. Clears the checkout screen (`setCheckoutBooking(null)`)
  2. Checks if the booking is within the joinable window (15 min before → session end)
  3. If joinable: immediately open the video meeting (`setVideoMeetingData(...)` + `setShowVideoMeeting(true)`)
  4. If not yet joinable: show a toast saying "Payment confirmed! Your session will be available to join closer to the scheduled time."
- Move `onBack` logic into `onPaymentInitiated` so it handles both closing checkout AND launching the session

**`src/components/PaymentCheckout.tsx`**
- Update `onPaymentInitiated` callback signature to pass the booking object back: `onPaymentInitiated: (booking: BookingRequest) => void`
- In `handleDevCardPayment`, `handleSavedCardPayment`, and `handleNewCardPayment` success paths: call `onPaymentInitiated(booking)` instead of calling both `onPaymentInitiated()` and `onBack()` separately

### Flow After Fix
1. Learner pays → payment succeeds
2. Checkout dismisses automatically
3. If session is joinable now → Video meeting opens immediately
4. If session is later → Toast confirms payment, user returns to home

### Files Changed
- `src/pages/LearnerApp.tsx` — Wire up `onPaymentInitiated` to launch video session
- `src/components/PaymentCheckout.tsx` — Pass booking to `onPaymentInitiated` callback

