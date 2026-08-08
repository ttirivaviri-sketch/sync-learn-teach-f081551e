# Add two new landing-page carousel slides

## Goal

Extend the existing hero carousel on the landing page with two new feature slides: **School Workspaces** and **Learning Operating System**, consistent with the current `FeatureSlide` pattern and visual language.

## Current state

- The carousel is rendered by `src/components/HeroCarousel.tsx`.
- It currently uses `embla-carousel-react` and a reusable `FeatureSlide` component for slides 2–4.
- Slide 1 is a custom `Slide1` shell; subsequent slides use `FeatureSlide`.
- The project already has school workspace and learning-operating-system features live (Schools, Teacher Workspace, Learning Kernel, SAIL, LOS PR 64).

## Proposed change

1. Add two new `FeatureSlide` entries after the existing Study Planner slide (or at the end).
2. Slide details:
  **School Workspaces**
  - Eyebrow: "School Workspaces"
  - Title: "Your school,"
  - Highlight: "in one place."
  - Description: "Classrooms, teachers, students, homework and AI study tools — all inside a branded, closed ecosystem for your school."
  - Bullets: "Branded by your school logo", "Teacher & student workspaces", "AI homework and class analytics"
  - CTA: "Explore school workspace contact us now" → navigate to WhatsApp 
  - Accent: "purple"
  - Image: generate a new school-workspace illustration (classroom/learning dashboard visual)
   **Learning Operating System**
  - Eyebrow: "Learning Operating System"
  - Title: "One brain,"
  - Highlight: "every subject."
  - Description: "A unified AI learning engine that tracks mastery, predicts gaps, and schedules the next best action across every learner."
  - Bullets: "Mastery tracking across subjects", "Predictive gap alerts", "Automated next-action suggestions","Bridging the gap between private tutoring and school"
  - CTA: "See how it works" → navigate to `/learner/auth`
  - Accent: "blue"
  - Image: generate a new learning OS illustration (neural network / data brain visual)
3. Generate the two new images via `imagegen--generate_image` and save them under `src/assets/` as webp-compatible exports, then import them into `HeroCarousel.tsx`.
4. Update the carousel `snapCount` initial value from `4` to `6` to avoid a transient UI mismatch before Embla reinitializes.
5. Ensure the new slides are responsive, accessible, and follow the same whitespace / typographic scale as existing slides.
6. Add `track()` calls for the new CTAs (`hero_school_workspace`, `hero_learning_os`) consistent with existing analytics.

## Out of scope

- No changes to the underlying school or learning OS feature logic.
- No backend changes or new pages.
- No modifications to other landing sections (Features, How It Works, etc.).

## Verification

- Build should pass.
- Hero section should show 6 pagination dots.
- Swiping/keyboard navigation should cycle through all 6 slides including the new two.
- CTA buttons should navigate correctly and fire analytics events.