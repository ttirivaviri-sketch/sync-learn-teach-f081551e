/**
 * /past-papers/ieb — SEO landing page targeting "IEB past papers",
 * "IEB Maths past papers", "IEB Physical Sciences past papers with memos".
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, FileText, GraduationCap, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRIAL_DURATION_DAYS } from "@/sail/types";
import { analytics } from "@/utils/analytics";
import LandingPageLayout, { type LandingFaq } from "@/components/landing/LandingPageLayout";

const SUBJECTS = [
  {
    name: "IEB Mathematics",
    detail:
      "Paper 1 (algebra, functions, calculus, financial maths) and Paper 2 (analytical geometry, trigonometry, statistics) practice in the IEB question style, with worked marking guidelines where published.",
  },
  {
    name: "IEB Physical Sciences",
    detail:
      "Physics Paper 1 (mechanics, waves, electricity) and Chemistry Paper 2 (matter, reactions, organic chemistry) exam-format questions with mark allocations.",
  },
  {
    name: "IEB Life Sciences",
    detail:
      "Data-response and essay questions covering genetics, human physiology, evolution and environmental studies — the sections IEB examiners weight most heavily.",
  },
  {
    name: "IEB English Home Language",
    detail:
      "Comprehension, language structures, summary and literature questions matched to the IEB set-work approach.",
  },
  {
    name: "IEB Accounting & Business Studies",
    detail:
      "Case-study led questions in the IEB format, with ledger, statement and essay-style practice.",
  },
  {
    name: "IEB Geography & History",
    detail:
      "Source-based and extended-writing questions, mapwork practice and essay planning for IEB Grade 12 exams.",
  },
];

const STEPS = [
  { icon: GraduationCap, title: "Set your curriculum to IEB", text: "Choose IEB and your grade when you sign up — the library then shows IEB-aligned papers first." },
  { icon: FileText, title: "Write the paper properly", text: "Work through a full IEB-format paper under timed conditions, section by section." },
  { icon: ListChecks, title: "Mark against the guidelines", text: "Use published marking guidelines and memos to see exactly where IEB examiners award marks." },
  { icon: Sparkles, title: "Close the gaps with AI", text: "AI StudyMode turns the questions you lost marks on into targeted quizzes and flashcards." },
];

const FAQS: LandingFaq[] = [
  {
    question: "What are IEB past papers?",
    answer:
      "IEB past papers are previous National Senior Certificate examination papers set by the Independent Examinations Board, the assessment body used by most independent schools in South Africa. They follow the same NSC standard as CAPS but use their own question styles, contexts and marking guidelines.",
  },
  {
    question: "Are IEB and CAPS/NSC past papers the same?",
    answer:
      "No. Both lead to a National Senior Certificate, but the IEB sets its own papers. The subject content overlaps heavily with CAPS, so CAPS papers are useful extra practice, while IEB papers are the closest match to what independent-school learners actually write.",
  },
  {
    question: "Which IEB subjects can I practise on StudySync?",
    answer:
      "Mathematics, Mathematical Literacy, Physical Sciences, Life Sciences, English Home Language, Accounting, Business Studies, Geography and History, organised by grade and year in the StudySync library.",
  },
  {
    question: "Do the IEB papers include memos or marking guidelines?",
    answer:
      "Where the marking guideline has been published for a paper, it is linked alongside it so you can mark your own attempt. Every link in the library is checked before it is added.",
  },
  {
    question: "How much does access to IEB past papers cost?",
    answer: `Create a free StudySync account to open the library — every account starts with a ${TRIAL_DURATION_DAYS}-day free trial, and you can filter straight to IEB papers for your subjects and grade.`,
  },
  {
    question: "Can a tutor help me work through IEB papers?",
    answer:
      "Yes. You can book a verified StudySync tutor who teaches the IEB curriculum to work through a past paper with you and explain the marking guideline question by question.",
  },
];

const IebPastPapersLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_past_papers_ieb");
  }, []);

  return (
    <LandingPageLayout
      title="IEB Past Papers &amp; Memos — Grade 12 Matric | StudySync"
      description="Practise IEB Grade 12 matric past papers for Mathematics, Physical Sciences, Life Sciences and English, with marking guidelines and memos by subject, grade and year."
      path="/past-papers/ieb"
      faqs={FAQS}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            For South African independent schools
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            IEB past papers &amp; memos, sorted by subject, grade and year
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Everything an IEB learner needs to revise properly:{" "}
            <strong>IEB-aligned exam papers and marking guidelines</strong> for Mathematics,
            Physical Sciences, Life Sciences, English and more — every link verified, filtered to
            the exact grade and subject you write.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Open IEB papers free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tutoring">Get an IEB tutor</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {TRIAL_DURATION_DAYS}-day free trial · Marking guidelines where published · Updated regularly
          </p>
        </div>
      </section>

      {/* Subjects */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
            IEB subjects covered
          </h2>
          <p className="mb-8 max-w-2xl text-gray-600">
            The Independent Examinations Board sets its own National Senior Certificate papers, so
            the question style differs from CAPS even where the content matches. These are the
            subjects StudySync learners revise most.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SUBJECTS.map((s) => (
              <div key={s.name} className="rounded-2xl border border-gray-200 bg-white p-6">
                <CheckCircle2 className="mb-3 h-6 w-6 text-blue-600" aria-hidden />
                <h3 className="mb-1.5 text-lg font-semibold text-gray-900">{s.name}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
          How to revise with IEB past papers
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
            <h2 className="text-lg font-semibold text-gray-900">Also useful for IEB learners</h2>
          </div>
          <ul className="grid gap-2 text-sm text-blue-700 sm:grid-cols-3">
            <li>
              <Link className="hover:underline" to="/past-papers">
                All past papers (ZIMSEC O &amp; A Level, Cambridge IGCSE, matric)
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/past-papers/physical-sciences">
                Physical Sciences past papers &amp; memos
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/books">
                Free textbooks & set-work novels
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/tutoring">
                Tutors who teach the IEB curriculum
              </Link>
            </li>
          </ul>
        </div>

        <div className="mt-12 rounded-2xl bg-blue-600 p-8 text-center sm:p-10">
          <h2 className="text-2xl font-bold text-white">Start your next IEB paper today</h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Create a free account, set your curriculum to IEB, and the library shows the papers for
            your exact subjects and grade.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/learner/auth">Open the library</Link>
          </Button>
        </div>
      </section>
    </LandingPageLayout>
  );
};

export default IebPastPapersLanding;
