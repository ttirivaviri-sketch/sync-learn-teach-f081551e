## What's actually broken

I read the data and code. Here's what I found:

**Library tabs are empty (Clips, Books, Past Papers):**
- DB has 8 system resources (CAPS/IEB/ZIMSEC/Cambridge textbooks + Grade 12 papers) and 2 published video tutorials (one IEB Grade 12, one ZIMSEC Form 6).
- `useLibraryResources.ts` filters everything through `personalizedResources` first. If the learner's `academic_profile` doesn't match curriculum + grade + subject exactly, `recommendedTutorials`, `pastPapers`, and the `tutorialFeed` derived in `StudySyncLibrary.tsx` all collapse to **0 items**.
- That's why the Clips tab does nothing (handler early-returns when `tutorialFeed.length === 0`), and Books/Papers tabs show empty states.

**PDFs don't open on mobile:**
- `DocumentViewerOverlay` renders the PDF in a plain `<iframe src={pdfUrl}>`. iOS Safari and most Android browsers do NOT render PDFs inline in iframes — they show a blank frame. Needs a real PDF viewer (PDF.js / Google viewer) or a clear "Open" fallback that actually triggers download/native viewer reliably.

**Pricing is wrong / wrong structure:**
- `PLAN_PRICING.premium` is `R99/mo`. You want a 3-product structure (AI Moderate / AI Premium / Tutor Sessions / Combo discount) — not a single "premium" plan.
- Trial signup currently shows only `R{premium.monthly}/mo` with no Moderate vs Premium choice and no tutor-session product.

---

## Plan

### 1. Plan & pricing model (data + UI)

Update `src/sail/types/index.ts`:
- Replace `PLAN_PRICING` with a richer structure:
  ```ts
  export const PRICING = {
    ai_moderate:  { monthly: 250,    annually: 2500,    currency: 'ZAR', usd: 15 },
    ai_premium:   { monthly: 500,    annually: 5000,    currency: 'ZAR', usd: 30 },
    ai_moderate_combo: { monthly: 179.99, currency: 'ZAR', usd: 11 },
    ai_premium_combo:  { monthly: 399.99, currency: 'ZAR', usd: 24 },
    tutor_session: { perSession: 300, currency: 'ZAR' },
    combo_minimum_sessions_per_month: 4, // 1/week
  };
  ```
- Keep legacy `PLAN_PRICING` export pointing to the new values to avoid breaking other call sites; map `basic → ai_moderate`, `premium → ai_premium`.

Rewrite `src/pages/TrialSignupFlow.tsx` as a 3-step flow matching the screenshot:
1. **Choose your plan** — three cards: "AI Study Mode (from R250/mo)", "Tutor Sessions (R300/session)", "Combo Plan — Most Popular (save up to R100/mo)".
2. **AI plan picker** (Moderate R250 vs Premium R500) — only shown for AI / Combo paths.
3. **Tutor sessions builder** (subject chips + lessons-per-week slider 1–5, total = sessions × R300) — only shown for Tutor / Combo paths.
4. **Review & Pay** — shows itemized monthly total. For Combo with ≥4 sessions/month, AI line is automatically discounted (R250→R179.99 or R500→R399.99) with a green "Discount applied" pill.
5. Final "Start 7-Day Free Trial" CTA continues to `/learner/auth?trial=1&plan=…&billing=…&sessions=…`.

Routing: keep `/start-trial` route. Hero "Start 7-day free trial" already lands here.

### 2. Library: stop returning empty tabs

In `src/hooks/useLibraryResources.ts`:
- Make personalization a **soft preference, not a hard filter**:
  - Compute `personalizedResources` as today.
  - For derived lists, fall back to full pool if personalized is empty:
    ```ts
    const visibleResources = (academicProfile && personalizedResources.length > 0)
      ? personalizedResources
      : allResources;
    ```
- Loosen `pastPapers` filter to also include resources where `kind`/`type` indicates a paper regardless of category string.
- Same fallback in `StudySyncLibrary.tsx` for `tutorialFeed`.

Result: Clips tab opens reels (DB has 2 videos), Past Papers tab shows the 4 Grade 12 papers, Books tab shows the 4 OpenStax textbooks — even before the learner sets a profile.

### 3. In-app PDF viewing that works on mobile

Replace iframe in `src/components/library/DocumentViewerOverlay.tsx`:
- Use **PDF.js via `react-pdf`** (already common in the stack) to render pages to canvas — works on iOS/Android.
- Keep the overlay shell (header with title, Close, "Open in new tab"). Add page navigation (prev/next + page X of Y) and pinch/scroll zoom.
- Fallback: if `react-pdf` fails to load the URL (CORS), show "Open in new tab" + "Download" buttons rather than a blank frame.

If `react-pdf` isn't desired, alternative is Mozilla's hosted viewer:
`https://mozilla.github.io/pdf.js/web/viewer.html?file=<encoded url>` — works in iframe on mobile. I'll use `react-pdf` for offline reliability and styling control.

Add `react-pdf` and `pdfjs-dist` deps.

### 4. Hero / landing copy stays as-is

No further changes to `HeroSection`, `Index.tsx`, `Navbar` from the previous turn — CTAs already point to `/start-trial?role=…`.

---

## Files to change

- `src/sail/types/index.ts` — new `PRICING` constants, keep `PLAN_PRICING` shim.
- `src/pages/TrialSignupFlow.tsx` — full rewrite with 3-product picker, AI tier picker, tutor-sessions builder, review/pay step, combo discount logic.
- `src/hooks/useLibraryResources.ts` — soft personalization fallback; broaden `pastPapers` filter.
- `src/components/StudySyncLibrary.tsx` — `tutorialFeed` falls back to all tutorials when personalized is empty; small empty-state copy tweak.
- `src/components/library/DocumentViewerOverlay.tsx` — replace iframe with `react-pdf` viewer + pager + robust fallbacks.
- `package.json` — add `react-pdf`, `pdfjs-dist`.

## Out of scope (call out)
- Wiring real billing for the new combo/tutor-session SKUs to PayFast — current flow ends at auth with query params; PayFast catalog updates are a separate task once you confirm SKU IDs.
- No DB migration needed; we're not changing `subscriptions` schema, just the pre-auth pricing UI.
