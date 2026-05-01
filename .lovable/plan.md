## Goal

Two related additions on top of the existing payment + wallet infrastructure:

1. **Payment receipts** — both learner and tutor can download a clean, branded PDF proof-of-payment for any successful booking payment.
2. **Tutor payout (withdrawal) request flow** — tutors can submit a withdrawal request from their wallet balance to a bank account, and admins can approve/reject and mark as paid.

Auto session-level commission credits (existing `process-tutor-payout` function) stay as-is. This plan adds **withdrawals from the wallet balance**, which is what's currently missing.

## What already exists (we reuse)

- `payments` table with `pending|succeeded|failed|refunded`
- `tutor_wallets` (balance, total_earned, total_withdrawn already there)
- `tutor_payouts` (per-session commission records)
- `process-tutor-payout` edge function + `useTutorPayouts` hook
- `TutorWalletPanel`, `PaymentHistory`

## What's missing → what we add

### A. Receipt feature

**Frontend only**, no schema changes — receipts are derived from `payments` + booking + profiles data.

1. New util `src/lib/generateReceipt.ts`
   - Uses `jspdf` + `jspdf-autotable` (add via `bun add`).
   - Renders an Uber-style clean receipt: StudySync logo header (existing locked PNG, 175px rule respected), receipt #, date, payer name, tutor name, subject, session date/time, amount, currency, provider, provider ref, status, "PAID" stamp.
   - Footer: "StudySync — studysync.co.za", VAT note placeholder.
   - Returns a Blob the caller saves with `file-saver` (or via a hidden `<a download>`).

2. New hook `src/hooks/useReceipt.ts`
   - `downloadReceipt(paymentId)` — fetches the payment with joined booking + tutor + learner profiles (RLS already restricts to payer or admin; tutor access added via new policy below), renders via the util, triggers download.

3. **Receipt download button** in:
   - `PaymentHistory.tsx` — small "Receipt" icon-button per succeeded row.
   - `TutorWalletPanel.tsx` — "Receipt" link on each session payout row (resolves to the underlying payment via `tutor_payouts.payment_id`).
   - `BookingCard.tsx` — "Download Receipt" action when status is `completed` and a succeeded payment exists.

4. **DB change** (migration): add an RLS policy so a tutor can `SELECT` from `payments` for their own bookings (currently only the `payer_id` can read). Read-only.

### B. Tutor withdrawal flow

The existing `tutor_payouts` table is per-session commission credits. We need a separate concept: a tutor-initiated **withdrawal request** that debits the wallet balance.

**DB migration** — new table `payout_requests`:

```text
payout_requests
├─ id uuid pk
├─ tutor_id uuid (no FK to auth.users — store user id, validated in RLS)
├─ amount numeric(12,2)            -- requested withdrawal
├─ currency text default 'ZAR'
├─ method text                     -- 'bank_transfer' (only option for v1)
├─ bank_account_holder text
├─ bank_name text
├─ bank_account_number text        -- store as plaintext for v1; flag for encryption later
├─ bank_branch_code text
├─ status text                     -- 'pending' | 'approved' | 'paid' | 'rejected' | 'cancelled'
├─ admin_note text
├─ processed_by uuid               -- admin user id
├─ processed_at timestamptz
├─ created_at, updated_at
```

RLS:
- Tutor can `SELECT` / `INSERT` their own rows.
- Tutor can `UPDATE` only `status='pending' → 'cancelled'` on their own rows.
- Admins (`has_role(auth.uid(),'admin')`) can `SELECT`/`UPDATE` all.

**Postgres function** `request_tutor_withdrawal(_amount numeric, _bank_account_holder text, _bank_name text, _bank_account_number text, _bank_branch_code text)` (SECURITY DEFINER):
- Verifies `auth.uid()` has a wallet with `balance >= _amount` and `_amount >= 50` (min withdrawal).
- Atomically deducts from `tutor_wallets.balance` and inserts a `payout_requests` row with status `pending`.
- Returns the new request id.
- Wrapped in a transaction so a concurrent payout can't drain the balance below zero.

**Postgres function** `resolve_payout_request(_request_id uuid, _new_status text, _admin_note text)` (SECURITY DEFINER, admin-only):
- For `approved` → no balance change (already deducted at request time).
- For `paid` → bumps `tutor_wallets.total_withdrawn` and sets `last_withdrawal_at`.
- For `rejected` or `cancelled` → refunds amount back to `tutor_wallets.balance`.
- Updates `processed_by`, `processed_at`, `status`, `admin_note`.

**Frontend**

1. Update `src/integrations/supabase/types.ts` is auto-regenerated after migration — no manual edit.

2. New hook `src/hooks/useWithdrawals.ts`
   - `requestWithdrawal({ amount, bank... })`
   - `cancelRequest(id)`
   - `requests` list with realtime subscription.

3. Extend `TutorWalletPanel`:
   - Primary "Withdraw" CTA on the wallet card (disabled when `balance < 50`).
   - Opens `WithdrawalRequestModal`:
     - Amount input (validates ≤ balance, ≥ R50)
     - Bank account form (holder, bank name, account #, branch code) — pre-filled from last successful request via `localStorage`.
     - Submits via the RPC.
   - New "Withdrawal Requests" section listing pending/approved/paid/rejected requests with status badges and a "Cancel" button on pending ones.

4. Admin: `src/pages/admin/Payments.tsx` — add a "Withdrawal Requests" tab with table (tutor name, amount, bank details, status), and approve / mark-paid / reject buttons calling `resolve_payout_request`.

## Files

**New**
- `supabase/migrations/<ts>_payout_requests.sql` — table, RLS, RPCs, plus the `payments` SELECT policy for tutors.
- `src/lib/generateReceipt.ts`
- `src/hooks/useReceipt.ts`
- `src/hooks/useWithdrawals.ts`
- `src/components/WithdrawalRequestModal.tsx`
- `src/components/AdminWithdrawalsPanel.tsx`

**Edited**
- `src/components/PaymentHistory.tsx` — receipt button on succeeded rows.
- `src/components/TutorWalletPanel.tsx` — Withdraw CTA + requests list + receipt link.
- `src/components/booking-manager/BookingCard.tsx` — receipt button for completed sessions.
- `src/pages/admin/Payments.tsx` — admin withdrawal review tab.

**Deps**
- `bun add jspdf jspdf-autotable file-saver` + `bun add -D @types/file-saver`

## Notes / out of scope

- No actual money movement is automated — admin marks a request `paid` after manually doing the EFT. PayFast doesn't support outbound payouts in our current setup.
- Bank account numbers are stored plaintext for v1; we'll add a TODO to migrate to Vault-encrypted columns once volume justifies it.
- VAT receipt formatting (registered tax invoice) is not in scope — current PDF is a "proof of payment", which is what the user asked for.
- Existing `tutor_payouts` and `process-tutor-payout` are untouched.
