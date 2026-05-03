## Part 1 — Landing-page bounce-rate fixes

Confirmed against the live files: `HeroSection.tsx` still has dual equal-weight CTAs, generic copy, no trust band, and `Index.tsx` lumps everything below the fold into one Suspense with PWA + cookie prompts that delay the CTA.

### A. HeroSection rewrite (`src/components/HeroSection.tsx`)

- Replace headline + sub: outcome-led, exam-specific copy with risk-reversal ("7-day free trial · No card required").
- **Single primary CTA** — yellow "Start 7-day free trial" → `/learner/auth`. Demote tutor route to a small text link "I'm a tutor →" beneath.
- Mobile order (current 552px viewport): headline → sub → CTA → checklist → image. Image becomes a smaller rounded inset on mobile so the CTA is above the fold.
- Add a tight social-proof line under the headline ("★ 4.8 · Trusted by N students") fed by the new trust band hook.
- Wire `track('cta_click', { id: 'hero_primary' })` on the primary CTA.

### B. TrustBand component with real DB counts (new `src/components/TrustBand.tsx`)

A slim band rendered between hero and `AppShowcase`. Fetches once on mount via `supabase.from('profiles').select('id', { count: 'exact', head: true })` etc. for:
- Learners (`profiles.user_type='learner'`) → "students learning"
- Tutors (`profiles.user_type='tutor'`) → "verified tutors"
- Sessions (`bookings.status='completed'`) → "sessions delivered"

Falls back to floor values (e.g. "1,200+") when the DB returns small numbers, so the band never reads "4 students". Always shows the static items: "★ 4.8 rating · 30-min money-back · Powered by AI".

### C. Index.tsx performance + analytics wiring

- Split the single Suspense into two boundaries: first chunk = `AppShowcase`, `TrustBand`, `HowItWorksSection`, `FeaturesSection` (visible on first scroll). Second chunk = `StudyModeSection`, `StatsSection`, `TestimonialSection`, `TrustSection`, `Footer`, `PWAInstallPrompt`, `CookieConsent`. Second chunk only mounts after the first user scroll **or** `requestIdleCallback` (whichever first), so cookie/PWA prompts can't cover the CTA on first paint.
- On mount: `track('page_view')` + `installScrollDepthTracking()` from `src/utils/landingAnalytics.ts` (already exists, just unused).
- `index.html`: add `<link rel="preload" as="image" href="/images/students-group.png">` so hero image isn't a network-blocking decode.

### D. Replace stub analytics

`src/utils/analytics.ts` currently no-ops. Wrap `pageView` and `event` to also call into `landingAnalytics.track`, so existing call sites start producing real `landing_events` rows.

---

## Part 2 — Library textbooks & past papers (view-only)

You uploaded:
- `Mathematics_Paper_I_exam_paper_creation_request.pdf`
- `Original_Mathematics_Paper_II_examination_document_request.pdf`
- `algebra-and-trigonometry-2e_-_WEB.pdf`

Today the library reads only from `tutor_tutorials` and requires a `tutor_id` that maps to a `profiles` row with `is_official=true` (none exists). Rather than fake an auth user, add a dedicated **system-owned** content table.

### A. New table `library_system_resources` (migration)

Columns: `id`, `title`, `kind` (`past_paper` | `textbook`), `subject`, `topic` (nullable), `curriculum` (`IEB` | `CAPS` | `ZIMSEC` | `Cambridge`), `grade_levels` (text[]), `pdf_url`, `thumbnail_url`, `description`, `pages` (int nullable), `view_count` (int default 0), `created_at`.

RLS:
- `SELECT` — anyone authenticated.
- `INSERT/UPDATE/DELETE` — admin only via `has_role(auth.uid(),'admin')`.

A row may belong to multiple curriculums via duplicated rows (one per curriculum/grade band) — simpler than an M:N join for this volume.

### B. Storage: upload the 3 PDFs

Use the existing public `library-pdfs` bucket. Upload files to `library-pdfs/system/…` and insert rows:

