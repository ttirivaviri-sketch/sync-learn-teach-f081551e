## Goal
Make the learner app feel like one ecosystem: tactile micro-interactions everywhere, and contextual "next best action" surfaces powered by `useLearningTimeline` + `useLearningGaps`.

## Scope (4 tabs)

### 1. Home tab (`LearnerHomeTab.tsx`)
- Tutor cards: add `hover-scale`, `animate-fade-in` on list mount, `active:scale-95` on action buttons, haptic tap (`triggerHaptic('light')`) on Book/Chat/Join.
- New **Smart Suggestion Strip** above search: pulls top weak-topic from `useLearningGaps` → "Struggling with {topic}? Find a {subject} tutor" → tapping pre-fills subject filter + search. Dismissable, animated `slide-in-right`.
- My Lessons button: pulse the badge when there's a joinable lesson within 15min.

### 2. Activity tab (`LearnerActivityTab.tsx`)
- Replace static activity list with `useLearningTimeline` driven feed: source-icon, relative time, score chip, mastery delta arrow.
- Add **Streak ribbon** + **Today's wins** counter (events today) at top with `animate-scale-in`.
- Each event row tappable → deep-link to its source surface (topic session / homework / lesson reinforcement). Haptic on tap.

### 3. Library tab (`LearnerLibraryTab.tsx`)
- **"Recommended because you struggled with X"** rail at top — derives from latest low-score `learning_events` (last 7 days, <60%), filters StudyClips by those topics.
- Profile chip: animated `hover-scale`; show subject pills with stagger fade-in.
- Empty state when no profile: clearer CTA, gradient border pulse.

### 4. Study Mode dashboard (`Dashboard.tsx` via `StudyMode.tsx`)
- **"Continue where you left off"** banner above subjects: uses last `topic_session` from timeline; tap resumes.
- Floating chat button: subtle bounce when AI has a fresh suggestion (gap detected today).
- Subject cards: tactile `active:scale-95` + haptic on tap.

## Shared building blocks
- New `src/components/learner/SmartSuggestionStrip.tsx` — reusable, consumes timeline+gaps, dismissable (localStorage per-day key).
- New `src/components/learner/LearningEventRow.tsx` — single row used in Activity tab and (compact form) in TutorBriefing for consistency.
- Extend `src/lib/haptics.ts` usage: wrap primary CTAs with `triggerHaptic('light')` helper.

## Out of scope
- No schema changes, no new edge functions, no backend logic. Pure FE polish + read-side wiring of existing hooks.

## Technical notes
- All animations via existing Tailwind utilities (`animate-fade-in`, `animate-scale-in`, `hover-scale`, `active:scale-95`).
- Use semantic tokens only (no hardcoded colors).
- Best-effort haptics (already gated by `useHapticsSync`).
- Suggestion strip dismissals stored in `localStorage` with date-keyed entry so it re-appears next day.

## Files touched
- create `src/components/learner/SmartSuggestionStrip.tsx`
- create `src/components/learner/LearningEventRow.tsx`
- edit `src/pages/learner/LearnerHomeTab.tsx`
- edit `src/pages/learner/LearnerActivityTab.tsx`
- edit `src/pages/learner/LearnerLibraryTab.tsx`
- edit `src/studymode/components/Dashboard.tsx` (Continue-where-you-left-off banner only)