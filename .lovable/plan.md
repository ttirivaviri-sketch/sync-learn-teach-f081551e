## Seed Library Books + Past Papers with Real Covers, and Polish PDF Reader

The library already supports PDFs (`DocumentViewerOverlay` is wired into `StudySyncLibrary`) and there are 250+ textbook rows. The gaps are: only **4 past papers** across the whole table, many rows lack stable cover thumbnails, and several seeds use placeholder images. This plan fills those gaps with **real, hot-linkable URLs from open repositories** so every high-school learner sees ≥10 books and ≥10 past papers regardless of curriculum/grade.

### Content sources (all free + hot-linkable)

- **OpenStax** (`assets.openstax.org`) — Algebra/Trig, Pre-Calculus, Calculus, Stats, Biology, Chemistry, Physics, World History, Psychology. Cover JPGs live at the same CDN. Maps cleanly to Grade 10–12 / Form 4–6 / IGCSE / A-Level.
- **Siyavula Open Textbooks** (`www.siyavula.com/read`) — SA-aligned Mathematics, Mathematical Literacy, Physical Sciences, Life Sciences for Grade 7–12. PDFs + covers available.
- **CK-12 FlexBooks** (`flexbooks.ck12.org`) — middle-school Math, Science, English supplements (Grade 7–9 / Form 1–3).
- **DBE NSC past papers** (`www.education.gov.za`) — public South African Matric papers 2018–2023, every subject, with marking memos.
- **Cambridge Assessment specimen papers** (`www.cambridgeinternational.org`) — IGCSE / O-Level / A-Level Math, Sciences, English (specimen + 2020–2022 published).
- **ZIMSEC** — only specimen papers are reliably online; we'll seed those for Form 4 + Form 6 (Math, English, Combined Science).

### What gets seeded (target counts)

Rows are inserted into `library_system_resources` with `kind` = `textbook` or `past_paper`, and `grade_levels` arrays designed so any single grade query returns ≥10 of each kind.

| Curriculum | Books target | Past papers target |
|---|---|---|
| CAPS (Grade 8–12) | already 250+, top up gaps | +30 (DBE NSC, all major subjects, 2019–2023) |
| Cambridge IGCSE / O-Level | +20 (OpenStax + Cambridge endorsed) | +20 (Math, Bio, Chem, Phys, English) |
| Cambridge AS / A-Level | +15 | +15 |
| IEB | keep existing | +6 |
| ZIMSEC | +10 (Siyavula + open) | +12 (Math, English, Combined Science, Form 4 + 6) |

Every row is also tagged with multiple grade levels where appropriate (e.g. an Algebra book is tagged Grade 9, Grade 10, Form 3, Form 4, IGCSE) so it cross-pollinates across curricula and ensures ≥10 results everywhere.

### Cover thumbnails

- New rows: `thumbnail_url` set to the publisher's real cover JPG.
- Existing rows missing thumbnails (the 8 with NULL today, plus any using `/placeholder.svg`): backfill using a tight title→cover mapping (OpenStax / Siyavula / Google Books cover API for catalogued textbooks).
- The `ContentRack` already lays out cards horizontally; with proper covers this gives the requested Netflix-style scroll rack — no UI changes needed.

### In-app PDF reader

The reader is already implemented (`src/components/library/DocumentViewerOverlay`) and wired up. I will:
- Verify it opens both `kind=textbook` and `kind=past_paper` from the new seed (the code already passes `pdf_url` through).
- Add a small `Save offline` toast hint and remember last page in `localStorage` keyed by resource id (nice-to-have polish; ~15 lines).
- No new library dependencies.

### Execution

1. Build a single SQL `INSERT … ON CONFLICT DO NOTHING` migration with the curated rows (≈120 new rows). Conflict key on `(title, curriculum, kind)` so repeat runs are idempotent — this needs a unique index added in the same migration.
2. Run a separate `UPDATE` (via the data tool, not migration) to backfill `thumbnail_url` for the 8 NULL rows.
3. Add the small reader polish in `DocumentViewerOverlay.tsx`.

### Out of scope
- Uploading our own PDFs to Storage. We hot-link to the publisher CDNs; if a link rots later we swap the URL.
- Per-user library uploads (already exists).
- Subject-by-subject curation beyond the counts above — happy to add more on request once you see the first batch.

### Open assumption (flag if wrong)
I'll hot-link to the publisher CDNs above rather than copy PDFs into your `library-pdfs` Storage bucket. That keeps the seed lightweight; downside is broken links if a publisher reorganises. If you'd rather I download + re-host into Storage, say so and I'll switch the migration to insert Storage paths instead.
