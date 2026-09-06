/**
 * /past-papers/accounting — SEO landing page targeting "accounting past papers",
 * "grade 12 accounting past papers and memos", "CAPS/NSC and IEB accounting exam papers".
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, FileText, GraduationCap, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRIAL_DURATION_DAYS } from "@/sail/types";
import { analytics } from "@/utils/analytics";
import LandingPageLayout, { type LandingFaq } from "@/components/landing/LandingPageLayout";

const TOPICS = [
  {
    name: "Financial statements (Grade 12)",
    detail:
      "Statement of Comprehensive Income, Statement of Financial Position and notes for companies — the highest-mark question in most NSC and IEB Accounting Paper 1 papers.",
  },
  {
    name: "Cash flow statements & analysis",
    detail:
      "Reconciliations, cash flow statements and the ratio interpretation questions examiners pair with them, with marking guidelines where published.",
  },
  {
    name: "Cost accounting & manufacturing",
    detail:
      "Production cost statements, break-even analysis and unit-cost calculations set in the standard Grade 11–12 exam format.",
  },
  {
    name: "Budgeting & projected statements",
    detail:
      "Cash budgets, projected income statements and the debtors/creditors collection schedules that carry the method marks.",
  },
  {
    name: "Inventory, VAT & fixed assets",
    detail:
      "FIFO and weighted-average valuation, VAT calculations and the fixed-asset note, including the internal-control comment questions.",
  },
  {
    name: "Partnerships, clubs & sole traders",
    detail:
      "Grade 10 and 11 groundwork — ledgers, general journal, appropriation accounts and club statements you need before matric papers make sense.",
  },
];

const STEPS = [
  { icon: GraduationCap, title: "Pick your curriculum and grade", text: "Choose CAPS/NSC or IEB and your grade — the library then shows Accounting papers for what you actually write." },
  { icon: FileText, title: "Write a full paper under time", text: "Accounting is a speed subject. Work through a complete paper in exam conditions before you look at anything." },
  { icon: ListChecks, title: "Mark with the memo", text: "Use the memo or marking guideline to award your own method marks and see where the examiner splits the marks." },
  { icon: Sparkles, title: "Drill the weak topics", text: "AI StudyMode turns the questions you lost marks on — ratios, cash flow, cost accounting — into targeted quizzes and flashcards." },
];

const FAQS: LandingFaq[] = [
  {
    question: "Where can I get Grade 12 Accounting past papers and memos?",
    answer: `Create a free StudySync account and open the library, then filter to Accounting and your grade. Every past paper link is checked before it is added, and the memo or marking guideline is linked alongside the paper where it has been published. Every account starts with a ${TRIAL_DURATION_DAYS}-day free trial.`,
  },
  {
    question: "Which grades and curriculums are covered?",
    answer:
      "Accounting papers for Grade 10, 11 and 12 across CAPS/NSC (matric) and IEB, organised by grade, year and paper so you can work backwards from the most recent exam.",
  },
  {
    question: "Are CAPS/NSC and IEB Accounting papers different?",
    answer:
      "The syllabus content is largely the same, but the IEB sets its own papers with more case-study framing, while CAPS/NSC papers follow the national exam structure. Practising both is useful — write the papers for your own board first.",
  },
  {
    question: "Do the Accounting papers include marking guidelines?",
    answer:
      "Where the official memo or marking guideline has been published for a paper, it is linked next to it. Accounting memos matter more than in most subjects because method marks are awarded for workings, not just the final figure.",
  },
  {
    question: "What are the highest-mark Accounting topics to revise?",
    answer:
      "Company financial statements, cash flow statements with ratio analysis, cost accounting and budgeting carry the most marks in Grade 12 papers, alongside the internal control and ethics comment questions.",
  },
  {
    question: "Can a tutor help me with Accounting?",
    answer:
      "Yes. You can book a verified StudySync tutor who teaches Accounting to work through a past paper with you and explain the marking guideline question by question.",
  },
];

const AccountingPastPapersLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_past_papers_accounting");
  }, []);

  return (
    <LandingPageLayout
      title="Accounting Past Papers &amp; Memos — Grade 10-12 | StudySync"
      description="Grade 10, 11 and 12 Accounting past papers with memos and marking guidelines for CAPS/NSC matric and IEB — financial statements, cash flow, ratios and cost accounting."
      path="/past-papers/accounting"
      faqs={FAQS}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Past Papers", path: "/past-papers" },
        { name: "Accounting", path: "/past-papers/accounting" },
      ]}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            CAPS/NSC matric &amp; IEB · Grade 10–12
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            Accounting past papers &amp; memos, sorted by grade and year
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Practise real <strong>Accounting exam papers with memos and marking guidelines</strong>{" "}
            for Grade 10, 11 and 12 — financial statements, cash flow and ratios, cost accounting,
            budgeting and VAT. Every link in the StudySync library is verified before it is added.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Open Accounting papers free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tutoring">Get an Accounting tutor</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {TRIAL_DURATION_DAYS}-day free trial · Memos where published · Updated regularly
          </p>
        </div>
      </section>

      {/* Topics */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
            Accounting topics you can practise
          </h2>
          <p className="mb-8 max-w-2xl text-gray-600">
            Accounting is marked on method, so past papers are the fastest way to learn the layouts
            and the workings examiners expect. These are the sections that carry the most marks.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {TOPICS.map((t) => (
              <div key={t.name} className="rounded-2xl border border-gray-200 bg-white p-6">
                <CheckCircle2 className="mb-3 h-6 w-6 text-blue-600" aria-hidden />
                <h3 className="mb-1.5 text-lg font-semibold text-gray-900">{t.name}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{t.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
          How to revise with Accounting past papers
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
            <BookOpen className="h-5 w-5 text-blue-600" aria-hidden />
            <h2 className="text-lg font-semibold text-gray-900">Also useful for Accounting learners</h2>
          </div>
          <ul className="grid gap-2 text-sm text-blue-700 sm:grid-cols-3">
            <li>
              <Link className="hover:underline" to="/past-papers">
                All past papers (ZIMSEC O &amp; A Level, Cambridge IGCSE, matric)
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/past-papers/ieb">
                IEB past papers &amp; marking guidelines
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/books">
                Free textbooks &amp; study guides
              </Link>
            </li>
          </ul>
        </div>

        <div className="mt-12 rounded-2xl bg-blue-600 p-8 text-center sm:p-10">
          <h2 className="text-2xl font-bold text-white">Start your next Accounting paper today</h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Create a free account, set your curriculum and grade, and the library shows the
            Accounting papers and memos for exactly what you write.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/learner/auth">Open the library</Link>
          </Button>
        </div>
      </section>
    </LandingPageLayout>
  );
};

export default AccountingPastPapersLanding;
