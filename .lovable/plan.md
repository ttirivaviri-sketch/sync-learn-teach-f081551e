

## Plan: Fix Uploaded Videos Not Showing in Library

### Root Cause

Two issues prevent tutorials from loading:

1. **RPC permission denied** — The `get_published_tutorials` function exists but has no `EXECUTE` grant for `anon` or `authenticated` roles. Every call fails silently.
2. **Fallback query broken** — The fallback direct query uses `profiles!tutor_id` join syntax, which requires a foreign key relationship that doesn't exist on `tutor_tutorials`. So both paths fail.

### Fix

**Database migration** — Grant execute permissions on the RPC function:
```sql
GRANT EXECUTE ON FUNCTION public.get_published_tutorials(text, text) TO anon, authenticated;
```

**`src/hooks/useLibraryResources.ts`** — Fix the fallback direct query to not use FK join syntax. Instead, fetch tutorials without the join and look up tutor names separately, or simply remove the join and use `tutor_id` directly (since the RPC path handles the join properly and should be the primary path once permissions are fixed):

```typescript
// Replace the FK-dependent join:
//   tutor_profile:profiles!tutor_id(id, full_name, avatar_url)
// With a simple select without the join:
//   id, title, subject, topic, ..., tutor_id
// Then fetch tutor profiles in a second query if needed
```

### Files Changed

- **Migration**: Grant EXECUTE on `get_published_tutorials` to `anon` and `authenticated`
- **`src/hooks/useLibraryResources.ts`**: Fix fallback query to remove the broken FK join

