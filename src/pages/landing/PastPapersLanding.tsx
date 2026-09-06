/**
 * /past-papers — SEO landing page targeting "ZIMSEC past papers",
 * "Cambridge IGCSE past papers", "matric past papers", "past exam papers
 * with memos".
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileText, Filter, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRIAL_DURATION_DAYS } from "@/sail/types";
import { analytics } from "@/utils/analytics";
import LandingPageLayout, { type LandingFaq } from "@/components/landing/LandingPageLayout";

const PAPER_SETS = [
  {
    name: "ZIMSEC O Level & A Level",
    detail:
      "Official ZIMSEC O Level (Form 4) and A Level (Upper 6) specimen papers across Maths, Combined Science, English, Geography, Accounts and more — sourced from ZIMSEC's own published downloads.",
  },
  {
    name: "Cambridge IGCSE, O Level & AS/A Level",
    detail:
      "Freely published Cambridge International IGCSE, O Level and AS/A Level question papers with matching mark schemes and memos, so you can mark your own attempts properly.",
  },
  {
    name: "CAPS / NSC matric & IEB Grade 12",
    detail:
      "Grade 10, Grade 11 and Grade 12 matric (NSC) exam preparation aligned to the South African national curriculum, plus IEB papers — organised by grade, subject and year.",
  },
];

const STEPS = [
  { icon: Filter, title: "Filter to your exam", text: "Pick your curriculum, subject, level and year — see only the papers you actually write." },
  { icon: FileText, title: "Practise the real thing", text: "Work through genuine exam-format questions under timed conditions." },
  { icon: ListChecks, title: "Mark with the memo", text: "Cambridge papers come with mark schemes so you learn exactly what examiners award." },
  { icon: Sparkles, title: "Drill weak spots with AI", text: "AI StudyMode turns the topics you struggled with into quizzes and flashcards." },
];

const FAQS: LandingFaq[] = [
  {
    question: "Are the past papers on StudySync real exam papers?",
    answer: "Yes. The library links to official ZIMSEC specimen papers published by ZIMSEC and freely published Cambridge International question papers, alongside curriculum-aligned practice material. Every link is verified before it's added.",
  },
  {
    question: "Do the past papers come with marking schemes or memos?",
    answer: "Cambridge papers include their matching mark schemes where Cambridge has published them. ZIMSEC specimen papers follow the official exam format so you can practise under real conditions.",
  },
  {
    question: "Which subjects have past papers?",
    answer: "Mathematics, Maths Literacy, Combined Science, Physical Sciences (Physics and Chemistry), Life Sciences/Biology, English, Afrikaans, Geography, History, Accounts/Accounting, Business Studies, Economics and more, across ZIMSEC O and A Level, Cambridge IGCSE and AS/A Level, CAPS/NSC Grade 10-12 and IEB.",
  },
  {
    question: "Where can I download Grade 12 matric past papers and memos?",
    answer: "Sign in to the StudySync library and filter to CAPS/NSC, Grade 12. You get matric past exam papers with memos where they have been published, alongside Grade 10 and Grade 11 papers for earlier revision, and IEB papers on the dedicated IEB page.",
  },
  {
    question: "Do you have ZIMSEC O Level and A Level past papers?",
    answer: "Yes. The library links official ZIMSEC specimen papers for O Level (Form 4) and A Level (Lower and Upper 6) across Maths, Combined Science, Sciences, English, Commerce, Accounts, Geography and History, so Zimbabwean learners can practise in the exact exam format.",
  },
  {
    question: "What is the difference between Cambridge IGCSE, O Level and A Level papers?",
    answer: "IGCSE and O Level are taken around Form 4 / Grade 11 and cover a broad subject spread; AS and A Level are the advanced, two-year qualifications taken in Lower and Upper 6. StudySync separates all three so you only practise the papers you actually write.",
  },
  {
    question: "How much does it cost to access past papers?",
    answer: `Create a free StudySync account to browse the library — every account starts with a ${TRIAL_DURATION_DAYS}-day free trial. The library is organised by curriculum, subject, level and year.`,
  },
  {
    question: "Can I practise past papers with AI help?",
    answer: "Yes. AI StudyMode can generate practice quizzes and flashcards from the topics you're revising, track which question types you get wrong, and focus your next session on those gaps.",
  },
];

const PastPapersLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_past_papers");
  }, []);

  return (
    <LandingPageLayout
      title="Past Exam Papers &amp; Memos — ZIMSEC, Cambridge, Grade 12"
      description="Download past exam papers with memos: ZIMSEC O Level & A Level, Cambridge IGCSE, O Level & AS/A Level, and CAPS/NSC Grade 12 matric papers — sorted by subject, grade and year."
      path="/past-papers"
      faqs={FAQS}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Verified exam practice
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            Past exam papers &amp; memos, organised the way you revise
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Stop hunting through broken links. The StudySync library gives you{" "}
            <strong>official ZIMSEC O Level and A Level specimen papers</strong>,{" "}
            <strong>Cambridge IGCSE, O Level and AS/A Level papers with mark schemes</strong>, and{" "}
            <strong>Grade 12 matric (CAPS/NSC) and IEB exam papers with memos</strong> — every link
            verified, filtered by curriculum, subject, grade, level and year.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Browse past papers free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tutoring">Get a tutor to mark with you</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {TRIAL_DURATION_DAYS}-day free trial · Every link verified · Updated regularly
          </p>
        </div>
      </section>

      {/* Paper collections */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
            Papers for the exams you actually write
          </h2>
          <div className="grid gap-6 lg:grid-cols-3">
            {PAPER_SETS.map((p) => (
              <div key={p.name} className="rounded-2xl border border-gray-200 bg-white p-6">
                <CheckCircle2 className="mb-3 h-6 w-6 text-blue-600" aria-hidden />
                <h3 className="mb-1.5 text-lg font-semibold text-gray-900">{p.name}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{p.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
          How past-paper practice works on StudySync
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

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Writing ZIMSEC exams?</h2>
            <p className="mb-3 text-sm leading-relaxed text-gray-600">
              Official ZIMSEC O Level and A Level specimen papers — Maths, Combined Science,
              English, Geography, Accounts and more.
            </p>
            <Link className="text-sm font-medium text-blue-700 hover:underline" to="/past-papers/zimsec">
              Browse ZIMSEC past papers →
            </Link>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Writing matric (NSC)?</h2>
            <p className="mb-3 text-sm leading-relaxed text-gray-600">
              Grade 12 matric past papers with memos for Mathematics, Physical Sciences, Life
              Sciences, English and more.
            </p>
            <Link className="text-sm font-medium text-blue-700 hover:underline" to="/past-papers/matric">
              Browse matric past papers &amp; memos →
            </Link>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Writing IEB exams?</h2>
            <p className="mb-3 text-sm leading-relaxed text-gray-600">
              The Independent Examinations Board sets its own papers and marking guidelines.
            </p>
            <Link className="text-sm font-medium text-blue-700 hover:underline" to="/past-papers/ieb">
              Browse IEB past papers &amp; memos →
            </Link>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Writing Physical Sciences?</h2>
            <p className="mb-3 text-sm leading-relaxed text-gray-600">
              Grade 10–12 Physical Sciences papers with memos — Paper 1 (Physics) and Paper 2
              (Chemistry), sorted by grade and year.
            </p>
            <Link className="text-sm font-medium text-blue-700 hover:underline" to="/past-papers/physical-sciences">
              Browse Physical Sciences past papers &amp; memos →
            </Link>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Studying Accounting?</h2>
            <p className="mb-3 text-sm leading-relaxed text-gray-600">
              Grade 10–12 Accounting papers with memos — financial statements, cash flow, ratios and
              cost accounting.
            </p>
            <Link className="text-sm font-medium text-blue-700 hover:underline" to="/past-papers/accounting">
              Browse Accounting past papers &amp; memos →
            </Link>
          </div>
        </div>

        <div className="mt-12 rounded-2xl bg-blue-600 p-8 text-center sm:p-10">
          <h2 className="text-2xl font-bold text-white">Start practising with real papers today</h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Create a free account, pick your curriculum, and the library shows you the papers for
            your exact subjects and level.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/learner/auth">Open the library</Link>
          </Button>
        </div>
      </section>
    </LandingPageLayout>
  );
};

export default PastPapersLanding;
