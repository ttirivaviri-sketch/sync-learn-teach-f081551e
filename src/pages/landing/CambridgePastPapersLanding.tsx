/**
 * /past-papers/cambridge — SEO landing page targeting "cambridge past papers",
 * "igcse past papers", "o level past papers", "a level past papers zimbabwe"
 * and subject variants. Cambridge learners in Zimbabwe and SA private schools
 * are a core StudySync audience (4,000+ Cambridge papers seeded) but the
 * cluster previously had no dedicated page.
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
    name: "Mathematics (0580, 4024, 9709)",
    detail:
      "IGCSE Maths 0580, O Level Maths D 4024 and A Level Maths 9709 past papers with mark schemes — Paper 1 to Paper 4, core and extended.",
  },
  {
    name: "Sciences (Physics, Chemistry, Biology)",
    detail:
      "IGCSE and O/A Level Physics, Chemistry, Biology and Combined Science papers with mark schemes, including alternative-to-practical papers.",
  },
  {
    name: "English (First & Second Language)",
    detail:
      "IGCSE English 0500/0510 and O Level English 1123 past papers — comprehension, directed writing, summary and composition, with examiner reports.",
  },
  {
    name: "Accounting & Business Studies",
    detail:
      "IGCSE and O Level Accounting (0452/7707) and Business Studies papers with mark schemes covering ledgers, financial statements and case studies.",
  },
  {
    name: "Geography & History",
    detail:
      "Source-based and structured questions from previous IGCSE and O/A Level examinations, organised by paper and year.",
  },
  {
    name: "Computer Science & ICT",
    detail:
      "IGCSE Computer Science 0478 and ICT papers with mark schemes — theory, problem-solving and programming questions.",
  },
];

const STEPS = [
  {
    icon: GraduationCap,
    title: "Set your level",
    text: "Choose Cambridge and IGCSE, O Level or AS/A Level when you sign up — the library shows papers for your exact syllabus codes.",
  },
  {
    icon: FileText,
    title: "Write a full paper, timed",
    text: "Cambridge rewards exam technique. Practise complete papers against the clock, reading in-app on any phone — no downloads needed.",
  },
  {
    icon: ListChecks,
    title: "Mark with the mark scheme",
    text: "Use the official mark scheme, or photograph your answers and let the AI mark them against the paper with examiner expectations.",
  },
  {
    icon: Sparkles,
    title: "Drill what you got wrong",
    text: "AI StudyMode turns your mistakes into practice questions of the same type until the method sticks.",
  },
];

const FAQS: LandingFaq[] = [
  {
    question: "Which Cambridge past papers does StudySync have?",
    answer:
      "IGCSE, O Level and AS/A Level past papers across Mathematics, Physics, Chemistry, Biology, Combined Science, English, Accounting, Business Studies, Geography, History, Computer Science and more — thousands of papers organised by syllabus code, paper number and year.",
  },
  {
    question: "Do the papers include mark schemes?",
    answer:
      "Yes — where the mark scheme has been published it is available alongside the question paper, so you can mark your attempt exactly the way Cambridge examiners do.",
  },
  {
    question: "Can I read the papers on my phone without downloading?",
    answer:
      "Yes. StudySync opens every paper in an in-app reader that works on any phone, with pinch zoom and page navigation — plus an AI assistant you can ask about any question in the paper.",
  },
  {
    question: "I'm in Zimbabwe — does StudySync cover both Cambridge and ZIMSEC?",
    answer:
      "Yes. Many Zimbabwean learners write Cambridge (O/A Level or IGCSE) while others write ZIMSEC. StudySync carries both, and if a topic has no ZIMSEC paper yet, the library automatically shows the closest Cambridge equivalent.",
  },
  {
    question: "How much does it cost?",
    answer: `Create a free account to open the library — every account starts with a ${TRIAL_DURATION_DAYS}-day free trial, with papers filtered to your syllabus and level.`,
  },
  {
    question: "Can a tutor help me with Cambridge exam technique?",
    answer:
      "Yes. You can book verified online tutors who know the Cambridge syllabi and mark schemes to work through past papers with you question by question.",
  },
];

const CambridgePastPapersLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_past_papers_cambridge");
  }, []);

  return (
    <LandingPageLayout
      title="Cambridge Past Papers — IGCSE, O Level & A Level | StudySync"
      description="Practise Cambridge IGCSE, O Level and AS/A Level past exam papers with mark schemes — Maths, Sciences, English and more, sorted by subject, level and year."
      path="/past-papers/cambridge"
      faqs={FAQS}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Past Papers", path: "/past-papers" },
        { name: "Cambridge", path: "/past-papers/cambridge" },
      ]}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            For Cambridge International learners
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            Cambridge past papers &amp; mark schemes — IGCSE, O &amp; A Level
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Thousands of <strong>Cambridge IGCSE, O Level and AS/A Level past papers with mark
            schemes</strong>, organised by syllabus code, paper and year — readable in-app on any
            phone, with AI marking of your written answers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Open Cambridge papers free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tutoring">Get a Cambridge tutor</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {TRIAL_DURATION_DAYS}-day free trial · Mark schemes included · Updated regularly
          </p>
        </div>
      </section>

      {/* Subjects */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
            Cambridge subjects covered
          </h2>
          <p className="mb-8 max-w-2xl text-gray-600">
            The most practised Cambridge syllabi on StudySync, from IGCSE core papers to A Level.
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
          How to revise with Cambridge past papers
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
            <h2 className="text-lg font-semibold text-gray-900">Also useful for Cambridge learners</h2>
          </div>
          <ul className="grid gap-2 text-sm text-blue-700 sm:grid-cols-3">
            <li>
              <Link className="hover:underline" to="/past-papers/zimsec">
                ZIMSEC past papers O &amp; A Level
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/past-papers/maths">
                Maths past papers &amp; memos
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/tutoring/maths">
                Cambridge maths tutors online
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/exam-prep">
                Exam prep tools &amp; AI marking
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
          <h2 className="text-2xl font-bold text-white">Start your next Cambridge paper today</h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Create a free account, set your curriculum to Cambridge, and the library shows papers
            for your exact syllabus and level.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/learner/auth">Open the library</Link>
          </Button>
        </div>
      </section>
    </LandingPageLayout>
  );
};

export default CambridgePastPapersLanding;
