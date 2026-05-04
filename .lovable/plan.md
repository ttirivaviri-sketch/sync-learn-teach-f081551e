## Goal

Make every book and past paper in the learner Library actually open (using `pdf_url` as a robust fallback), and verify Study Clips video playback still works.

## Findings from inspection

- `src/hooks/useLibraryResources.ts` already maps system resources' `pdf_url` → `LibraryResource.videoUrl` (line 379), and tutor PDFs the same way (line 336–341). So the data is there.
- `src/components/StudySyncLibrary.tsx` `openResource` (lines 112–146) currently only fires a toast `"Opening Resource"` for non-video resources — it never calls `window.open`. **This is the bug**: books and past papers do not actually open. PR #40's diff fixes this; we'll apply that fix with an extra `pdf_url` fallback for safety.
- Study Clips path (video → `setReelsFeedOpen(true)`) is unchanged by the fix, so clips keep working.

## Change

Edit `src/components/StudySyncLibrary.tsx` `openResource`:

1. If `resource.type` is `book | guide | pastpaper | pdf`:
   - Resolve `documentUrl = resource.videoUrl ?? (resource as any).pdf_url ?? (resource as any).url`.
   - If found → `window.open(documentUrl, "_blank", "noopener,noreferrer")` and toast "Opening Resource".
   - If not → toast "File not available".
2. Leave the existing video branch untouched (Study Clips feed still opens at the right index, single-video overlay still works as fallback).

No type changes, no hook changes, no DB changes. Pure UX fix in one function.

## Verification (smoke test, no automation needed)

In the learner app → Library:

1. **Books tab**: click a poster of a seeded textbook → new tab opens its `pdf_url`. Click one without an attached file → toast says "File not available".
2. **Past Papers tab**: click a past-paper poster → new tab opens its PDF.
3. **Browse tab → Past Exam Papers rack**: click a card → opens PDF.
4. **Search results**: search a textbook title → click → opens PDF.
5. **Tutorials / Top Tutorial Videos rack**: click a video card → Study Clips feed opens at the correct slide and plays. Confirms clips still work.
6. **Empty case**: open a video resource that has no URL → toast "No Video URL" (unchanged behavior).
7. Browser console clean (no errors); confirm `useLibraryResources` log line shows `documents: N` > 0.

## Risks

- Popup blockers may block `window.open` on some browsers if not triggered directly by a user gesture. The call sits inside a click handler so this should be fine across Chrome/Safari/Firefox/mobile webviews.
