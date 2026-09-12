/**
 * /past-papers/grade-11 — SEO landing page targeting "grade 11 past papers",
 * "grade 11 exam papers and memos", "grade 11 maths past papers" and subject
 * variants — the second-highest-volume grade cluster after matric.
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
      "Grade 11 Paper 1 (algebra, functions, finance, probability) and Paper 2 (geometry, trigonometry, statistics) with memos — the year trig identities and Euclidean geometry get serious.",
  },
  {
    name: "Physical Sciences",
    detail:
      "Grade 11 Physics (vectors, Newton's laws, electrostatics) and Chemistry (molecular structures, energy change, acids and bases) papers with memos.",
  },
  {
    name: "Life Sciences",
    detail:
      "Biodiversity, body systems, photosynthesis and respiration — Grade 11 papers with marking memoranda.",
  },
  {
    name: "English & Afrikaans",
    detail:
      "Home Language and First Additional Language papers: comprehension, language structures, literature and writing.",
  },
  {
    name: "Accounting",
    detail:
      "Partnerships, clubs, cost accounting, budgets and internal controls — Grade 11 papers in the format the matric exam builds on.",
  },
  {
    name: "Geography, History & Business Studies",
    detail:
      "Mapwork, source-based questions, case studies and essays from previous Grade 11 examinations, organised by year.",
  },
];

const STEPS = [
  {
    icon: GraduationCap,
    title: "Set your grade to 11",
    text: "Choose your curriculum and Grade 11 when you sign up — the library filters straight to your level.",
  },
  {
    icon: FileText,
    title: "Practise full papers, timed",
    text: "The Grade 11 November paper is a dress rehearsal for matric — treat it that way from your first practice session.",
  },
  {
    icon: ListChecks,
    title: "Mark with the memo",
    text: "Learn exactly where method and accuracy marks are awarded before it counts for your final NSC results.",
  },
  {
    icon: Sparkles,
    title: "Close gaps before matric",
    text: "AI StudyMode drills the topics you lose marks on, so you enter Grade 12 without carried-over gaps.",
  },
];

const FAQS: LandingFaq[] = [
  {
    question: "Where can I find Grade 11 past papers with memos?",
    answer:
      "StudySync's library has Grade 11 past exam papers with memos for Mathematics, Maths Literacy, Physical Sciences, Life Sciences, English, Afrikaans, Accounting, Business Studies, Geography and History — organised by subject and year.",
  },
  {
    question: "Why is Grade 11 past-paper practice so important?",
    answer:
      "Grade 11 covers much of the content examined in matric — trigonometry, Euclidean geometry, Newton's laws, and financial statements all start here. Universities also look at Grade 11 marks for provisional admission, so this year's results matter more than most learners realise.",
  },
  {
    question: "Are these CAPS-aligned papers?",
    answer:
      "Yes — the Grade 11 collection follows the CAPS curriculum used in South African public schools, with IEB papers for independent-school learners where published.",
  },
  {
    question: "Do the papers include memos?",
    answer:
      "Yes — where the marking memorandum has been published it is available with the paper, so you can mark your own attempt the way markers do.",
  },
  {
    question: "How much do Grade 11 past papers cost?",
    answer: `Create a free StudySync account to open the library — every account starts with a ${TRIAL_DURATION_DAYS}-day free trial, filtered to Grade 11 and your subjects.`,
  },
  {
    question: "Can I get help with questions I don't understand?",
    answer:
      "Yes. Ask the AI about any question while reading a paper, photograph your written answers for AI marking with examiner-style feedback, or book a verified online tutor for your subject.",
  },
];

const Grade11PastPapersLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_past_papers_grade_11");
  }, []);

  return (
    <LandingPageLayout
      title="Grade 11 Past Papers & Memos — All Subjects | StudySync"
      description="Grade 11 past exam papers with memos for every major subject — Maths, Physical Sciences, Life Sciences, Accounting and English — CAPS/NSC and IEB, free to practise."
      path="/past-papers/grade-11"
      faqs={FAQS}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Past Papers", path: "/past-papers" },
        { name: "Grade 11", path: "/past-papers/grade-11" },
      ]}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            For South African Grade 11 learners
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            Grade 11 past papers &amp; memos, sorted by subject and year
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            The year before matric decides how matric goes:{" "}
            <strong>Grade 11 exam papers with memos</strong> for Mathematics, Physical Sciences,
            Life Sciences, English, Accounting and more — filtered to exactly what you study.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Open Grade 11 papers free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tutoring">Get a tutor</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {TRIAL_DURATION_DAYS}-day free trial · Memos where published · Updated regularly
          </p>
        </div>
      </section>

      {/* Subjects */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
            Grade 11 subjects covered
          </h2>
          <p className="mb-8 max-w-2xl text-gray-600">
            The subjects Grade 11 learners practise most on StudySync — each feeding directly into
            the matric syllabus.
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
          How to use Grade 11 past papers
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
            <h2 className="text-lg font-semibold text-gray-900">Keep going</h2>
          </div>
          <ul className="grid gap-2 text-sm text-blue-700 sm:grid-cols-3">
            <li>
              <Link className="hover:underline" to="/past-papers/matric">
                Matric (Grade 12) past papers
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/past-papers/grade-10">
                Grade 10 past papers &amp; memos
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/past-papers/maths">
                Maths past papers Grade 10–12
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/past-papers/life-sciences">
                Life Sciences past papers
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/exam-prep">
                Exam prep tools &amp; AI marking
              </Link>
            </li>
          </ul>
        </div>

        <div className="mt-12 rounded-2xl bg-blue-600 p-8 text-center sm:p-10">
          <h2 className="text-2xl font-bold text-white">Start your next paper today</h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Create a free account, set your grade to 11, and the library shows the papers for your
            exact subjects.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/learner/auth">Open the library</Link>
          </Button>
        </div>
      </section>
    </LandingPageLayout>
  );
};

export default Grade11PastPapersLanding;
