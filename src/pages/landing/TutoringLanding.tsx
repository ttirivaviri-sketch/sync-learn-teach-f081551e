/**
 * /tutoring — SEO landing page targeting "online tutors South Africa",
 * "maths tutor", "science tutor", "CAPS / IEB / Cambridge / ZIMSEC tutoring".
 *
 * Copy pulls real facts from the PRICING source of truth so claims never
 * drift from the product.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, CalendarClock, GraduationCap, MessageCircle, ShieldCheck, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRICING, TRIAL_DURATION_DAYS } from "@/sail/types";
import { analytics } from "@/utils/analytics";
import LandingPageLayout, { type LandingFaq } from "@/components/landing/LandingPageLayout";

const SUBJECTS = [
  "Mathematics", "Physical Sciences", "Life Sciences", "English", "Afrikaans",
  "Accounting", "Business Studies", "Economics", "Geography", "History",
  "Computer Science", "Combined Science",
];

const CURRICULA = [
  { name: "CAPS / NSC", detail: "South African national curriculum — Grade 8 to Grade 12, including matric (National Senior Certificate) exam prep and Grade 11 controlled tests." },
  { name: "IEB", detail: "Independent Examinations Board — Grade 12 matric support for independent-school learners, matched to IEB papers and marking guidelines." },
  { name: "Cambridge", detail: "IGCSE, O Level, AS Level and A Level tutoring aligned to Cambridge International syllabuses and mark schemes." },
  { name: "ZIMSEC", detail: "Zimbabwe School Examinations Council — Form 1 to Form 4 O Level and Lower/Upper 6 A Level tutoring, in line with ZIMSEC syllabuses." },
];

const FAQS: LandingFaq[] = [
  {
    question: "How much does a tutor cost on StudySync?",
    answer: `Tutor sessions are R${PRICING.tutor.perSession} per session, billed only for the sessions you book. There are no signup fees, and every new account starts with a ${TRIAL_DURATION_DAYS}-day free trial of the platform.`,
  },
  {
    question: "Are StudySync tutors verified?",
    answer: "Yes. Every tutor goes through identity and qualification verification before they can accept bookings, and learners can read reviews from previous sessions before choosing a tutor.",
  },
  {
    question: "Which curricula do StudySync tutors cover?",
    answer: "Tutors cover CAPS/NSC, IEB, Cambridge (IGCSE, O Level, AS and A Level) and ZIMSEC (O Level and A Level), from Grade 8 / Form 1 up to Grade 12 matric and Upper 6.",
  },
  {
    question: "Can I get a matric maths tutor for Grade 12?",
    answer: "Yes. Grade 12 matric Mathematics and Maths Literacy are the most requested subjects on StudySync, for both CAPS/NSC and IEB. Tutors work through past papers and memos with you and target the exam sections costing you marks.",
  },
  {
    question: "Do you have ZIMSEC O Level and A Level tutors in Zimbabwe?",
    answer: "Yes. Zimbabwean learners can book tutors for ZIMSEC O Level (Form 1 to Form 4) and A Level (Lower and Upper 6) in Maths, Combined Science, Sciences, English, Accounts, Commerce, Geography and History. Lessons are online, so location is not a limit.",
  },
  {
    question: "Are lessons online or in person?",
    answer: "Lessons run online with built-in video calling, so you can learn from anywhere in South Africa or Zimbabwe. You book times that suit your schedule directly in the app.",
  },
  {
    question: "Can I switch tutors if it's not a good fit?",
    answer: "Yes — you're never locked in. You can book a different tutor for your next session at any time, and our refund policy covers tutor cancellations and no-shows.",
  },
];

const TutoringLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_tutoring");
  }, []);

  return (
    <LandingPageLayout
      title="Online Tutors South Africa &amp; Zimbabwe — StudySync"
      description={`Book verified online tutors for Maths, Sciences, English and more. CAPS, IEB, Cambridge and ZIMSEC. R${PRICING.tutor.perSession} per session, ${TRIAL_DURATION_DAYS}-day free trial.`}
      path="/tutoring"
      faqs={FAQS}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Verified online tutoring
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            Find a verified online tutor in South Africa &amp; Zimbabwe
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            StudySync connects learners with verified tutors for Mathematics, Physical Sciences,
            English and more — across CAPS/NSC (Grade 8 to Grade 12 matric), IEB, Cambridge IGCSE,
            O Level and A Level, and ZIMSEC O Level and A Level. Sessions are{" "}
            <strong>R{PRICING.tutor.perSession} each</strong>, booked online at times that suit you,
            with no long-term contracts.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Find my tutor</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tutor/auth">Apply to tutor</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {TRIAL_DURATION_DAYS}-day free trial · Pay per session · Cancel anytime
          </p>
        </div>
      </section>

      {/* Why StudySync tutoring */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
            Why learners choose StudySync tutors
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: BadgeCheck, title: "Verified tutors", text: "Every tutor passes identity and qualification checks before teaching a single lesson." },
              { icon: Video, title: "Online sessions", text: "Built-in video lessons — no travel, no shared documents chaos. Learn from home." },
              { icon: CalendarClock, title: "Book on your schedule", text: "See tutor availability in real time and book slots that fit around school and sport." },
              { icon: ShieldCheck, title: "Fair refund policy", text: "Covered if a tutor cancels or doesn't show. You only pay for lessons that happen." },
              { icon: GraduationCap, title: "Curriculum-matched", text: "Tutors are matched to your exact curriculum and grade — CAPS, IEB, Cambridge or ZIMSEC." },
              { icon: MessageCircle, title: "AI StudyMode included", text: "Between lessons, practise with AI-generated quizzes, flashcards and past-paper drills." },
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

      {/* Subjects */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
          Tutoring for every major subject
        </h2>
        <p className="mb-8 max-w-2xl text-gray-600">
          From foundation concepts to final exam preparation, book a tutor for the subjects that
          matter most to your results.
        </p>
        <p className="mb-8 max-w-2xl text-gray-600">
          Looking for maths specifically? See our dedicated{" "}
          <Link to="/tutoring/maths" className="font-medium text-blue-600 hover:underline">
            online maths tutor page
          </Link>{" "}
          for CAPS/NSC, IEB, Cambridge and ZIMSEC Mathematics and Maths Literacy.
        </p>
        <ul className="flex flex-wrap gap-2.5">
          {SUBJECTS.map((s) => (
            <li key={s} className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
              {s}
            </li>
          ))}
        </ul>
      </section>

      {/* Curricula */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
            Support for your exact curriculum
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {CURRICULA.map((c) => (
              <div key={c.name} className="rounded-2xl border border-gray-200 bg-white p-6">
                <h3 className="mb-1.5 text-lg font-semibold text-gray-900">{c.name}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{c.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl bg-blue-600 p-8 text-center sm:p-10">
            <h2 className="text-2xl font-bold text-white">Ready to improve your marks?</h2>
            <p className="mx-auto mt-2 max-w-xl text-blue-100">
              Create a free account, tell us your curriculum and subjects, and get matched with a
              verified tutor today.
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

export default TutoringLanding;
