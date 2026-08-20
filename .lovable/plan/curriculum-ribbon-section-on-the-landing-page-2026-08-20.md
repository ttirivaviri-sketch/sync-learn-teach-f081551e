# Curriculum ribbon section on the landing page

## On copying the NerdX layout

Short answer: borrow the *mechanics*, not the design. What makes that page convert is structural — a single obvious primary action, social proof (curriculum/exam-board logos) right under the hero, and a repeated sign-up prompt down the page. StudySync already has the hero carousel, pricing, testimonials and sticky CTA, so a wholesale redesign would mostly cost us our own identity (white-dominant Uber-style landing, logo rules) for little gain. The one clearly missing piece is exactly what you uploaded: a trust ribbon of exam-board logos near the top.

So this plan does only the ribbon. No other landing sections are touched.

## What gets added

A new "Built for your curriculum" section containing the uploaded logo ribbon video, placed **directly under the hero carousel and above the App Showcase** — the first thing a visitor sees after the hero, which is where trust marks do the most work for sign-ups.

Behaviour and look:
- Full-bleed strip: the ribbon runs edge to edge, logos visually enter and exit off both screen edges (no container padding, no rounded card).
- Zoomed in: the source video is a 16:9 white frame with the ribbon occupying only the middle ~18% band. The section crops to that band and scales the video up so the ribbon fills the strip cleanly instead of sitting in a sea of white.
- Soft white fade masks on the left and right edges so logos dissolve rather than getting hard-cut.
- Autoplays muted, loops, inline, no controls; it is decorative so it is hidden from screen readers.
- A short heading + line of crawlable text above the ribbon naming the boards (ZIMSEC, Cambridge IGCSE / O & A Level, IEB, CAPS/NSC) so the section also carries SEO value — the video itself is not indexable.
- Reduced-motion users get a static first frame instead of the looping video.

## Technical notes

- Upload `logo_ribbon_white_16x9_8s.webm` through the assets CLI and reference it via a pointer JSON in `src/assets` (the binary is not committed to the repo).
- New component `src/components/CurriculumRibbon.tsx`; lazy-loaded and inserted as the first entry in the existing `Suspense` block in `src/pages/Index.tsx`, before `AppShowcase`.
- Cropping done with a fixed-height section, `overflow-hidden`, and a `scale`d, vertically centred video — no CSS keyframes needed since the motion is baked into the video (the marquee CSS in your snippet becomes unnecessary).
- Edge fades via a CSS mask gradient; colours use existing tokens, no hardcoded hex.
- No changes to the hero, nav, pricing, or any other landing section.
