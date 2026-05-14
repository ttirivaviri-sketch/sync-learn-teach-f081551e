## Goal

Polish the full new-user flow end-to-end so it feels like a high-end app:
- **Tutor**: signup → guided onboarding (docs + teaching profile) → pending screen → admin approval → instant teaching access. No subscription anywhere.
- **Learner**: signup → guided profile → 7-day trial / skip → personalised library + StudyMode pre-seeded with curriculum-aligned topics from day one.

Most plumbing already exists (`TutorOnboardingWizard`, `useTutorVerificationGate`, `LearnerOnboarding`, `useSeedSubjectsFromProfile`, `seed-curriculum-topics` edge fn). This pass closes the remaining gaps and elevates the UX.

---

## 1. Tutor onboarding — completion & polish

**1a. Resumable wizard.** Persist wizard state to `localStorage` per `user.id` (text fields + step index — files re-pick). Loader on mount restores progress so a refresh mid-application doesn't reset.

**1b. High-end visual treatment** in `TutorOnboardingWizard.tsx`:
- Animated step transitions (framer-motion fade/slide).
- Replace flat progress bar with a segmented stepper showing icons per step + checkmarks on completed steps.
- Each step gets a hero icon, short benefit copy, and clear primary CTA.
- File inputs → drag-and-drop dropzones with thumbnail preview for images, filename + size for PDFs.
- Step 8 becomes a **Review & Submit** screen that summarises every entry (photo, ID #, curriculums, grades, subjects, rate, bio) before submission.

**1c. Welcome celebration** after submission — full-screen success card ("You're in! We'll let you know within 24–48 hours"), then redirect to pending screen instead of bare toast.

**1d. Approval celebration.** When `gate.status` flips from `pending` → `verified`, show a one-time `<TutorApprovedSplash>` overlay before TutorApp renders normally (flag in `localStorage` so it shows once).

**1e. Pending screen polish** (`TutorPendingScreen`): live status pill that re-polls every 30s using the existing `gate.refetch()`; clearer "what we're checking" checklist; link to "Edit my application" if `pending` (allow re-uploading docs).

**1f. Notifications.** Verify the admin-decision notification insert in `Verifications.tsx` works (it does); add a Postgres trigger as backup so manual `verification_status` flips also notify.

---

## 2. Learner onboarding — completion & polish

**2a. Polish `LearnerOnboarding.tsx`** with same visual language as the tutor wizard (segmented stepper, motion transitions, branded card).

**2b. Add a Step 0 "Welcome" splash** with the user's first name, what we'll set up, and a single "Let's go" CTA. Skip if profile already exists.

**2c. Celebration step 3** after subscription decision: animated "All set!" card with a quick checklist ("Library personalised ✓ / StudyMode subjects ready ✓ / Free trial active ✓") then auto-route to `/learner`.

**2d. Eager seeding.** When the learner saves their academic profile in onboarding, immediately:
1. Insert subjects into `subjects` table (the existing seed hook handles this on first StudyMode entry — call it here too so it's done by the time they land on home).
2. Fire `bulk-seed-curriculum`-style request narrowed to *just their (curriculum, grade, subjects)* — a new lightweight call to the existing `seed-curriculum-topics` per missing subject. Show a tiny toast "Personalising your study plan…" — non-blocking.

**2e. Confirm subscription is learner-only.** Tutor app already has zero `useSubscription` references — keep it that way; ensure no tutor route ever reaches `/start-trial`. (Audited — clean.)

---

## 3. Library auto-filter (verification only)

`StudySyncLibrary` is already keyed off `academicProfile` (curriculum / grade / subjects). Audit the filter inside `StudySyncLibrary` to make sure:
- `library_system_resources` query filters by `curriculum = profile.curriculum AND grade_levels @> [profile.grade] AND subject = ANY(profile.subjects)`.
- Empty state when nothing matches points to "Edit profile" instead of showing irrelevant content.
- Add unit-style smoke check by reading the component and patching the query if needed.

---

## 4. StudyMode curriculum coverage — make it thorough

Build on the existing `seed-curriculum-topics` and `useSeedSubjectsFromProfile`:

**4a. Strengthen `seed-curriculum-topics` prompt** to require:
- Every official syllabus strand and sub-strand (no abbreviation).
- Per topic: `learning_objectives[]`, `key_concepts[]`, `assessment_objectives[]`, `prerequisites[]`, `exam_weight`, `typical_question_styles[]`.
- Validator pass enabled by default for ALL sources (not only `ai`) — the doubled cost is acceptable since seeding is one-shot per template.

**4b. After topics seed for a learner, kick off a one-time `personalise-curriculum-deep-dive` background job** (new edge function) per subject that:
- Reads the subject's seeded topics.
- Generates a coverage map of *concepts* (not just topics) and writes them into `daily_task_concepts` so the daily-task engine has a full pool to draw from.
- Builds an initial spaced-rotation plan in `daily_tasks` for the first 7 days so home tab is never empty after onboarding.

**4c. Daily task engine guard.** Ensure `generate-daily-task` always picks topics from the user's seeded `subjects.topics` (curriculum-aligned), never from generic AI brainstorm. Add a fallback that re-runs `seed-curriculum-topics` if the subject has < 5 topics.

**4d. Admin curriculum dashboard** (`/admin/curriculum-templates` already exists): add per-template coverage stats (topic count, concept count, last verified) and a "Re-seed with validator" button.

---

## 5. Technical notes

- New file: `src/components/onboarding/StepperHeader.tsx` (shared between tutor + learner wizards).
- New file: `src/components/onboarding/SuccessSplash.tsx`.
- New edge function: `personalise-curriculum-deep-dive` (CRON_SECRET-gated, called from learner onboarding completion).
- New hook: `src/hooks/useResumableWizard.ts` for tutor wizard state persistence.
- `TutorPendingScreen` polling: `useEffect` interval calling `gate.refetch()` every 30s; clear on unmount.
- No schema changes required — `daily_task_concepts`, `subjects`, `curriculum_topic_templates`, `tutor_verifications`, `tutor_teaching_profile` all already exist.
- Animations: use `motion/react` (already in deps from Lovable preset) for step transitions and splash overlays.

---

## Open question

Validator pass on **all** template seeding doubles AI cost (~1200 calls). Confirm OK, or keep current behavior (validator only when no syllabus PDF). Default in this plan: **validator on for all** — quality wins for a one-shot seed.
