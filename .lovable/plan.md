

## Plan: Fix Remaining "Tutor" Hardcoded Fallbacks

### Problem
In `src/hooks/useLibraryResources.ts`, there's a **direct query fallback** path (line 306-337) that maps `tutor_tutorials` rows. Both `author` (line 310) and `tutor.name` (line 333) are hardcoded to `"Tutor"` instead of using the actual tutor name from the database row.

### Fix

**`src/hooks/useLibraryResources.ts`** — 2 line changes:

- **Line 310**: Change `author: "Tutor"` to `author: row.tutor_full_name || "Unknown"`
- **Line 333**: Change `name: "Tutor"` to `name: row.tutor_full_name || "Unknown"`

The `tutor_full_name` field is returned by the `get_published_tutorials` database function (confirmed in the schema), which joins `profiles.full_name` as `tutor_full_name`.

### Files Changed
- `src/hooks/useLibraryResources.ts` — Update 2 hardcoded strings in the direct query mapping

