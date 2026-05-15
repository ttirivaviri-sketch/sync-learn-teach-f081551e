# Library admin + fix "books don't open"

## Why books still don't open

The `library-stream` edge function tries to **proxy** external `pdf_url`s. Every current system resource points at OpenStax / archive.org files that are **100–300 MB** (College Physics 2e is 263 MB). Streaming that through a Supabase Edge Function consistently fails — the runtime caps response time/memory and the gateway returns a generic 404 ("Resource not streamable"). That's the error the user sees.

Proxying multi-hundred-MB PDFs is not viable. Two realistic fixes:

- **A. Direct upstream URL for `http(s)://` resources** — return a 302 redirect to the original URL when it's external, and only download-from-bucket when `pdf_url` is a storage path. The viewer fetches bytes straight from the upstream CDN. Pros: instant, no edge bandwidth. Cons: the URL is exposed to the client (acceptable here — these are public OpenStax / archive.org files anyway).
- **B. Mirror to private bucket** — admin uploads each PDF into the `library-pdfs` bucket, `pdf_url` becomes a storage path, edge function downloads. Pros: fully private. Cons: 100s of MB per book, slow first-time admin work.

Recommendation: **A now** (unblocks every existing book today) + admin page that lets us swap any URL or upload a private replacement later.

## Scope

1. **Edge function `library-stream`**: when `pdf_url` is an external `http(s)://` URL, respond with `302` to that URL (instead of proxying bytes). Storage paths still stream from the private bucket.
2. **Client `useProtectedPdfBlob`**: follow redirects (default), still wrap result as a blob URL so the viewer keeps working unchanged.
3. **New admin page `/admin/library`**:
   - List `library_system_resources` (id, title, kind, curriculum, grade_levels, pdf_url, view_count).
   - Search by title; filter by kind (`textbook` / `past_paper`) and curriculum.
   - Inline edit `title`, `pdf_url`, `kind`, `description`, `subject`, `topic`, `grade_levels`.
   - "Test link" button: HEAD-checks the URL and shows status + content-type so admins can spot non-PDF landing pages instantly.
   - "Open in viewer" button: opens the existing `DocumentViewerOverlay` to confirm it loads end-to-end.
   - Delete row.
   - "Add resource" dialog with same fields.
4. **Sidebar entry**: add "Library" link in `src/components/admin/AppSidebar.tsx`.
5. **Route**: add `/admin/library` under `AdminLayout` in `src/App.tsx`.

No schema changes — `library_system_resources` already has all the columns and RLS allows admins full access.

## Files

- `supabase/functions/library-stream/index.ts` — replace external-proxy branch with `302` redirect.
- `src/hooks/useProtectedPdfBlob.ts` — already uses `fetch` (follows redirects by default); no change expected, but verify.
- `src/pages/admin/Library.tsx` — new.
- `src/App.tsx` — register route.
- `src/components/admin/AppSidebar.tsx` — add nav item.

## Out of scope

- Bulk re-uploading all OpenStax PDFs into the private bucket (can be done later per-resource via the new admin UI).
- Tutor tutorials table — already streams from the private bucket and works.
