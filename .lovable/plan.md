## Goal

Mirror the published app's subscription flow exactly inside the learner app. Six screens, same copy and structure as the screenshots:

```
1. Sign in / Welcome           (already exists — no change)
2. Choose Your Plan            (3 cards: AI Study Mode, Tutor Sessions, Combo · Most Popular)
3. AI Study Mode Plans         (Moderate / Premium toggle, perks, 7-day free trial CTA)
4. Tutor Sessions              (subjects chips, lessons-per-week slider 1–5, monthly summary)
5. Build Combo Plan            (Moderate/Premium toggle, lessons/week slider, savings line)
6. Review & Pay                (line-itemed summary, "Start My Plan", trust bullets)
```

The same flow runs in **two** places:
- `LearnerOnboarding` step 1 — replaces the current inline `PlanPicker`.
- `Profile → Subscription & Plans` — replaces the current inline `PlanPicker`.

## New components — `src/components/subscription/`

- `SubscriptionFlow.tsx` — orchestrator. Internal step state `'choose' | 'ai' | 'tutor' | 'combo' | 'review'`, back-arrow header, animated transitions. Props: `mode: 'onboarding' | 'profile'`, `onComplete?(plan)`. This is the single component dropped into both call-sites.
- `PlanChooser.tsx` — screen 2. Three cards (AI = blue, Tutor = green, Combo = purple with "★ Most Popular" badge). "Cancel or change anytime" footnote.
- `AIPlanScreen.tsx` — screen 3. Robot avatar, **Moderate / Premium** segmented toggle, dynamic perks list, primary CTA = "Start 7-Day Free Trial" (or "Choose Plan" outside trial), secondary "Continue Without Trial".
- `TutorSessionsScreen.tsx` — screen 4. Subject chips (multi-select, optional, sourced from `useLearnerSubjects` with the screenshot's static fallback), lessons-per-week slider 1–5, monthly summary `R300 × 4 × N`, "Continue to Payment" CTA.
- `ComboScreen.tsx` — screen 5. Moderate/Premium toggle (R179.99 / R399.99), discount-applied banner, lessons-per-week slider, line-itemed monthly summary, green "You save Rxx / month 🎉" line, "Continue to Payment" CTA.
- `ReviewPayScreen.tsx` — screen 6. "Combo Plan / AI Plan / Tutor Sessions" header card with line items + total, trust bullets (Cancel anytime, No long-term contracts, Secure payments, 7-day free trial for AI), "Start My Plan" CTA, trial-end note.

All screens use existing semantic tokens (no new colors added to `index.css`/`tailwind.config.ts`), shadcn primitives (`Card`, `Button`, `Slider`, `Badge`, `Toggle`/segmented), and the glassmorphism mesh background already in use. Pricing pulled from `PRICING` in `src/sail/types/index.ts`.

## Wiring

- `src/pages/LearnerOnboarding.tsx` — step 1 `Card` body becomes `<SubscriptionFlow mode="onboarding" onComplete={() => setStep(2)} />`. The step-1 outer header copy moves into `PlanChooser` so it's only visible on the chooser screen.
- `src/pages/learner/LearnerProfileTab.tsx` — `<PlanPicker mode="profile" />` is replaced with `<SubscriptionFlow mode="profile" />`. `PlanChooser` shows a "Selected" badge on the user's current plan group.

## Persistence & payment

- "Start My Plan" / "Start 7-Day Free Trial" calls existing `supabase.rpc("set_subscription_plan", { p_plan })` with the resolved key (`ai_moderate | ai_premium | tutor_payg | combo_moderate | combo_premium`) — same as today.
- For paid plans outside the trial window, route to the existing PayFast checkout (`payfast-create-payment` edge function via the current `useBookingPayments` flow). During an active 7-day trial, just save the plan and resolve `onComplete` (matches current behaviour — no charge until trial ends).
- `lessons_per_week` and `selected_subjects` are persisted to `localStorage` under `subscription:preferences:{userId}` so the Tutor booking flow can pre-fill. **No DB schema change.**

## Removed

- `src/components/subscription/PlanPicker.tsx` — deleted after both call-sites switch to `SubscriptionFlow`.

## Out of scope

- No DB migration. Reuses `subscriptions` table and `set_subscription_plan` RPC as-is.
- No edge-function changes.
- No landing-page pricing section.
- Sign-in / Welcome screen unchanged (screen 1 already matches).
- Tutor app subscription UI unchanged.

## Validation

- Onboarding → Choose Your Plan → AI → toggle Premium → Start 7-Day Free Trial → Review & Pay shows "AI Plan (Premium) R500/mo" → Start My Plan → `ai_premium` saved, advances to onboarding step 2.
- Onboarding → Tutor Sessions → pick 2 subjects + slider 3 → monthly summary R3,600 → Continue → Review → `tutor_payg` saved.
- Onboarding → Combo → Premium + slider 4 → savings line shows correct delta vs standalone AI Premium → Continue → Review shows two line items + total → `combo_premium` saved.
- Profile → Subscription opens at chooser, current plan group has "Selected" badge, back arrow works at every step, refresh returns to chooser.
