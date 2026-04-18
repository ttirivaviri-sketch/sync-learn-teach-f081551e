
The user wants to integrate **Paystack** (test mode) for online payments. Currently the project uses **PayFast** for tokenization, charging, and ITN webhooks.

## Approach

Add Paystack alongside PayFast (don't rip out PayFast yet — bookings, tokens, and refunds depend on it). Wire Paystack as a **new payment option** for card add + checkout, in test mode using a `PAYSTACK_SECRET_KEY` (sk_test_…).

### Why Paystack fits
- Native card tokenization via `authorization_code` returned on first charge — no separate "verify R1" dance like PayFast.
- Hosted "Initialize Transaction" flow → redirect to Paystack → callback to our app.
- Server-side `charge_authorization` for one-tap re-bookings (mirrors `payfast-charge-token`).
- Webhooks signed with HMAC-SHA512 of the secret key.

## What gets built

**1. Secret**
- `PAYSTACK_SECRET_KEY` (test: `sk_test_...`) — request via add_secret tool after plan approval.

**2. Edge functions** (3 new, in `supabase/functions/`)
- `paystack-initialize/index.ts` — POST to `https://api.paystack.co/transaction/initialize` with email + amount (kobo/cents) + callback_url + metadata `{ user_id, booking_id?, mode: "setup" | "charge" }`. Returns `authorization_url`.
- `paystack-charge-token/index.ts` — calls `/transaction/charge_authorization` using a saved `authorization_code` for one-tap booking pay.
- `paystack-webhook/index.ts` — verifies `x-paystack-signature` (HMAC-SHA512), handles `charge.success`: saves authorization to `saved_payment_methods` (last4, brand, bank, `authorization_code`, `signature`), and marks booking paid if `booking_id` in metadata.

**3. DB migration** — extend `saved_payment_methods` (additive, nullable):
- `provider text default 'payfast'` (existing rows unaffected)
- `paystack_authorization_code text`
- `paystack_signature text` (Paystack's reusable card fingerprint)
- `card_bank text`, `card_exp_month text`, `card_exp_year text`

**4. Frontend**
- `PaymentMethodsModal.tsx` — add a "Pay with Paystack" option in the "Add payment method" section (PayFast stays as-is). On click → invoke `paystack-initialize` with `mode: "setup"`, redirect to `authorization_url`.
- `PaymentSuccess.tsx` — handle Paystack callback param `?reference=...&provider=paystack` (verify via existing webhook flow; show success toast).
- Card list renders both providers; provider badge ("Paystack" / "PayFast") shown subtly under the card brand.

**5. Currency note**
PayFast = ZAR. Paystack supports ZAR for South African merchants but defaults to NGN/GHS/KES/USD. Will use the same `amount` as bookings (ZAR) and let the user's Paystack dashboard determine accepted currencies in test mode.

## Files

- NEW `supabase/functions/paystack-initialize/index.ts`
- NEW `supabase/functions/paystack-charge-token/index.ts`
- NEW `supabase/functions/paystack-webhook/index.ts`
- MIGRATION add provider + authorization columns to `saved_payment_methods`
- EDIT `src/components/learner-modals/PaymentMethodsModal.tsx` — add Paystack button
- EDIT `src/pages/PaymentSuccess.tsx` — handle Paystack `reference` callback
- EDIT `src/hooks/useBookingPayments.ts` — route to `paystack-charge-token` when saved method's `provider === 'paystack'`

## Out of scope (this round)
- Removing PayFast — keep both providers live so existing tokens/bookings keep working.
- Paystack subscriptions / split payments / refunds UI — can be added next.

## After approval, I will
1. Request `PAYSTACK_SECRET_KEY` via add_secret.
2. Run the migration.
3. Create the 3 edge functions + frontend edits.
4. Give you the webhook URL to paste into Paystack Dashboard → Settings → API Keys & Webhooks.
