## Problems found

1. **Loop / never enters app**
  - `SuccessSplash` calls `setTimeout(onCta, autoAdvanceMs)` directly in the render body, so every re-render schedules another `navigate("/learner")`. Stacked navigations + the LearnerApp redirect-to-onboarding effect (which only checks `academicProfile`) cause the user to bounce back into onboarding.
  - `LearnerOnboarding` only jumps a returning user past steps when `step === 2` (`if (profile && step === 2) setStep(3)`). A user who already finished onboarding is forced back to Step 0 (Welcome) every time they visit `/learner` and the wizard never auto-completes.
  - `LearnerApp` gates onboarding off `academicProfile` presence only, ignoring `profiles.onboarding_completed_at`. After the wizard finishes once, refreshing the app can still bounce them back if the profile query is mid-flight.
2. **Subscription step is a placeholder, no real page**
  - Step 1 is just an info card with a "Continue" button — no actual plan picker, no PayFast call, and there is no equivalent UI inside the app (Profile tab has no plan management). The user wants a real subscription set-up page in onboarding **and** the same surface inside the app.
3. **Hot-reload friendliness**
  - Wizard state is not persisted, so any refresh during onboarding restarts at Step 0.

## Plan

### 1. Fix the loop (small, surgical)

`**src/components/onboarding/SuccessSplash.tsx**`

- Move the auto-advance into a `useEffect` with `[autoAdvanceMs, onCta]` deps, fire once, clear timer on unmount.

`**src/pages/LearnerOnboarding.tsx**`

- On mount, if `profile?.onboarding_completed_at` is set, `navigate("/learner", { replace: true })` immediately (no wizard).
- If `academicProfile` exists but onboarding flag isn't set, jump straight to Step 3 (celebration) regardless of current step.
- After `mark_learner_onboarding_complete` RPC succeeds, then navigate. Guard `finish` with a ref so it only runs once.

`**src/pages/LearnerApp.tsx**`

- Replace the "no academic profile → redirect" effect with a single check that waits for both `academicProfileLoading === false` **and** a profile fetch for `onboarding_completed_at`. Only redirect to `/learner/onboarding` when both are missing. Use `replace: true` and a `redirected` ref to prevent re-fires.

### 2. Real subscription set-up page (in onboarding + in app)

**New `src/components/subscription/PlanPicker.tsx**` — single source of truth used by both surfaces. Shows three cards:

```
Free Trial (7 days, active)        — Continue
Premium Monthly  R149/mo            — Subscribe
Premium Annual   R1 290/yr (save 28%) — Subscribe
```

- Uses `useSubscription` to show current state (Active trial / Premium / Expired).
- "Subscribe" → invokes existing `payfast-create-payment` edge function with `subscription_type: "monthly" | "annual"` and a `return_url` of `/payment-success?next=/learner/onboarding?step=2` (or `/learner` when used from Profile).
- "Continue with free trial" → calls `onContinue()` callback.
- "Manage / cancel" link when already premium.

`**src/pages/LearnerOnboarding.tsx**`

- Replace the inline Step 1 card with `<PlanPicker mode="onboarding" onContinue={() => setStep(2)} />`.
- Read `?step=` query param on mount so PayFast return lands on Step 2 (academic profile).

`**src/pages/learner/LearnerProfileTab.tsx**`

- Add a "Subscription" section near the top using the same `<PlanPicker mode="profile" />`. This is the in-app surface the user asked for.

`**src/pages/PaymentSuccess.tsx**`

- Honour the `next` query param and redirect there instead of the default landing.

### 3. Persist wizard progress

`**src/pages/LearnerOnboarding.tsx**`

- Use the existing `useResumableWizard` hook to persist `{ step }` per user so refresh resumes mid-flow.

### 4. Out of scope

- No DB migrations (subscription table, RPC, and PayFast functions already exist).
- No tutor flow changes (tutors don't pay subscriptions).
- No new payment provider work — reuse PayFast.

## Technical notes

- All new code uses semantic Tailwind tokens.
- PlanPicker pricing is read from a single `PLANS` const so it can later move to a config table without touching UI.
- `finish()` becomes idempotent via `useRef<boolean>(false)`.
- LearnerApp's redirect uses `useRef` to ensure it fires at most once per mount.

&nbsp;

&nbsp;

Side note remember we had a full subscription system where student can choose ai plan , hourly session plan and combo (a mixture of both Ay a discount of ai ) i want that to be inclused instead of acting like it never existed