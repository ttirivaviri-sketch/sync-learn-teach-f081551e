

## Plan: Add Saved Cards with One-Tap Payment via PayFast Tokenization

### How it works

PayFast supports **tokenization** (also called "recurring billing"). After a learner's first card payment, PayFast returns a `token` in the ITN callback. We store that token and use the PayFast **ad hoc charge API** to charge the saved card instantly on future bookings -- no redirect, no re-entering card details.

### What changes

**1. Database: New `saved_payment_methods` table**

```sql
CREATE TABLE saved_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'payfast',
  token text NOT NULL,           -- PayFast tokenization token
  card_last4 text,               -- e.g. "4242"
  card_brand text,               -- e.g. "Visa"
  is_default boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- RLS: users can only see/manage their own saved methods
```

**2. Edge Function: Update `payfast-create-payment`**
- Add `subscription_type: 1` to the PayFast form data -- this tells PayFast to return a token after the first successful payment.

**3. Edge Function: Update `payfast-itn`**
- On `COMPLETE` status, check if `pfData.token` exists. If so, save it to `saved_payment_methods` for that user (upsert by token to avoid duplicates).

**4. New Edge Function: `payfast-charge-token`**
- Accepts `bookingId` + `savedMethodId`.
- Fetches the token from `saved_payment_methods`.
- Calls PayFast's ad hoc charge API (`https://api.payfast.co.za/subscriptions/{token}/adhoc`) to charge the card server-side.
- Creates a payment record, updates booking status on success.

**5. Frontend: Update `PayFastPayment` component**
- On mount, check if the user has a saved card.
- If yes, show a "Pay with Visa ...4242" button that calls `payfast-charge-token` directly (instant, no redirect).
- Still show "Pay with new card" as a fallback.
- Add a "Manage saved cards" option in the profile tab to delete saved methods.

### User experience after implementation

1. **First booking**: Learner pays via PayFast redirect as usual. Card is tokenized automatically.
2. **Future bookings**: Learner sees "Pay with Visa ...4242" -- one tap, payment completes instantly without leaving the app.
3. **Profile**: Learner can remove saved cards anytime.

### Technical details

- PayFast ad hoc API requires the merchant to be on a plan that supports tokenization -- you may need to verify this is enabled on your PayFast account.
- Tokens are stored encrypted-at-rest by Supabase. RLS ensures only the card owner can access them.
- The `payfast-charge-token` function validates the booking belongs to the user and the amount matches `bookingData.price` (server-side validation from Phase 3).

