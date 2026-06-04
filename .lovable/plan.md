
## Part 1 — Extended KaTeX unit & quantity rules

Update `supabase/functions/_shared/katex-rules.ts` so every StudyMode generator emits consistently formatted quantities. The shared constant is already imported by 11+ edge functions, so updating it once propagates everywhere.

Additions to `KATEX_RULES`:
- **SI base units** (length/mass/time/temp): `mm, cm, m, km, mg, g, kg, t, s, min, h, °C, K` → always `$8\,\text{cm}$`, `$25\,\text{°C}$`, `$1.5\,\text{kg}$`.
- **Physics derived units**: `N, J, W, Pa, V, A, Ω, Hz` and compounds → `$9.8\,\text{m/s}^2$`, `$50\,\text{Hz}$`, `$12\,\text{V}$`, `$5\,\Omega$`.
- **Chemistry/biology**: `mol, mol/L, mL, L, μg, ppm, °, atm` → `$0.5\,\text{mol/L}$`, `$25\,\mu\text{g}$`, `$200\,\text{ppm}$`.
- **Currencies + ratios** (already partly covered, tightened): `$\$120$`, `$R\,250$`, `$\pounds 10$`, `$\euro 5$`, ratios `$3:4$`.
- **Per-unit notation**: always `$\text{kg/m}^3$`, never `kg/m^3`.
- **Thin space rule**: always `\,` between number and unit; never bare `5kg`.

Also harden `src/studymode/components/MathMarkdown.tsx`:
- Expand the unit-wrapping regex to recognise the new unit vocabulary (Ω, μg, mol/L, m/s², kg/m³, etc.) when AI slips and emits a bare `5 kg`.
- Add a small post-processor that auto-inserts `\,` between digit and known unit token inside `$...$`.

No DB or schema changes for Part 1.

## Part 2 — Lesson transcription + StudyMode reinforcement

Provider: **Lovable AI Gateway (Gemini)** — uses existing `LOVABLE_API_KEY`. Gemini 2.5 Flash accepts inline audio (base64) and returns transcripts; no new secret needed.

Capture mode: **Both** live + post-lesson.

### 2.1 Database (one migration)

New tables (with full GRANTs + RLS):

```text
lesson_recordings
  id, booking_id (FK bookings), tutor_id, learner_id,
  storage_path, duration_seconds, status (uploaded|transcribing|ready|failed),
  created_at, updated_at

lesson_transcripts
  id, recording_id (FK lesson_recordings, unique),
  booking_id, full_text, segments jsonb (speaker, start, end, text[]),
  language, created_at

lesson_notes
  id, booking_id, owner_id (learner_id or tutor_id), audience (learner|tutor|shared),
  summary, key_points jsonb, action_items jsonb, vocabulary jsonb,
  created_at, updated_at

lesson_topic_mapping
  id, booking_id, learner_id, subject_id, topic,
  concepts text[], coverage_score numeric (0-1),
  weak_concepts text[], created_at
```

RLS: learners read their own; tutors read their bookings' rows; service_role writes.

Storage: new private bucket `lesson-audio` (only owner + tutor of the booking can read; service_role writes).

### 2.2 Live in-call captions

- Add a "Live captions" toggle in the existing Jitsi call view (existing `integrations/video-conferencing`).
- New hook `src/hooks/useLiveLessonTranscript.ts` that captures the local mic via `MediaRecorder` (webm/opus, 5-second chunks), base64-encodes, and POSTs each chunk to a new edge function `transcribe-lesson-chunk`.
- Edge function calls Gemini 2.5 Flash with the audio chunk and returns a partial transcript; we append to a local in-memory transcript and render a caption strip overlay.
- At call end, the accumulated chunks are uploaded as a single `lesson-audio` blob → triggers the post-lesson pipeline below (so we never lose the recording even if the user only had live mode on).

### 2.3 Post-lesson upload pipeline

New edge function `process-lesson-recording`:
1. Reads audio from `lesson-audio` storage.
2. Calls Gemini for a clean diarised transcript (system prompt enforces speaker labels Tutor/Learner) → writes `lesson_transcripts`.
3. Calls Gemini again with the transcript to produce:
   - `lesson_notes` for learner (summary, key points, vocabulary, action items)
   - `lesson_notes` for tutor (teaching summary, learner struggles, follow-up suggestions)
   - `lesson_topic_mapping` (subject/topic/concepts covered, per-concept coverage_score, weak_concepts list) — uses `KATEX_RULES` so any maths in notes is correctly formatted.
4. **Feeds StudyMode** (the "Both" option):
   - For every concept in `lesson_topic_mapping.concepts`, insert a `concept_attempts` row with `source = 'tutor_lesson'`, `correct = true|partial` based on coverage_score → the existing `concept_mastery_v` view picks it up automatically (Phase 5 work).
   - For every entry in `weak_concepts`, upsert into the existing `weak_concepts` table.
   - Insert one row into `daily_tasks` of type `lesson-reinforcement` with metadata `{ booking_id, topic, concepts }` so the next-day quiz/flashcard generators bias toward what was covered. Existing `generate-quiz` and `generate-flashcards` already accept `weak_concepts` — no signature changes.

### 2.4 UI

- **Tutor & Learner Activity tabs**: each past booking gets a "Lesson notes" expandable card showing summary, key points, action items, and a "View transcript" link.
- **StudyMode Dashboard**: new banner "Reinforce your last lesson" when a `lesson-reinforcement` daily task exists for today; tapping opens the existing daily task runner.
- All transcript/notes rendered via `MathMarkdown` so KaTeX rules apply.

### 2.5 Cost & privacy notes

- Audio stays in private storage; only booking participants can read.
- Live chunking is opt-in (toggle defaults OFF); post-lesson processing runs only if a recording exists.
- Gemini billed via existing workspace credits; surface 402/429 errors in the UI like other AI calls.

## Technical summary

- **New files**: `supabase/functions/transcribe-lesson-chunk/index.ts`, `supabase/functions/process-lesson-recording/index.ts`, `src/hooks/useLiveLessonTranscript.ts`, `src/components/lesson/LessonNotesCard.tsx`, `src/components/lesson/LiveCaptionsOverlay.tsx`, 1 migration, 1 storage bucket migration.
- **Edited**: `supabase/functions/_shared/katex-rules.ts`, `src/studymode/components/MathMarkdown.tsx`, Jitsi call component, `LearnerActivityTab.tsx`, `TutorActivityTab.tsx`, `studymode/components/Dashboard.tsx`.
- **No edits** to existing generators' signatures — they already accept `weak_concepts`.
