# Protected in-app PDF reader

## Goal
Stop casually exposing library PDF URLs (system books, past papers, tutor uploads) and make extraction noticeably harder while keeping the reading experience inside the app.

Realistic scope: defeat casual download / link-share, not motivated attackers (that's impossible in a browser).

## Current state (what's broken)
- `library_system_resources.pdf_url` and `tutor_tutorials.pdf_url` are **public Supabase URLs** stored straight in the DB and rendered into anchors. Anyone who inspects DOM/network grabs the file.
- `DocumentViewerOverlay` reads PDFs via `react-pdf` but also renders **Download** + **Open in new tab** buttons next to the file URL.
- The `library-pdfs` bucket is **public** (`public: true`), so even without our UI the URL is permanent.
- Right-click, text selection, save dialogs are not blocked.

## Target architecture

```text
LearnerApp ──► /api/library/{id}/view (Edge Function, JWT-checked)
                │
                ├─ verifies auth.uid() + entitlement
                ├─ reads file from PRIVATE library-pdfs bucket (service role)
                ├─ streams bytes back as application/pdf
                │  with short-lived ETag, no-store headers
                ▼
        DocumentViewerOverlay (PDF.js / react-pdf canvas)
        ├─ loads via fetch + Blob URL (no <a href>)
        ├─ no download button, no "open in new tab"
        ├─ disables right-click, selection, print on the overlay
        └─ optional: caches encrypted blob in IndexedDB for offline reading
```

## Plan

### 1. Lock down the storage bucket
- Migration: flip `library-pdfs` to `public = false`.
- Add storage RLS so **no anonymous reads** are possible. Authenticated reads also denied for direct bucket access — only the service role (used inside the Edge Function) can read.
- Existing `pdf_url` column becomes the **storage object path** (e.g. `system/grade12-maths.pdf`), not a public URL. A migration backfills: strip the `…/object/public/library-pdfs/` prefix on existing rows.

### 2. New `library-stream` Edge Function (private, JWT-validated)
- Path: `supabase/functions/library-stream/index.ts`.
- Accepts `{ resource_id }` (or `?id=`); validates Supabase JWT in code (no `verify_jwt` in toml).
- Looks up the resource in `library_system_resources` / `tutor_tutorials`, checks the user has access (authenticated learner; later we can scope by curriculum/subscription).
- Uses service-role client to call `storage.from('library-pdfs').download(path)`.
- Streams back the file with:
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline` (no filename → discourages "save as")
  - `Cache-Control: private, no-store`
  - `X-Content-Type-Options: nosniff`
  - CORS for the app origin only.
- Logs reads (user_id, resource_id, ts) into a new `library_access_log` table for abuse detection.

### 3. Frontend: stop using `getPublicUrl`
- `useLibraryResources` returns the storage path as `pdfPath`, not a public URL.
- A new helper `useProtectedPdfBlob(resourcePath)` fetches the Edge Function with the user's access token, gets a `Blob`, and returns an in-memory `blob:` URL (revoked on unmount).
- `DocumentViewerOverlay` consumes that blob URL and:
  - removes Download + Open-in-new-tab buttons
  - sets `oncontextmenu={e => e.preventDefault()}`
  - applies `user-select: none`, `pointer-events` rules, and `@media print { display:none }` on the overlay
  - keeps `renderTextLayer={false}` (already the case) so copy-paste yields nothing useful even if selection slips through
- Tutor upload flow (`TutorialFormDialog`, `TutorCreatorDashboard`) stops calling `getPublicUrl` and stores the **path** instead.

### 4. Optional offline cache (phase 2 — flagged behind a feature toggle)
- After the blob arrives, AES-GCM encrypt it with a key derived from the user's session and stash the ciphertext in IndexedDB keyed by `resource_id`.
- Service worker (Workbox) intercepts subsequent `/library-stream?id=X` requests and serves the decrypted blob if offline.
- Out of scope for this iteration — call it out and leave hooks for it.

### 5. Migration of existing data
- Backfill SQL strips public URL prefix from `library_system_resources.pdf_url` and `tutor_tutorials.pdf_url` so the field is the bucket path.
- Anyone with the old public URL will eventually 404 once the bucket flips private — communicate via release note.

### 6. Verify
- Sign in, open a library item → PDF renders inside the overlay.
- Network tab shows only `…/functions/v1/library-stream` (no public storage URL anywhere on the page).
- Sign out + try to fetch the function with no JWT → 401.
- Try the old public URL `…/storage/v1/object/public/library-pdfs/…` → 400/403.
- Right-click on the page → context menu suppressed; download/print disabled.

### Technical notes
- Files touched: new `supabase/functions/library-stream/index.ts`; migration to flip bucket + backfill paths + add `library_access_log`; `src/components/library/DocumentViewerOverlay.tsx`; `src/hooks/useLibraryResources.ts` (+ small new `useProtectedPdfBlob` hook); `src/components/StudySyncLibrary.tsx`; `src/components/tutor-creator/TutorialFormDialog.tsx`; `src/components/TutorCreatorDashboard.tsx`.
- `react-pdf` already bundles its worker, so the in-app reader keeps working with blob URLs.
- Edge Function uses `SUPABASE_SERVICE_ROLE_KEY` (already in secrets) — never sent to client.

## Out of scope
- DRM-grade protection (impossible in a browser; even Adobe/Google can't).
- Blocking screenshots / screen recording / DevTools.
- Per-school or per-subscription gating beyond "logged-in learner" (can be layered on the auth check later).
- Page-by-page image streaming (would require pre-rendering every PDF; defer until books prove valuable enough).
