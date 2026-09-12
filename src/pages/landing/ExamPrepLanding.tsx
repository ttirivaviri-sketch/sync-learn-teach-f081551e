/**
 * /exam-prep — SEO landing page targeting "exam prep", "exam preparation
 * grade 12", "exam prep help South Africa", "matric exam preparation" and
 * "ZIMSEC exam preparation". Competitors ranking for these phrases (Ace My
 * Exams, SimpleStudy, Go Study Now) lead with "exam preparation platform"
 * language; this page answers the same intent and funnels into past papers,
 * tutoring and AI StudyMode.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Camera,
  CheckCircle2,
  FileText,
  GraduationCap,
  ListChecks,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRIAL_DURATION_DAYS } from "@/sail/types";
import { analytics } from "@/utils/analytics";
import LandingPageLayout, { type LandingFaq } from "@/components/landing/LandingPageLayout";

const TOOLS = [
  {
    icon: FileText,
    name: "Past papers with memos",
    detail:
      "Thousands of real exam papers — Matric/NSC, IEB, ZIMSEC O & A Level and Cambridge IGCSE — with official memos and mark schemes, filtered to your exact grade and subjects.",
  },
  {
    icon: Camera,
    name: "AI marking of your answers",
    detail:
      "Photograph your written answers to a past paper and the AI marks them against the actual questions — step by step, with examiner expectations and corrections.",
  },
  {
    icon: Sparkles,
    name: "AI StudyMode",
    detail:
      "Turn any topic into quizzes, flashcards and worked examples. The questions you get wrong become targeted practice until the gap closes.",
  },
  {
    icon: Users,
    name: "Verified online tutors",
    detail:
      "Book a vetted tutor for Maths, Sciences, English and more to work through papers with you and explain the memo question by question.",
  },
  {
    icon: ListChecks,
    name: "Exam-countdown planning",
    detail:
      "Add your exam dates and StudySync sorts your library and study plan by what you write soonest, so revision time goes where it matters.",
  },
  {
    icon: BookOpen,
    name: "Free textbooks & study guides",
    detail:
      "Openly licensed textbooks, set works and study guides aligned to CAPS, IEB, Cambridge and ZIMSEC syllabi — all in one library.",
  },
];

const STEPS = [
  {
    icon: GraduationCap,
    title: "Tell us what you write",
    text: "Pick your curriculum (CAPS/NSC, IEB, ZIMSEC or Cambridge), grade and subjects — everything is filtered to your exact exams.",
  },
  {
    icon: FileText,
    title: "Practise real papers",
    text: "Write full past papers under timed conditions. Exam technique is a skill — the learners who practise papers outperform those who only read notes.",
  },
  {
    icon: Camera,
    title: "Get marked like an examiner",
    text: "Upload photos of your answers and the AI marks them against the paper — awarding method marks, flagging missed steps and showing the model solution.",
  },
  {
    icon: Sparkles,
    title: "Drill your weak spots",
    text: "Every mistake becomes practice questions of the same type, so you improve exactly where you lost marks.",
  },
];

const FAQS: LandingFaq[] = [
  {
    question: "What is the best way to prepare for exams?",
    answer:
      "Examiners and top achievers agree: practising real past papers under timed conditions, then marking against the official memo, beats passive re-reading. StudySync combines past papers with memos, AI marking of your written answers, and tutors — so every study session targets actual exam marks.",
  },
  {
    question: "Which exams does StudySync cover?",
    answer:
      "Matric/NSC (CAPS) Grade 10–12, IEB, ZIMSEC O Level and A Level, and Cambridge IGCSE, O Level and AS/A Level. That covers the main school-leaving exams in South Africa and Zimbabwe.",
  },
  {
    question: "How does the AI exam marking work?",
    answer:
      "Open any past paper in the StudySync library, write your answers on paper, then photograph them. The AI reads your working, marks it against the paper's questions the way an examiner would — method marks, accuracy marks, examiner expectations — and gives corrections plus practice questions of the same type.",
  },
  {
    question: "Is StudySync free?",
    answer: `Every account starts with a ${TRIAL_DURATION_DAYS}-day free trial with full access to past papers, AI StudyMode and the library. After the trial, affordable plans keep everything unlocked, and tutoring is pay-per-session.`,
  },
  {
    question: "Can StudySync help with matric finals specifically?",
    answer:
      "Yes. Set your curriculum to CAPS and Grade 12, add your final exam timetable, and StudySync sorts your papers and study plan by what you write soonest — with NSC-format papers and official memos for every major subject.",
  },
  {
    question: "Does StudySync work for ZIMSEC students in Zimbabwe?",
    answer:
      "Yes. StudySync serves Zimbabwe as fully as South Africa: ZIMSEC O Level and A Level past papers with answers, Cambridge papers, AI tools aligned to the ZIMSEC syllabus, and online tutors who know the Zimbabwean curriculum.",
  },
];

const ExamPrepLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_exam_prep");
  }, []);

  return (
    <LandingPageLayout
      title="Exam Prep for Matric, IEB, ZIMSEC & Cambridge | StudySync"
      description="Exam preparation help for Grade 10–12: past papers with memos, AI study tools, photo marking against real exam papers and verified tutors — South Africa and Zimbabwe."
      path="/exam-prep"
      faqs={FAQS}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Exam Prep", path: "/exam-prep" },
      ]}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            For learners in South Africa &amp; Zimbabwe
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            Exam prep that targets real exam marks
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            One platform for serious exam preparation:{" "}
            <strong>past papers with memos, AI marking of your written answers, study tools and
            verified tutors</strong> — for Matric/NSC, IEB, ZIMSEC O &amp; A Level and Cambridge
            IGCSE learners.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Start exam prep free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/past-papers">Browse past papers</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {TRIAL_DURATION_DAYS}-day free trial · No card needed · Works on any phone
          </p>
        </div>
      </section>

      {/* Tools */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
            Everything you need to prepare for exams
          </h2>
          <p className="mb-8 max-w-2xl text-gray-600">
            Most study sites give you either papers or notes. StudySync connects the whole exam
            preparation loop — practise, get marked, close the gap.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map(({ icon: Icon, name, detail }) => (
              <div key={name} className="rounded-2xl border border-gray-200 bg-white p-6">
                <Icon className="mb-3 h-6 w-6 text-blue-600" aria-hidden />
                <h3 className="mb-1.5 text-lg font-semibold text-gray-900">{name}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
          How exam preparation works on StudySync
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

        {/* Exam clusters */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Matric / NSC exam prep</h2>
            <p className="mb-3 text-sm leading-relaxed text-gray-600">
              Grade 12 past papers with official memos, subject-by-subject revision and tutors who
              know the NSC marking guidelines.
            </p>
            <Link className="text-sm font-medium text-blue-700 hover:underline" to="/past-papers/matric">
              Matric past papers &amp; memos →
            </Link>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">ZIMSEC exam prep</h2>
            <p className="mb-3 text-sm leading-relaxed text-gray-600">
              O Level and A Level past papers with answers, aligned to the ZIMSEC syllabus for
              learners in Zimbabwe.
            </p>
            <Link className="text-sm font-medium text-blue-700 hover:underline" to="/past-papers/zimsec">
              ZIMSEC past papers →
            </Link>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Cambridge exam prep</h2>
            <p className="mb-3 text-sm leading-relaxed text-gray-600">
              IGCSE, O Level and AS/A Level past papers with mark schemes for Cambridge
              International learners.
            </p>
            <Link className="text-sm font-medium text-blue-700 hover:underline" to="/past-papers/cambridge">
              Cambridge past papers →
            </Link>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Grade 10 &amp; 11 exam prep</h2>
            <p className="mb-3 text-sm leading-relaxed text-gray-600">
              Build exam technique before the matric year with Grade 10 and Grade 11 papers and
              memos for every major subject.
            </p>
            <Link className="text-sm font-medium text-blue-700 hover:underline" to="/past-papers/grade-11">
              Grade 10–11 past papers →
            </Link>
          </div>
        </div>

        <div className="mt-12 rounded-2xl bg-blue-600 p-8 text-center sm:p-10">
          <h2 className="text-2xl font-bold text-white">Start preparing for your exams today</h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Create a free account, pick your curriculum and subjects, and your exam prep plan is
            ready in under two minutes.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/learner/auth">Create free account</Link>
          </Button>
        </div>
      </section>
    </LandingPageLayout>
  );
};

export default ExamPrepLanding;
