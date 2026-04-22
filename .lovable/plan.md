

# Plan: Flexible Topic Mode + AI Knowledge Mapping + Exam-Ready Evaluation

A non-linear "Start by Topic" learning system that runs alongside StudyMode without disturbing its linear syllabus progression. Built on a knowledge-mapping backbone so every question, review, and grade is grounded in the same structured concept layer.

---

## 1. Database (one migration)

**`topic_sessions`** — a flexible session opened when a student picks a topic.
- `id`, `user_id`, `subject_id`, `topic_id` (nullable, free-text `topic_name` fallback for ad-hoc topics), `subtopic`, `curriculum`
- `mode` text default `'flexible'`
- `status` text default `'active'` (`active` | `completed` | `expired`)
- `questions_attempted` int default 0, `questions_correct` int default 0, `mastery_score` numeric default 0
- `concept_review_count` int default 0 (for review-farming guard)
- `last_activity_at` timestamptz, `created_at`, `completed_at`
- RLS: user owns their sessions.

**`topic_session_questions`** — every question + grade inside a session (audit + mastery + flashcard linking).
- `id`, `session_id`, `question_text`, `expected_answer`, `student_answer`
- `concept_map jsonb` (output of mapping engine — topic / subtopic / concepts / difficulty / exam_expectation)
- `accuracy bool`, `coverage_score numeric`, `expression_score numeric`
- `missing_points jsonb`, `level text` (`exam_ready` | `close` | `developing` | `weak`)
- `xp_delta int`, `created_at`
- RLS: user owns rows via session.

**`weak_concepts`** — personalisation memory (Q3 in your spec).
- `id`, `user_id`, `subject`, `curriculum`, `concept text`, `topic text`, `weakness_score numeric` (rolling), `last_seen_at`
- Unique on `(user_id, subject, curriculum, concept)`
- Used later to bias question generation toward gaps.

**Auto-expire**: `topic_sessions` with `last_activity_at < now() - interval '24h'` and `status='active'` are closed by a lightweight RPC `expire_stale_topic_sessions()` invoked on Topic Mode entry (no cron needed).

**Caps**: enforce max **3 active sessions per user** in the `start_topic_session` RPC (auto-expire oldest if exceeded). Max **20 questions per session** enforced client + server.

---

## 2. Edge functions (4 new, all on Lovable AI Gateway, default `google/gemini-3-flash-preview`)

All return **strict JSON via tool-calling** (no free-text JSON) — this is the consistency lock.

**`map-question-concepts`** — Knowledge Mapping Engine.
Input: `{ question, subject, curriculum, topic? }`
Output: `{ topic, subtopic, concepts[], difficulty, exam_expectation }`
**Rule**: every question generated for a topic session is piped through this before it's shown.

**`generate-topic-session`** — Session initialiser.
Input: `{ subject, curriculum, topic, subtopic?, weak_concepts[] }`
Output: `{ concept_learning, quick_review, questions[5–10], flashcards[] }` — each question pre-tagged with its concept_map. Biased toward `weak_concepts`.

**`generate-concept-review`** — Pre-answer guidance ("Review this concept first").
Input: `{ question, concept_map, depth: 'quick' | 'full' }`
Output: `{ quick_review: { bullets[], formulas[], definitions[] }, full_explanation, examples[], common_mistakes[], testing_focus[] }` — **specific to the question**, never generic.

**`evaluate-topic-answer`** — Multi-layer grader.
Input: `{ question, expected_answer, student_answer, concept_map, require_keywords: true, require_structure: true }`
Output: exact schema from your spec:
```
{ accuracy, coverage_score, expression_score, missing_points[], improvement_needed, level }
```
**Exam-ready rule**: `accuracy === true && coverage ≥ 0.9 && expression ≥ 0.8 && missing_points.length === 0`.

---

## 3. XP & mastery rules (server-side in `evaluate-topic-answer`)

| Outcome | XP |
|---|---|
| Correct | +5 |
| Exam-ready | +8 to +10 (scaled by difficulty) |
| Flashcard correct | +2 |
| Minor mistake | −2 |
| Moderate mistake | −3 |
| Major mistake | −5 |

- **Floor**: session XP cannot drop below 0 (clamped per session, total leaderboard XP unaffected by session floor).
- **Difficulty scaling guard against farming**: easy topic XP × 0.6, medium × 1.0, hard × 1.4. Difficulty comes from `concept_map.difficulty`.
- **Review-farming guard**: if `concept_review_count > questions_attempted` and ratio > 2, "Review" button disables for next question (forced attempt).
- **Flashcard mastery boost**: when answer is `exam_ready`, find flashcards matching `concept_map.concepts[]` and bump `mastery_score += 25`, push next review interval out (spaced repetition acceleration). After 3 consecutive exam-ready hits on the same concept → mark flashcard `mastered=true`.

