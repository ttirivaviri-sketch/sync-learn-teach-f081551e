

# Show Academic Profile in Profile Tab & Study Mode

## Problem
1. The Learner Profile tab shows academic details (curriculum, grade, exam year, subjects) but only if the user has already saved them -- no deep integration with Study Mode.
2. Study Mode has its own separate `OnboardingFlow` that duplicates academic profile setup and doesn't read from `academic_profiles` table.
3. Study Mode Dashboard jumps straight to "Upload Syllabi" without showing the student's curriculum, grade, exam year, or subjects.
4. There's no gating to require document uploads before generating quizzes/tasks.

## Plan

### 1. Pass academic profile into Study Mode
- In `StudySyncLibrary.tsx`, pass the `academicProfile` prop through `StudyModeWrapper` down to `StudyMode` and then to `Dashboard`.
- Update `StudyModeWrapper` props to accept `academicProfile`.
- Update `StudyMode` and `Dashboard` to receive and use the academic profile.

### 2. Show academic profile card in Study Mode Dashboard
- Add an "Academic Profile" summary card at the top of the Dashboard showing: curriculum, grade, exam year, and subject badges.
- If no academic profile exists, show a prompt directing back to the Profile tab.
- Replace the separate `OnboardingFlow` curriculum/subject selection with reading from the existing academic profile -- the OnboardingFlow should only handle the readiness check and exam date setup, not re-ask for curriculum/subjects.

### 3. Gate quizzes/tasks behind document uploads
- In the Dashboard, after showing the academic profile card, check if the user has any `documents` (syllabi/past papers) uploaded.
- If no documents exist, show a prominent "Upload your syllabus and past papers" card with the upload button, and disable/hide task generation and quiz buttons.
- If documents exist, show the normal subject cards and task flows.

### 4. Enhance Profile tab academic card
- Add the student's full name, email at the top of the profile academic card.
- Show all fields: curriculum, grade, exam year, exam board, school name, target grade, learning style -- whatever is populated.
- Ensure subjects are displayed as badges.

### Files to modify
- `src/components/StudySyncLibrary.tsx` -- pass academicProfile to StudyModeWrapper
- `src/studymode/StudyModeWrapper.tsx` -- accept and forward academicProfile prop
- `src/studymode/components/StudyMode.tsx` -- accept academicProfile, pass to Dashboard
- `src/studymode/components/Dashboard.tsx` -- render academic profile card, gate content behind document uploads
- `src/studymode/components/OnboardingFlow.tsx` -- simplify to skip curriculum/subject steps if academic profile exists
- `src/pages/LearnerApp.tsx` -- minor: ensure all academic profile fields render in Profile tab

### Technical details
- Academic profile data comes from `useAcademicProfile` hook (already used in LearnerApp).
- Document check: query `documents` table filtered by `user_id` to see if any syllabi/past papers exist.
- No database changes needed -- all tables and columns already exist.

