
## Problems to fix

1. **Repeated images on the landing page** — three carousel slides reuse images that appear again in sections below:
   - `girl-phone.png` → slide 2 **and** `AppShowcase`
   - `screenshot-studymode.jpeg` → slide 3 **and** `StudyModeSection`
   - `boy-videocall.png` → slide 4 **and** `HowItWorksSection`
   - (slide 1 `students-group.png` is unique — keep it)

2. **"7-day free trial" wording on landing** — appears in:
   - `HeroCarousel.tsx` slide 4 (bullet + CTA label)
   - `HeroSection.tsx` mobile menu CTA button
   - (SubscriptionFlow inside the app is unrelated to the landing — leave it alone)

3. **Runtime error** ("Importing a module script failed") — stale Vite chunk from the previous hero refactor; resolved by a dev-server restart after the new files settle.

## Fix

### A. Give the carousel its own dedicated imagery

Generate 3 new hero illustrations sized 1024×1024, brand-consistent (clean, light, white-dominant, blue accent — matching the landing-page design memory). Save to `src/assets/` so they're bundled and ES6-imported.

| Slide | New asset | Prompt direction |
|---|---|---|
| 2 — Tutors | `hero-tutor-marketplace.jpg` | Friendly female tutor smiling at laptop with a chat bubble of "Math" notation, soft pastel background, no text overlay |
| 3 — Library | `hero-smart-library.jpg` | Floating stack of books / tablet showing notes & a play button, soft purple gradient background, illustrative |
| 4 — Planner | `hero-study-planner.jpg` | Calendar + checklist + progress ring composition on a soft emerald background, illustrative |

These are visually distinct from the existing photographs (`girl-phone`, `boy-videocall`) and screenshots used in the sections below, so nothing repeats.

Update `HeroCarousel.tsx` slides 2-4 to import these new assets and drop the `/images/*` paths.

### B. Remove "7-day free trial" wording from landing

- `HeroCarousel.tsx` slide 4:
  - bullet `"7-day free trial, cancel anytime"` → `"Cancel anytime"`
  - CTA label `"Start 7-day free trial"` → `"Start learning today"`
- `HeroSection.tsx` mobile menu: `"Start free trial"` → `"Get Started"`

Internal `SubscriptionFlow.tsx` keeps its trial copy — it's product UI, not landing.

### C. Coherent landing flow (after fixes)

```
[Hero Carousel — 4 swipe slides, all unique imagery]
   ↓ scroll
AppShowcase          (girl-phone.png — student lifestyle shot)
HowItWorksSection    (boy-videocall.png — process visual)
FeaturesSection      (icon grid, no photos)
StudyModeSection     (studymode + tutor-matching screenshots — product proof)
TestimonialSection
TrustSection
ContactStrip
Footer
```

No image appears twice on the page. Carousel uses illustrative hero art; sections below use real photos + product screenshots — clear visual hierarchy.

## Files

**New (generated)**
- `src/assets/hero-tutor-marketplace.jpg`
- `src/assets/hero-smart-library.jpg`
- `src/assets/hero-study-planner.jpg`

**Edited**
- `src/components/HeroCarousel.tsx` — import 3 new assets, swap slide 2-4 images, retitle slide 4 CTA + bullet
- `src/components/HeroSection.tsx` — relabel mobile CTA button

**Unchanged**
- `AppShowcase`, `HowItWorksSection`, `StudyModeSection`, `FeaturesSection`, all other sections
- `SubscriptionFlow` (internal app)
- Routes, auth, backend

## Out of scope

- No layout overhaul of below-the-fold sections (already coherent).
- No copy changes outside the trial wording.
- No new dependencies.
