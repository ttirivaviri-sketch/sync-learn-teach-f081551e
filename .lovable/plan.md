## Problem

Logged in as `ashmlambo89@gmail.com` (IEB · Grade 12 · Mathematics, Accounting, Physical Sciences) the learner only sees **Talent** even though there are 3 tutor profiles in the DB.

DB snapshot:
| Tutor | tutor_subjects rows |
|---|---|
| Talent | 1 (Mathematics, Grade 10-12) |
| Israel Potera | 0 |
| StudySync | 0 |

Reading `src/hooks/useTutorData.ts`, four filtering bugs combine to hide relevant tutors:

1. **`filtered = tutorsWithSubjects.filter(t => t.subjects.length > 0)`** drops every tutor whose `tutor_subjects` rows are missing — even if their `tutor_teaching_profile` lists the subject. Two of three tutors disappear here.
2. **Subject match is strict equality** (`canonicalSubject` lowercases + trims, nothing else). Common aliases never match: `Physical Sciences` ↔ `Physics`, `Maths` ↔ `Mathematics`, `Accountancy` ↔ `Accounting`, `English Home Language` ↔ `English`, etc.
3. **Subject + Grade filters are AND-combined and hard.** A tutor with the right subject but a non-overlapping grade label is hidden. The single "Talent" row only matches because Grade 10-12 happens to include Grade 12.
4. **Curriculum is never considered.** Learner curriculum (IEB) is ignored, and tutors who tag themselves cross-curriculum on `tutor_teaching_profile.curriculums` aren't surfaced as such.

There is also a data-quality issue: onboarding only writes `tutor_subjects` rows for subjects the tutor explicitly enters in that step (`TutorOnboardingWizard.tsx:177-185`). If a tutor edits their teaching profile later, no `tutor_subjects` rows exist and they vanish from search.

## Plan

### 1. Show tutors with no `tutor_subjects` rows by falling back to `tutor_teaching_profile`
- In `useTutorData`, also fetch `tutor_teaching_profile (user_id, subjects?, curriculums, grades)` and merge:
  - If a tutor has `tutor_subjects` rows → use them (canonical source of price/level).
  - Otherwise synthesize lightweight subject entries from `tutor_teaching_profile.subjects` (or fallback list derived from grades) so they're discoverable, with `hourly_rate=null` and `level` from `grades[0]`.
- Stop excluding tutors with zero rows; instead score them lower and tag them `profileIncomplete: true` so the UI can show a soft "Setting up profile" pill.

### 2. Subject alias matching
- Add a `SUBJECT_ALIASES` map in `src/lib/personalization.ts` keyed by canonical name → synonyms (Maths/Mathematics, Physics/Physical Sciences, Accounting/Accountancy, English variants, Life Sciences/Biology, etc.).
- Update `subjectMatches` to compare canonical+alias sets instead of strict equality. Use it in `useTutorData` and `TopicTutorRack` consumers.

### 3. Soften filters + add curriculum awareness
- Change the filter pipeline in `useTutorData` from "must match all" to a **score-and-rank** approach:
  - Compute `subjectScore`, `gradeScore`, `curriculumScore`, `distanceScore`, `ratingScore` per tutor.
  - Keep tutors with `subjectScore > 0` OR (`gradeScore > 0` AND `searchQuery` matches name/bio).
  - Sort by composite score so exact subject+grade+curriculum matches surface first, partial matches still appear below.
- Match `academicProfile.curriculum` against `tutor_teaching_profile.curriculums` using the existing `curriculumMatches` helper. Cross-curriculum tutors (multiple curriculums or untagged) stay visible.
- Remove the implicit AND on the academic-profile `subjects` array — match if **any** learner subject overlaps a tutor subject.

### 4. Backfill missing `tutor_subjects` on save
- In `TutorOnboardingWizard.tsx` (and the profile-edit equivalent if present) add a one-shot reconciler: after `tutor_teaching_profile` upsert, ensure a `tutor_subjects` row exists for every subject in `state.subjects`, deleting stale ones the tutor removed. Prevents the "0 rows" state for new tutors going forward.

### 5. Verify
- Re-query the DB after the change to confirm Israel Potera + StudySync now surface for a Grade 12 IEB Maths/Physics learner (assuming they pick subjects).
- Quick manual check in the preview: switch learner subjects between Mathematics, Physical Sciences, Accounting and confirm Talent still appears for Maths and that incomplete tutors show with the "Setting up profile" pill.

### Technical notes
- Files touched: `src/hooks/useTutorData.ts`, `src/lib/personalization.ts`, `src/pages/tutor/TutorOnboardingWizard.tsx`.
- No schema changes required.
- `gradeMatches` and `curriculumMatches` already handle Form↔Grade and CAMB/IGCSE/A-Level synonyms — we just need to actually call `curriculumMatches` and use the new `subjectMatches`.

## Out of scope
- Building an admin tool to bulk-fix tutors with missing `tutor_subjects` (the reconciler in step 4 fixes them on next save).
- Geosearch/radius UI changes.
