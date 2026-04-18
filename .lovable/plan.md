
The error "Could not add card — Please log in" comes from the catch block in `handleAddMethod`. Looking at the code:

```ts
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData?.session) throw new Error("Please log in");

const response = await supabase.functions.invoke(
  "payfast-add-payment-method",
  { body: { returnUrl, cancelUrl } }
);
```

The user clearly IS logged in (they see their profile "Ashlie", avatar, "8 upcoming"). So the "Please log in" message isn't from the session check — it's from the edge function returning an error that gets surfaced as the toast description... wait, no. The toast says "Please log in" which exactly matches the local throw.

Actually two possibilities:
1. `supabase.auth.getSession()` returns null session momentarily (token refresh race) even though user is authenticated.
2. The edge function throws "Authorization header required" or "Invalid authentication token" and that bubbles up — but the message would differ.

Most likely: **the edge function `payfast-add-payment-method` hasn't been deployed yet, or PayFast secrets aren't configured**, causing `response.error` → but our catch shows the error message. The exact "Please log in" string only appears in the local `throw new Error("Please log in")`.

Wait — re-reading: that throw only fires if `!sessionData?.session`. So `getSession()` is returning no session. This is a known issue when `supabase.functions.invoke` or modal mount races with auth hydration, OR when the modal is rendered outside an auth-wrapped context.

But the simpler explanation: I added the session check **redundantly** — `supabase.functions.invoke` automatically attaches the auth header from the SDK's stored session. The explicit `getSession()` call may return `null` during a brief refresh window even though `invoke` would succeed.

## Root cause
Redundant client-side `getSession()` precheck failing during a token refresh race, blocking the call before it reaches the (working) edge function which has its own auth validation.

## Fix
Remove the redundant precheck in `handleAddMethod`. Let `supabase.functions.invoke` handle auth attachment, and let the edge function's own auth validation return a proper error if truly unauthenticated. Same cleanup in `handleSetDefault` (use `useAuth` hook or rely on RLS).

Also worth verifying:
- Confirm the edge function `payfast-add-payment-method` is actually deployed (it should auto-deploy after creation).
- Confirm `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY` secrets exist (they already do per existing PayFast functions).

## Changes
**`src/components/learner-modals/PaymentMethodsModal.tsx`**
- Remove `getSession()` precheck in `handleAddMethod` — invoke directly and surface real error from response.
- In `handleSetDefault`, get user via `supabase.auth.getUser()` once or rely on RLS (`is_default` updates scoped by RLS).
- Improve error toast to show the actual edge function error message instead of swallowing it.

That's it — one file, ~10 lines changed.
