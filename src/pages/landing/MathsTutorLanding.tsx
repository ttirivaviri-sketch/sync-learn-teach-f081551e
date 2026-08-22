/**
 * /tutoring/maths — SEO landing page targeting "maths tutor" (SA, ~1k monthly
 * searches, low difficulty) plus "maths tutor near me", "grade 12 maths tutor",
 * "matric maths tutor", "maths literacy tutor" and ZIMSEC/Cambridge variants.
 *
 * All product claims come from the PRICING source of truth so copy can't drift.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, CalendarClock, Calculator, FileText, ShieldCheck, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRICING, TRIAL_DURATION_DAYS } from "@/sail/types";
import { analytics } from "@/utils/analytics";
import LandingPageLayout, { type LandingFaq } from "@/components/landing/LandingPageLayout";

const TOPICS = [
  "Algebra & equations", "Functions & graphs", "Trigonometry", "Euclidean geometry",
  "Analytical geometry", "Calculus & differentiation", "Financial maths", "Probability",
  "Statistics & data handling", "Sequences & series", "Number patterns", "Measurement",
];

const CURRICULA = [
  {
    name: "CAPS / NSC — Grade 8 to Grade 12 matric",
    detail:
      "Mathematics and Mathematical Literacy for the South African national curriculum. Tutors work through Paper 1 (algebra, functions, calculus, finance) and Paper 2 (geometry, trigonometry, statistics) using NSC past papers and memos.",
  },
  {
    name: "IEB — Grade 12 matric maths",
    detail:
      "Independent Examinations Board Mathematics and Maths Literacy for independent-school learners, matched to IEB question styles and marking guidelines.",
  },
  {
    name: "Cambridge — IGCSE, O Level, AS & A Level",
    detail:
      "Cambridge International Mathematics (0580), Additional Maths, and AS/A Level Pure Maths, Mechanics and Statistics, aligned to the current syllabuses and mark schemes.",
  },
  {
    name: "ZIMSEC — O Level & A Level",
    detail:
      "ZIMSEC Mathematics for Form 1 to Form 4 O Level and Pure Maths & Statistics for Lower and Upper 6, following ZIMSEC syllabuses and past exam papers.",
  },
];

const FAQS: LandingFaq[] = [
  {
    question: "How much does a maths tutor cost in South Africa on StudySync?",
    answer: `Maths tutoring is R${PRICING.tutor.perSession} per session on StudySync, billed per session you book. There is no signup fee and no monthly contract, and every new account gets a ${TRIAL_DURATION_DAYS}-day free trial of the study tools.`,
  },
  {
    question: "Can I find a maths tutor near me?",
    answer:
      "StudySync maths lessons run online with built-in video, so you're not limited to tutors in your suburb or town. Learners anywhere in South Africa or Zimbabwe can book any available maths tutor on the platform.",
  },
  {
    question: "Do you have Grade 12 matric maths tutors?",
    answer:
      "Yes. Grade 12 matric Mathematics and Mathematical Literacy are the most-booked subjects on StudySync, for both CAPS/NSC and IEB. Sessions focus on past papers, memos and the exam sections that are costing you marks.",
  },
  {
    question: "Do you tutor Maths Literacy as well as pure Mathematics?",
    answer:
      "Yes. Tutors cover both Mathematical Literacy (finance, measurement, maps and plans, data handling) and pure Mathematics (algebra, functions, trigonometry, geometry, calculus).",
  },
  {
    question: "Which maths topics can a tutor help with?",
    answer:
      "Algebra and equations, functions and graphs, trigonometry, Euclidean and analytical geometry, calculus, financial maths, sequences and series, probability and statistics — from foundation gaps right up to final exam prep.",
  },
  {
    question: "Are the maths tutors verified?",
    answer:
      "Every tutor completes identity and qualification verification before they can accept a booking, and you can read reviews from previous learners before choosing who to book.",
  },
  {
    question: "What happens between maths lessons?",
    answer:
      "Your account includes AI StudyMode, which generates practice quizzes, flashcards and past-paper drills for the exact maths topics you're working on, so you keep practising between sessions.",
  },
];

const MathsTutorLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_tutoring_maths");
  }, []);

  return (
    <LandingPageLayout
      title="Maths Tutor Online — Grade 12, IEB, Cambridge, ZIMSEC"
      description={`Book a verified online maths tutor for CAPS/NSC Grade 12 matric, IEB, Cambridge IGCSE/A Level and ZIMSEC. R${PRICING.tutor.perSession} per session, ${TRIAL_DURATION_DAYS}-day free trial.`}
      path="/tutoring/maths"
      faqs={FAQS}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Verified maths tutoring online
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            Find a maths tutor for CAPS, IEB, Cambridge and ZIMSEC
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Book a verified online <strong>maths tutor</strong> for Mathematics and Mathematical
            Literacy — from Grade 8 foundations to Grade 12 matric (CAPS/NSC and IEB), Cambridge
            IGCSE, O Level and A Level, and ZIMSEC O Level and A Level. Lessons are{" "}
            <strong>R{PRICING.tutor.perSession} per session</strong>, booked at times that suit
            you, with no long-term contract.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Book a maths tutor</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/past-papers">Practise maths past papers</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {TRIAL_DURATION_DAYS}-day free trial · Pay per session · Online, anywhere in SA &amp; Zimbabwe
          </p>
        </div>
      </section>

      {/* Why */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
            Why learners book maths tutors on StudySync
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: BadgeCheck, title: "Verified maths tutors", text: "Identity and qualification checks are completed before any tutor can teach a lesson." },
              { icon: Calculator, title: "Topic-by-topic help", text: "Start from the exact topic you're stuck on — algebra, trig, geometry or calculus — not a generic syllabus recap." },
              { icon: FileText, title: "Past papers & memos", text: "Work through real NSC, IEB, Cambridge and ZIMSEC maths papers with a tutor marking your method." },
              { icon: Video, title: "Online video lessons", text: "Learn from home with built-in video and a shared workspace for working through problems." },
              { icon: CalendarClock, title: "Book around school", text: "See live tutor availability and book 30-minute slots that fit around school and sport." },
              { icon: ShieldCheck, title: "Fair refund policy", text: "Covered if a tutor cancels or doesn't show — you only pay for lessons that actually happen." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-gray-200 bg-white p-6">
                <Icon className="mb-3 h-6 w-6 text-blue-600" aria-hidden />
                <h3 className="mb-1.5 text-base font-semibold text-gray-900">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Topics */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
          Maths topics tutors cover
        </h2>
        <p className="mb-8 max-w-2xl text-gray-600">
          Whether you need to close a Grade 9 algebra gap or push a matric mark from 50% to a
          distinction, sessions start with the topics costing you the most marks.
        </p>
        <ul className="flex flex-wrap gap-2.5">
          {TOPICS.map((t) => (
            <li key={t} className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* Curricula */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
            Maths tutoring for your exact curriculum
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {CURRICULA.map((c) => (
              <div key={c.name} className="rounded-2xl border border-gray-200 bg-white p-6">
                <h3 className="mb-1.5 text-lg font-semibold text-gray-900">{c.name}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{c.detail}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm text-gray-600">
            Need another subject? See all{" "}
            <Link to="/tutoring" className="font-medium text-blue-600 hover:underline">
              online tutors on StudySync
            </Link>
            , download{" "}
            <Link to="/past-papers" className="font-medium text-blue-600 hover:underline">
              past exam papers and memos
            </Link>{" "}
            or browse{" "}
            <Link to="/books" className="font-medium text-blue-600 hover:underline">
              free textbooks and study guides
            </Link>
            .
          </p>

          <div className="mt-10 rounded-2xl bg-blue-600 p-8 text-center sm:p-10">
            <h2 className="text-2xl font-bold text-white">Ready to fix your maths marks?</h2>
            <p className="mx-auto mt-2 max-w-xl text-blue-100">
              Create a free account, choose your curriculum and grade, and book a verified maths
              tutor for your next session.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-6">
              <Link to="/learner/auth">Start your free trial</Link>
            </Button>
          </div>
        </div>
      </section>
    </LandingPageLayout>
  );
};

export default MathsTutorLanding;
