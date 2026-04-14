

## Plan: Study Mode — Comprehensive Improvement Roadmap

### Current Architecture Summary

Study Mode is a sophisticated system with: AI Study Intelligence engine, Active Recall with semantic evaluation, spaced repetition, mastery tracking, daily task generation, exam mode, flashcards, and an AI tutor chat panel. The AI backbone uses Supabase edge functions calling the Lovable AI Gateway.

---

### 1. AI Logic Improvements

**A. Smarter Task Generation (Dynamic, not Template-Based)**

Currently `useDailyTasks.ts` generates the same 5 task types per subject every day from a static template. The AI context adjusts descriptions but not the task *composition*.

**Fix**: Call an AI edge function to dynamically select which task types to assign based on:
- Mastery level (high mastery → skip concept-learning, add exam-question)
- Spaced repetition schedule (due cards → prioritize flashcards)
- Days until exam (close → more exam-mode, less concept-learning)
- Readiness check (low energy → lighter tasks like micro-revision)
- Weak areas (struggling topics → add prerequisite remediation tasks)

**B. Persistent AI Memory Across Sessions**

Currently the AI Chat panel (`ChatPanel.tsx`) clears messages when subject/topic changes and has no cross-session memory. The AI tutor forgets everything.

**Fix**: Persist chat messages to a `study_chat_messages` table so the AI tutor remembers past conversations, common misconceptions, and can reference "last time we discussed X."

**C. Smarter Readiness-to-Task Mapping**

The readiness check collects sleep/energy/mood but only changes a greeting message. It doesn't actually affect task difficulty or count.

**Fix**: Pass readiness scores into the task generation pipeline:
- Low readiness → fewer tasks, lower difficulty, more review-type tasks
- High readiness → add bonus challenge tasks, higher difficulty

---

### 2. User Experience Improvements

**A. Skip Readiness Check Option**

The readiness check is a full-screen blocker every time Study Mode loads. Returning users may find this annoying.

**Fix**: Add a "Skip" button and remember preference. Auto-skip if user completed it within the last 4 hours (store timestamp in localStorage).

**B. Progress Animations & Micro-Feedback**

Task completion feels flat — the task just gets a "Done" badge. No celebration, no XP animation.

**Fix**:
- Add XP counter animation (+10 XP pop-up) on task completion
- Add confetti/particle burst on completing all daily tasks
- Add a progress ring around the subject card showing daily task completion %

**C. Mobile Chat Panel UX**

The chat panel is a fixed 380×500px floating panel that doesn't work well on mobile (414px viewport).

**Fix**: On mobile, make the chat panel full-screen (bottom sheet style) instead of a floating box. Use the `Sheet` component from shadcn.

**D. Dashboard Information Density**

The dashboard has too many cards before the user reaches their subjects — academic profile, syllabus gate, document upload gate, AI message, exam date prompt, upload prompt. On a 640px viewport, subjects may be below the fold.

**Fix**: Collapse informational cards into a compact accordion/summary row. Keep the subject list above the fold.

---

### 3. Task Interface & Interaction Improvements

**A. Task Timer & Estimated Duration**

Tasks have no time indication. Students don't know if a task takes 2 minutes or 20 minutes.

**Fix**: Add estimated duration per task type (micro-revision: 3min, concept-learning: 8min, flashcards: 5min, etc.) and an optional countdown timer during the task.

**B. Task Completion Flow — Keep Momentum**

After completing a task in `SubjectDetail`, the user is sent back to the task list (`setSelectedTask(null)`). This breaks flow.

**Fix**: After completing a task, show a brief completion card (2s) then auto-advance to the next unlocked task with a "Continue to next task" button.

**C. Undo/Retry Tasks**

Once a task is marked complete, there's no way to redo it for extra practice.

**Fix**: Add a "Practice Again" option on completed tasks that re-launches the task without affecting the completion status.

**D. Swipe Gestures on Task Cards**

Mobile users should be able to swipe right to start a task or swipe to see quick actions.

---

### 4. Additional Suggestions

**A. Study Session Timer**

Add a global study session timer (Pomodoro-style) that tracks total study time per day and per subject. Show this on the dashboard.

**B. Weekly Review Report**

Generate a weekly AI summary: topics covered, mastery changes, streak status, recommendations for next week. This exists partially in `DailySummary` but there's no weekly aggregation shown to the user.

**C. Offline Task Caching**

Pre-generate task content so students can study without internet. Cache the last generated content per task type in localStorage/IndexedDB.

**D. Sound Effects & Haptics**

Add optional subtle sound effects on correct answers, task completion, and streak milestones (can be toggled off).

---

### Implementation Priority

| Improvement | Impact | Effort | Priority |
|---|---|---|---|
| Skip/remember readiness check | High UX | Small | 1 |
| Auto-advance to next task | High UX | Small | 2 |
| Add task duration estimates | Medium UX | Small | 3 |
| Mobile chat panel (bottom sheet) | High UX | Medium | 4 |
| XP animation on task complete | Medium UX | Small | 5 |
| Dynamic AI task generation | High AI | Large | 6 |
| Readiness → task difficulty mapping | Medium AI | Medium | 7 |
| Dashboard density reduction | Medium UX | Medium | 8 |
| Persistent AI chat memory | High AI | Medium | 9 |
| Practice Again on completed tasks | Medium UX | Small | 10 |
| Study session timer (Pomodoro) | Medium UX | Medium | 11 |
| Weekly AI review report | Medium AI | Large | 12 |

---

### Recommended First Batch (Quick Wins)

Items 1-5 above can be done in one pass — they're all small UI changes with high impact:
1. Add "Skip" to readiness check + 4hr cooldown
2. Auto-advance to next task after completion
3. Show estimated duration on each task card
4. Convert chat panel to bottom sheet on mobile
5. Add XP pop-up animation on task completion

Shall I proceed with this first batch, or would you like to prioritize differently?

