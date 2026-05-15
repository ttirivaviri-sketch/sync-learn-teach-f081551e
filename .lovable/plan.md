# Bypass AI quota for admins

## Problem
`enforceQuota()` in `supabase/functions/_shared/ai-config.ts` applies the per-user daily AI cap to **every** authenticated user — including admins running bulk-seed/curriculum tools from the admin panel. This causes 429 "daily_limit_reached" errors when seeding.

## Change
Make `enforceQuota()` skip the quota check when the caller has the `admin` role.

### How
1. After resolving `userId` from the JWT, call the existing `has_role(_user_id, 'admin')` RPC via the service role.
2. If it returns `true`, return `{ allowed: true, used: 0, limit: <cap>, userId }` immediately — no increment, no cap.
3. Anonymous and non-admin behaviour stays exactly the same.
4. Cache the admin check in-memory per cold start (small Map keyed by userId) so repeat calls within one function instance don't re-hit the RPC.

Single file changed: `supabase/functions/_shared/ai-config.ts`. All edge functions that call `enforceQuota` automatically inherit the bypass — no per-function edits needed.

## Out of scope
No DB migration. No client changes. No new admin-panel features. If you've seen specific admin-panel bugs other than the rate-limit, share the page/error and I'll add them to the plan.
