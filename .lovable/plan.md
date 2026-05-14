# Tutor & Learner onboarding overhaul + curriculum-aligned StudyMode

## Goals

1. **Tutors are service providers** — no subscription, no app access until admin-verified.
2. **Learners are consumers** — guided profile → guided subscription on first launch.
3. **Profile data drives everything**: Library filters and StudyMode topic generation use the learner's curriculum + grade + subjects.
4. **StudyMode covers the full curriculum** thoroughly, topic by topic, grounded in real syllabus data.

---

## Part A — Tutor onboarding (full guided flow + verification gate)

### A1. Remove tutor subscription surface

- Remove `useSubscription`/trial banners from `TutorApp` and tutor tabs.
- Trial trigger in DB (`handle_new_subscription`) should only run for `user_type='learner'` — update trigger.
- Remove `/start-trial` from any tutor-facing path; keep it learner-only.

### A2. Document upload (mandatory, blocks app)

Extend `tutor_verifications` with:

- `student_status` enum (`current_student` | `graduate`)
- `transcript_url` (required when student)
- `qualification_url` (required when graduate) — already partly in `qualifications` table
- Keep `id_document_url`, `profile_photo_url` as required.

New onboarding screen `/tutor/onboarding`:

1. Step 1: Upload ID
2. Step 2: Upload selfie/profile photo
3. Step 3: Choose status → upload transcript OR qualification
4. Submit → `verification_status = 'pending'`

### A3. Guided profile setup (parallel to learner)

Right after documents submitted (still pending), force tutor through:

1. Curriculums they cover (multi-select: ZIMSEC, CAMB, IEB, NSC)
2. Grades they teach (filtered by chosen curriculums, multi-select)
3. Subjects per curriculum (multi-select from `CURRICULUM_SUBJECTS`)
4. Hourly rate per subject
5. Bio + teaching style

Store in existing `tutor_subjects` + new `tutor_teaching_profile` (curriculums[], grades[], bio, teaching_style, onboarding_completed_at).

### A4. Verification gate

- Add `useTutorVerificationGate` hook.
- `TutorApp` shell renders one of three states:
  - **Documents missing** → onboarding wizard
  - **Pending review** → friendly "Your documents are being reviewed" screen with status timeline; no other tabs accessible
  - **Verified** → full TutorApp (Home / Activity / Profile)
  - **Rejected** → reasons + re-upload flow
- Admin `Users`/new `Verifications` page: list pending, view docs, approve/reject with reason. Approval flips `verification_status='approved'` → triggers notification to tutor.

### A5. Profile editing post-verification

- After verified, tutors edit curriculum/grades/subjects/rate from Profile tab as today (no forced wizard).

---

## Part B — Learner onboarding (guided, once)

### B1. Flow on first sign-in

1. Account create → email confirm
2. **Step 1: Profile setup** (curriculum, grade, subjects, exam year, optional guardian email) — uses existing `AcademicProfileSetup`
3. **Step 2: Subscription** — show plans, start trial or pay (PayFast). Trial auto-starts if they skip, but screen is shown.
4. Land on `/learner` Home.

Move `/start-trial` into `/learner/start-trial` (subscription belongs in learner app).

### B2. Single source of truth for "onboarded"

- `profiles.onboarding_completed_at` (already partly tracked via academic_profiles existence). Use guard in `LearnerApp`:
  - No academic_profile → redirect to `/learner/onboarding/profile`
  - Has profile, no subscription row → `/learner/onboarding/subscription`
  - Both → app

### B3. Profile editing later

- All academic profile + subscription management lives in Profile tab (already does — verify and polish).

---

## Part C — Library personalization

The learner's `academic_profile.{curriculum, grade, subjects}` becomes the default filter for `useLibraryResources`:

- Default queries add `WHERE curriculum = profile.curriculum AND grade = profile.grade AND subject = ANY(profile.subjects)`.
- Show a "Showing resources for {Grade} {Curriculum}" chip with a "Show all" toggle.
- Applies to books, past papers, videos, study clips uniformly.

Backfill: ensure all `library_resources` rows have `curriculum`, `grade`, `subject` populated; add `NOT NULL` going forward + admin upload form enforcement.

---

## Part D — StudyMode: curriculum-aligned topic coverage

### D1. Auto-seed subjects from profile

On first entry to StudyMode (or right after profile setup), for each subject in `academic_profile.subjects`:

1. Insert/upsert into `subjects` table with `{user_id, name, curriculum, grade}`.
2. Trigger background edge function `seed-curriculum-topics` per subject.

### D2. New edge function `seed-curriculum-topics`

Inputs: `{ subject_id, subject_name, curriculum, grade }`.

