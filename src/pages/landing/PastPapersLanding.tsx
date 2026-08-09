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
    name: "ZIMSEC O-Level & A-Level",
    detail:
      "Official ZIMSEC specimen papers across Maths, Combined Science, English, Geography, Accounts and more — sourced from ZIMSEC's own published downloads.",
  },
  {
    name: "Cambridge IGCSE, O & A-Level",
    detail:
      "Freely published Cambridge International question papers with matching mark schemes, so you can mark your own attempts properly.",
  },
  {
    name: "CAPS / NSC & IEB",
    detail:
      "South African exam preparation resources aligned to the national curriculum, organised by grade and subject.",
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
    answer: "Mathematics, Combined Science, Physics, Chemistry, Biology, English, Geography, History, Accounts/Accounting, Business Studies and more, across ZIMSEC, Cambridge, CAPS and IEB.",
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
      title="Past Exam Papers — ZIMSEC, Cambridge, CAPS | StudySync"
      description="Practise with verified past exam papers: official ZIMSEC specimen papers and Cambridge IGCSE/A-Level papers with mark schemes, organised by subject and year."
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
            Past exam papers, organised the way you revise
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Stop hunting through broken links. The StudySync library gives you{" "}
            <strong>official ZIMSEC specimen papers</strong> and{" "}
            <strong>Cambridge question papers with mark schemes</strong> — every link verified,
            filtered by curriculum, subject, level and year.
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
