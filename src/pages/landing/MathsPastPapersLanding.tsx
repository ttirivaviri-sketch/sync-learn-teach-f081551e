/**
 * /past-papers/maths — SEO landing page targeting the South African
 * mathematics past-paper search cluster (~9,800 combined monthly searches
 * per Semrush): "maths past papers" (5,400/mo), "grade 12 maths past
 * papers" (4,400/mo), "mathematics paper 1", "maths grade 11 past papers
 * and memos" and curriculum variants across CAPS, IEB, Cambridge and
 * ZIMSEC.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Calculator, CheckCircle2, FileText, GraduationCap, ListChecks, Pi, Sparkles, Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRIAL_DURATION_DAYS } from "@/sail/types";
import { analytics } from "@/utils/analytics";
import LandingPageLayout, { type LandingFaq } from "@/components/landing/LandingPageLayout";

const PAPERS = [
  {
    icon: Pi,
    name: "Paper 1 — Algebra, functions & calculus",
    detail:
      "Equations and inequalities, sequences and series, functions and inverses, differential calculus, financial maths and probability — the full NSC Paper 1 with official memos showing exactly where method marks are awarded.",
  },
  {
    icon: Sigma,
    name: "Paper 2 — Geometry, trig & statistics",
    detail:
      "Euclidean geometry and riders, analytical geometry, trigonometry (graphs, identities, 2D/3D problems) and data handling — practised against the real NSC Paper 2 format with step-by-step marking memoranda.",
  },
];

const CURRICULA = [
  {
    name: "CAPS / NSC Mathematics past papers",
    detail:
      "The full set of DBE November, June and supplementary papers with memos for Grade 10, 11 and 12 — the core revision resource for South African matric maths.",
  },
  {
    name: "IEB Mathematics past papers",
    detail:
      "IEB papers with marking guidelines for learners at independent schools, including the AP Maths option — structured around the IEB's own question style and mark allocations.",
  },
  {
    name: "Cambridge IGCSE & A Level maths papers",
    detail:
      "Cambridge International past papers with mark schemes — IGCSE Mathematics and A Level Pure Mathematics, Mechanics and Statistics, sorted by paper and session.",
  },
  {
    name: "ZIMSEC O & A Level maths papers",
    detail:
      "ZIMSEC Ordinary and Advanced Level Mathematics past papers with answers, for Zimbabwean learners preparing for their national examinations.",
  },
];

const GRADES = [
  {
    name: "Grade 12 maths past papers",
    detail:
      "Every NSC final and supplementary Paper 1 and Paper 2 with memos — the single most effective revision resource before the matric maths exam. Practise by year, under timed conditions.",
  },
  {
    name: "Grade 11 maths past papers",
    detail:
      "Grade 11 papers with memos covering functions, trigonometry, Euclidean geometry and statistics — the content the matric paper assumes and builds directly on.",
  },
  {
    name: "Grade 10 maths past papers",
    detail:
      "Grade 10 exam papers and memos: algebra, equations, functions and the geometry riders that everything in Grade 11 and 12 grows out of.",
  },
  {
    name: "June exams & controlled tests",
    detail:
      "Mid-year and term papers alongside the finals, so you can practise under time pressure throughout the year instead of only before November.",
  },
];

const STEPS = [
  { icon: GraduationCap, title: "Set your curriculum and grade", text: "Choose CAPS, IEB, Cambridge or ZIMSEC when you sign up — the library then filters straight to Mathematics papers for your grade." },
  { icon: FileText, title: "Write Paper 1 or Paper 2 under exam conditions", text: "Time yourself against the real three-hour paper with only a calculator and formula sheet, exactly as in the exam hall." },
  { icon: ListChecks, title: "Mark with the official memo", text: "Maths memos show where markers award marks for the correct formula, substitution and simplification — learn to bank method marks even when the final answer slips." },
  { icon: Sparkles, title: "Turn lost marks into practice", text: "AI StudyMode converts the questions you got wrong into targeted quizzes and flashcards on those exact concepts — from calculus to circle geometry riders." },
];

const FAQS: LandingFaq[] = [
  {
    question: "Where can I get maths past papers with memos for Grade 12?",
    answer:
      "StudySync's library has Grade 12 Mathematics past exam papers with official marking memoranda where published — NSC Paper 1 and Paper 2, by year. Create a free account, set your curriculum, and filter to Mathematics for Grade 12 — every link is verified before it's added.",
  },
  {
    question: "What is the difference between Maths Paper 1 and Paper 2?",
    answer:
      "Paper 1 covers algebra, equations and inequalities, sequences and series, functions, differential calculus, financial mathematics and probability. Paper 2 covers Euclidean and analytical geometry, trigonometry and statistics. Both are three-hour, 150-mark NSC papers.",
  },
  {
    question: "Are Grade 10 and Grade 11 maths papers included?",
    answer:
      "Yes. The library covers Grade 10 to Grade 12 Mathematics, so you can build exam technique from Grade 10 instead of starting in the matric year. Grade 11 papers are especially valuable because the matric paper assumes that content.",
  },
  {
    question: "Do you have IEB, Cambridge and ZIMSEC maths past papers too?",
    answer:
      "Yes. Alongside CAPS/NSC papers, the library includes IEB Mathematics papers with marking guidelines, Cambridge IGCSE and A Level Mathematics with mark schemes, and ZIMSEC O and A Level Mathematics papers with answers.",
  },
  {
    question: "How should I use past papers to improve my maths mark?",
    answer:
      "Write a full paper under timed exam conditions, then mark it strictly with the official memo. Note every question where you lost marks and drill those topics before attempting the next paper. In maths, most marks come from method — the memo shows exactly how formulas, substitution and simplification are credited.",
  },
  {
    question: "How much do maths past papers cost on StudySync?",
    answer: `Create a free StudySync account to open the library — every account starts with a ${TRIAL_DURATION_DAYS}-day free trial, and you can filter straight to Mathematics papers for your grade and curriculum.`,
  },
  {
    question: "Can a tutor help me work through maths past papers?",
    answer:
      "Yes. You can book a verified StudySync Mathematics tutor to work through a past paper with you online, question by question, and explain the memo's reasoning — especially useful for multi-step calculus, trigonometry and geometry-rider problems.",
  },
];

const MathsPastPapersLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_past_papers_maths");
  }, []);

  return (
    <LandingPageLayout
      title="Maths Past Papers & Memos — Grade 10-12 CAPS, IEB & ZIMSEC"
      description="Practise maths past exam papers with memos — Grade 10, 11 and 12 Mathematics Paper 1 and Paper 2 for CAPS/NSC, IEB, Cambridge and ZIMSEC, sorted by grade and year."
      path="/past-papers/maths"
      faqs={FAQS}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Past Papers", path: "/past-papers" },
        { name: "Mathematics", path: "/past-papers/maths" },
      ]}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            For South African Grade 10–12 learners
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            Maths past papers &amp; memos — Grade 10, 11 &amp; 12
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Maths marks are earned with practice, not cramming.{" "}
            <strong>Mathematics Paper 1 and Paper 2 past exam papers with official memos</strong>{" "}
            for CAPS/NSC, IEB, Cambridge and ZIMSEC — verified links, filtered to your exact
            grade and curriculum.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Open maths papers free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tutoring/maths">Get a maths tutor</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {TRIAL_DURATION_DAYS}-day free trial · Official memos where published · Grade 10–12, sorted by year
          </p>
        </div>
      </section>

      {/* Paper 1 vs Paper 2 */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
            Paper 1 and Paper 2 — both covered
          </h2>
          <p className="mb-8 max-w-2xl text-gray-600">
            Matric maths is two three-hour, 150-mark papers. Practising each in its real
            format — calculator and formula sheet in hand — is what turns content knowledge
            into marks.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {PAPERS.map(({ icon: Icon, name, detail }) => (
              <div key={name} className="rounded-2xl border border-gray-200 bg-white p-6">
                <Icon className="mb-3 h-6 w-6 text-blue-600" aria-hidden />
                <h3 className="mb-1.5 text-lg font-semibold text-gray-900">{name}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{detail}</p>
              </div>
            ))}
          </div>

          <h2 className="mb-3 mt-12 text-2xl font-bold text-gray-900 sm:text-3xl">
            Papers for every curriculum
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {CURRICULA.map((c) => (
              <div key={c.name} className="rounded-2xl border border-gray-200 bg-white p-6">
                <BookOpen className="mb-3 h-6 w-6 text-blue-600" aria-hidden />
                <h3 className="mb-1.5 text-lg font-semibold text-gray-900">{c.name}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{c.detail}</p>
              </div>
            ))}
          </div>

          <h2 className="mb-3 mt-12 text-2xl font-bold text-gray-900 sm:text-3xl">
            Papers for every grade
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {GRADES.map((g) => (
              <div key={g.name} className="rounded-2xl border border-gray-200 bg-white p-6">
                <CheckCircle2 className="mb-3 h-6 w-6 text-blue-600" aria-hidden />
                <h3 className="mb-1.5 text-lg font-semibold text-gray-900">{g.name}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{g.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
          How to revise maths with past papers
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <Icon className="h-5 w-5 text-blue-600" aria-hidden />
              </div>
              <h3 className="mb-1.5 text-base font-semibold text-gray-900">{title}</h3>
              <p className="text-sm leading-relaxed text-gray-600">{text}</p>
            </div>
          ))}
        </div>

        {/* Related */}
        <div className="mt-12 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-3 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" aria-hidden />
            <h2 className="text-lg font-semibold text-gray-900">
              Also useful for maths learners
            </h2>
          </div>
          <ul className="grid gap-2 text-sm text-blue-700 sm:grid-cols-3">
            <li>
              <Link className="hover:underline" to="/past-papers/physical-sciences">
                Physical Sciences past papers &amp; memos
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/past-papers/accounting">
                Accounting past papers &amp; memos
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/past-papers/matric">
                All matric past papers &amp; memos
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/past-papers/ieb">
                IEB past papers &amp; marking guidelines
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/past-papers/zimsec">
                ZIMSEC past papers &amp; answers
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/tutoring/maths">
                Grade 12 maths tutors online
              </Link>
            </li>
          </ul>
        </div>

        <div className="mt-12 rounded-2xl bg-blue-600 p-8 text-center sm:p-10">
          <h2 className="text-2xl font-bold text-white">
            Start your next maths paper today
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Create a free account, set your curriculum, and the library shows Mathematics
            papers for your exact grade — Paper 1 and Paper 2, with memos.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/learner/auth">Open the library</Link>
          </Button>
        </div>
      </section>
    </LandingPageLayout>
  );
};

export default MathsPastPapersLanding;
