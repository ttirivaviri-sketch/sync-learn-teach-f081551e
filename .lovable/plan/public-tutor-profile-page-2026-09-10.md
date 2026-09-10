# Public Tutor Profile Page

A dedicated page where students tap a tutor's name in the listings and see that tutor's full profile: subjects & rates, bio, qualifications/experience, curriculum coverage, and reviews — with Book and Chat actions.

## What you'll see

- A new page at `/tutors/:tutorId` (e.g. opened from the "Available Tutors" list on the Learner home tab and from the booking browse cards).
- Tapping a tutor's name, avatar, or a "View profile" link on any tutor card opens this page.
- The page shows:
  - **Header**: photo, name, online status, star rating + review count, distance, verified/qualification badges.
  - **About**: the tutor's bio.
  - **Subjects & rates**: each subject with level and hourly rate.
  - **Experience**: qualifications (type, institution, year) and the curriculums/grades they teach (ZIMSEC, CAPS, IEB, Cambridge).
  - **Reviews**: individual reviews with star rating, comment, date, and reviewer first name; "New tutor" state when none exist.
  - **Sticky action bar**: "Book Online", "In-Person", and "Chat" buttons that drop straight into the existing booking/chat flows.
- Incomplete profiles (no rate/subjects yet) show the same friendly "profile being set up" state used in listings.

## Technical approach

1. **New route** in `src/App.tsx`: `/tutors/:tutorId` → new page `src/pages/TutorPublicProfile.tsx` (lazy-loaded like other pages).
2. **New reviews RPC** (migration): `get_tutor_reviews(_tutor_id uuid)` — security-definer function returning `rating, comment, created_at` and reviewer **first name only** (from `profiles.full_name`), ordered newest first. Needed because the `reviews` table policy only lets participants read rows. No emails, phone numbers, or reviewer IDs exposed.
3. **Page data** reuses existing safe reads already proven in `useTutorData`: `get_tutor_directory` (filtered to this tutor), `tutor_subjects`, `get_public_qualifications`, `get_tutor_ratings`, `tutor_teaching_profile` — plus the new `get_tutor_reviews`. No new table grants needed.
4. **Link from listings**:
   - `src/pages/learner/LearnerHomeTab.tsx` — tutor name/avatar become links to the profile page (booking buttons unchanged).
   - `src/components/advanced-booking/TutorBrowseCard.tsx` — add a "View profile" link.
5. **Book/Chat actions**: the page accepts `state` from navigation back to the learner app (or links to `/learner?book=<tutorId>` using the existing `studyIntent`-style deep link already handled in `LearnerApp.tsx`), so booking from the profile opens the existing booking modal with this tutor preselected.
6. **SEO**: canonical + noindex (authenticated app page, not a landing page).

## Verification

- Typecheck + build.
- Playwright: open a tutor profile from the learner home list, confirm subjects/qualifications/reviews render, and Book/Chat buttons work.
