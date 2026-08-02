## What's broken

The published app (`sync-learn-teach.lovable.app` and `studysync.co.za`) renders an empty page. The HTML and title load fine, but JavaScript dies immediately with:

```text
Uncaught TypeError: Cannot read properties of undefined (reading 'createContext')
```

Nothing renders after that, which is exactly the "blank state on all pages" you're seeing. The dev preview works because Vite does not bundle chunks in dev — the bug only exists in the production build.

### Cause

`vite.config.ts` has a hand-written `manualChunks` function that splits `node_modules` into ~12 separate chunks (`react`, `router`, `radix`, `query`, `motion`, `vendor`, …). React ends up in its own chunk while libraries that touch React at module-evaluation time (react-is, use-sync-external-store, Radix internals) land in `vendor`. That produces a circular chunk import, so `vendor` runs before `react` has been initialised and `React` is `undefined` when something calls `React.createContext()`.

The rule `if (id.includes('framer-motion') || id.includes('motion'))` also over-matches — any dependency path containing the substring "motion" gets pulled into that chunk, which makes the ordering worse.

## The fix

1. `**vite.config.ts` — replace the fragile manual chunking.** Remove the custom `manualChunks` function. Vite/Rollup's default chunking already handles React ordering correctly, and the app already code-splits properly through the `React.lazy` route imports in `App.tsx`, so the first-paint savings the manual rule was chasing are largely preserved. Keep `minify`, `target`, `cssCodeSplit`, and `chunkSizeWarningLimit` as-is.
  If we later want vendor splitting back, it must be done as an object map that keeps React, react-dom, scheduler, react-is, and every React-dependent UI library in one shared chunk — not as separate per-library chunks.
2. **Verify the built bundle actually boots.** Run a production build and serve `dist/` locally, then load `/`, `/learner`, and `/school` in a headless browser asserting `#root` is non-empty and there are zero page errors. This is the check that was missing — the previous chunking change was never validated against a real production build.

## Second issue found while auditing the recent PRs

`src/App.tsx` declares `/school` twice:

- line 130 → `SchoolAdminPage` (the Learning-OS console)
- line 158 → `SchoolLayout` + `SchoolDashboard`, behind the `FEATURE_SCHOOLS` flag

The first declaration wins, so the school portal's index page is unreachable; only `/school/:schoolId/*` works. I'll move the Learning-OS console to `/school-ops` and leave `/school` to `SchoolLayout`, so both surfaces are reachable.

Related: `/teacher` (`TeacherCommandCenterPage`) currently redirects signed-out users to `/tutor/auth`. For a school teacher that's the wrong door. I'll flag this rather than change it unilaterally — tell me whether school teachers should authenticate through the tutor login or the learner/school login and I'll wire it accordingly.

## What I verified as already fine

- PRs #94–#100 (Cambridge IGCSE / O-Level / A-Level curriculum seeds) are merged **and** applied to the database: `curriculum_topic_templates` now carries CAMB IGCSE (15), O-Level (10) and A-Level (11) rows alongside the existing ZIMSEC / NSC / IEB sets.
- The two newest commits only regenerated `bun.lock` and `src/integrations/supabase/types.ts` — no app-code changes, so they're not implicated in the blank page.
- All public routes (`/`, `/learner`, `/tutor`, `/guardian`, `/admin`) render correctly against the dev server with no console errors.

## Note on testing signed-in screens

This project uses an external Supabase that Lovable can't mint a session for, so I can't run authenticated end-to-end checks. I'll verify the fix on public routes plus a production-build smoke test; you'll need to confirm the signed-in learner and school-student screens once it's deployed.