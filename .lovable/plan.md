

## Plan: Add dark mode toggle

The app already has dark mode CSS variables defined in `index.css` (Tailwind `darkMode: 'class'` is standard). The `Header` in Study Mode imports `useTheme` from `next-themes` — but `next-themes` is **not installed** and there's no `ThemeProvider` wrapping the app, so that toggle is currently dead.

### Steps

1. **Install `next-themes`** and add a `ThemeProvider` wrapper in `src/App.tsx` (attribute=`class`, defaultTheme=`system`, enableSystem, disableTransitionOnChange) so `<html>` gets a `dark` class.

2. **Verify Study Mode header toggle works** — `src/studymode/components/Header.tsx` already has a sun/moon button calling `setTheme`. Once the provider is mounted, this starts working immediately.

3. **Add a global toggle accessible outside Study Mode** so learners/tutors can switch theme from anywhere:
   - Add a small `ThemeToggle` button component (`src/components/ThemeToggle.tsx`) — sun/moon icon, calls `setTheme`.
   - Place it in the **Learner Profile tab** (`src/pages/learner/LearnerProfileTab.tsx`) and **Tutor Profile tab** (`src/pages/tutor/TutorProfileTab.tsx`) as an "Appearance" row with a Light / Dark / System segmented control.

4. **Sanity check dark tokens** — `src/index.css` already defines `.dark` HSL variables for the internal app. Landing page is intentionally white-dominant (memory rule), so the toggle is meaningful mainly inside the app shell. No CSS changes needed.

5. **Persistence** — `next-themes` writes to `localStorage` automatically; no extra work.

### Files
- `package.json` — add `next-themes`
- `src/App.tsx` — wrap with `<ThemeProvider>`
- `src/components/ThemeToggle.tsx` — new component (segmented Light / Dark / System)
- `src/pages/learner/LearnerProfileTab.tsx` — add Appearance row
- `src/pages/tutor/TutorProfileTab.tsx` — add Appearance row

### Result
Dark mode is toggleable from the Study Mode header (already wired) **and** from each Profile tab via a Light / Dark / System control. Choice persists across sessions.

