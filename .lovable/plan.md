## Scope

Five related changes that build on the lesson-transcription pipeline shipped in the previous loop. All work stays inside StudyMode + the lesson features, plus a small legal/consent surface.

---

## Part 1 — Speaker diarization (tutor vs student)

**Edge: `transcribe-lesson-chunk`**
- Accept `speaker_hint` (`tutor` | `learner`) plus the user's `display_name` and pass them in the Gemini prompt so each chunk transcript is tagged with `[Tutor]` / `[Learner]` line prefixes.
- Return `{ text, segments: [{speaker, text}] }` instead of plain text.

**Edge: `process-lesson-recording`**
- Strengthen the diarization system prompt: enforce exactly two labels (`Tutor`, `Learner`), require every segment to carry a `speaker`, and reject unknown speakers (fallback to `unknown`).
- Continue writing `segments` jsonb to `lesson_transcripts` but with the stricter schema.

**Client: `useLiveLessonTranscript.ts` + `LiveCaptionsOverlay.tsx`**
- Hook now tracks per-speaker captions. Caller passes `localRole` (tutor/learner) and a display name; that's the `speaker_hint`.
- Overlay shows the last 2 lines with a coloured speaker chip (Tutor = primary, Learner = accent).

**UI: transcript viewer**
- New `LessonTranscriptDialog.tsx` opened from `LessonNotesCard`; renders `segments` with speaker chips and timestamps, using `MathMarkdown` so KaTeX rules still apply.

---

## Part 2 — Consent, retention, deletion, export

**Migration**
- New `lesson_consents` table: `user_id`, `booking_id`, `recording_consent bool`, `transcription_consent bool`, `notes_consent bool`, `consented_at`, `revoked_at`. RLS: user manages their own row; tutor + learner of the booking can read each other's row to know whether to start recording.
- New `lesson_retention_settings` table (one row per user): `auto_delete_after_days` (default 90), `keep_notes_only bool` (default true — purges audio + transcript but keeps AI notes for StudyMode reinforcement).
- New `pg_cron`-style purge: scheduled edge function `purge-expired-lesson-data` (manual trigger acceptable too) that deletes audio from storage and rows from `lesson_recordings` / `lesson_transcripts` past the retention window.

**Client gating**
- `VideoMeeting.tsx` shows a consent modal before the Live captions toggle does anything. Both parties must have a row with `recording_consent = true` for that booking, otherwise the toggle is disabled with a tooltip.
- Hook checks consent before `start()`.

**UI: Data & Compliance screen**
- New `src/pages/settings/DataCompliance.tsx` linked from learner + tutor Profile tabs.
- Shows: consent toggles (recording / transcription / AI notes), retention slider (7 / 30 / 90 / 365 days), "Delete all my lesson data" button, "Export my lesson data" button (downloads a JSON bundle of transcripts + notes + topic mappings via new edge `export-lesson-data`), and a per-lesson list with individual delete.

---

## Part 3 — Smarter `lesson_topic_mapping` + weak-concept feedback

**Edge: `process-lesson-recording`** (extend Step 3)
- After producing topic mappings, run a second Gemini call to *review* the mapping against the transcript: for each concept produce `evidence_quotes`, `confidence` (0–1), and `recommendation` (`reinforce` | `review` | `skip`).
- Persist new columns on `lesson_topic_mapping`: `confidence numeric`, `evidence jsonb`, `recommendation text`.
- Weak-concept upsert thresholds:
  - `confidence >= 0.75 && coverage_score < 0.6` → upsert `weak_concepts` with `severity = 'high'`.
  - `0.5 <= confidence < 0.75` → upsert with `severity = 'medium'`.
  - `confidence < 0.5` → ignore (don't pollute StudyMode).
- `concept_attempts` only written for `confidence >= 0.6`.

**Migration**
- `ALTER TABLE lesson_topic_mapping ADD COLUMN confidence numeric, ADD COLUMN evidence jsonb, ADD COLUMN recommendation text;`

---

## Part 4 — Lesson reinforcement set (quiz + flashcards) + mastery tracking

**Edge: new `generate-lesson-reinforcement`**
- Input: `recording_id`. Reads notes + topic mapping.
- Calls existing `generate-quiz` (5 questions biased to high-confidence concepts) and `generate-flashcards` (6 cards covering vocabulary + key points) internally — no signature changes.
- Stores result in new `lesson_reinforcement_sets` table: `booking_id`, `learner_id`, `quiz jsonb`, `flashcards jsonb`, `concepts text[]`, `mastery_baseline jsonb` (snapshot of each concept's current mastery from `concept_mastery_v`).

**Migration**
- `lesson_reinforcement_sets` with full GRANTs + RLS (learner-only read/write of their own row).

**Client**
- `LessonNotesCard` gets a "Reinforce this lesson" CTA → opens new `LessonReinforcementRunner.tsx` (mini version of existing `StructuredDailyTaskRunner` — quiz first, then flashcards).
- On completion, write `concept_attempts` rows (`source = 'lesson_reinforcement'`) and compute a delta vs `mastery_baseline`; show a "Mastery progression" panel: per-concept before → after bars, plus overall % gained.
- StudyMode Dashboard banner ("Reinforce your last lesson") already exists from prior loop — wire it to open the new runner instead of the generic daily task runner.

---

## Part 5 — Data & Compliance + Terms + Privacy across all apps

Three legal pages already exist (`src/pages/legal/Terms.tsx`, `Privacy.tsx`, plus `Community`, `Cookies`, `Refunds`, `LibraryDisclaimer`, `Copyright`). Work needed:

1. **New `src/pages/legal/DataCompliance.tsx`** (legal copy, distinct from the user-settings screen in Part 2) — covers POPIA/GDPR scope for recordings, transcripts, AI notes, retention defaults, export/deletion rights.
2. **Update `Privacy.tsx`** — add a section on lesson recording, transcription, AI notes, retention windows, opt-out, processor (Gemini via Lovable AI Gateway).
3. **Update `Terms.tsx`** — add a recording/AI-notes clause referencing the new consent + retention controls.
4. **Add footer links** in Learner, Tutor, and Admin apps:
   - Learner: `LearnerProfileTab.tsx` legal section row → Data & Compliance, Terms, Privacy.
   - Tutor: `TutorProfileTab.tsx` same row.
   - Admin: `AdminLayout.tsx` footer.
   - Landing: already wired; add Data & Compliance link.
5. **Update `mem://index.md` Core** with: "Lesson recordings require explicit consent from both parties; retention defaults 90 days; notes can outlive audio."

---

## Technical summary

- **New tables**: `lesson_consents`, `lesson_retention_settings`, `lesson_reinforcement_sets`. ALTER on `lesson_topic_mapping`.
- **New edge functions**: `export-lesson-data`, `purge-expired-lesson-data`, `generate-lesson-reinforcement`.
- **Updated edge functions**: `transcribe-lesson-chunk`, `process-lesson-recording`.
- **New components/pages**: `LessonTranscriptDialog`, `LessonReinforcementRunner`, `settings/DataCompliance`, `legal/DataCompliance`.
- **Updated**: `VideoMeeting`, `useLiveLessonTranscript`, `LiveCaptionsOverlay`, `LessonNotesCard`, `LearnerProfileTab`, `TutorProfileTab`, `AdminLayout`, `Privacy`, `Terms`, route registration in `App.tsx`, StudyMode `Dashboard` banner wiring.
- **Memory**: new core rule on consent + retention.

This is a 3-migration, ~14-file change. Ready to implement on approval.
