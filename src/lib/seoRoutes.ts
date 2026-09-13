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
    title: "Free Past Papers & Exam Prep — Matric, IEB, ZIMSEC | StudySync",
    description:
      "Free past exam papers with memos, AI exam prep and verified tutors for Matric/NSC, IEB, ZIMSEC, Cambridge and CAPS learners in South Africa and Zimbabwe.",
    image: "/og/home.jpg",
  },
  {
    path: "/exam-prep",
    title: "Exam Prep for Matric, IEB, ZIMSEC & Cambridge | StudySync",
    description:
      "Exam preparation help for Grade 10–12: past papers with memos, AI study tools, photo marking against real exam papers and verified tutors — South Africa and Zimbabwe.",
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
    path: "/tutoring/maths",
    title: "Maths Tutor Online — Grade 12, IEB, Cambridge, ZIMSEC",
    description:
      "Book a verified online maths tutor for Mathematics & Maths Literacy — CAPS/NSC Grade 12 matric, IEB, Cambridge IGCSE/A Level and ZIMSEC. Pay per session.",
    image: "/og/tutor-auth.jpg",
  },
  {
    path: "/past-papers",
    title: "Free Past Exam Papers & Memos — Matric, ZIMSEC, Cambridge, IEB",
    description:
      "Download free past exam papers with memos and answers: Grade 10–12 Matric/NSC, IEB, ZIMSEC O & A Level and Cambridge IGCSE — sorted by subject, grade and year.",
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
    path: "/past-papers/zimsec",
    title: "ZIMSEC Past Papers Free Download — O Level & A Level | StudySync",
    description:
      "Free ZIMSEC O Level and A Level past exam papers with answers — Mathematics, Combined Science, English, Accounts and more, sorted by subject, level and year.",
    image: "/og/home.jpg",
  },
  {
    path: "/past-papers/cambridge",
    title: "Cambridge Past Papers — IGCSE, O Level & A Level | StudySync",
    description:
      "Practise Cambridge IGCSE, O Level and AS/A Level past exam papers with mark schemes — Maths, Sciences, English and more, sorted by subject, level and year.",
    image: "/og/home.jpg",
  },
  {
    path: "/past-papers/matric",
    title: "Matric Past Papers & Memos — Grade 12 NSC | StudySync",
    description:
      "Download and practise Grade 12 matric past exam papers with memos — Mathematics, Physical Sciences, Life Sciences, English and more, sorted by subject and year.",
    image: "/og/home.jpg",
  },
  {
    path: "/past-papers/maths",
    title: "Maths Past Papers & Memos — Grade 10-12 CAPS, IEB & ZIMSEC",
    description:
      "Practise maths past exam papers with memos — Grade 10, 11 and 12 Mathematics Paper 1 and Paper 2 for CAPS/NSC, IEB, Cambridge and ZIMSEC, sorted by grade and year.",
    image: "/og/home.jpg",
  },
  {
    path: "/past-papers/physical-sciences",
    title: "Physical Sciences Past Papers & Memos — Grade 10-12",
    description:
      "Practise Physical Sciences past exam papers with memos — Grade 10, 11 and 12 NSC Paper 1 (Physics) and Paper 2 (Chemistry), sorted by grade and year.",
    image: "/og/physical-sciences-past-papers.jpg",
  },
  {
    path: "/past-papers/life-sciences",
    title: "Life Sciences Past Papers & Memos — Grade 10-12",
    description:
      "Practise Life Sciences past exam papers with memos — Grade 10, 11 and 12 NSC Paper 1 and Paper 2, from genetics to human physiology, sorted by grade and year.",
    image: "/og/life-sciences-past-papers.jpg",
  },
  {
    path: "/past-papers/accounting",
    title: "Accounting Past Papers & Memos — Grade 10-12 Matric",
    description:
      "Grade 10, 11 and 12 Accounting past papers with memos for CAPS/NSC matric and IEB — financial statements, cash flow, ratios, cost accounting and budgeting.",
    image: "/og/home.jpg",
  },
  {
    path: "/past-papers/business-studies",
    title: "Business Studies Past Papers & Memos — Grade 10-12",
    description:
      "Grade 10, 11 and 12 Business Studies past papers with memos for CAPS/NSC matric and IEB — business environments, operations, marketing and management essays.",
    image: "/og/home.jpg",
  },
  {
    path: "/past-papers/grade-10",
    title: "Grade 10 Past Papers & Memos — All Subjects | StudySync",
    description:
      "Free Grade 10 past exam papers with memos — Mathematics, Physical Sciences, Life Sciences, Accounting and English for CAPS/NSC and IEB, sorted by year.",
    image: "/og/home.jpg",
  },
  {
    path: "/past-papers/grade-11",
    title: "Grade 11 Past Papers & Memos — All Subjects | StudySync",
    description:
      "Grade 11 past exam papers with memos for every major subject — Maths, Physical Sciences, Life Sciences, Accounting and English — CAPS/NSC and IEB, free to practise.",
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
    path: "/community",
    title: "WhatsApp Study Community for Exam Students — StudySync",
    description:
      "Join the free StudySync WhatsApp study community: share notes and study plans with students writing finals, get exam tips, and talk directly to the StudySync team.",
    image: "/og/home.jpg",
  },
  {
    path: "/blog",
    title: "StudySync Blog — Better Learning with AI & Evidence",
    description:
      "Evidence-informed ideas on AI in education, assessment, teaching and study practice from StudySync in South Africa.",
    image: "/__l5e/assets-v1/5a92ef49-aca8-435f-804b-26fdffb23e9d/ai-education-learning-partner.jpg",
  },
  {
    path: "/blog/ai-in-education-learning-partner",
    title: "AI in Education: From Cheating Tool to Learning Partner",
    description:
      "How schools can redesign assessment, build AI literacy and keep teachers central as students learn to use AI well.",
    image: "/__l5e/assets-v1/5a92ef49-aca8-435f-804b-26fdffb23e9d/ai-education-learning-partner.jpg",
    type: "article",
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
