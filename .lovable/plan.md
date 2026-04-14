

## Plan: Redesign Landing Page to Match Reference Images

### What You Want

Rebuild the landing page to match two reference designs:
- **IMG_1084.png** (hero): "Learn smarter. Pass faster." -- split-screen layout with student group photo on the right, feature bullet points, two CTA buttons (yellow "Start Learning" + blue "Find a Tutor"), and 4 feature cards at the bottom
- **IMG_1096.png** (mid-page): "Built for real students" section with photo + checklist, and "How StudySync Works" 5-step flow with icons

Use the other uploaded images as real content:
- **IMG_1136.png** (group of students) -- hero right side
- **IMG_1091.png** (boy on video call with tutor) -- "Built for real students" or "How it Works" section
- **IMG_1093.png** (girl using app on phone) -- app showcase / feature illustration
- **IMG_1433.jpeg** (tutor matching screenshot) -- showcase tutor booking feature
- **IMG_1432.jpeg** (StudyMode screenshot) -- showcase StudyMode feature

### Implementation Steps

**1. Copy uploaded images into project assets**

Copy all 7 images to `public/images/` for use on the landing page.

**2. Redesign HeroSection.tsx**

Replace the current dark gradient + phone mockup hero with:
- **Light/white background** with subtle gradient
- **Split-screen layout**: left = headline + copy + CTAs, right = student group photo (IMG_1136.png)
- Headline: "Learn **smarter.** Pass **faster.**" with yellow accent on "faster"
- Subtitle paragraph about AI-powered learning + verified tutors
- 4 green-check bullet points in a 2x2 grid (AI study assistant, Expert tutors, Past paper exam practice, Personalized study schedules)
- Two CTA buttons: yellow "Start Learning" + blue "Find a Tutor"
- "Trusted by students preparing for exams across Africa" tagline
- 4 feature cards row at bottom (AI Study Mode, Tutor Marketplace, Smart Learning Library, Personalized Algorithm)
- Keep the Navbar but restyle: white background, dark text, add "Pricing" link, yellow "Get Started" pill button

**3. Redesign "Built for Real Students" section**

New component or rework `AppShowcase.tsx`:
- Left: photo of student using phone (IMG_1093.png) in a rounded card
- Right: "Built for **real** students" headline + paragraph + 4 green-check bullet points (safe online learning, diverse students, expert tutors, structured study)
- Clean white background, minimal styling

**4. Redesign "How StudySync Works" section**

Rework `HowItWorksSection.tsx`:
- Left: photo of student on video call (IMG_1091.png)
- Right: 5-step horizontal flow with numbered icons (Create profile, Upload syllabus, Book a tutor, Get daily tasks, Book tutors when needed)
- Step 3 highlighted with a card-like border treatment
- Clean, light design matching the reference

**5. Add App Screenshots Showcase**

New section or rework `StudyModeSection.tsx`:
- Show the two real app screenshots (IMG_1433.jpeg for tutor matching, IMG_1432.jpeg for StudyMode) in phone mockup frames
- Brief descriptions for each

**6. Keep existing sections (restyle as needed)**

- TestimonialSection, StatsSection, TrustSection, Footer -- keep but ensure they match the lighter, cleaner design language (white/light backgrounds, subtle shadows, rounded cards)

### Files to Change

| File | Change |
|---|---|
| `src/components/HeroSection.tsx` | Full rewrite -- light split-screen hero with photo, new navbar styling |
| `src/components/AppShowcase.tsx` | Rewrite as "Built for real students" + app screenshots |
| `src/components/HowItWorksSection.tsx` | Rewrite as 5-step flow with photo |
| `src/components/FeaturesSection.tsx` | May merge into hero bottom cards or simplify |
| `src/components/StudyModeSection.tsx` | Rework to showcase real app screenshots |
| `src/pages/Index.tsx` | Adjust section order to match reference flow |

### Design Language Shift

- Current: dark glassmorphism gradient hero
- New: **light, clean, white-dominant** with subtle blue/indigo accents, yellow highlights, rounded cards with soft shadows
- Typography: large bold headlines with colored accent words
- The rest of the app (learner/tutor dashboards) keeps its current glassmorphism style -- only the landing page changes

