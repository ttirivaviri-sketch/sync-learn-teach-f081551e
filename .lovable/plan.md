## Root cause

The session replay shows `LearnerApp` flicker-mounting every ~400 ms (LaunchScreen ↔ LoadingScreen, "Location updated" toast on every mount). That is a redirect loop between `/learner` and `/learner/onboarding`:

1. `LearnerApp` mounts. Two async loads run in parallel:
   - `useAcademicProfile` → returns `academicProfile = null` quickly.
   - `loadUserProfile()` → fetches `profiles` row (with `onboarding_completed_at`) — **slower**, sets `profile` later.
2. The redirect effect fires as soon as `academicProfileLoading === false`. At that moment `profile` is still `null`, so the guard `if (profile && profile.onboarding_completed_at) return;` does nothing → it navigates to `/learner/onboarding`.
3. `LearnerOnboarding` does its own fetch of `onboarding_completed_at`, sees it set, navigates back to `/learner`.
4. `LearnerApp` remounts, `redirectedToOnboardingRef` resets, geolocation hook re-fires (toast), and the cycle repeats.

So `redirectedToOnboardingRef` only protects within a single mount; the loop survives because the ref is recreated each mount, and the redirect decision is made before `profile` loads.

## Fix (surgical, frontend-only)

### `src/pages/LearnerApp.tsx`

- Track `profileLoaded` (boolean) alongside the existing `profile` state. Set it to `true` in `loadUserProfile`'s `finally` block (success or PGRST116 "no row").
- In the redirect effect:
  - Bail while `loading || academicProfileLoading || !profileLoaded`.
  - Then: if `profile?.onboarding_completed_at` → never redirect (clear case).
  - Else if `!academicProfile` → redirect once.
- Keep the `redirectedToOnboardingRef` guard so it can't fire twice within one mount.

### `src/hooks/useGeolocation.ts`

- Suppress the "Location updated" toast on auto-fire; only show it when the user explicitly triggers `getCurrentLocation()` (add a `silent` flag, default `true` for the auto-effect, `false` when called from a button). This stops toast spam during any future remount and removes the visible symptom while we're here.
- Remove `LearnerApp`'s manual `getCurrentLocation()` call in the `session?.user?.id` effect — the hook already auto-fires once on mount, the duplicate call is what produced two toasts per mount.

### Out of scope

- No DB changes. No onboarding wizard changes (the wizard's bounce-out behaviour is correct; the bug is on the `/learner` side).
- No tutor/payments/subscription changes.

## Validation

- Reload `/learner` while signed in with `onboarding_completed_at` set → lands on the app shell, no flicker, single (or zero) location toast.
- Sign in fresh with no academic profile → single redirect to `/learner/onboarding`, no bounce-back.
