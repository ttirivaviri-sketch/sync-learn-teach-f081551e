

## Updated rule
- **All tutors** can upload **tutorials** (videos) — current behavior, no gating change.
- **Only the `studysyncofficial` account** can upload **study materials** (PDFs: textbooks, past papers, notes).
- Library author label for the official account stays as `studysyncofficial` with verified badge.

## Plan

### 1. Schema (migration)
- `profiles.is_official BOOLEAN DEFAULT false` — flag the official account.
- `tutor_tutorials.content_type TEXT DEFAULT 'video'` — `'video' | 'pdf'`.
- `tutor_tutorials.pdf_url TEXT` (nullable).
- `tutor_tutorials.resource_category TEXT` (nullable) — `'textbook' | 'past_paper' | 'notes'` (only used for PDFs).
- New public storage bucket `library-pdfs` with public-read + insert policy: `bucket_id='library-pdfs' AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND is_official=true)`.
- DB trigger on `tutor_tutorials` BEFORE INSERT/UPDATE: if `content_type='pdf'`, require uploader's `profiles.is_official=true`. Video inserts are unrestricted (any tutor).

### 2. Library UI — `src/components/StudySyncLibrary.tsx`
- **Clips/Tutorials tab**: when selected, immediately open `StudyClipsFeed` (vertical carousel) — no card grid, no Watch buttons. Closing the feed returns to the previous tab.
- **Books tab + Past Papers tab**: replace current grid with Netflix-style horizontal poster racks (new `PosterCard.tsx`). Tap a card → open/download PDF directly.
- Source PDFs from `tutor_tutorials` where `content_type='pdf'` filtered by `resource_category`.

### 3. Tutor dashboard — `src/components/TutorCreatorDashboard.tsx` + `tutor-creator/TutorialFormDialog.tsx`
- Keep the existing **Upload Tutorial** flow available to all tutors (video only).
- For users where `profiles.is_official = true`, expose an additional **Upload Study Material** path in the dialog: content-type selector (Tutorial Video / Textbook PDF / Past Paper PDF / Notes PDF) + PDF file picker (max 50MB → `library-pdfs` bucket).
- Non-official tutors only see the Tutorial Video form (current UX preserved).

### 4. Author display — `useLibraryResources.ts` + cards
- Map authors with `is_official=true` to display name `studysyncofficial` + small verified check badge in `ResourceCard`, `PosterCard`, and `StudyClipsFeed` slide footer.
- Other tutors keep their real names (existing behavior — Study Clips memory respected).

### Files
- New migration (schema + bucket + trigger + RLS)
- `src/components/library/PosterCard.tsx` (new)
- `src/components/StudySyncLibrary.tsx` (auto-open carousel for Clips; poster racks for Books/Papers)
- `src/components/library/ResourceCard.tsx` (verified badge)
- `src/components/library/StudyClipsFeed.tsx` (verified badge)
- `src/hooks/useLibraryResources.ts` (fetch `is_official`, map official label, include PDFs)
- `src/components/TutorCreatorDashboard.tsx` (gate "Upload Study Material" to official)
- `src/components/tutor-creator/TutorialFormDialog.tsx` (PDF + category fields, official-only)

### Result
- Any tutor can keep uploading video tutorials as today.
- Only `studysyncofficial` can publish textbooks and past papers; those appear in Books/Past Papers tabs as Netflix-style poster racks.
- Tapping the Clips tab drops the learner straight into the swipeable carousel — no intermediate card list.
- Official content is attributed to `studysyncofficial` with a verified badge.

