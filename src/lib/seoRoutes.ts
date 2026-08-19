/**
 * Shared per-route head metadata.
 *
 * Consumed by two places:
 *  1. `src/components/Seo.tsx` — client-side head tags for JS-executing crawlers.
 *  2. `scripts/prerenderOg.ts` — a build-time Vite plugin that emits a static
 *     HTML file per route so social crawlers (which do NOT run JS) read the
 *     correct title/description/og:image straight from the served HTML.
 */

export const SITE_URL = "https://studysync.co.za";

export interface RouteSeo {
  /** Route path, e.g. "/learner/auth". */
  path: string;
  /** Under 60 chars. */
  title: string;
  /** 50–160 chars. */
  description: string;
  /** Absolute-from-root path to a 1200x630 preview image. */
  image: string;
  type?: "website" | "article";
}

export const DEFAULT_OG_IMAGE = "/og/home.jpg";

export const ROUTE_SEO: RouteSeo[] = [
  {
    path: "/",
    title: "StudySync — Tutors & AI StudyMode for students",
    description:
      "Book verified tutors and study with AI StudyMode: past papers and memos, quizzes and flashcards for ZIMSEC O & A Level, Cambridge IGCSE, matric (CAPS/NSC) and IEB.",


    image: "/og/home.jpg",
  },
  {
    path: "/tutoring",
    title: "Online Tutors South Africa & Zimbabwe — StudySync",
    description:
      "Book verified online tutors for Maths, Sciences, English — Grade 12 matric, IEB, Cambridge IGCSE, O/A Level and ZIMSEC. Pay per session, free trial.",
    image: "/og/tutor-auth.jpg",
  },
  {
    path: "/past-papers",
    title: "Past Exam Papers & Memos — ZIMSEC, Cambridge, Grade 12",
    description:
      "Download past exam papers with memos: ZIMSEC O & A Level, Cambridge IGCSE, O/A Level, and CAPS/NSC Grade 12 matric — sorted by subject, grade and year.",
    image: "/og/home.jpg",
  },
  {
    path: "/past-papers/ieb",
    title: "IEB Past Papers & Memos — Grade 12 Matric | StudySync",
    description:
      "Practise IEB Grade 12 matric past papers for Mathematics, Physical Sciences, Life Sciences and English, with marking guidelines and memos by subject, grade and year.",
    image: "/og/home.jpg",
  },
  {
    path: "/books",
    title: "Free Textbooks, Set Works & Study Guides | StudySync",
    description:
      "Free openly licensed textbooks, set-work novels and study guides for CAPS/NSC Grade 10–12, IEB, Cambridge IGCSE/A Level and ZIMSEC O & A Level.",
    image: "/og/home.jpg",
  },

  {
    path: "/learner/auth",
    title: "Sign in to StudySync — Start learning",
    description:
      "Create your free StudySync learner account to book tutors, unlock AI StudyMode and track your progress across every subject you study.",
    image: "/og/learner-auth.jpg",
  },
  {
    path: "/tutor/auth",
    title: "Become a StudySync tutor — Teach online",
    description:
      "Join StudySync as a verified tutor. Set your own rates and availability, teach online sessions and get paid weekly for the students you help.",
    image: "/og/tutor-auth.jpg",
  },
  {
    path: "/legal/terms",
    title: "Terms of Service — StudySync",
    description:
      "The terms that govern your use of StudySync, covering accounts, bookings, payments, tutor obligations and acceptable use of the platform.",
    image: "/og/legal.jpg",
  },
  {
    path: "/legal/privacy",
    title: "Privacy Policy — StudySync",
    description:
      "How StudySync collects, uses and protects your personal information, in line with POPIA in South Africa and the GDPR in the EU and UK.",
    image: "/og/legal.jpg",
  },
  {
    path: "/legal/cookies",
    title: "Cookie Policy — StudySync",
    description:
      "The cookies and local storage StudySync uses to keep you signed in, remember preferences and measure usage — and how to opt out of them.",
    image: "/og/legal.jpg",
  },
  {
    path: "/legal/copyright",
    title: "Copyright & Takedown — StudySync",
    description:
      "How rights holders can report infringing material on StudySync, what we need in a takedown notice, and how quickly we respond to requests.",
    image: "/og/legal.jpg",
  },
  {
    path: "/legal/library",
    title: "Library Content Disclaimer — StudySync",
    description:
      "StudySync does not own third-party past papers, syllabi or textbooks in the Library. Read how materials are credited and how to request removal.",
    image: "/og/legal.jpg",
  },
  {
    path: "/legal/community",
    title: "Community Guidelines — StudySync",
    description:
      "The rules that keep StudySync safe for students and tutors: respect, academic integrity, content standards and how to report a violation.",
    image: "/og/legal.jpg",
  },
  {
    path: "/legal/refunds",
    title: "Refund Policy — StudySync",
    description:
      "When you can get money back for a StudySync booking: learner cancellations, tutor cancellations, no-shows, technical failures and subscriptions.",
    image: "/og/legal.jpg",
  },
  {
    path: "/legal/data-compliance",
    title: "Data & Compliance — StudySync",
    description:
      "How StudySync handles lesson recordings, transcripts and AI notes: consent from both parties, processors, retention limits and your data rights.",
    image: "/og/legal.jpg",
  },
];

export function getRouteSeo(path: string): RouteSeo | undefined {
  return ROUTE_SEO.find((r) => r.path === path);
}
