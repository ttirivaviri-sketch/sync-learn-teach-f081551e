

## Plan: Replace "Tutor" Fallback with Author Name

The `StudyClipsFeed` and `VideoPlayerOverlay` components fall back to the string `"Tutor"` when `resource.tutor?.name` is missing. Fix: use `resource.author` as a secondary fallback before showing a generic label.

### Changes

**`src/components/library/StudyClipsFeed.tsx`**
- Line 87: Change `resource.tutor?.name || "Tutor"` → `resource.tutor?.name || resource.author || "Unknown"`
- Line 279: Same change for the `onBookTutor` callback fallback

**`src/components/library/VideoPlayerOverlay.tsx`**
- No changes needed — it only shows tutor info when `resource.tutor` exists

**`src/hooks/useLibraryResources.ts`**
- Lines 245, 268: Change fallback from `"Tutor"` → use `row.tutor_full_name || row.tutor_profile?.full_name || row.author || "Unknown"` so the tutor name is properly populated from the database when available

### Files Changed
- `src/components/library/StudyClipsFeed.tsx` — Update 2 fallback strings
- `src/hooks/useLibraryResources.ts` — Update 2 fallback strings in data mapping

