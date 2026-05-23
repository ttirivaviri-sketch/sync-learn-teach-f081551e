
## Goal

Replace the current landing hero with a **full-screen, horizontally swipeable hero carousel** (4 slides, one per main feature) that closely matches the uploaded reference (~4/5 faithfulness). Users swipe left/right between slides and scroll down for the rest of the page. The "Contact our admin" CTA opens WhatsApp.

## Hero — full-screen carousel

Create `src/components/HeroCarousel.tsx` using `embla-carousel-react` (already common in shadcn stack; install if missing).

- Container: `h-[100svh] w-full` so it fills the viewport. Below it, the page continues normally (scroll down for rest).
- Navbar stays overlaid at the top (transparent over hero, white on scroll).
- 4 horizontal slides, snap-scroll, touch swipe + arrow buttons + numbered pagination (`01 02 03 04`) bottom-left, prev/next circular arrows bottom-right — matching reference.
- Each slide: 2-column on desktop (text left, image/illustration right), stacked on mobile.

### Slides

1. **AI Study Mode** — "Learn smarter. Pass faster." + 4-item checklist + yellow WhatsApp CTA "Contact our admin now and let's build your child's study plan" + 2K+ avatars trust strip. Image: `students-group.png` with floating feature badges (AI Study Assistant, Expert Tutors, Smart Library, Study Planner) like the reference.
2. **Tutor Marketplace** — "Verified tutors, on your schedule." + bullets + "Find a tutor" CTA. Image: `girl-phone.png`.
3. **Smart Learning Library** — "Videos, notes, past papers." + bullets + "Explore library" CTA. Image: existing library/showcase image from `/public/images` (reuse what's there; fallback to `students-group.png` cropped).
4. **Study Planner & Practice** — "Plan, practice, progress." + bullets + "Start free trial" CTA. Image: reuse `girl-phone.png` or existing planner screenshot.

Floating badge chips (Brain/GraduationCap/BookOpen/Calendar icons) animate in on slide 1 only, matching reference layout.

## WhatsApp CTA

Single helper `openWhatsAppAdmin()` in `src/lib/whatsapp.ts`:
```ts
export const WHATSAPP_ADMIN_URL =
  "https://wa.me/27686523995?text=" +
  encodeURIComponent("Hi StudySync, I'd like to build my child's study plan");
```
Yellow pill button in hero slide 1 opens this URL in a new tab. Track `cta_click` via existing `landingAnalytics`.

## Rest of the page (below hero)

Keep existing sections but reorder/light-touch to match reference flow:
1. `FeaturesSection` ("Everything They Need, All in One Place" — 2×4 grid) — already exists, keep.
2. `AppShowcase` — keep, ensure it uses `girl-phone.png` (already does).
3. `StudyModeSection` / `HowItWorksSection` — keep.
4. `TestimonialSection`, `TrustSection`, `ContactStrip`, `Footer` — keep.

No structural changes to these components beyond what's needed to avoid duplicate hero copy.

## Files

**New**
- `src/components/HeroCarousel.tsx` — full-screen carousel + 4 slide subcomponents
- `src/lib/whatsapp.ts` — WhatsApp URL helper

**Edited**
- `src/components/HeroSection.tsx` — replace hero body with `<HeroCarousel />`; keep `Navbar` export (or move Navbar into its own file and import in both places)
- `src/pages/Index.tsx` — no change (still renders `HeroSection`), or swap to render Navbar + HeroCarousel directly
- `index.html` — no change

**Unchanged**
- All other landing sections, routes, auth flows, app shell

## Technical notes

- Use `embla-carousel-react` with `loop: false`, `align: "start"`, `dragFree: false`. Add `embla-carousel-autoplay` only if user later wants auto-advance (not in this plan).
- `h-[100svh]` for accurate mobile viewport (avoids URL bar jump).
- Navbar: change from `fixed` white bg to `fixed` transparent over hero, switches to white after scrolling past hero (existing `scrolled` state already handles this — just adjust initial bg to transparent when at top AND on landing route).
- All colors via existing semantic tokens; yellow CTA keeps current `hsl(45,100%,51%)`.
- Lazy-load slide 2-4 images with `loading="lazy"`.
- Accessibility: arrow keys navigate slides, `aria-roledescription="carousel"`, slide count announced.

## Out of scope

- No new image generation — only reuses existing `/public/images/*` and `/lovable-uploads/*`.
- No backend / DB / auth changes.
- No changes to internal app routes (`/learner/*`, `/tutor/*`).
