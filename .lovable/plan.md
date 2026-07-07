# Simplify Learner UX — "one obvious thing per screen"

Goal: make the app feel simple without removing capability. Everything stays; it just gets ranked, grouped, and demoted so one primary action is obvious per screen and the rest is one tap away.

I agree with the direction you pasted. StudyMode is currently reached via a toggle inside Home — that's the single biggest discoverability bug. Promoting it to its own bottom-nav tab is the right move. I'd sequence it exactly as suggested: **Home → Library → StudyMode**, in that order, because each step de-clutters the surface the next one depends on.

---

## Phase 1 — Learner bottom nav: 4 tabs → 5 tabs

Current (`src/pages/LearnerApp.tsx` + `AppShell`): Home / Activity / Library / Profile, with StudyMode hidden behind a toggle on Home.

New:

```text
[ Home ] [ Study ] [ Library ] [ Activity ] [ Profile ]
```

- `Study` tab mounts `<StudyModeWrapper />` directly — no toggle, no wrapper card.
- The old StudyMode toggle on Home is removed; a small "Open Study" affordance stays on the NextActionCard for continuity.
- Bottom nav already scales via `gridTemplateColumns: repeat(navItems.length, 1fr)` — 5 tabs fit, but we tighten label sizing to keep it comfortable on 360px devices.
- Desktop sidebar just gets one more item — no layout change.

## Phase 2 — Home consolidation

Today, Home stacks: greeting → 4 insight cards → giant "My Lessons" → NextActionCard → tutor list.

After:

- **One** hero: `NextActionCard` (already exists, already the right primitive). It becomes the only above-the-fold element besides the greeting.
- The 4 insight cards collapse into a single horizontally-scrollable "At a glance" strip (streak, XP, next exam, weak topic) — same data, one row instead of four blocks.
- "My Lessons" demotes from giant CTA to a normal row action inside the At-a-glance strip (chip: "3 lessons this week →").
- Tutor discovery list stays exactly where it is — that's the thing people actually opened Home to do.

No hooks change. Purely a re-composition of `LearnerHomeTab.tsx`.

## Phase 3 — Library consolidation

Today: Clips / Books / Past Papers / Tutorials tabs + StruggleRecRail + "need help?" nudges repeated.

After:

- Drop the **Tutorials** sub-tab. Tapping a clip in the "Clips for you" rail already opens the fullscreen clip feed — that's what the Tutorials tab did. One less tab, zero features lost.
- Merge the 3 "need help?" nudges into **one** persistent footer CTA on the Library page.
- StruggleRecRail stays at the top (it's the "for you" shelf).
- Edit inside `StudySyncLibrary` + `LearnerLibraryTab.tsx` only.

## Phase 4 — StudyMode inner tabs de-stacked

This is the worst offender. The fix is the same pattern applied to each of the 5 inner tabs:


| Tab         | Today (stacked)                                                                  | After (one primary + "More")                                                                                       |
| ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Subjects    | Header actions + banners + subject grid + AI panel                               | Subject grid is the screen. Header actions collapse into a `⋯` menu.                                               |
| Progress    | Grade predictor + AI insights + charts (3 full-width blocks)                     | One summary card ("You're on track for a B, up from C") + `See details` expands the rest inline.                   |
| Calendar    | Exam countdown + adaptive-plan banner + calendar                                 | Calendar is the screen. Countdown becomes a chip in the header; banner becomes a dismissable toast on first visit. |
| Exams       | Mock exams + explainer + AI alerts + "still stuck" + review + history (6 blocks) | Mock exam CTA + review widget only. Explainer, alerts, history move under a `⋯ More` sheet.                        |
| Leaderboard | (fine as-is)                                                                     | No change.                                                                                                         |


Rules applied consistently:

- **One summary card** instead of a stack of banners.
- **Badges capped at 1 per item** (currently multiple pile up on subject cards).
- **Secondary actions** move to a `⋯` overflow, not the header.
- Nothing is deleted — every block that comes out of the main scroll lives in a `More` sheet on the same tab.

## Phase 5 — Follow-ups (not in this plan, flagged)

- Onboarding tour that highlights the new Study tab on first launch (one-time).
- Analytics event on tab switches to confirm StudyMode DAU rises after promotion.

---

## Technical notes

- **Files touched (Phase 1–4):**
  - `src/pages/LearnerApp.tsx` — add Study nav item + route case
  - `src/components/layout/AppShell.tsx` — no changes required (already dynamic)
  - `src/pages/learner/LearnerHomeTab.tsx` — remove StudyMode toggle, collapse insight cards
  - `src/pages/learner/LearnerLibraryTab.tsx` + `src/components/StudySyncLibrary.tsx` — remove Tutorials tab, unify help nudge
  - `src/studymode/components/StudyMode.tsx` + the 5 inner tab components under `src/studymode/components/` — de-stack per table above
- **No hook changes, no DB changes, no edge-function changes.** Purely presentational.
- **StudyModeWrapper** (`src/studymode/StudyModeWrapper.tsx`) is already suitable as a standalone route/tab mount.
- **Mobile-first check:** at 360×640, the new 5-tab nav needs `text-[10px]` labels and 20px icons to stay legible. Desktop sidebar is unaffected.
- **Feature flag:** wrap the nav change behind `featureFlags.newLearnerNav` (default on) so we can flip back instantly if something regresses.

## What I want to confirm before building

1. **5-tab order** — is `Home / Study / Library / Activity / Profile` right, or do you want Study in position 1 (leftmost)? Study after library 
2. **Insight cards on Home** — collapse into one horizontal strip (my proposal) 
3. **Phase 4 scope** — do all 5 StudyMode inner tabs in one pass

If you're happy with the direction and defaults, say "go" and I'll implement Phases 1–3 in one build pass, then Phase 4 in a second.