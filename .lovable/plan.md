# Make PhotoSolve "Mark my answers" reliably visible in the PDF viewer

## Problem
The PDF viewer has a "Mark my answers" button that sends a photographed answer to the `photo-solve-grade` Edge Function and grades it against the currently viewed past paper. Users report they do not see this button.

The button is currently gated by `canRenderInApp` (`!!streamUrl && !pdfRenderFailed`) and `resource.type === "pastpaper"`. If the PDF falls back to the iframe viewer, or if the resource type is not exactly `"pastpaper"`, the button is hidden with no explanation.

## Goal
Make the PhotoSolve / "Mark my answers" action reliably discoverable and usable from the PDF viewer for any document that represents an exam paper, regardless of whether pdf.js or the iframe is rendering it.

## What we will build

1. **Lower the visibility gate**
   - Show "Mark my answers" for `pastpaper` resources as soon as a readable URL exists (`url`), not only when pdf.js streaming is active (`streamUrl`).
   - Keep the AI panel usable when pdf.js text extraction is unavailable by falling back to paper metadata (title, year, session, paper number, subject, curriculum, grade) as the marking context.

2. **Mobile-friendly button placement**
   - Ensure the button is reachable on narrow viewports: icon-only on small screens, icon+label on larger screens, and never pushed out of the header by overflow.
   - Add a `title`/`aria-label` so the icon-only state is accessible.

3. **Clear empty / disabled states**
   - If the panel opens but no document context can be extracted, show an inline message: "I can't read this paper's text, but I can still mark from your photo. Results may be less precise."
   - If the resource is not a past paper, do not show the button.

4. **Verify with real past-paper resources**
   - Open a past paper in the preview and confirm the button appears on both desktop and mobile widths.
   - Tap the button, upload/photograph a sample answer, and confirm the `photo-solve-grade` call returns a graded result.

## Technical notes
- Files involved: `src/components/library/DocumentViewerOverlay.tsx`, `src/components/library/PaperMarkPanel.tsx`, `src/hooks/useProtectedPdfBlob.ts`.
- No Edge Function changes are required; `photo-solve-grade` already accepts `question`, `subject`, `topic`, `curriculum`, and `examLevel`.
- The panel already persists attempts to `photo_solve_attempts`, so no new tables are needed.

## Out of scope
- Extending PhotoSolve to non-paper resources (books/guides) — this plan only fixes visibility for past papers.
- Changing the grading prompt or model.
