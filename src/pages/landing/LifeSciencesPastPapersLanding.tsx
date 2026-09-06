/**
 * /past-papers/life-sciences — SEO landing page targeting the South African
 * Life Sciences past-paper search cluster: "life sciences grade 12 past
 * papers", "life science past papers", "life sciences grade 11 past papers
 * and memos", "life sciences paper 1", grade 10 variants and downloads —
 * the sibling cluster to Physical Sciences, similar volume in SA.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, Dna, FileText, GraduationCap, Leaf, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRIAL_DURATION_DAYS } from "@/sail/types";
import { analytics } from "@/utils/analytics";
import LandingPageLayout, { type LandingFaq } from "@/components/landing/LandingPageLayout";

const PAPERS = [
  {
    icon: Dna,
    name: "Paper 1 — Life processes & environment",
    detail:
      "Meiosis, reproduction in vertebrates, human reproduction, responding to the environment (nervous system, senses, hormones), homeostasis and human endocrine system — the full NSC Paper 1 scope with official memos.",
  },
  {
    icon: Leaf,
    name: "Paper 2 — Genetics, evolution & DNA",
    detail:
      "DNA: code of life, meiosis and genetics, genetic engineering, evolution by natural selection, human evolution and cladograms — practised against the real NSC Paper 2 format and mark allocations.",
  },
];

const GRADES = [
  {
    name: "Grade 12 Life Sciences past papers",
    detail:
      "The full set of NSC final and supplementary papers with memoranda — November and June sittings by year. The fastest way to learn how examiners phrase genetics crosses, essay questions and data interpretation.",
  },
  {
    name: "Grade 11 Life Sciences past papers",
    detail:
      "Grade 11 papers with memos: biodiversity of plants and animals, photosynthesis, respiration, gaseous exchange, excretion and population ecology — content the matric paper assumes.",
  },
  {
    name: "Grade 10 Life Sciences past papers",
    detail:
      "Grade 10 exam papers and memos covering the chemistry of life, cells, plant and animal tissues, transport systems and biosphere basics — the foundation years.",
  },
  {
    name: "Controlled tests & June exams",
    detail:
      "Mid-year and term papers alongside the finals, so you can practise the long-essay technique and data questions under time pressure throughout the year.",
  },
];

const STEPS = [
  { icon: GraduationCap, title: "Set your curriculum to CAPS/NSC", text: "Choose CAPS and your grade when you sign up — the library filters straight to Life Sciences papers for your grade." },
  { icon: FileText, title: "Write Paper 1 or Paper 2 under exam conditions", text: "Time yourself against the real two-and-a-half-hour paper, including the mini-essay — timing is where most marks are lost." },
  { icon: ListChecks, title: "Mark with the official memo", text: "The memoranda show exactly how markers award marks for terminology, genetics crosses and essay structure — mark your own work the same way." },
  { icon: Sparkles, title: "Turn lost marks into practice", text: "AI StudyMode converts the questions you got wrong into targeted quizzes and flashcards — from monohybrid crosses to nitrogen cycle detail." },
];

const FAQS: LandingFaq[] = [
  {
    question: "Where can I get Life Sciences past papers with memos?",
    answer:
      "StudySync's library has Life Sciences past exam papers for Grade 10, 11 and 12 with official marking memoranda where published. Create a free account, set your curriculum to CAPS/NSC, and filter to Life Sciences for your grade — every link is verified before it's added.",
  },
  {
    question: "What is the difference between Life Sciences Paper 1 and Paper 2?",
    answer:
      "Paper 1 covers life processes: reproduction, the nervous and endocrine systems, and homeostasis. Paper 2 covers DNA, meiosis, genetics and inheritance, and evolution. Both are two-and-a-half-hour, 150-mark NSC papers.",
  },
  {
    question: "Are Grade 10 and Grade 11 Life Sciences papers included?",
    answer:
      "Yes. The library covers Grade 10 to Grade 12 Life Sciences. Grade 11 content — photosynthesis, respiration, gaseous exchange and population ecology — is assumed knowledge in the matric paper, so practising those papers directly lifts Grade 12 marks.",
  },
  {
    question: "How do I answer the Life Sciences essay question?",
    answer:
      "The mini-essay is marked for content, synthesis and logical sequence. Practising past essays with the memo teaches the structure markers reward: relevant facts grouped logically, linked to the question, with no contradictions. StudySync tutors can mark your practice essays against the official rubric.",
  },
  {
    question: "Do the papers cover both IEB and NSC (DBE) Life Sciences?",
    answer:
      "The library focuses on NSC (DBE/CAPS) papers, and IEB learners are covered on the dedicated IEB past papers page. The core content overlaps heavily, so NSC papers remain excellent practice for IEB candidates too.",
  },
  {
    question: "How much do Life Sciences past papers cost on StudySync?",
    answer: `Create a free StudySync account to open the library — every account starts with a ${TRIAL_DURATION_DAYS}-day free trial, and you can filter straight to Life Sciences papers for your grade.`,
  },
  {
    question: "Can a tutor help me work through Life Sciences papers?",
    answer:
      "Yes. You can book a verified StudySync Life Sciences tutor to work through a past paper with you online — especially useful for genetics problems, data-response questions and essay technique.",
  },
];

const LifeSciencesPastPapersLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_past_papers_life_sciences");
  }, []);

  return (
    <LandingPageLayout
      title="Life Sciences Past Papers & Memos — Grade 10-12"
      description="Practise Life Sciences past exam papers with memos — Grade 10, 11 and 12 NSC Paper 1 and Paper 2, from genetics to human physiology, sorted by grade and year."
      path="/past-papers/life-sciences"
      faqs={FAQS}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Past Papers", path: "/past-papers" },
        { name: "Life Sciences", path: "/past-papers/life-sciences" },
      ]}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            For South African Grade 10–12 learners
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            Life Sciences past papers &amp; memos — Grade 10, 11 &amp; 12
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            From genetics crosses to the mini-essay, Life Sciences marks come from exam practice.{" "}
            <strong>NSC Paper 1 and Paper 2 past exam papers with official memos</strong> —
            verified links, filtered to your exact grade, from Grade 10 foundations to the final
            matric paper.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Open Life Sciences papers free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tutoring">Get a Life Sciences tutor</Link>
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
            Paper 1 and Paper 2 — both covered
          </h2>
          <p className="mb-8 max-w-2xl text-gray-600">
            Life Sciences is two two-and-a-half-hour, 150-mark papers with different content.
            Practising each in its real format — including the mini-essay — is what turns content
            knowledge into marks.
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
          How to revise Life Sciences with past papers
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
              Also useful for Life Sciences learners
            </h2>
          </div>
          <ul className="grid gap-2 text-sm text-blue-700 sm:grid-cols-3">
            <li>
              <Link className="hover:underline" to="/past-papers/physical-sciences">
                Physical Sciences past papers &amp; memos
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
          </ul>
        </div>

        <div className="mt-12 rounded-2xl bg-blue-600 p-8 text-center sm:p-10">
          <h2 className="text-2xl font-bold text-white">
            Start your next Life Sciences paper today
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Create a free account, set your curriculum to CAPS, and the library shows Life
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

export default LifeSciencesPastPapersLanding;
