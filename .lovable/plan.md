## Enforce User Suspension at Sign-In and Runtime

The admin Users page can already flag accounts as suspended (`profiles.is_suspended`), but nothing currently blocks a suspended user from using the app. This plan wires that flag into the auth flow.

### Scope
1. **Block sign-in** — In the auth provider/hook (`src/hooks/useAuth` or equivalent), after a successful login fetch `profiles.is_suspended`. If true, immediately `supabase.auth.signOut()` and surface a toast: "Your account has been suspended. Contact support." Include `suspended_reason` if present.
2. **Block active sessions** — Subscribe to realtime updates on the current user's `profiles` row. If `is_suspended` flips to true mid-session, sign them out and redirect to `/auth` with the same toast.
3. **Guard route loader** — In the top-level protected route wrapper, treat a suspended profile the same as an unauthenticated user (redirect to `/auth`).
4. **Admin UX polish** — On the Users admin page, show the `suspended_reason` in the row tooltip and prompt for an optional reason when suspending (simple `prompt()` is fine; persists into `suspended_reason` and stamps `suspended_at`).

### Out of scope
- Email notification to the suspended user (can add later via edge function if you want).
- Appeals workflow.
- Suspending tutors specifically affecting their public listing (already hidden because protected routes will reject them).

### Technical notes
- Files likely touched: `src/hooks/useAuth.tsx` (or `src/contexts/AuthContext.tsx`), `src/components/ProtectedRoute.tsx`, `src/pages/admin/Users.tsx`.
- No schema changes — columns already exist.
- Use existing `has_role` pattern; no new RLS needed since admin already has UPDATE on profiles.
