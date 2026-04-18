

## What you're seeing

Your account `ashmlambo89@gmail.com` has **two Mathematics rows in `subjects`**:

| Created | Name | Syllabus code |
|---|---|---|
| 2026-03-09 | `Mathematics` | (none) |
| 2026-04-18 | `Mathematics (IGCSE)` | `0580` |

The IGCSE Maths 0580 syllabus (Cambridge calls it "Core/Extended Mathematics") was imported recently and inserted a **new** row instead of merging into the existing `Mathematics`. There is no separate "Core Maths" subject in code — the second one just looks like one because of the `(IGCSE)` suffix and 0580 syllabus.

Root cause: the syllabus import path matches subjects by `(name, user_id)` exact match. Adding `(IGCSE)` to the name made it not match the existing `Mathematics`, so a duplicate was created. Same risk exists for any future import (e.g. "Physics (IGCSE)" vs "Physics").

## Plan

### A. Fix the duplicate (data + prevention)

1. **One-time cleanup**: merge the older empty `Mathematics` row into `Mathematics (IGCSE)` for this user, then delete the older one. Repoint any `topic_mastery`, `quiz_attempts`, `paper_blueprints`, `exam_patterns`, `daily_tasks`, `subject_exams` referencing the old subject_id → new one. Rename the surviving row back to `Mathematics` (cleaner UI; syllabus code 0580 is enough metadata).
2. **Prevent recurrence**:
   - Add a unique index `subjects(user_id, lower(canonical_name))` where `canonical_name` strips parenthetical suffixes like `(IGCSE)`, `(Core)`, `(Extended)`.
   - Update the syllabus-import edge function and `useSubjects`/syllabus manager to look up existing subject by **canonical name** (case-insensitive, suffix-stripped) before inserting; if found, update `syllabus_code`/`topics` instead of inserting.

### B. Improve app speed

Issues spotted from console + code:
- `useUserProgress` errors with "JSON object requested, multiple (or no) rows returned" → using `.single()` where it should be `.maybeSingle()`; the failed request retries (3×) per render → wasted RTT.
- `ai-greeting` edge function fails on every Dashboard mount (`Load failed`) → Dashboard re-renders eat a network round-trip + a retry storm.
- `useLibraryResources` runs on every Library tab visit (logs show 3 fires in ~5s) — no `staleTime` override, default cache misses.
- All routes are lazy-loaded ✅ but `LearnerApp` itself is a giant tree that mounts every hook on first paint (presence, notifications, subscription, tutors, library, study activity) — first-tab-after-login is heavy.

Fixes:
1. **Stop retry storms**: in `App.tsx`, set `retry: 1` and add `refetchOnWindowFocus: false`. In `useUserProgress` use `.maybeSingle()` and treat null as default state.
2. **Gate `ai-greeting`** behind a feature flag / cache the greeting for 12h in `localStorage` so Dashboard doesn't call it every visit. Wrap in `enabled: false` until user opens the AI panel.
3. **Tab-level lazy mounting in `LearnerApp`**: only mount the active tab's component (Home/Activity/Library/Profile). Today all four trees mount; only the active one should run its hooks. Use `React.lazy` per tab + `Suspense`.
4. **Increase `staleTime` for slow-changing queries**: tutors list (5 min), library resources (5 min), academic profile (15 min), subjects (5 min). Remove redundant `useEffect`-driven refetches.
5. **Defer presence + notifications subscriptions** by ~1.5s after first paint (idle callback) so the initial route paints faster.
6. **Image perf**: add `loading="lazy"` and explicit `width/height` on `PosterCard`, `ResourceCard`, `StudyClipsFeed` slide thumbnails to stop layout thrash.
7. **Bundle**: split heavy charting (`recharts`) and KaTeX out of the main bundle by dynamic-importing them only inside the components that use them (tutor analytics, StudyMode question rendering).

## Files

- New migration: cleanup duplicate Maths row + repoint FKs + add canonical-name unique index.
- `supabase/functions/parse-document/index.ts` (or wherever syllabus import inserts subjects): canonical-name upsert.
- `src/studymode/hooks/useSubjects.ts` and `src/components/LearnerSyllabusManager.tsx`: same upsert path on the client.
- `src/App.tsx`: tighter QueryClient defaults (`retry: 1`, `refetchOnWindowFocus: false`).
- `src/studymode/hooks/useUserProgress.ts`: `.maybeSingle()` + null handling.
- `src/studymode/hooks/useAIGreeting.ts`: 12h localStorage cache, only call when greeting panel opens.
- `src/pages/LearnerApp.tsx`: lazy-load each tab.
- `src/hooks/useLibraryResources.ts`, `useTutorData.ts`, `useAcademicProfile.ts`: per-query `staleTime`.
- `src/hooks/usePresenceTracking.ts`, `useNotifications.ts`: defer subscription with `requestIdleCallback`.
- `src/components/library/PosterCard.tsx`, `ResourceCard.tsx`, `StudyClipsFeed.tsx`: `loading="lazy"` + dimensions.

## Result

- Library shows a single `Mathematics` (Cambridge 0580) — no more "Core Maths" lookalike. Future syllabus imports merge into existing subjects automatically.
- Initial app load and tab switches feel faster: fewer redundant refetches, no retry storms, lighter first paint, lazier images and chart bundles.

