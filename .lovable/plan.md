

## Findings

### 1. "Generate Plan / Generate Schedule" buttons don't work — root cause found
Network shows the edge function returns **HTTP 200** with the AI plan, but also `"saved":0` and `"insertError":"Could not find the 'subject_id' column of 'study_schedule' in the schema cache"`.

The `study_schedule` table actually has these columns: `user_id, subject, task, due_date, completed, scheduled_date, duration_minutes, task_type, is_completed, notes`.

The edge function `supabase/functions/generate-study-plan/index.ts` tries to insert `subject_id` and `topic_name` (which don't exist). So the AI plan is generated but never saved → calendar stays empty → user thinks the button is broken. The hook also doesn't surface `insertError` as a toast, so it silently "succeeds".

### 2. Subjects tab is overloaded
Currently the **Subjects tab** stacks: AI greeting, reminders, **ExamReadinessWidget**, **MockExamSection** (with paper unlock cards), then the subject grid. Plus all 5 tabs: Subjects / Progress / Calendar / Review / Profile. Mock Exams + Exam Readiness logically belong on their own surface — they're full mini-features.

The **Profile tab** (inside Study Mode) also doubles up Quick Actions, Daily Progress card, exam-date prompt, syllabus gate, AI profile card — heavy and duplicates LearnerProfileTab.

## Plan

### A. Fix the broken Generate Plan / Schedule buttons

1. **Migration** — add the missing columns to `public.study_schedule` so the edge-function insert succeeds:
   - `subject_id uuid references public.subjects(id) on delete set null`
   - `topic_name text`
   - Index on `(user_id, scheduled_date)` for the calendar query.
2. **Edge function `generate-study-plan/index.ts`**: when an insert error occurs, return HTTP 500 (not 200 with `saved: 0`) so the client can show a real error.
3. **Client `useAdaptiveLearningEngine.generateStudyPlan`**: surface success/failure with a `toast()` ("Plan saved · N tasks added to your calendar" / error toast) so the buttons feel responsive and the result is visible.
4. **`AdaptivePlanBanner`** + **`StudyCalendar.handleGenerateSchedule`**: after a successful generate, also invalidate `['daily-tasks']` and `['study-schedule']` so the calendar grid + Today's tasks repaint immediately.

### B. Restructure Study Mode tabs to reduce clutter

Reorganise the 5-tab layout into a cleaner 5-tab layout with stricter scopes. Move heavy widgets behind buttons / dedicated tabs.

| Tab | Keeps | Moves OUT (to where) |
|---|---|---|
| **Subjects** | AI greeting strip, reminders, subject grid | Exam Readiness Widget → Progress; Mock Exam Section → new "Exams" tab |
| **Progress** | AI Insights, ProgressCharts | + Exam Readiness Widget (moved from Subjects) |
| **Calendar** | Multi-exam countdown, AdaptivePlanBanner, StudyCalendar | (no change in scope, but Generate Plan button now works) |
| **Exams** *(renamed from Review)* | MockExamSection (moved here), Spaced Repetition, Weak-Topic Alerts, Quiz History | Quiz History collapsed behind a "Show history" button instead of always rendered |
| **Setup** *(renamed from Profile)* | Academic profile card, Syllabus gate, Upload docs button | Daily Progress card → REMOVED (already lives in LearnerHomeTab); Quick Actions row → REMOVED (each action already exists where it makes sense); exam-date prompt → kept but compact |

Specifically:
- **Mock Exam Section** moves from Subjects → Exams tab. This was the biggest source of clutter in the screenshot the user shared.
- **Today's Progress** card removed from Setup tab — duplicates the Home tab stats.
- **Quick Actions row** (Upload / Past Papers / Daily Summary) removed — each is reachable elsewhere, and "Daily Summary" stays as a small button in the header.
- **Quiz History list** in Exams tab hidden behind a `Show full quiz history` collapsible button to declutter.

### C. Files to change

- New migration: add `subject_id`, `topic_name`, index to `public.study_schedule`.
- `supabase/functions/generate-study-plan/index.ts` — return 500 on insert error so client sees real failure.
- `src/studymode/hooks/useAdaptiveLearningEngine.ts` — toast on success/failure; invalidate `daily-tasks` + `study-schedule` queries.
- `src/studymode/components/StudyCalendar.tsx` — invalidate same queries; toast on result.
- `src/studymode/components/Dashboard.tsx` — restructured tabs (move MockExamSection, ExamReadinessWidget; trim Profile tab; collapsible quiz history).

## Result

- "Generate Plan" and "Generate Study Schedule" actually save to the database, populate the calendar, and show a confirmation toast.
- Subjects tab is clean: just your subjects + reminders.
- Mock Exams get their own home alongside Spaced Repetition (the "Exams" tab).
- Setup tab is lean: profile + syllabus + upload — no duplicated daily stats.
- Less vertical scrolling, fewer competing CTAs, clearer mental model per tab.

