/**
 * /past-papers/business-studies — SEO landing page targeting
 * "business studies grade 12 past papers", "business studies past papers and memos",
 * "CAPS/NSC and IEB business studies exam papers".
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, FileText, GraduationCap, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRIAL_DURATION_DAYS } from "@/sail/types";
import { analytics } from "@/utils/analytics";
import LandingPageLayout, { type LandingFaq } from "@/components/landing/LandingPageLayout";

const TOPICS = [
  {
    name: "Business environments & ventures",
    detail:
      "Micro, market and macro environments, business sectors, forms of ownership and the legislation questions examiners pair with them.",
  },
  {
    name: "Business operations",
    detail:
      "Quality management, production planning and the functions questions — marketing, HR, financial and general management — set in the standard NSC Paper 2 format.",
  },
  {
    name: "Marketing & human resources",
    detail:
      "The marketing mix, consumer rights, recruitment, contracts and labour legislation — the case-study sections where structured answers score the marks.",
  },
  {
    name: "Management & leadership",
    detail:
      "Leadership styles, management tasks, team development, conflict resolution and the quality-of-performance questions that carry the essay marks.",
  },
  {
    name: "Business strategies & investment",
    detail:
      "SWOT and Porter's Five Forces, business strategies and investment options — the higher-order questions that separate a 5 from a 7.",
  },
  {
    name: "Ethics, CSR & exam technique",
    detail:
      "Professionalism, creative thinking, corporate social responsibility and how to structure the 40-mark essay and case-study answers examiners expect.",
  },
];

const STEPS = [
  { icon: GraduationCap, title: "Pick your curriculum and grade", text: "Choose CAPS/NSC or IEB and your grade — the library then shows Business Studies papers for what you actually write." },
  { icon: FileText, title: "Write a full paper under time", text: "Business Studies is a writing-speed subject. Work through a complete paper in exam conditions before you look at anything." },
  { icon: ListChecks, title: "Mark with the memo", text: "Use the memo or marking guideline to see exactly how examiners award marks for verbs like discuss, evaluate and recommend." },
  { icon: Sparkles, title: "Drill the weak topics", text: "AI StudyMode turns the sections you lost marks on — legislation, marketing, business operations — into targeted quizzes and flashcards." },
];

const FAQS: LandingFaq[] = [
  {
    question: "Where can I get Grade 12 Business Studies past papers and memos?",
    answer: `Create a free StudySync account and open the library, then filter to Business Studies and your grade. Every past paper link is checked before it is added, and the memo or marking guideline is linked alongside the paper where it has been published. Every account starts with a ${TRIAL_DURATION_DAYS}-day free trial.`,
  },
  {
    question: "Which grades and curriculums are covered?",
    answer:
      "Business Studies papers for Grade 10, 11 and 12 across CAPS/NSC (matric) and IEB, organised by grade, year and paper so you can work backwards from the most recent exam.",
  },
  {
    question: "How are Business Studies papers structured in matric?",
    answer:
      "NSC Grade 12 writes two papers: Paper 1 covers business environments and operations, Paper 2 covers business ventures and roles. Both mix multiple-choice, matching, direct questions, case studies and a 40-mark essay — so practising the memo's answer style matters as much as knowing the content.",
  },
  {
    question: "Do the Business Studies papers include marking guidelines?",
    answer:
      "Where the official memo or marking guideline has been published for a paper, it is linked next to it. Business Studies memos are especially useful because they show how marks split across facts, explanation and application in case-study and essay answers.",
  },
  {
    question: "What are the highest-mark Business Studies topics to revise?",
    answer:
      "The essay question (business environments, ventures or roles), legislation and its impact on business, marketing and human resources case studies, and management and leadership questions carry the most marks in Grade 12 papers.",
  },
  {
    question: "Can a tutor help me with Business Studies?",
    answer:
      "Yes. You can book a verified StudySync tutor who teaches Business Studies to work through a past paper with you and coach your essay and case-study technique against the marking guideline.",
  },
];

const BusinessStudiesPastPapersLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_past_papers_business_studies");
  }, []);

  return (
    <LandingPageLayout
      title="Business Studies Past Papers &amp; Memos — Grade 10-12"
      description="Grade 10, 11 and 12 Business Studies past papers with memos for CAPS/NSC matric and IEB — business environments, operations, marketing and management essays."
      path="/past-papers/business-studies"
      faqs={FAQS}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Past Papers", path: "/past-papers" },
        { name: "Business Studies", path: "/past-papers/business-studies" },
      ]}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            CAPS/NSC matric &amp; IEB · Grade 10–12
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            Business Studies past papers &amp; memos, sorted by grade and year
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Practise real <strong>Business Studies exam papers with memos and marking guidelines</strong>{" "}
            for Grade 10, 11 and 12 — business environments, operations, marketing, human resources
            and the essay section. Every link in the StudySync library is verified before it is added.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Open Business Studies papers free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tutoring">Get a Business Studies tutor</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {TRIAL_DURATION_DAYS}-day free trial · Memos where published · Updated regularly
          </p>
        </div>
      </section>

      {/* Topics */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
            Business Studies topics you can practise
          </h2>
          <p className="mb-8 max-w-2xl text-gray-600">
            Business Studies rewards structured, applied answers, so past papers are the fastest way
            to learn how examiners mark case studies and essays. These are the sections that carry
            the most marks.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {TOPICS.map((t) => (
              <div key={t.name} className="rounded-2xl border border-gray-200 bg-white p-6">
                <CheckCircle2 className="mb-3 h-6 w-6 text-blue-600" aria-hidden />
                <h3 className="mb-1.5 text-lg font-semibold text-gray-900">{t.name}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{t.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
          How to revise with Business Studies past papers
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
            <h2 className="text-lg font-semibold text-gray-900">Also useful for Business Studies learners</h2>
          </div>
          <ul className="grid gap-2 text-sm text-blue-700 sm:grid-cols-3">
            <li>
              <Link className="hover:underline" to="/past-papers">
                All past papers (ZIMSEC O &amp; A Level, Cambridge IGCSE, matric)
              </Link>
            </li>
            <li>
              <Link className="hover:underline" to="/past-papers/accounting">
                Accounting past papers &amp; memos
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
          <h2 className="text-2xl font-bold text-white">Start your next Business Studies paper today</h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Create a free account, set your curriculum and grade, and the library shows the
            Business Studies papers and memos for exactly what you write.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/learner/auth">Open the library</Link>
          </Button>
        </div>
      </section>
    </LandingPageLayout>
  );
};

export default BusinessStudiesPastPapersLanding;