---

## 4. Hooks (new)

- `useTopicSession(sessionId)` — session state + progress, auto-saves `last_activity_at` on every action.
- `useTopicSessionRunner()` — `startSession`, `requestReview(question, depth)`, `submitAnswer(question, answer)`, `nextQuestion`, `endSession`. Wraps the four edge functions and writes to `topic_session_questions`.
- `useWeakConcepts(subject, curriculum)` — read + update rolling weakness scores; injected into `generate-topic-session`.
- Existing `useSubjectXP` reused for XP awards (already supports arbitrary amounts post-XP-differentiation work).

---

## 5. UI (new + minimal touches)

**New entry: "Start by Topic" button** on the Subjects tab in `Dashboard.tsx`, sitting next to the existing "🏆 Global" leaderboard button.

**New: `TopicPicker.tsx`** (sheet) — progressive disclosure:
```
Subject ▸ Unit (collapsible) ▸ Topic ▸ Subtopic
```
Pulls from existing `subjects.topics` jsonb. Free-text "Custom topic" input at the bottom for ad-hoc entries (creates session with `topic_id=null`, `topic_name=<input>`).

**New: `TopicSessionRunner.tsx`** — full-screen session view:
- Header: topic name, progress (3/10), session XP, "End session" button.
- Question card with **"📖 Review this concept first"** button above the answer input.
- Review opens a side-sheet with `quick_review` first, "Show full explanation" expands to `full_explanation + examples + common_mistakes`. A **"This question is testing: X, Y, Z"** highlight chip is always visible (pulled from `concept_map.concepts`).
- Submit → `evaluate-topic-answer` → result card:
  - If `exam_ready`: green badge "Exam Ready ✨ +8 XP", no feedback shown, mastery pulse animation, auto-advance after 2s.
  - Else: red/amber card with `missing_points[]` and `improvement_needed` guidance, "Try again" or "Next question".

**New: `TopicSessionSummary.tsx`** — end-of-session screen with XP earned, mastery delta, weakest concepts identified, "Mark as learned in StudyMode" optional sync button (writes to `topic_mastery` only on explicit click — never auto).

---

## 6. State isolation (the non-negotiable rule)

`mode='flexible'` sessions:
- Do NOT touch `topic_mastery`, `daily_tasks`, `quiz_attempts`, or any StudyMode progression table.
- Do NOT contribute to streak from StudyMode side; instead, Topic Mode XP feeds `subject_xp` (so leaderboards still update).
- Optional one-way sync via the explicit "Mark as learned" button on the summary screen.

---

## 7. Edge case handling (built in)

| Case | Solution |
|---|---|
| Rapid topic switching | Cap of 3 active sessions; oldest auto-expired |
| XP farming on easy topics | Difficulty multiplier (0.6 / 1.0 / 1.4) |
| Inconsistent AI grading | Strict tool-calling JSON schema on `evaluate-topic-answer` |
| Review-button abuse | Forced-attempt cooldown after 2× review:attempt ratio |
| AI returns generic content | `generate-concept-review` always receives `concept_map` + question; system prompt forbids generic textbook answers |
| Student abandons session | 24h inactivity auto-expire on next Topic Mode open |

---

## 8. Files

**DB**: 1 migration (3 tables, RLS, RPCs `start_topic_session`, `expire_stale_topic_sessions`).

**Edge functions (new)**:
- `supabase/functions/map-question-concepts/index.ts`
- `supabase/functions/generate-topic-session/index.ts`
- `supabase/functions/generate-concept-review/index.ts`
- `supabase/functions/evaluate-topic-answer/index.ts`

**Hooks (new)**:
- `src/studymode/hooks/useTopicSession.ts`
- `src/studymode/hooks/useTopicSessionRunner.ts`
- `src/studymode/hooks/useWeakConcepts.ts`

**Components (new)**:
- `src/studymode/components/TopicPicker.tsx`
- `src/studymode/components/TopicSessionRunner.tsx`
- `src/studymode/components/TopicSessionSummary.tsx`

**Modified**:
- `src/studymode/components/Dashboard.tsx` — add "Start by Topic" button on Subjects tab.
- `src/studymode/lib/aiClient.ts` — register 4 new edge function names in `EDGE_FUNCTION_MAP`.

---

## Result

- A second, non-linear learning surface ("Start by Topic") that students open whenever they want to drill a specific concept — without polluting their linear StudyMode progression.
- Every question is concept-mapped, every review is question-specific, every grade returns a strict 4-field schema, and every exam-ready answer compounds into the flashcard mastery + leaderboard XP systems.
- Personalisation memory (`weak_concepts`) starts populating from session one, ready to feed adaptive question selection in future iterations.

