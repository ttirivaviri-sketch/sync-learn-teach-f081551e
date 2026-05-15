# Fix books and past papers not opening

## What is broken
- The viewer is requesting `https://undefined.supabase.co/functions/v1/library-stream...`.
- The current hook builds the Edge Function URL from `VITE_SUPABASE_PROJECT_ID`, but that env is missing in the live preview runtime.
- Result: the request never reaches `library-stream`, so books and past papers fail before PDF rendering even starts.

## Root cause
The secure PDF architecture is mostly in place, but the client-side fetch path is brittle because it depends on a separate env var for the project ID instead of using the already-configured Supabase client/base URL.

## Plan

### 1. Make the PDF hook use a stable function URL
- Update `src/hooks/useProtectedPdfBlob.ts` to stop constructing the endpoint from `VITE_SUPABASE_PROJECT_ID`.
- Derive the function base from the existing Supabase URL (`VITE_SUPABASE_URL` / client config), or use the Supabase client’s function helper directly.
- Keep the authenticated `Authorization: Bearer <token>` flow unchanged.

### 2. Add a safe fallback so preview/runtime env differences don’t break reading
- Prefer the configured Supabase client/base URL already used elsewhere in the app.
- If needed, support both `VITE_SUPABASE_URL` and a client-derived fallback so preview and published builds behave the same.
- Preserve blob URL creation and cleanup logic.

### 3. Harden the PDF worker import if needed
- The preview console also shows `Importing a module script failed`, which can happen when the PDF.js worker asset path is not emitted correctly.
- If the function URL fix alone is not enough, update `DocumentViewerOverlay` to use the same Vite-safe `?url` worker pattern already used elsewhere in the project (`pdfjs-dist/legacy/build/pdf.worker.min.mjs?url`).
- Keep the viewer otherwise unchanged.

### 4. Improve failure handling in the protected PDF hook
- Return clearer errors when the function URL cannot be resolved or the function returns a non-OK response.
- Keep the viewer’s empty/error state, but make sure it reflects real transport or auth failures rather than generic “Load failed”.

### 5. Verify end-to-end
- Open a system book and a past paper from the learner library.
- Confirm the network request goes to `https://uynoykcratwbcdzmsxfw.supabase.co/functions/v1/library-stream...` instead of `undefined.supabase.co`.
- Confirm the overlay renders the PDF successfully.
- Confirm no public storage URL is exposed in the request path.

## Files to change
- `src/hooks/useProtectedPdfBlob.ts`
- `src/components/library/DocumentViewerOverlay.tsx` if the worker import needs the Vite-safe path or the error messaging needs a small adjustment

## Out of scope
- Reworking the secure storage architecture
- Offline caching
- Broader tutor matching or library ranking changes
