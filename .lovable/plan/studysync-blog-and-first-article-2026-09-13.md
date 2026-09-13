# StudySync blog and first article

## Goal
Create a public, search-friendly blog that education publications can discover and link to, then publish **“AI in Education: From Cheating Tool to Learning Partner”** under **Ashlie Potera’s** name.

## What will be built

### 1. Blog hub at `/blog`
- Add a polished editorial index using StudySync’s light landing-page style.
- Feature the AI-in-education article with its image, title, summary, author, publication date, reading time, and topic.
- Keep the article catalogue in a small shared data file so future posts can be added without duplicating card content.
- Include clear paths back to StudySync, past papers, tutoring, and the learner sign-up.

### 2. Article at `/blog/ai-in-education-learning-partner`
- Preserve the supplied argument and voice while copy-editing punctuation, headings, and readability.
- Publish with one clear H1, Ashlie Potera’s byline, date, reading time, descriptive section headings, a short key-takeaway introduction, and a references section.
- Add inline links to reliable primary or institutional evidence rather than leaving numerical claims unsupported.
- Correct or qualify claims where the available evidence requires it:
  - credit Stanford’s “Infinite Story” primarily to Chris Piech and list Mehran Sahami as an adviser; remove the unsupported direct quotation unless a primary source confirms it;
  - use the verified UNESCO 2026 ministerial statement and distinguish it from UNESCO’s 2024 student/teacher competency frameworks;
  - identify Microsoft’s figures as results from its 2026 survey;
  - replace ambiguous or unverified claims about the STEM task, Italy, the UniDistance Suisse effect size, Ghana, and Peru with accurately sourced wording;
  - distinguish China’s 2026 AI education action plan from its separate ethics reference framework.
- Add an editorial note that the article is evidence-informed commentary, plus a natural invitation to explore StudySync’s guided AI learning tools.

### 3. Visual presentation
- Generate one original education-focused editorial image for the article and its social-sharing card, with no embedded text or altered StudySync logo.
- Use an editorial magazine layout: generous reading width, strong typography, a visible contents list on larger screens, pull quotes, evidence callouts, and mobile-friendly spacing.
- Reuse the locked transparent StudySync logo and existing landing-page visual language.

### 4. Homepage discovery
- Add a “From the StudySync blog” section near the lower homepage content, featuring the new article with a direct link.
- Add **Blog** to the homepage navigation and footer so the section remains discoverable beyond the featured article.
- Add Blog to the shared public-page navigation where appropriate.

### 5. Search and sharing setup
- Register both routes with lazy loading.
- Add unique titles, descriptions, canonical URLs, article social metadata, and a `BlogPosting` structured-data block containing author, publisher, dates, image, and article URL.
- Add breadcrumbs and visible source links.
- Add `/blog` and the article URL to the sitemap and the static metadata prerender registry.
- Keep the hub as `website` metadata and the article as `article` metadata.

## Technical details
- Create focused blog data, layout/card, hub, article, and homepage-feature files rather than placing the full article in the router or homepage.
- Extend the existing `Seo`, routing, footer, homepage, sitemap, and SEO registry patterns already used by public pages.
- Use semantic HTML (`article`, `header`, `nav`, `section`, `time`, and `cite`) and accessible link labels.
- No database or admin publishing system is included; this first version is a fast, static editorial section suitable for this article and future code-managed posts.

## Verification
- Run the existing TypeScript and SEO route/sitemap checks.
- Open the homepage, blog hub, and article at desktop and mobile widths.
- Confirm the homepage links reach the correct routes, the article is readable without overlap, the generated image loads, only one H1 appears, metadata/structured data are present, and no module-import runtime error remains.
