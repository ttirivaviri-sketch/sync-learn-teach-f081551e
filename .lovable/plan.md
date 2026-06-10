## Goal

Restyle Learner, Tutor, and Admin apps to match the uploaded reference (saturated blue hero headers, bright white cards, larger headings, roomier spacing, pill bottom nav) while **keeping all existing functionality, tabs, routes, hooks, and the glassmorphism look inside cards**.

No tabs are added or removed. No business logic, RLS, or data hooks are touched.

## What changes

### 1. Design tokens (the source of truth)

- `src/index.css` — repoint semantic HSL tokens:
  - `--primary` → brighter reference blue (~`hsl(228 89% 60%)`),` --primary-foreground` white
  - `--primary-glow` / `--gradient-primary` → solid + subtle gradient variants used by hero headers
  - `--background` stays light; `--card` stays white with existing glass `backdrop-blur` utilities preserved
  - Add `--header-gradient` (deep→bright blue) for hero header bands
- `tailwind.config.ts` — bump the typography/spacing scale globally:
  - `fontSize`: nudge `sm/base/lg/xl/2xl/3xl` up ~1 step (e.g. base 15→16px, 2xl 24→28px, 3xl 30→34px)
  - `spacing`: keep Tailwind defaults but add `safe-bottom` already present; widen container padding tokens used by tab shells
  - `borderRadius`: increase `--radius` from current to `1rem` so cards/buttons feel rounder like the reference

### 2. Shared chrome

- **Hero headers** in `LearnerHomeTab`, `LearnerLibraryTab`, `TutorHomeTab`, tutor profile detail: swap mesh-gradient header band for solid `--header-gradient` with white text, larger greeting (`text-3xl`), search bar pinned at bottom of band — exactly like the reference.
- **Bottom nav** (`src/components/learner/LearnerBottomNav.tsx` + tutor equivalent): keep 4 tabs and current icons/labels; restyle pill container to pure white with subtle shadow and active tab in primary blue (icon + label).
- **Cards** (`src/components/ui/card.tsx` consumers): keep glass surface inside content cards (tutor cards, continue-learning, daily tasks) — only the outer page header changes to solid blue.

### 3. Per-app touch-ups

- **Learner**: Home greeting + search hero, Library header band, Tutor detail page hero (avatar + name + rate badge) sized to match reference proportions.
- **Tutor**: same header treatment on `TutorHomeTab` and `TutorProfileTab`; tabs and earnings/wallet UI untouched functionally.
- **Admin**: apply the new primary/radius tokens so sidebar + buttons inherit the brighter blue; layout structure (post-`SidebarInset` fix) unchanged.

### 4. Memory

- Update `mem://style/visual-theme` to note: solid blue hero headers, larger global type scale, glass retained inside cards.
- Update `mem://style/navigation-structure` only if pill styling tokens change (tabs/labels unchanged).

## What does NOT change

- Routes, tabs, tab order, tab icons/labels.
- Any hook, query, RLS, edge function, or business logic.
- Tutor verification flow, booking flow, payments, Study Mode logic.
- Logo asset (still the locked transparent PNG, 175px header / 325px auth).

## Risk & verification

- Token-level changes ripple through shadcn components automatically — no per-component color overrides needed (the codebase already uses semantic tokens).
- After changes I'll walk Home → Library → Tutors → Profile on learner, plus Tutor home + Admin dashboard, and check contrast/spacing at the current mobile viewport (552px) and at desktop.
- Rollback is a single revert of `index.css` + `tailwind.config.ts` + the few header components.

## Files I expect to touch

```
src/index.css                              (tokens)
tailwind.config.ts                         (type scale, radius)
src/components/learner/LearnerBottomNav.tsx
src/components/tutor/TutorBottomNav.tsx    (if present)
src/pages/learner/LearnerHomeTab.tsx       (hero band)
src/pages/learner/LearnerLibraryTab.tsx    (hero band)
src/pages/learner/LearnerProfileTab.tsx    (header sizing)
src/pages/tutor/TutorHomeTab.tsx           (hero band)
src/pages/tutor/TutorProfileTab.tsx        (header sizing)
src/components/TutorProfileDetail*.tsx     (profile hero — exact file confirmed at build time)
mem://style/visual-theme                    (memory update)
```

Also update darkmode

Ready to switch to build mode and implement.