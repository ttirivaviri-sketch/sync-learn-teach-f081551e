

## Plan: Fix 4 Study Mode Issues

### 1. Notification X Button Not Deleting

**Problem**: The `removeNotification` function in `src/hooks/useNotifications.ts` calls `supabase.from('notifications').delete()` but doesn't optimistically update local state. The real-time subscription listens for DELETE events, but Supabase real-time DELETE events only include `old` record data when the table's replica identity is set to `full`. Without that, the local state never removes the notification.

**Fix** (`src/hooks/useNotifications.ts`):
- Add optimistic local state removal in `removeNotification` — immediately filter the notification out of state before the DB call completes.

**Fix** (`src/components/NotificationCenter.tsx`):
- The X button's `onClick` calls `removeNotification` correctly, but the event also bubbles to `markAsRead`. Add `e.stopPropagation()` is already there — verified OK.

### 2. Exam Question Not Generating

**Problem**: In `ExamQuestionPanel`, the `useEffect` on line 78-82 has an empty dependency array `[]`, but `quizGenerator` is conditionally created (`subject ? useQuizGenerator(...) : null`). The effect runs once on mount but `quizGenerator` may not be ready yet (context not loaded). The `isLoading` check includes `!contextLoaded`, so it shows loading forever if `contextLoaded` never flips, or the `generateQuestion()` call fires before context is ready and fails silently.

**Fix** (`src/studymode/components/ExamQuestionPanel.tsx`):
- Fix the `useEffect` to depend on `quizGenerator?.isLoading` and `quizGenerator?.question` and `quizGenerator?.contextLoaded` so it triggers generation once context is loaded.
- The component already has the full answer/marking flow (phases: read → analyze → answer → marking → feedback). This works once a question exists.

### 3. Concept Learning Should Cover Whole Topic

**Problem**: The concept-learning prompt in `generate-task-content` always generates content about the same subtopics. There's no tracking of which subtopics have been covered, so the AI repeats the same section.

**Fix** (`supabase/functions/generate-task-content/index.ts`):
- Add an instruction to the concept-learning prompt telling the AI to focus on a RANDOM subtopic from the provided list each time, and to vary content across the full breadth of the topic.
- Accept a `previouslyStudiedSubtopics` param and instruct the AI to avoid those.

**Fix** (`src/studymode/components/TaskContentPanel.tsx`):
- Before calling `generateContent`, query `study_activity` for recent concept-learning entries on this topic to build a list of recently covered subtopics.
- Pass `previouslyStudiedSubtopics` to the edge function so the AI avoids repeating them.

### 4. Flashcards Should Highlight What Went Wrong

**Problem**: After the student submits an answer on a flashcard, the panel shows "Your Answer" and "Correct Answer" side by side, but doesn't highlight the difference or explain what was wrong.

**Fix** (`src/studymode/components/FlashcardPanel.tsx`):
- In `FlashcardView`, when `hasAttempted && !skipped && flipped`, add a comparison section between the student's answer and the correct answer.
- Use the `useAdaptiveLearningEngine`'s `markAnswer` function (already available in the parent) to get AI feedback on the flashcard answer, or do a lightweight client-side comparison.
- Add a new "What you missed" section that calls the `explain-answer` edge function with the student's answer vs the card's back, showing key differences.
- Show a colored diff-style highlight: green for correct parts, red/orange for missing or incorrect parts.

### Files Changed
1. `src/hooks/useNotifications.ts` — Optimistic delete in `removeNotification`
2. `src/studymode/components/ExamQuestionPanel.tsx` — Fix useEffect dependencies for question generation
3. `supabase/functions/generate-task-content/index.ts` — Concept-learning prompt: diversify across subtopics
4. `src/studymode/components/TaskContentPanel.tsx` — Pass recently studied subtopics to avoid repetition
5. `src/studymode/components/FlashcardPanel.tsx` — Add "What you missed" comparison after flashcard attempt

