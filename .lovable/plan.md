

## Plan: Fix PayFast 400 Error + Uber-Style Payment UX

### Part 1: Fix the PayFast 400 Error

**Root Cause**: Line 168 of `payfast-create-payment/index.ts` includes `subscription_type: "1"`, which tells PayFast to create a recurring subscription. PayFast then requires a `frequency` field (e.g., monthly, weekly). Since this is a one-time booking payment, `subscription_type` should be removed entirely.

**File**: `supabase/functions/payfast-create-payment/index.ts`
- Remove `subscription_type: "1"` from the `paymentData` object (line 168)
- This single-line fix resolves the 400 Bad Request error

### Part 2: Uber-Style Payment UX

Redesign the payment flow to feel like the Uber wallet/checkout experience shown in the screenshots — a bottom sheet with saved cards, a clean booking summary, and one-tap payment.

**File**: `src/components/PaymentCheckout.tsx` — Major redesign:
- **Wallet-style layout**: Show saved payment methods as a list with card brand icons (Mastercard, Visa), last 4 digits, and status (active/expired) — similar to the Uber Wallet screenshot
- **Booking summary card at top**: Tutor name, subject, date/time, price — compact like the Uber trip selection card
- **One-tap payment**: Tapping a saved card immediately initiates payment (no separate confirm step for saved cards)
- **"Add payment method" button**: For new card payments, redirects to PayFast
- **DevCard row**: Kept at top with amber styling for test mode
- **Bottom fixed bar**: Shows selected payment method + total, with a single "Pay R{amount}" CTA button — similar to Uber's "Choose Uber Go" bar
- **Trust badge**: "Secured by PayFast" remains

**File**: `src/components/PayFastPayment.tsx` — Align with new design patterns (or deprecate if PaymentCheckout fully replaces it)

### Technical Details

- No database changes needed
- Edge function redeployment needed for the `subscription_type` fix
- Saved cards continue to use the existing `saved_payment_methods` table and `payfast-charge-token` edge function
- Server-side price validation already in place (booking price checked in edge function)

