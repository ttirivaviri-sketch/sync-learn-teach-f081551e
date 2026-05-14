# Fix Start Trial flow

## Desired flow
`Start Trial` (landing) → `/learner/auth` (sign in / sign up) → Subscription step → Guided setup (academic profile) → Learner app

## Changes

### 1. Landing page CTAs → go straight to auth
**`src/components/HeroSection.tsx`**
- Replace `openTrialFlow("learner")` with `navigate("/learner/auth")` for both Start Trial buttons (lines ~110 and ~200).
- Tutor CTA continues to `/tutor/auth` directly (no trial picker).
- Also audit `TrustSection.tsx` and `StudyModeSection.tsx` for any other `/start-trial` links and point them at `/learner/auth`.

### 2. Retire the standalone TrialSignupFlow page
- Remove the `/start-trial` route from `src/App.tsx` and the `TrialSignupFlow` import.
- Delete `src/pages/TrialSignupFlow.tsx` (no longer needed; subscription now lives inside the app).

### 3. Add Subscription step inside the onboarding wizard
**`src/pages/LearnerOnboarding.tsx`** — restructure to 4 steps:

```
0. Welcome splash
1. Choose plan / start trial   ← NEW (re-added in correct position)
2. Academic profile (guided setup)
3. All set → /learner
```

- Bring back a Subscription step component using the existing `useSubscription` hook (mirrors the card that lives in Profile tab) with options: Start 7-day free trial (default, one-tap continue), choose paid plan, or "Skip for now" (still gets trial via DB trigger).
- Update `STEPS` labels and `step` state to `0 | 1 | 2 | 3`.
- Update the "skip to celebration if profile exists" effect so returning users still land correctly (e.g. profile present → jump to step 3).
- Keep `kickOffPersonalisation` firing right after academic profile save (unchanged).

### 4. Keep gating in `LearnerApp.tsx` unchanged
The existing redirect to `/learner/onboarding` when no academic profile exists still works — the new subscription step sits inside that same wizard, so users naturally hit it before reaching the app surface.

## Out of scope
- Tutor flow (tutors don't pay subscription).
- Pricing/plan content itself — reuse the same plan UI already used in the Profile subscription card.
