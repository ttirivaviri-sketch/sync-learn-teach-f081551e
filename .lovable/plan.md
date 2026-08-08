# Make the app easy to find + gate Study Mode behind manual payment

Two changes: make the "open the app" path obvious on the landing page, and put Study Mode behind a one-free-daily-task trial followed by an admin-confirmed manual payment (deposit / EFT / EcoCash).

## Part 1 — Landing page discoverability

Today the only way in is a small "Get Started" button in the navbar (and it disappears into the hamburger on mobile). Changes:

- **Sticky mobile CTA bar** at the bottom of the landing page: "Start learning" (→ `/learner/auth`) plus a smaller "Sign in" link. Always visible while scrolling.
- **Mobile navbar**: show a compact "Start" button next to the hamburger so the entry point never hides behind a menu.
- **Hero**: make the primary button unmistakably the student action ("Start learning free"), with "Become a tutor" demoted to a secondary link.
- **Repeat entry points**: add a clear student CTA at the end of How It Works, Study Mode, and Pricing sections, and an "Open the app" link in the footer.
- **`/app` shortcut route** that redirects signed-in users straight into the learner app and everyone else to `/learner/auth` — a short link that can be shared in WhatsApp/posters.
- **PWA "Add to home screen" prompt** already exists; surface it once the user scrolls past the hero instead of only on load.

No copy/positioning rewrite beyond CTA wording; layout and visual style stay as they are.

## Part 2 — Trial + manual payment gate for Study Mode

### How it works for a learner
1. New learner gets **one free daily task** (their trial). They can complete it fully — questions, flashcards, exam question.
2. Once that task is finished (or a second one is requested), Study Mode is **locked** behind a paywall screen.
3. The paywall shows the price, the deposit/EFT/EcoCash payment details, and a form to submit proof: reference number, amount, method, and an optional screenshot upload.
4. Status becomes **Pending review**. The learner sees a clear "we're confirming your payment" state and can still use non-AI parts of the app (tutors, library, school workspace).
5. When an admin approves, access unlocks immediately (realtime) for the paid period.

### How it works for admin
A new **Payments → Manual deposits** queue in the admin area listing submitted proofs with learner, method, reference, amount, screenshot, and submitted date. Approve (with an access-until date) or reject with a reason. Both actions notify the learner.

## Technical notes

**Database**
- `manual_payment_requests`: learner id, method (`deposit` | `eft` | `ecocash`), reference, amount, currency, proof file path, status (`pending` | `approved` | `rejected`), reviewer id, review note, access period requested, timestamps. RLS: learner reads/creates own; admins read/update all; explicit GRANTs.
- Private storage bucket `payment-proofs` with owner-scoped upload and admin read.
- Extend `subscriptions` with `access_until` (timestamptz) and allow `status = 'manual_active'`; approval sets `access_until` and status. No PayFast code touched.
- `free_task_used` tracked from existing `daily_tasks` (count of tasks for the learner) rather than a new column — no extra state to keep in sync.

**Access rule (single source of truth)**
Extend `useSubscription` with `studyAccess()` returning one of `trial_task | active | locked | pending_review`, derived from: existing trial/premium logic, `access_until > now()`, pending manual request, and daily-task count. Everything else reads this hook — no duplicate rules.

**Enforcement**
- Client: `StudyModeWrapper` renders the paywall instead of Study Mode when locked; the Home tab's Study CTAs show a lock badge.
- Server: the gated AI edge functions (`generate-daily-task` and siblings using `requireCaller`) get a shared `requireStudyAccess` check in `_shared/ai-config.ts`, returning `402` with a `reason` so the client opens the paywall. Client-only gating is not enough since these are paid AI calls.

**Notifications**
Reuse the existing notifications table/trigger pattern for "payment approved" / "payment needs attention".

## Out of scope
Automating EcoCash/EFT confirmation, changing PayFast, or altering pricing values.
