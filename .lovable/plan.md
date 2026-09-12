# Fix: profile saves are being rejected by the database

## What's actually broken (confirmed)

Every attempt to update a user's profile row fails with database error `42P10`:

```text
Column list used by the publication does not cover the replica identity.
cannot update table "profiles"
```

This repeats continuously in the live console logs from the presence tracker
(`src/hooks/usePresenceTracking.ts`), and it is not limited to presence — the
database is refusing **all** updates to the profiles table, so anything that
saves to a person's profile (online status, last seen, name/photo/bio edits,
onboarding completion, study level) fails right now.

Verified cause: the profiles table is published for live updates with a
restricted column list (added earlier so private contact details are never
broadcast), but the table's row-identity setting is "full", which Postgres
requires to be entirely inside that column list. The two settings contradict
each other, so Postgres blocks the write instead of the broadcast.

## The fix

Change the profiles table's row-identity setting to use its primary key
(which is already inside the published column list). This satisfies Postgres,
restores profile writes, and keeps private columns out of the live broadcast —
no policy or privacy change.

## About the "Something went wrong" screen

That screenshot is the app's error screen on the published site. No runtime
error was captured for the current preview session, so it is not yet proven to
be the same problem — but a page whose first actions include writing presence
and reading/saving the profile is a very likely victim of the failing writes.

Steps, in order:

1. Apply the database fix above.
2. Confirm no more `42P10` errors appear and profile edits save.
3. Load the published page and, if the error screen still appears, capture the
   real error from the error boundary and fix that separately before closing
   this out.

## Technical notes

- Migration: `ALTER TABLE public.profiles REPLICA IDENTITY DEFAULT;`
- `pg_publication_tables` shows `supabase_realtime` publishing profiles with a
  12-column list; `pg_class.relreplident` for profiles is `f` (full).
- No frontend changes are expected for step 1; `usePresenceTracking.ts` already
  handles errors gracefully and will simply stop logging them.