Three-source grounding (priority order):

1. **Official syllabus document** if present in `documents` table (curriculum + subject + grade match) — extract topics/subtopics/objectives.
2. **Past papers** in `documents` for the same curriculum/grade/subject → extract recurring topics into `exam_patterns`.
3. **AI fallback** (Gemini) with strict prompt: "Generate the complete topic & subtopic tree for `{curriculum} {grade} {subject}` syllabus. Output JSON `{topics: [{name, subtopics, learning_objectives, key_concepts, exam_weight}]}`. Use only official syllabus knowledge for `{curriculum}`."

Result is merged and written to `subjects.topics` JSONB and `topic_mastery` rows initialized at 0.

### D3. Coverage tracking & guarantee

- Add `subject_coverage_audit` table: `{subject_id, total_topics, covered_topics, last_audit_at}`.
- Daily task selector (`generate-daily-task`) already prefers uncovered concepts — confirm and tighten so every topic is touched before any repeats.
- Add a `Coverage` widget in SubjectDetail showing "X of Y topics covered, Z mastered".

### D4. Quality controls for curriculum alignment

- **Syllabus library**: seed `documents` with the official ZIMSEC/CAMB/IEB/NSC syllabus PDFs per subject/grade (admin upload). Once present, AI no longer guesses.
- **Past-paper ingestion job**: extend `parse-document` to auto-tag topics → builds `exam_patterns` automatically.
- **Verification pass**: after AI seeds topics, run a second AI call ("validator") that scores each topic against the syllabus document and drops/merges low-confidence ones.
- **Human override**: admin tool to edit a subject's topic tree (one source of truth for all learners on that curriculum/grade — share via a `curriculum_topic_templates` table keyed by `(curriculum, grade, subject)` so we don't reseed per learner).

### D5. Shared template table (cost + consistency)

New `curriculum_topic_templates` table:

- PK `(curriculum, grade, subject)`
- `topics JSONB`, `source` ('syllabus'|'ai'|'manual'), `verified_by`, `verified_at`
- When a learner picks a subject, we copy from this template instead of re-running AI per learner. Massive cost cut + consistent quality.
- One-time admin seed job populates ZIMSEC/CAMB/IEB/NSC × all grades × core subjects.

---

## Technical details

### New / modified tables

```text
tutor_verifications
  + student_status text             -- 'current_student' | 'graduate'
  + transcript_url text
  + qualification_url text          -- (or rely on qualifications table)
  + reviewed_by uuid, reviewed_at, rejection_reason text

tutor_teaching_profile (NEW)
  user_id uuid PK
  curriculums text[]
  grades text[]
  bio text
  teaching_style text
  onboarding_completed_at timestamptz

profiles
  + onboarding_completed_at timestamptz   -- learner

curriculum_topic_templates (NEW)
  curriculum text, grade text, subject text  -- composite PK
  topics jsonb, source text, verified_by uuid, verified_at timestamptz

subject_coverage_audit (NEW)
  subject_id uuid PK
  total_topics int, covered_topics int, mastered_topics int
  last_audit_at timestamptz
```

Trigger update: `handle_new_subscription` → only fire when `profiles.user_type='learner'`.

### New edge functions

- `seed-curriculum-topics` — generates topic tree per (curriculum, grade, subject), writes template + per-learner copy
- `validate-topic-tree` — second-pass AI validator
- `audit-subject-coverage` — nightly cron updating coverage stats

### New routes

- `/tutor/onboarding` (multi-step wizard)
- `/tutor/pending` (verification waiting screen)
- `/learner/onboarding/profile`
- `/learner/onboarding/subscription`

### Admin

- `/admin/verifications` — review tutor docs, approve/reject
- `/admin/curriculum-templates` — edit canonical topic trees

---

## Open questions before I build

1. **Tutor verification SLA**: how long should admin take? Show estimated time on pending screen ("usually 24–48h")? Answer: 24-48hrs
2. **Rejected docs**: allow re-upload immediately, or after a cooldown?
3. **Subscription step for learners**: hard wall (must subscribe/start trial) or skippable with a "remind me later"? Answer:Remind me late is fine(however if they don't add card they only get 3 active recalls and flash cards in studymode so they see how it works) after that they ai usage and generation should be capped
4. **Curriculum templates seeding**: do you want me to bulk-seed all ZIMSEC/CAMB/IEB/NSC subjects up front (one big AI cost) or seed lazily on first learner-pick per (curriculum, grade, subject)? Answer:bulk seed so we know we already have the information

Once you answer these, I'll execute in this order: Tutor onboarding + verification gate → Learner onboarding flow → Library auto-filter → StudyMode curriculum templates + seeding.