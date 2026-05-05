## What's already shipped vs. what's still needed

### ✅ Already done (verified by reading the code)
1. **Books / past papers open via `pdf_url` fallback** — `src/components/StudySyncLibrary.tsx` `openResource` (lines 112–128) already handles `book | guide | pastpaper | pdf` with a `videoUrl → pdf_url → url` fallback chain and toasts "File not available" otherwise. DB confirms 8 system PDFs all have `pdf_url` populated, so taps on Books / Past Papers tabs will open the file in a new tab. ✅
2. **Study Clips still works** — `openResource` keeps the original `video` branch intact: it finds the resource's index in `recommendedTutorials` and opens `StudyClipsFeed` (the reels overlay) at that index. The Tutorials tab shortcut and the "Top Tutorial Videos" rack both feed the same flow. DB has 2 published video tutorials, so the reels feed will mount with content. ✅
3. **`logGenerationHistory` try/catch** — there are no `logGenerationHistory` references anywhere in `src/` or `supabase/`. Nothing to wrap. (If you meant a different logger, point me at it and I'll harden it.)

### ❌ Still to do
1. **Remove StatsSection** — you've now confirmed the numbers are made-up and the section must go.
2. **Add "7-day free trial" CTA on the landing hero**, with a **"Become a tutor"** CTA directly below it.

---

## Plan

### 1. Remove `StatsSection` from the landing page
**File:** `src/pages/Index.tsx`
- Drop the `StatsSection` lazy import.
- Remove `<StatsSection />` from the JSX.
- Leave `src/components/StatsSection.tsx` on disk (unused) so it can be revived later if you ever want real numbers — no other file imports it.

### 2. Add the two new CTAs to the hero
**File:** `src/components/HeroSection.tsx` (the CTA block currently has "Start Learning" + "Find a Tutor" side-by-side)

Replace that CTA block with a stacked layout:

```text
[ Start 7-day free trial ]   ← primary, yellow, full-width on mobile
[ Become a tutor          ]   ← secondary outline, directly below
[ Start Learning ] [ Find a Tutor ]   ← keep existing pair as a thinner row
```

- **"Start 7-day free trial"** → `navigate("/learner/auth")` (signup flow already grants the 7-day trial via the Postgres trigger noted in memory — no backend change needed).
- **"Become a tutor"** → `navigate("/tutor/auth")`.
- Add a tiny line under the trial button: `"No card required · cancel anytime"` to reduce friction.
- Mirror the same two CTAs in the mobile menu in `Navbar` (it currently shows "Get Started" + "Become a Tutor"; I'll relabel "Get Started" → "Start free trial" for consistency).

### 3. Sanity verification (no automation needed)
- Open `/` → confirm: hero shows trial CTA + tutor CTA stacked; StatsSection gone; ContactStrip + WhatsApp FAB still present.
- Open Learner → Library → Books tab → tap a poster → PDF opens in a new tab.
- Library → Past Papers tab → tap → PDF opens.
- Browse tab → "Top Tutorial Videos" rack → tap → reels feed opens at the correct slide.
- Tutorials tab → reels feed auto-opens.

---

## Risks / notes
- `StatsSection.tsx` left on disk = small dead weight (~5 KB), but it's not imported anywhere after this change so it won't ship in the bundle. I can delete the file too if you'd rather — say the word.
- The 7-day trial is already enforced by the existing `useSubscription` hook + DB trigger (per memory). The new button is purely a relabeled CTA into the same signup; no payment / Paddle / PayFast wiring needed.
- No DB, RLS, or edge-function changes.

Approve and I'll apply these three edits.