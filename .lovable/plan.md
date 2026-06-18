## Goal

Make the library reliably show seeded videos in the **Clips** tab (never in Books), and prevent future mis-classification at the data layer.

## What's wrong today

- `library_system_resources` has no dedicated `video_url` column. The seeder shoved YouTube URLs into `pdf_url`, relying on `kind = 'video'` to disambiguate. Anything that ever lands with `kind ≠ 'video'` (or with a video URL in `pdf_url` plus the wrong `kind`) is silently rendered as a Book.
- Mapper (`src/hooks/useLibraryResources.ts`) trusts `kind` blindly. No URL/MIME validation.
- Books tab filter (`StudySyncLibrary.tsx`) is `type === 'book' || type === 'guide'` — any future row that slips through with `kind = 'textbook'` but a video URL would render as a book and crash the PDF viewer.
- Some video rows have `grade_levels` arrays that don't intersect with common learner grades, so they're silently filtered out by `personalizedResources`.

## Plan

### 1. Schema hardening (migration)

In `library_system_resources`:

- Add `video_url TEXT` column.
- Tighten `kind` with a CHECK to the known set: `textbook | past_paper | syllabus | video | guide`.
- Add a `BEFORE INSERT OR UPDATE` trigger `library_resource_classify()` that:
  - If `video_url` looks like a video (`youtube|youtu.be|vimeo|loom|.mp4|.webm|.mov|.m4v`) OR `pdf_url` matches the same pattern → force `kind := 'video'` and move the URL into `video_url` (clear `pdf_url`).
  - Else if `pdf_url` ends in `.pdf` or is a storage path → leave `kind` as supplied, default to `textbook`.
  - Raise EXCEPTION when a row has `kind = 'video'` but no resolvable video URL, or `kind != 'video'` but no `pdf_url`. This is the "schema + type validation during seeding" requirement, enforced in the DB so it works for every code path (edge functions, admin UI, future seeders).

### 2. One-time reclassification migration

Same migration runs a backfill:

```sql
UPDATE library_system_resources
SET video_url = pdf_url, pdf_url = NULL, kind = 'video'
WHERE pdf_url ~* '(youtube|youtu\.be|vimeo|loom|\.(mp4|webm|mov|m4v)(\?|$))';

UPDATE library_system_resources
SET kind = 'textbook'
WHERE kind NOT IN ('textbook','past_paper','syllabus','video','guide');
```

Also normalises `grade_levels`: any video row whose `grade_levels` is empty/null gets `ARRAY['8','9','10','11','12']` so it isn't invisible to every learner.

### 3. Mapper update — `src/hooks/useLibraryResources.ts`

- Select the new `video_url` column.
- Re-derive `isVideo` from **both** `kind === 'video'` AND a URL pattern check (`/youtube|youtu\.be|vimeo|loom|\.(mp4|webm|mov|m4v)/i`) — defensive against any legacy row.
- Set `videoUrl = row.video_url ?? row.pdf_url` only when `isVideo`; otherwise `videoUrl` stays undefined and `pdfSource = 'system'`.
- Add a console warning when a row's stored `kind` disagrees with the URL-derived classification.

### 4. Library tabs — `src/components/StudySyncLibrary.tsx`

- Books tab filter becomes `r.type === 'book' || r.type === 'guide') && !r.isTutorial && !r.videoUrl?.match(videoRegex)` so a misclassified row can never appear as a book.
- Clips filter stays `r.isTutorial`, but `isTutorial` is now driven by the hardened mapper above.
- Past Papers filter unchanged.

### 5. Future seeding helper

Add `supabase/functions/_shared/librarySeed.ts` exporting `validateLibraryRow(row)` (Zod):

- Enforces required fields (`title`, `subject`, `curriculum`, `kind`, at least one URL).
- Cross-checks `kind` vs URL pattern and throws before insert.
- Re-used by `bulk-seed-curriculum` and any future seeder; the DB trigger is the second line of defence.

### Files touched

- New migration: schema + backfill + trigger.
- `src/hooks/useLibraryResources.ts` — mapper + select list.
- `src/components/StudySyncLibrary.tsx` — Books tab predicate.
- `src/pages/admin/Library.tsx` — add `video_url` to the form so admins can edit it.
- New `supabase/functions/_shared/librarySeed.ts` — Zod validator for future seeds.

No changes to `tutor_tutorials` / `school_videos` — those already classify correctly today.

### Out of scope

- Re-seeding additional content (this is reclassify-in-place, per your prior choice).
- Tutor-uploaded tutorials (already correct via `content_type`).
