/**
 * /past-papers/matric — SEO landing page targeting "matric past papers",
 * "grade 12 past papers with memos", "NSC past papers", "matric exam papers
 * pdf download" and subject variants — the highest-volume past-paper search
 * cluster in South Africa, previously served only by the generic page.
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
    name: "Mathematics & Maths Literacy",
    detail:
      "NSC Paper 1 (algebra, functions, calculus, finance) and Paper 2 (geometry, trigonometry, statistics) with official memos — the most practised matric papers on StudySync.",
  },
  {
    name: "Physical Sciences",
    detail:
      "Physics Paper 1 and Chemistry Paper 2 past papers with memos, covering mechanics, electricity, matter, chemical change and organic chemistry.",
  },
  {
    name: "Life Sciences",
    detail:
      "Paper 1 and Paper 2 practice — genetics, human physiology, evolution and environmental studies — with marking memoranda.",
  },
  {
    name: "English & Afrikaans",
    detail:
      "Home Language and First Additional Language papers: comprehension, language structures, summary, literature and writing, with memos.",
  },
  {
    name: "Accounting, Business & Economics",
    detail:
      "Financial statements, cash flow, ratios, case studies and essay questions in the NSC format with marking guidelines.",
  },
  {
    name: "Geography, History & Tourism",
    detail:
      "Source-based questions, mapwork, essays and case studies from previous NSC examinations, organised by year.",
  },
];

const STEPS = [
  { icon: GraduationCap, title: "Set your curriculum to CAPS/NSC", text: "Choose CAPS and your grade when you sign up — the library then shows NSC-aligned papers first." },
  { icon: FileText, title: "Write a full paper under exam conditions", text: "Time yourself against the real three-hour paper so speed and accuracy improve together." },
  { icon: ListChecks, title: "Mark with the official memo", text: "Use the marking memorandum to see exactly where NSC markers award method and accuracy marks." },
  { icon: Sparkles, title: "Close the gaps with AI", text: "AI StudyMode turns the questions you lost marks on into targeted quizzes and flashcards." },
];

const FAQS: LandingFaq[] = [
  {
    question: "What are matric past papers?",
    answer:
      "Matric past papers are previous National Senior Certificate (NSC) examination papers written by Grade 12 learners in South Africa, set by the Department of Basic Education. Practising them with the official memos is the most reliable way to prepare for the final exams.",
  },
  {
    question: "Which matric subjects can I practise on StudySync?",
    answer:
      "Mathematics, Mathematical Literacy, Physical Sciences, Life Sciences, English, Afrikaans, Accounting, Business Studies, Economics, Geography, History and more — organised by subject, grade and year in the StudySync library.",
  },
  {
    question: "Do the papers include memos?",
    answer:
      "Yes — where the official marking memorandum has been published it is linked alongside the paper so you can mark your own attempt the way NSC markers do. Every link in the library is checked before it is added.",
  },
  {
    question: "Are Grade 10 and Grade 11 past papers included?",
    answer:
      "Yes. The library covers Grade 10 to Grade 12 for the major subjects, so you can build exam technique before the matric year rather than starting in Grade 12.",
  },
  {
    question: "How much do matric past papers cost on StudySync?",
    answer: `Create a free StudySync account to open the library — every account starts with a ${TRIAL_DURATION_DAYS}-day free trial, and you can filter straight to NSC papers for your subjects and grade.`,
  },
  {
    question: "Can a tutor help me work through matric papers?",
    answer:
      "Yes. You can book a verified StudySync tutor for your subject to work through a past paper with you online and explain the memo question by question.",
  },
];

const MatricPastPapersLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_past_papers_matric");
  }, []);

  return (
    <LandingPageLayout
      title="Matric Past Papers & Memos — Grade 12 NSC | StudySync"
      description="Download and practise Grade 12 matric past exam papers with memos — Mathematics, Physical Sciences, Life Sciences, English and more, sorted by subject and year."
      path="/past-papers/matric"
      faqs={FAQS}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            For South African Grade 10–12 learners
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            Matric past papers &amp; memos, sorted by subject and year
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Everything a matric learner needs to revise properly:{" "}
            <strong>NSC exam papers with official memos</strong> for Mathematics, Physical
            Sciences, Life Sciences, English and more — every link verified, filtered to the exact
            grade and subject you write.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Open matric papers free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tutoring">Get a matric tutor</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {TRIAL_DURATION_DAYS}-day free trial · Official memos where published · Updated regularly
          </p>
        </div>
      </section>

      {/* Subjects */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
            Matric subjects covered
          </h2>
          <p className="mb-8 max-w-2xl text-gray-600">
            The NSC examinations reward exam technique as much as content knowledge. These are the
            subjects StudySync learners revise most before the final papers.
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
          How to revise with matric past papers
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
            <h2 className="text-lg font-semibold text-gray-900">Also useful for matric learners</h2>
          </div>
          <ul className="grid gap-2 text-sm text-blue-700 sm:grid-cols-3">
            <li>
              <Link className="hover:underline" to="/past-papers/physical-sciences">
                Physical Sciences past papers &amp; memos
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/past-papers/ieb">
                IEB past papers &amp; marking guidelines
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/past-papers/accounting">
                Accounting past papers Grade 10–12
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
          <h2 className="text-2xl font-bold text-white">Start your next matric paper today</h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Create a free account, set your curriculum to CAPS, and the library shows the papers
            for your exact subjects and grade.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/learner/auth">Open the library</Link>
          </Button>
        </div>
      </section>
    </LandingPageLayout>
  );
};

export default MatricPastPapersLanding;
