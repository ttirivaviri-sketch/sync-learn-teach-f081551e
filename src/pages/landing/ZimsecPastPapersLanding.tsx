/**
 * /past-papers/zimsec — SEO landing page targeting "ZIMSEC past papers",
 * "ZIMSEC O Level past papers", "ZIMSEC A Level past papers with answers",
 * "ZIMSEC green books" and subject variants (maths, combined science, shona).
 *
 * ZIMSEC is a core audience for StudySync (referenced across the homepage and
 * library) but had no dedicated landing page until now.
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
    name: "ZIMSEC O Level Mathematics",
    detail:
      "Paper 1 (non-calculator arithmetic, algebra, geometry) and Paper 2 (structured questions) in the ZIMSEC format, with answers and examiner-style working where published.",
  },
  {
    name: "ZIMSEC Combined Science",
    detail:
      "Physics, chemistry and biology sections of the O Level combined science syllabus, with structured and multiple-choice practice matched to the ZIMSEC paper style.",
  },
  {
    name: "ZIMSEC English Language",
    detail:
      "Composition, comprehension, summary and language-structure practice for Paper 1 and Paper 2, following the current ZIMSEC O Level syllabus.",
  },
  {
    name: "ZIMSEC A Level Sciences",
    detail:
      "Pure Mathematics, Physics, Chemistry and Biology A Level papers with structured, data-response and essay questions in the ZIMSEC examination format.",
  },
  {
    name: "ZIMSEC Accounting & Commerce",
    detail:
      "O and A Level Principles of Accounting, Commerce and Business Studies practice — ledgers, financial statements and case-style questions.",
  },
  {
    name: "ZIMSEC Shona & Ndebele",
    detail:
      "Indigenous-language papers with composition, comprehension and grammar sections following the ZIMSEC O Level format.",
  },
];

const STEPS = [
  { icon: GraduationCap, title: "Set your curriculum to ZIMSEC", text: "Choose ZIMSEC and O or A Level when you sign up — the library then shows ZIMSEC-aligned papers first." },
  { icon: FileText, title: "Write a full paper under exam conditions", text: "Time yourself against the real paper length so speed and accuracy improve together." },
  { icon: ListChecks, title: "Mark with the answers", text: "Use published answers and marking notes to see exactly where marks are awarded — the way ZIMSEC examiners do." },
  { icon: Sparkles, title: "Close the gaps with AI", text: "AI StudyMode turns the questions you lost marks on into targeted quizzes and flashcards for your syllabus." },
];

const FAQS: LandingFaq[] = [
  {
    question: "What are ZIMSEC past papers?",
    answer:
      "ZIMSEC past papers are previous examination papers set by the Zimbabwe School Examinations Council for O Level (Form 4) and A Level (Form 6). Practising them is the most reliable way to learn the question styles, mark allocations and timing of the real exams.",
  },
  {
    question: "Which ZIMSEC subjects can I practise on StudySync?",
    answer:
      "O Level Mathematics, Combined Science, English Language, Shona, Ndebele, Accounting, Commerce, Geography and History, plus A Level Pure Mathematics, Physics, Chemistry, Biology and more — organised by level, subject and year in the StudySync library.",
  },
  {
    question: "Do the ZIMSEC papers come with answers?",
    answer:
      "Where answers or marking notes have been published for a paper, they are linked alongside it so you can mark your own attempt. Every link in the library is checked before it is added.",
  },
  {
    question: "Are ZIMSEC green books available?",
    answer:
      "The library focuses on official past examination papers with answers, which cover the same ground the green books are used for — worked exam practice by subject and year. New verified sources are added regularly.",
  },
  {
    question: "How much does access to ZIMSEC past papers cost?",
    answer: `Create a free StudySync account to open the library — every account starts with a ${TRIAL_DURATION_DAYS}-day free trial, and you can filter straight to ZIMSEC O or A Level papers for your subjects.`,
  },
  {
    question: "Can a tutor help me prepare for ZIMSEC exams?",
    answer:
      "Yes. You can book a verified StudySync tutor who teaches the ZIMSEC syllabus to work through past papers with you online and explain the marking approach question by question.",
  },
];

const ZimsecPastPapersLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_past_papers_zimsec");
  }, []);

  return (
    <LandingPageLayout
      title="ZIMSEC Past Papers & Answers — O & A Level | StudySync"
      description="Practise ZIMSEC O Level and A Level past exam papers with answers — Mathematics, Combined Science, English and more, sorted by subject, level and year."
      path="/past-papers/zimsec"
      faqs={FAQS}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            For Zimbabwean O &amp; A Level candidates
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            ZIMSEC past papers &amp; answers, sorted by subject, level and year
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Everything a ZIMSEC candidate needs to revise properly:{" "}
            <strong>O Level and A Level exam papers with answers</strong> for Mathematics, Combined
            Science, English and more — every link verified, filtered to the exact level and
            subject you write.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Open ZIMSEC papers free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tutoring">Get a ZIMSEC tutor</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {TRIAL_DURATION_DAYS}-day free trial · Answers where published · Updated regularly
          </p>
        </div>
      </section>

      {/* Subjects */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
            ZIMSEC subjects covered
          </h2>
          <p className="mb-8 max-w-2xl text-gray-600">
            The Zimbabwe School Examinations Council sets its own O and A Level papers with
            distinctive question styles. These are the subjects StudySync learners revise most.
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
          How to revise with ZIMSEC past papers
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
            <h2 className="text-lg font-semibold text-gray-900">Also useful for ZIMSEC candidates</h2>
          </div>
          <ul className="grid gap-2 text-sm text-blue-700 sm:grid-cols-3">
            <li>
              <Link className="hover:underline" to="/past-papers">
                All past papers (Cambridge IGCSE, matric, IEB)
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/books">
                Free textbooks &amp; study guides
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/tutoring/maths">
                ZIMSEC maths tutors online
              </Link>
            </li>
          </ul>
        </div>

        <div className="mt-12 rounded-2xl bg-blue-600 p-8 text-center sm:p-10">
          <h2 className="text-2xl font-bold text-white">Start your next ZIMSEC paper today</h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Create a free account, set your curriculum to ZIMSEC, and the library shows the papers
            for your exact subjects and level.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/learner/auth">Open the library</Link>
          </Button>
        </div>
      </section>
    </LandingPageLayout>
  );
};

export default ZimsecPastPapersLanding;
