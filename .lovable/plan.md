# Plan

## Part A — Landing page: full visual refresh

Goal: Premium, professional, no overlapping text. Keeps the white-dominant Uber-style direction (locked in memory) but tightens the visual system.

**Design system (applied across hero + below-the-fold)**
- Typography scale: `clamp()` headlines (e.g. h1 `clamp(2rem, 6vw, 4.25rem)`), tighter `leading-[1.05]`, body `text-base md:text-lg`. Fix the current hero overlap by capping headline width with `max-w-[18ch]` and adding `pr-4` so floating badges don't collide.
- Vertical rhythm: standardise section padding to `py-20 md:py-28`, container `max-w-6xl mx-auto px-6`.
- Color: keep white base, add one accent (existing primary). Replace ad-hoc colored slide backgrounds with subtle `bg-gradient-to-br from-background to-muted/40` + a single accent chip per slide.
- Components: rounded-2xl cards, soft shadow `shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]`, 1px hairline borders `border-border/60`.

**Hero carousel fixes (mobile-first, current viewport 487px)**
- Restructure slide 1 grid so headline, checks, CTA, avatars, and image sit in a single stacked flow on mobile (`flex-col gap-8`) and a 2-col grid on `md:`. Removes the overlap between floating badges and headline.
- Move floating badges (AI Study Assistant, Expert Tutors, etc.) to a separate row *below* the image on mobile; only float on `md:` and above.
- Pagination: replace "01–04" text with subtle dot indicators centered at bottom; arrows hidden on mobile.
- Reduce slide 1 bullet density from 4 to 3 items.

**Below the fold**
- Tighten `HeroSection` navbar: solid white after 10px scroll, consistent 64px height, hamburger drawer with proper z-index (`z-50`).
- Audit `AppShowcase`, `HowItWorksSection`, `FeaturesSection`, `StudyModeSection`, `TestimonialSection`, `TrustSection`, `ContactStrip`, `Footer` for the same typography scale + section padding so the page reads as one system.
- Ensure no two consecutive sections share the same background; alternate `bg-background` / `bg-muted/30`.

**Out of scope**: copy rewrites, new images, internal app screens.

---

## Part B — Admin tutor allocation (recurring monthly plans)

A parallel booking flow where admins assign a tutor to a learner on a recurring weekly schedule for a billing month. Payment happens outside the app. Tutor still has to accept each generated session via the normal booking flow.

### Data model (new tables)

```text
tutor_allocations
  id, learner_id, tutor_id, tutor_subject_id,
  weekly_schedule jsonb     -- [{ day: 'mon', time: '16:00', duration: 60 }]
  start_date, end_date,     -- e.g. 1st → 30th of month
  price_per_session numeric,
  external_payment_reference text,
  notes text,
  status text               -- 'active' | 'paused' | 'ended'
  created_by uuid (admin),  created_at, updated_at

bookings (existing)
  + add nullable column `allocation_id uuid references tutor_allocations(id)`
  + add nullable column `source text default 'self'` -- 'self' | 'admin_allocated'
```

RLS:
- `tutor_allocations`: admin full access; learner + tutor SELECT their own rows.
- Bookings created from allocations are owned by the learner/tutor as normal.

### Generation logic

A SECURITY DEFINER function `generate_allocation_bookings(allocation_id)`:
- Loops dates from `start_date` to `end_date`.
- For each matching weekday in `weekly_schedule`, inserts a `bookings` row with status `requested`, `source = 'admin_allocated'`, `allocation_id` set, price = `price_per_session`.
- Skips slots that conflict with existing bookings for either party.
- Returns count generated.

Called automatically on allocation INSERT (trigger) and exposed as RPC for "regenerate" button.

Tutor consent: bookings land as `requested` → tutor accepts/declines through existing `TutorBookingManager`. No new tutor UI needed. Existing `notify_new_booking` trigger already sends the notification.

Learner view: allocated lessons appear in My Lessons identically to self-booked ones (no badge, no payment prompt). Payment row is *not* inserted — `useBookingPayments` already treats missing-payment confirmed bookings as paid externally; verify and gate the payment CTA on `source !== 'admin_allocated'`.

### Admin UI

New sidebar item **Allocations** at `/admin/allocations` (add to `src/components/admin/AppSidebar.tsx` and `src/pages/admin/AdminLayout.tsx` routes).

Page `src/pages/admin/Allocations.tsx`:
- Table of existing allocations with learner, tutor, schedule summary, status, generated/accepted counts, actions (pause, end, regenerate).
- "New allocation" dialog:
  1. Search & pick learner (profiles where user_type = 'learner').
  2. Search & pick tutor + subject (tutor_subjects).
  3. Weekly schedule builder: checkbox per day + time picker + duration.
  4. Start date / end date (defaults: today → end of month).
  5. Price per session + external payment reference + notes.
  6. Preview: list of dates that will be generated.
  7. Create → calls insert; trigger generates bookings.

### Acceptance criteria

- Admin creates monthly plan → N booking requests appear for the tutor.
- Tutor accepts → lesson appears in learner's My Lessons as confirmed.
- Learner sees no payment prompt and no "admin allocated" badge.
- Self-booking flow unchanged.
- Pausing an allocation prevents future auto-generation but keeps existing bookings.

---

## Technical details

**Migration files**: one migration for the table + bookings columns + RLS + trigger function. No data backfill needed.

**Frontend files touched**:
- `src/components/HeroCarousel.tsx` — restructure slide layouts, remove overlapping floats on mobile, dot pagination
- `src/components/HeroSection.tsx` — navbar polish
- `src/components/{AppShowcase, HowItWorksSection, FeaturesSection, StudyModeSection, TestimonialSection, TrustSection, ContactStrip, Footer}.tsx` — typography + spacing pass
- `src/index.css` — add hero clamp utilities if needed (avoid new tokens unless required)
- `src/components/admin/AppSidebar.tsx` — add Allocations item
- `src/pages/admin/AdminLayout.tsx` — add route
- `src/pages/admin/Allocations.tsx` (new)
- `src/components/admin/AllocationDialog.tsx` (new)
- `src/hooks/useBookingPayments.ts` — guard payment CTA on `source`
- `src/integrations/supabase/types.ts` — auto-regenerated after migration

**Order of execution**:
1. Run migration (tables + RLS + trigger).
2. Build admin Allocations page + dialog.
3. Patch booking payment guard.
4. Landing page visual refresh (independent, can be done last).
