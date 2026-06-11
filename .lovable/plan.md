# StudySync Haptic System Plan

Build on the existing `src/lib/haptics.ts` utility to create an opinionated, brand-aware haptic vocabulary. Haptics fire only on meaningful achievement, progress, and social events — never on routine taps.

## 1. Extend the haptics library

**File:** `src/lib/haptics.ts`

Add a `StudySyncHaptic` layer on top of the existing `haptic()` primitive. Named events map to specific vibration patterns (web `navigator.vibrate`) and Capacitor impact/notification combos (native).

New named events:


| Event key                 | Pattern (web ms)             | Native              | Used for                                                 |
| ------------------------- | ---------------------------- | ------------------- | -------------------------------------------------------- |
| `task.checkbox`           | 6                            | selection           | Pressing a task checkbox                                 |
| `task.complete`           | [10, 40, 18]                 | success             | Daily task / quiz finished                               |
| `streak.day2`             | 12                           | light impact        | 2-day streak detected on app open                        |
| `streak.day7`             | [14, 60, 14]                 | medium impact ×2    | 7-day streak                                             |
| `streak.day30`            | [18, 50, 18, 50, 22]         | heavy ×3            | 30-day streak (premium)                                  |
| `ai.praise`               | [10, 40, 18]                 | success             | AI coach positive feedback                               |
| `quiz.wrong`              | 4                            | very light          | Wrong answer (subtle, never punishing)                   |
| `quiz.correct`            | 8                            | light               | Correct answer                                           |
| `quiz.perfect`            | [12,40,12,40,18,60,24]       | success+heavy       | 100% quiz score                                          |
| `unlock`                  | [10, 120, 22]                | light→pause→heavy   | Subject/level unlock                                     |
| `timer.pomodoro`          | [10, 80, 10, 80, 10]         | medium ×3           | Pomodoro session done                                    |
| `xp.levelup`              | [12,40,12,40,22]             | success             | Level up only (NOT per-XP)                               |
| `signature.success`       | [14, 50, 10, 50, 22, 80, 18] | custom              | **StudySync Success Pulse** — daily/weekly/exam goal hit |
| `tutor.booking`           | [12, 140, 12]                | medium→pause→medium | New booking request                                      |
| `tutor.payment`           | [16, 40, 22, 40, 26]         | success+heavy       | Payment received                                         |
| `tutor.review`            | [14, 60, 18]                 | success             | New 5-star review                                        |
| `tutor.scheduleMilestone` | [14, 50, 14, 50, 18]         | success             | 80%+ booked this week                                    |
| `tutor.message`           | 8                            | light               | Student message (distinct from booking)                  |
| `premium.milestone`       | [18, 60, 14, 60, 24, 80, 28] | heavy+success       | First booking, first payment, mastery, course complete   |


Export a single function:

```ts
studySyncHaptic("task.complete")
```

which resolves the pattern + native call internally. Preserves existing `haptic()` and `setHapticsEnabled()` API.

## 2. Add a streak-aware app-open hook

**New file:** `src/hooks/useStreakHaptic.ts`

- Runs once on learner app mount.
- Reads current streak from `useUserProgress` (already exists).
- Compares to a `localStorage` "last-streak-haptic-day" key so it fires at most once per calendar day.
- Fires `streak.day30`, `streak.day7`, or `streak.day2` based on thresholds.
- Mounted from `src/pages/LearnerApp.tsx`.

## 3. Wire learner events

Touch only event handlers, no business-logic changes.


| File                                                                      | Event → Haptic                                                                                                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/studymode/components/StructuredDailyTaskRunner.tsx`                  | checkbox toggle → `task.checkbox`; correct practice submit → `quiz.correct`; wrong/reveal → `quiz.wrong`; exam submit → `task.complete`; full task complete button → `signature.success` |
| `src/studymode/components/ActiveRecallSession.tsx` & `FlashcardPanel.tsx` | flip → none; "I knew it" → `quiz.correct`; "didn't know" → `quiz.wrong`                                                                                                                  |
| `src/studymode/components/MockExamResults.tsx`                            | on render: 100% → `quiz.perfect`, ≥pass → `task.complete`                                                                                                                                |
| `src/studymode/hooks/useUserProgress.ts`                                  | inside `addXp` mutation success: detect level change → `xp.levelup` (no haptic for plain XP)                                                                                             |
| `src/studymode/components/StreakCelebration.tsx`                          | on show → routed through `useStreakHaptic` thresholds                                                                                                                                    |
| `src/studymode/components/SubjectCard.tsx` / unlock surfaces              | on mastery-level unlock toast → `unlock`                                                                                                                                                 |
| Pomodoro/focus timer component (if present in studymode)                  | timer complete → `timer.pomodoro`                                                                                                                                                        |
| AI tutor praise responses (`ChatPanel.tsx` / `useAITutor`)                | when response flagged as praise/improvement → `ai.praise`                                                                                                                                |


## 4. Wire tutor events


| File                                                           | Event → Haptic                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/hooks/useRealtimeBookings.ts` (tutor side)                | new booking row → `tutor.booking`                                                             |
| `src/hooks/useBookingPayments.ts` or tutor payouts hook        | payment confirmed → `tutor.payment`                                                           |
| Tutor reviews subscription (in `useTutorStats` / activity tab) | new review row, rating ≥4 → `tutor.review`                                                    |
| `src/pages/tutor/TutorHomeTab.tsx`                             | weekly booked % crosses 80 → `tutor.scheduleMilestone` (guarded by localStorage per ISO week) |
| Tutor messages subscription                                    | new student message → `tutor.message`                                                         |


## 5. Premium milestone hook

**New file:** `src/hooks/usePremiumMilestones.ts`

Checks once per session for "first-time" achievements via existing tables/hooks:

- First booking accepted (learner & tutor)
- First payment received (tutor)
- First subject mastery achieved (learner)
- First completed course

Fires `premium.milestone`. Stored flags in `localStorage` keyed by user id so it never re-fires.

## 6. Settings toggle

Add a "Haptics" switch in `src/pages/learner/LearnerProfileTab.tsx` and `src/pages/tutor/TutorProfileTab.tsx` that calls `setHapticsEnabled()` (already supported by the lib). Default on.

## 7. Remove generic haptics where they're noise

Audit `src/components/layout/AppShell.tsx` and `src/components/ui/button.tsx`:

- Keep bottom-nav `selection` haptic (low-intensity, useful).
- Remove the default `haptic` prop on `<Button>` so haptics are opt-in per call site — prevents "every tap vibrates" anti-pattern.

## What does NOT change

- No DB schema, RLS, edge function, or business logic changes.
- No UI redesign — only event-handler additions.
- Existing `haptic()` API remains backward compatible.
- Logo, theme tokens, routes, tabs untouched.

## Technical notes

- All triggers are guarded by the existing `enabled` flag + `localStorage` "haptics-enabled".
- Day/week/first-time guards use `localStorage` to avoid replay on remount.
- Patterns chosen so total duration ≤ 350ms (Android vibration etiquette).
- iOS Safari: no-op (documented); native iOS via Capacitor uses `impact`/`notification` types since custom patterns aren't supported on iOS.
- The "StudySync Success Pulse" (`signature.success`) is a single reusable constant — reused identically across daily goal, weekly goal, and exam-readiness events for brand recognition.