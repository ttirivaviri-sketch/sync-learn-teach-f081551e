## What I confirmed in the data

- DB has 8 system PDFs (CAPS/IEB/ZIMSEC/Cambridge maths textbooks + Grade 12 papers) and **2 published video tutorials** (one IEB Grade 12 Maths, one ZIMSEC Form 6 Maths). So if a learner is e.g. ZIMSEC Form 4 Geography, there genuinely are no clips for them yet — the UI must say so instead of silently doing nothing or showing irrelevant items.
- 12 tutor profiles exist with subjects in `tutor_subjects`. Learner-side discovery currently filters by a single `subjectFilter` substring and an over-strict `studyLevel→grade` map that doesn't understand "Form 4", "A-Level", curriculum, etc. — so many matching tutors are hidden.

## The four fixes

### 1. PDFs/books actually open and are readable in-app

The current viewer points an `<iframe>` at `https://mozilla.github.io/pdf.js/web/viewer.html?file=…`. That host blocks framing on iOS Safari and inside the Lovable preview, which is why the overlay opens but the page stays blank ("loading and not opening").

Replace with a real in-app renderer:

- Add `react-pdf` + `pdfjs-dist`, bundle the worker locally (`pdfjs-dist/build/pdf.worker.min.js` via Vite `?url`).
- Rewrite `DocumentViewerOverlay.tsx` to render pages to `<canvas>` with prev/next + page X of Y, pinch/scroll zoom, and a width that matches the container.
- Keep the header (title, "Open in new tab", Download, Close).
- If `react-pdf` errors on a URL (CORS), keep the existing fallback (Open in new tab / Download), so the overlay is never a dead loading spinner.

### 2. Library shows ONLY syllabus + grade content (strict personalisation)

You explicitly want strict filtering now. That reverses the "soft fallback" we added previously, so to be clear:

- `useLibraryResources.ts`: drop the `personalizedResources.length > 0 ? … : allResources` fallback. `visibleResources = personalizedResources` whenever `academicProfile` is set.
- Tighten the filter:
  - `curriculum`: case-insensitive exact match (with synonyms: `CAPS↔NSC`, `Cambridge↔CAMB↔IGCSE`).
  - `grade`: exact normalized match against the learner grade and against every entry in `grade_levels[]` (no fuzzy "Form 4 contains 4" matches).
  - `subject`: must be in the learner's `subjects[]` (case-insensitive exact, not substring).
- `StudySyncLibrary.tsx`: `tutorialFeed`, the Books tab list, and the Past Papers tab list all derive from `personalizedResources` — never `allResources`.
- Empty states get explicit copy: "No Form 4 ZIMSEC Geography clips yet — tutors are uploading more weekly." Same pattern for Books and Past Papers. This is the honest UX when the catalogue genuinely has nothing for that learner.

If no `academicProfile` is set, prompt them to set one (link to the academic profile screen) instead of dumping the whole catalogue.

### 3. Clips actually play in the reels feed

Two real problems:

- **YouTube embed never starts looping:** `youtube.com/embed/<id>?autoplay=1&mute=1&loop=1&playsinline=1` requires `playlist=<id>` for `loop=1` to work, and needs `&enablejsapi=1&rel=0`. Update `embedUrl()` in `StudyClipsFeed.tsx` accordingly. Also add `&modestbranding=1`.
- **Vimeo/Loom embeds are missing the right autoplay flags on mobile;** add `playsinline=1` (Vimeo) and ensure Loom uses `?autoplay=1&hide_owner=true&hide_share=true&hide_title=true`.
- The `iframe` swap to `about:blank` when not active is fine, but on mount the `IntersectionObserver` only fires after layout — set the initial `activeIndex` from `startIndex` so the first slide gets a real `src` immediately (today first frame can stay on `about:blank` for ~300ms which looks like "loading and not playing").
- Add `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"` (already mostly there) and `referrerPolicy="strict-origin-when-cross-origin"` so YouTube serves the embed.

If `tutorialFeed.length === 0` (because of strict personalisation), the Clips tab shows the empty state from §2 instead of a black screen.

### 4. Learners see every tutor that teaches their subject + grade + syllabus

Today `useTutorData` only filters by one `subjectFilter` and a hard-coded `studyLevel → grade` map that doesn't include forms / A-Level. Switch to learner-driven matching:

- New options on `useTutorData`: `subjects?: string[]`, `curriculum?: string`, `grade?: string`.
- Matching rule: keep a tutor if **any** of their `tutor_subjects` rows satisfies all of:
  - `subject` is in the learner's `subjects[]` (case-insensitive exact).
  - `level` overlaps the learner's `grade` (normalize both: "Form 4" ↔ "Grade 10–11", "A-Level" ↔ "Form 6 / Grade 12", etc.). Use a small bidirectional map.
  - If `curriculum` is stored on `tutor_subjects` (it isn't today — confirm with you whether to add a column), match on it; otherwise allow all curricula for the right subject+grade.
- Remove the silent "tutors with active bookings ≥ maxActive" hide from the discovery list: instead show them with a "Fully booked this week" pill so the learner still sees them.
- `LearnerHomeTab` / wherever discovery is rendered passes `academicProfile.subjects`, `.grade`, `.curriculum` into the hook.

## Files to change

- `src/components/library/DocumentViewerOverlay.tsx` — full rewrite using `react-pdf`.
- `package.json` — add `react-pdf`, `pdfjs-dist`.
- `src/hooks/useLibraryResources.ts` — strict personalisation, remove soft fallback, normalise curriculum/grade/subject matching.
- `src/components/StudySyncLibrary.tsx` — derive Books/Papers/Clips from `personalizedResources`; clear empty-state copy; profile-required prompt.
- `src/components/library/StudyClipsFeed.tsx` — fix YouTube/Vimeo/Loom embed URLs, set initial active slide, referrerPolicy.
- `src/hooks/useTutorData.ts` — accept `subjects[]`, `curriculum`, `grade`; new normalised matcher; show fully-booked tutors with a pill.
- Discovery callers (`LearnerHomeTab.tsx`, `AdvancedBooking.tsx` if it passes filters) — pipe academic profile into the hook.

## Tradeoffs to confirm

1. **Strict personalisation will make tabs empty for learners whose curriculum/grade/subject combo has no content yet** (most non-Maths combos today). You explicitly want this — confirming we won't fall back to "show everything" anymore.
2. **Adding `react-pdf` + `pdfjs-dist**` ships ~300 KB more JS (lazy-loaded only when a doc is opened). I'll dynamic-import the viewer so it doesn't hit the home bundle.
3. **Curriculum on `tutor_subjects`:** today the table has `subject` and `level` only. To filter tutors by curriculum (ZIMSEC vs CAPS vs IEB) I'd need a new `curriculum text[]` column on `tutor_subjects` and a tutor-side UI to set it. For now I'll match on subject + grade only and surface a small "Teaches: ZIMSEC, CAPS" line from the tutor's bio if present — let me know if you want the schema change in this pass.