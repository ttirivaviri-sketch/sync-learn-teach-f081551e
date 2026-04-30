## Goal

Tighten the debounce story so realtime bursts, search typing, and prop changes don't trigger redundant or stale fetches.

## Current issues (in `useTutorData.ts`)

1. `debouncedFetch` captures a stale `fetchTutors` — `userLocation` and `maxActiveBookings` changes don't propagate (effect only re-subscribes on subject/search/level).
2. No in-flight guard or `AbortController` — overlapping fetches race; unmounted setState possible.
3. `searchQuery` triggers an immediate effect re-run on every keystroke (channels re-subscribed, fetch fired) — the 800ms realtime debounce doesn't help input typing.
4. Other hooks (`useNotifications`, `usePresenceTracking`, `useLeaderboard`) each reinvent timers with no shared utility.

## Changes

### 1. New shared hook `src/hooks/useDebouncedCallback.ts`
- `useDebouncedCallback(fn, delay, { leading?: boolean })` returning `[debounced, cancel, flush]`.
- Uses a ref to always call the latest `fn` (no stale closures).
- Auto-cancels on unmount.

### 2. New shared hook `src/hooks/useDebouncedValue.ts`
- `useDebouncedValue(value, delay)` for debouncing input values (search boxes).

### 3. Refactor `src/hooks/useTutorData.ts`
- Replace inline `setTimeout` with `useDebouncedCallback(fetchTutors, 800)`.
- Add `AbortController` per fetch; abort previous before starting new; ignore aborted results.
- Add `cancelled` flag in effect cleanup so late responses don't `setTutors` after unmount.
- Add `userLocation?.latitude`, `userLocation?.longitude`, `maxActive` to the effect dependency list so the channel re-subscribes when they change (still cheap because debounced).
- Move `searchQuery` debouncing **out** of this hook — callers pass an already-debounced value.

### 4. Update callers of `useTutorData` to debounce input
- `src/components/StudySyncLibrary.tsx`: wrap raw `searchQuery` with `useDebouncedValue(searchQuery, 300)` before passing to the hook (and to any other downstream search consumers).
- `src/components/library/SearchResultsView.tsx`: same — accept a debounced query.

### 5. Apply shared debounce to other realtime-heavy hooks (light touch)
- `src/studymode/hooks/useLeaderboard.ts`: replace ad-hoc timer with `useDebouncedCallback`.
- `src/hooks/useNotifications.ts`: not currently debounced (single-event INSERT/UPDATE handlers — fine as-is). No change.
- `src/hooks/usePresenceTracking.ts`: heartbeat is interval-based, not debounce — no change.

## Out of scope
- AI usage quotas / caching (separate plan, already in flight).
- Rewriting Supabase channel subscription strategy.

## Files

**New**
- `src/hooks/useDebouncedCallback.ts`
- `src/hooks/useDebouncedValue.ts`

**Edited**
- `src/hooks/useTutorData.ts`
- `src/components/StudySyncLibrary.tsx`
- `src/components/library/SearchResultsView.tsx`
- `src/studymode/hooks/useLeaderboard.ts`

## Expected result

| Scenario | Before | After |
|---|---|---|
| 5 realtime events in 200ms | 5 fetches (or 1 trailing, but stale fn) | 1 trailing fetch with fresh props |
| User types "calc" (4 keys) | 4 effect re-runs, 4 channel resubscribes, 4 fetches | 1 fetch ~300ms after last keystroke |
| Component unmounts mid-fetch | Possible setState warning | Aborted, no setState |
| `userLocation` changes | Distance not recalculated until next event | Re-fetch triggered (debounced) |
