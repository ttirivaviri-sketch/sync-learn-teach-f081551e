

## Plan: Full App Health Check and Fixes

### Current State

The app has **one build error** and several areas that need attention for production readiness. Here is the complete scope.

---

### Phase 1: Fix Build Error (blocks everything)

**File: `src/studymode/components/ExamModeSession.tsx` line 586**

The `MathMarkdown` component expects `children: string` but receives two separate JSX expressions (a `string[]`). Fix by concatenating into a single string:

```tsx
// Before (broken)
<MathMarkdown>{question.substring(0, 200)}{question.length > 200 ? '...' : ''}</MathMarkdown>

// After (fixed)
<MathMarkdown>{question.substring(0, 200) + (question.length > 200 ? '...' : '')}</MathMarkdown>
```

---

### Phase 2: Core Functional Audit

These are the key user flows that need to work end-to-end:

**1. Authentication Flow**
- Learner signup/login via `/learner/auth`
- Tutor signup/login via `/tutor/auth`
- Admin login via `/admin/auth`
- Profile creation trigger (`handle_new_user`) is in place

**2. Booking Flow**
- Learner browses tutors and creates a booking (status: `requested`)
- Tutor accepts (status: `confirmed`)
- Payment triggered via PayFast or saved card
- ITN webhook updates payment status
- Video session gated behind `paymentStatus === 'succeeded'`
- Already implemented; needs end-to-end testing

**3. Payment Flow**
- PayFast redirect with tokenization (`subscription_type: 1`)
- ITN handler saves tokens for one-tap future payments
- `payfast-charge-token` for saved card payments
- Server-side amount validation against booking price
- All edge functions exist and are configured

**4. Study Mode**
- Subject management, daily tasks, quizzes, flashcards, exam mode
- AI-powered features via edge functions (generate-quiz, ai-tutor, etc.)
- Document upload and parsing
- All hooks and components are wired up

**5. Video Meeting**
- Pre-call screen, connecting screen, meeting controls
- Dev mode bypass for instant access (already implemented)
- Production mode gates behind payment status

**6. Chat System**
- Conversations between tutors and learners
- Real-time messages with read receipts
- RLS policies in place

---

### Phase 3: Edge Function Verification

The build error list mentions all edge functions -- these are **Deno-based Supabase functions** and are not part of the Vite/TypeScript build. They deploy separately and are already configured in `supabase/config.toml`. No action needed unless specific runtime failures surface.

---

### Phase 4: Polish Items (from previous discussion)

1. **Payment failed retry UX** -- improve error states with clear retry buttons in `PayFastPayment.tsx`
2. **Email/notification on payment success** -- currently only in-app; could add edge function for email
3. **"Start Lesson" gating** -- already implemented in `LiveBookingCard.tsx` with `needsPayment` check
4. **"Secured by PayFast" badge** -- already added to `PayFastPayment.tsx` and `PaymentCheckout.tsx`

---

### Summary of Required Work

| Task | Effort | Priority |
|------|--------|----------|
| Fix `MathMarkdown` children type on line 586 | 1 min | Critical (blocks build) |
| End-to-end testing of auth + booking + payment | Manual testing | High |
| Payment retry UX improvement | 15 min | Medium |
| Email notifications on payment | New edge function | Low |

The only code change needed right now is the single-line fix on `ExamModeSession.tsx`. Everything else is already implemented and needs testing rather than new code.

