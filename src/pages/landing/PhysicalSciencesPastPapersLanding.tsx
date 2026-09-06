/**
 * /past-papers/physical-sciences — SEO landing page targeting the South
 * African Physical Sciences past-paper search cluster (~1,590 combined
 * monthly searches per Semrush): "physical sciences grade 12 past papers",
 * "physical science past papers", "physical sciences grade 11 past papers
 * and memos", "physical sciences paper 1", "grade 10 physical science exam
 * papers" and download variants.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Atom, BookOpen, CheckCircle2, FileText, FlaskConical, GraduationCap, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRIAL_DURATION_DAYS } from "@/sail/types";
import { analytics } from "@/utils/analytics";
import LandingPageLayout, { type LandingFaq } from "@/components/landing/LandingPageLayout";

const PAPERS = [
  {
    icon: Atom,
    name: "Paper 1 — Physics",
    detail:
      "Mechanics (Newton's laws, momentum, work-energy-power), waves and sound, electricity and magnetism, electrodynamics, photons and matter — the full NSC Physics paper with official memos to mark method and accuracy the way markers do.",
  },
  {
    icon: FlaskConical,
    name: "Paper 2 — Chemistry",
    detail:
      "Matter and materials, chemical bonding, intermolecular forces, chemical change (stoichiometry, energy, rates, equilibrium), acids and bases, electrochemistry and organic chemistry — practised against the real NSC Paper 2 format.",
  },
];

const GRADES = [
  {
    name: "Grade 12 Physical Sciences past papers",
    detail:
      "The full set of NSC final and supplementary papers with memos — the single most effective revision resource before the matric exam. Practise November and June papers by year.",
  },
  {
    name: "Grade 11 Physical Sciences past papers",
    detail:
      "Grade 11 papers with memos covering vectors, newton's laws, electrostatics, electric circuits, quantitative chemistry and more — build exam technique a year early.",
  },
  {
    name: "Grade 10 Physical Sciences past papers",
    detail:
      "Grade 10 exam papers and memos: motion, energy, the periodic table, chemical bonding and reactions — the foundation the matric paper builds on.",
  },
  {
    name: "Controlled tests & June exams",
    detail:
      "Mid-year and term papers alongside the finals, so you can practise under time pressure throughout the year rather than only before November.",
  },
];

const STEPS = [
  { icon: GraduationCap, title: "Set your curriculum to CAPS/NSC", text: "Choose CAPS and your grade when you sign up — the library then filters straight to Physical Sciences papers for your grade." },
  { icon: FileText, title: "Write Paper 1 or Paper 2 under exam conditions", text: "Time yourself against the real three-hour paper. Keep the data sheet handy, exactly as in the exam." },
  { icon: ListChecks, title: "Mark with the official memo", text: "The memoranda show where markers award marks for formulas, substitution and answers — learn to bank method marks even when the final answer slips." },
  { icon: Sparkles, title: "Turn lost marks into practice", text: "AI StudyMode converts the questions you got wrong into targeted quizzes and flashcards on those exact concepts — from Doppler effect to titration calculations." },
];

const FAQS: LandingFaq[] = [
  {
    question: "Where can I get Physical Sciences past papers with memos?",
    answer:
      "StudySync's library has Physical Sciences past exam papers for Grade 10, 11 and 12 with official marking memoranda where published. Create a free account, set your curriculum to CAPS/NSC, and filter to Physical Sciences for your grade — every link is verified before it's added.",
  },
  {
    question: "What is the difference between Physical Sciences Paper 1 and Paper 2?",
    answer:
      "Paper 1 covers Physics: mechanics, waves, sound and light, electricity, magnetism and electrodynamics. Paper 2 covers Chemistry: matter and materials, chemical change, rates, equilibrium, acids and bases, and organic chemistry. Both are three-hour, 150-mark NSC papers.",
  },
  {
    question: "Are Grade 10 and Grade 11 Physical Sciences papers included?",
    answer:
      "Yes. The library covers Grade 10 to Grade 12 Physical Sciences, so you can build exam technique from Grade 10 instead of starting in the matric year. Grade 11 papers are especially valuable because the matric paper assumes that content.",
  },
  {
    question: "How should I use past papers to improve my Physical Sciences marks?",
    answer:
      "Write a full paper under timed exam conditions, then mark it strictly with the official memo. Note every question where you lost marks and drill those topics before attempting the next paper. Marks in Physical Sciences come from formula selection, substitution and units — the memo shows exactly how they're awarded.",
  },
  {
    question: "Do the papers cover both IEB and NSC (DBE) Physical Sciences?",
    answer:
      "The library focuses on NSC (DBE/CAPS) papers, and IEB learners are covered on the dedicated IEB past papers page. The core content overlaps heavily, so NSC papers remain excellent practice for IEB candidates too.",
  },
  {
    question: "How much do Physical Sciences past papers cost on StudySync?",
    answer: `Create a free StudySync account to open the library — every account starts with a ${TRIAL_DURATION_DAYS}-day free trial, and you can filter straight to Physical Sciences papers for your grade.`,
  },
  {
    question: "Can a tutor help me work through Physical Sciences papers?",
    answer:
      "Yes. You can book a verified StudySync Physical Sciences tutor to work through a past paper with you online, question by question, and explain the memo's reasoning — especially useful for multi-step mechanics and stoichiometry problems.",
  },
];

const PhysicalSciencesPastPapersLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_past_papers_physical_sciences");
  }, []);

  return (
    <LandingPageLayout
      title="Physical Sciences Past Papers & Memos — Grade 10-12"
      description="Practise Physical Sciences past exam papers with memos — Grade 10, 11 and 12 NSC Paper 1 (Physics) and Paper 2 (Chemistry), sorted by grade and year."
      path="/past-papers/physical-sciences"
      faqs={FAQS}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Past Papers", path: "/past-papers" },
        { name: "Physical Sciences", path: "/past-papers/physical-sciences" },
      ]}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            For South African Grade 10–12 learners
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            Physical Sciences past papers &amp; memos — Grade 10, 11 &amp; 12
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Every mark in Physical Sciences is earned with practice.{" "}
            <strong>NSC Paper 1 (Physics) and Paper 2 (Chemistry) past exam papers with official
            memos</strong> — verified links, filtered to your exact grade, from Grade 10
            foundations to the final matric paper.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Open Physical Sciences papers free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tutoring">Get a Physical Sciences tutor</Link>
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
            Physics Paper 1 and Chemistry Paper 2 — both covered
          </h2>
          <p className="mb-8 max-w-2xl text-gray-600">
            Physical Sciences is two three-hour, 150-mark papers. Practising each in its real
            format — with the data sheet — is what turns content knowledge into marks.
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
          How to revise Physical Sciences with past papers
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
            <h2 className="text-lg font-semibold text-gray-900">
              Also useful for Physical Sciences learners
            </h2>
          </div>
          <ul className="grid gap-2 text-sm text-blue-700 sm:grid-cols-3">
            <li>
              <Link className="hover:underline" to="/past-papers/life-sciences">
                Life Sciences past papers &amp; memos
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
              <Link className="hover:underline" to="/tutoring/maths">
                Grade 12 maths tutors online
              </Link>
            </li>
          </ul>
        </div>

        <div className="mt-12 rounded-2xl bg-blue-600 p-8 text-center sm:p-10">
          <h2 className="text-2xl font-bold text-white">
            Start your next Physical Sciences paper today
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Create a free account, set your curriculum to CAPS, and the library shows Physical
            Sciences papers for your exact grade — Paper 1 and Paper 2, with memos.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/learner/auth">Open the library</Link>
          </Button>
        </div>
      </section>
    </LandingPageLayout>
  );
};

export default PhysicalSciencesPastPapersLanding;
