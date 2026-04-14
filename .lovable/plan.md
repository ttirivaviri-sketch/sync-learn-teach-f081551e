

## Plan: Replace Dev Mode with DevCard Virtual Payment Method

### What Changes

Remove the entire Dev Mode simulation layer (auth bypass, payment bypass, schedule bypass, 5-tap secret, /dev page, DevModeBanner). Replace it with a single "DevCard" — a virtual test card that appears as a saved payment method, simulates the payment flow through the real UI (no "bypassed" notifications), and allows testing the full booking → payment → video session flow using real authentication.

### Why This Is Better

- Users test with real auth (actual Supabase login), not synthetic sessions
- Payment flow is tested end-to-end through the same UI real users see
- No confusing "Dev Mode" banners or bypass notifications
- Other real cards (PayFast) work alongside DevCard

---

### Files to Delete

| File | Reason |
|---|---|
| `src/contexts/DevModeContext.tsx` | Entire dev mode context |
| `src/services/DevService.ts` | Dev simulation service |
| `src/components/DevModeBanner.tsx` | Floating dev panel |
| `src/pages/DevMode.tsx` | /dev passphrase page |

### Files to Modify

**1. `src/App.tsx`** — Remove DevModeProvider, DevModeBanner, /dev route import

**2. `src/pages/Index.tsx`** — Remove `registerTap` and `useDevMode` import; remove the click wrapper around HeroSection

**3. `src/pages/LearnerApp.tsx`** — Remove all `useDevMode` references. Remove dev-mode auth bypass (require real login). Remove dev session launching. Remove `bypassPayments`/`bypassSchedule` props passed to children. Clean up synthetic profile/bootstrap logic.

**4. `src/pages/TutorApp.tsx`** — Same cleanup: remove `useDevMode`, dev session logic, dev profile bootstrapping

**5. `src/components/PayFastPayment.tsx`** — Remove dev bypass UI. Add DevCard as a permanent entry in the saved methods list. When DevCard is selected for payment, simulate a 1.5s delay then:
  - Insert a real `payments` row with status `succeeded` via Supabase
  - Update booking status to `confirmed`
  - Fire the same toast as a real payment ("Payment confirmed!")
  - No "bypassed" or "dev mode" language

**6. `src/components/PaymentCheckout.tsx`** — Add DevCard as a selectable payment method option (alongside card, EFT, etc.) with a distinct icon and "Test Card" badge. When selected, process locally like PayFastPayment's DevCard flow instead of redirecting to PayFast.

**7. `src/hooks/useRealtimeBookings.ts`** — Remove `isDevUserId`, `buildDevBookings`, and all dev-mode branching. All bookings go through real Supabase.

**8. `src/components/ChatInterface.tsx`** — Remove `isDevMode` branching that loads fake conversations

**9. `src/components/learner-modals/PaymentMethodsModal.tsx`** — Remove `bypassPayments` prop and dev bypass card display. Add DevCard as a permanent listed method.

**10. `src/pages/learner/LearnerHomeTab.tsx`** — Remove any `bypassPayments`/`bypassSchedule` prop usage

**11. `src/pages/learner/LearnerProfileTab.tsx`** — Remove dev mode references if any

### DevCard Implementation Details

The DevCard is a **client-side virtual payment method** that:
- Appears in the payment method list with icon `🧪` and label "DevCard (Test)"
- Description: "Simulates payment — no real money charged"
- Badge: "Test"
- When used to pay:
  1. Shows a 1.5s loading spinner ("Processing test payment...")
  2. Inserts a row into `payments` table: `{ booking_id, payer_id, amount, status: 'succeeded', provider: 'devcard', currency: 'ZAR' }`
  3. Updates booking status to `confirmed` (or keeps it if already confirmed)
  4. Shows standard success toast: "Payment confirmed! Your session is now secured."
  5. Proceeds to the normal post-payment flow (booking card shows "Paid", video join becomes available)

The DevCard is always visible to all users (it's a test tool for the platform). It uses real database writes so the full notification pipeline (PostgreSQL triggers → notifications table → real-time subscription → toast) fires exactly as it would for a real payment.

### What Users Can Still Do

- **Add real cards**: The existing PayFast saved card flow remains untouched — users can pay with real cards, and those get tokenized/saved as before
- **Test full flow**: DevCard → payment succeeds → booking confirmed → join video session — all through the real UI with no "bypass" messaging

### Migration Note

No database migration needed — the `payments` table already supports arbitrary `provider` values (text field), so `'devcard'` works out of the box.