| Title | kind | curriculum | grade_levels |
|-------|------|------------|--------------|
| Mathematics Paper I — Grade 12 | past_paper | IEB | ["Grade 12"] |
| Mathematics Paper I — Grade 12 | past_paper | CAPS | ["Grade 12"] |
| Mathematics Paper II — Grade 12 | past_paper | IEB | ["Grade 12"] |
| Mathematics Paper II — Grade 12 | past_paper | CAPS | ["Grade 12"] |
| Algebra & Trigonometry (OpenStax 2e) | textbook | IEB | ["Grade 9","Grade 10","Grade 11","Grade 12"] |
| Algebra & Trigonometry (OpenStax 2e) | textbook | CAPS | ["Grade 9","Grade 10","Grade 11","Grade 12"] |
| Algebra & Trigonometry (OpenStax 2e) | textbook | ZIMSEC | ["Form 2","Form 3","Form 4","Form 5","Form 6"] |
| Algebra & Trigonometry (OpenStax 2e) | textbook | Cambridge | ["Grade 9","O Level","AS Level","A Level"] |

Same `pdf_url` is reused; cross-listing is just per-curriculum rows so the personalisation filter in `useLibraryResources` keeps working without changes.

### C. Hook integration (`src/hooks/useLibraryResources.ts`)

Add a second fetch to `library_system_resources`, map each row to a `LibraryResource` with:
- `author = "StudySync Official"`, `tutor` undefined,
- `type = 'pastpaper' | 'book'`,
- `videoUrl = pdf_url` (re-using the existing field for the viewer),
- a new flag `isSystem: true` so the card knows to hide download.

Concatenate into `dbResources`. Real-time channel also subscribes to the new table.

### D. View-only PDF viewer (new `src/components/library/PdfViewerOverlay.tsx`)

Full-screen sheet rendering the PDF via `<iframe src="{pdf_url}#toolbar=0&navpanes=0" />` plus our own header (title, close, page counter best-effort). No "open in new tab" or download link. Includes:
- `oncontextmenu="return false"` on the iframe wrapper to discourage right-click save (browser native PDF still allows it; this is a soft deterrent — true DRM is out of scope).
- `track('section_view', { id: 'pdf', resourceId })` on open.

### E. ResourceCard / library wiring

- `ResourceCard.tsx`: hide the `<Download />` button when `resource.isSystem === true`. CTA reads "Read" for textbooks, "View" for past papers.
- `StudySyncLibrary.tsx`: in `openResource`, when the resource has a non-video `pdf` URL, route to `PdfViewerOverlay` instead of toasting "Opening Resource".

### F. Type update

Add `isSystem?: boolean` to `LibraryResource` in `src/types/academicProfile.ts`.

---

## Files

**New**
- `src/components/TrustBand.tsx`
- `src/components/library/PdfViewerOverlay.tsx`
- Migration: `library_system_resources` table + RLS

**Edit**
- `src/components/HeroSection.tsx` — copy, single CTA, mobile order, analytics
- `src/pages/Index.tsx` — two-stage Suspense, deferred prompts, scroll-depth tracking
- `index.html` — preload hero image
- `src/utils/analytics.ts` — forward to `landingAnalytics.track`
- `src/hooks/useLibraryResources.ts` — fetch + map system resources
- `src/components/library/ResourceCard.tsx` — hide download for system, label change
- `src/components/StudySyncLibrary.tsx` — open PDFs in `PdfViewerOverlay`
- `src/types/academicProfile.ts` — `isSystem` flag

**Storage uploads** (via edge-function-free admin insert during migration follow-up): 3 PDFs into `library-pdfs/system/`.

---

## Out of scope (flag if you want them)

- Actual DRM / preventing the browser PDF reader from offering "Save" via Ctrl+S. Genuine no-download requires server-side rendering of pages to images — large effort, separate ticket.
- Replacing the no-op `analytics.ts` with a full provider (Plausible/PostHog).
- Redesigning `AppShowcase`, `Footer`, etc.
