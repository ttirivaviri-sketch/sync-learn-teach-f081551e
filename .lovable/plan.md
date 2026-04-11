

## Plan: Fix Build Errors + Video & Payment Flow Improvements

### Phase 1: Fix Current Build Errors

**File 1: `src/hooks/useBookingPayments.ts`**
- Add `import { logger } from '@/utils/logger';` at the top

**File 2: `supabase/functions/generate-tutor-booking-insights/index.ts`**
- Change line 168 from `recommendations: [],` to `recommendations: [] as string[],` to fix the `never[]` type inference

### Phase 2: Video Meeting Improvements (optional, user to confirm)

1. **Save session notes to database** -- persist notes from the summary screen to the booking record or a new `session_notes` column
2. **Connect rating to reviews table** -- on summary submit, insert into `reviews`
3. **Add reconnection logic** -- detect Jitsi disconnect events and auto-retry with exponential backoff
4. **Waiting indicator** -- show "Waiting for [partner]..." when `participantCount === 1`

### Phase 3: Payment Flow Improvements (optional, user to confirm)

1. **Server-side amount validation** -- in `payfast-create-payment`, compare `amount` from request body against `bookingData.price` and reject mismatches
2. **Payment expiry** -- auto-fail pending payments older than 24 hours (could be a scheduled function or checked on fetch)
3. **Receipt generation** -- generate a simple payment receipt after successful payment

### Technical Details

- Phase 1 is two single-line fixes that resolve all remaining build errors
- Phase 2 and 3 are incremental improvements that can be prioritized based on what matters most to you

