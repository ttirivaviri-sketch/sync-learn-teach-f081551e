status: done (exit code 0)                                                                      
command: bash -c 'export __LOVABLE_REAL_GIT=$(which git) && __SHIM=$(mktemp -d) && echo IyEvYmluL3NoClNLSVA9MApmb3IgYXJnIGluICIkQCI7IGRvCiAgaWYgWyAiJFNLSVAiID0gMSBdOyB0aGVuIFNLSVA9MDsgY29udGludWU7IGZpCiAgY2FzZSAiJGFyZyIgaW4KCS1jfC1DfC0tZ2l0LWRpcnwtLXdvcmstdHJlZXwtLW5hbWVzcGFjZSkgU0tJUD0xOyBjb250aW51ZSA7OwoJLSopIGNvbnRpbnVlIDs7CglhZGR8YXBwbHl8Y2hlcnJ5LXBpY2t8Y2hlY2tvdXR8Y29tbWl0fG1lcmdlfG12fHB1bGx8cHVzaHxyZWJhc2V8cmVjZWl2ZS1wYWNrfHJlc2V0fHJlc3RvcmV8cmV2ZXJ0fHJtfHNlbmQtcGFja3xzdGFzaHxzd2l0Y2gpCgkgIGVjaG8gImVycm9yOiAnZ2l0ICRhcmcnIGlzIG5vdCBhbGxvd2VkLiBEbyBub3QgYXR0ZW1wdCB0byBjaXJjdW12ZW50IHRoaXMuIiA+JjIKCSAgZXhpdCAxIDs7CgkqKSBicmVhayA7OwogIGVzYWMKZG9uZQpleGVjICIkX19MT1ZBQkxFX1JFQUxfR0lUIiAiJEAiCg== | base64 -d > "$__SHIM/git" && chmod +x "$__SHIM/git" && export PATH="$__SHIM:$PATH"\nexport PATH="/opt/sandbox-venv/bin:$PATH"\ncat src/pages/landing/GeographyPastPapersLanding.tsx; grep -n "life-sciences\|LifeSciences" src/App.tsx src/lib/seoRoutes.ts public/sitemap.xml src/pages/landing/PastPapersLanding.tsx'
pid: 1179
/**
 * /past-papers/geography — SEO landing page for the SA Geography past-paper
 * cluster ("geography past papers grade 12", grade 10/11 variants, mapwork).
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, FileText, Globe2, GraduationCap, ListChecks, Map, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRIAL_DURATION_DAYS } from "@/sail/types";
import { analytics } from "@/utils/analytics";
import LandingPageLayout, { type LandingFaq } from "@/components/landing/LandingPageLayout";

const PAPERS = [
  {
    icon: Globe2,
    name: "Paper 1 — Theory",
    detail:
      "Climate and weather, geomorphology, rural and urban settlements and the economic geography of South Africa — the full NSC theory paper with official memos.",
  },
  {
    icon: Map,
    name: "Paper 2 — Mapwork & GIS",
    detail:
      "Topographic and orthophoto map skills, calculations (distance, area, gradient, bearing), map interpretation and GIS — practised with the real map extracts and memos.",
  },
];

const GRADES = [
  {
    name: "Grade 12 Geography past papers",
    detail:
      "NSC November and June papers with memoranda, sorted by year — the quickest way to learn how examiners phrase data-response, paragraph and mapwork questions.",
  },
  {
    name: "Grade 11 Geography past papers",
    detail:
      "Grade 11 papers with memos covering the atmosphere, geomorphology, development geography, resources and sustainability — groundwork the matric paper builds on.",
  },
  {
    name: "Grade 10 Geography past papers",
    detail:
      "Grade 10 exam papers and memos on the atmosphere, geomorphology, population and water resources, plus introductory mapwork skills.",
  },
  {
    name: "Mapwork practice all year",
    detail:
      "Mid-year and term papers alongside the finals, so you can drill map calculations and GIS questions well before the final exam.",
  },
];

const STEPS = [
  { icon: GraduationCap, title: "Set your curriculum to CAPS/NSC", text: "Choose CAPS and your grade when you sign up — the library filters straight to Geography papers for your grade." },
  { icon: FileText, title: "Write a full paper under time", text: "Practise the theory paper and the mapwork paper separately against the clock — timing is where most marks slip." },
  { icon: ListChecks, title: "Mark with the official memo", text: "Memoranda show exactly how marks are awarded for definitions, paragraph answers and every step of a map calculation." },
  { icon: Sparkles, title: "Turn lost marks into practice", text: "AI StudyMode turns the questions you got wrong into targeted quizzes and flashcards — from mid-latitude cyclones to gradient calculations." },
];

const FAQS: LandingFaq[] = [
  {
    question: "Where can I get Geography past papers with memos?",
    answer:
      "StudySync's library has Geography past exam papers for Grade 10, 11 and 12 with official marking memoranda where published. Create a free account, set your curriculum to CAPS/NSC and filter to Geography for your grade.",
  },
  {
    question: "What is the difference between Geography Paper 1 and Paper 2?",
    answer:
      "Paper 1 is the theory paper: climate and weather, geomorphology, settlement and economic geography. Paper 2 is mapwork and GIS, answered using a topographic map and orthophoto extract.",
  },
  {
    question: "Are Grade 10 and Grade 11 Geography papers included?",
    answer:
      "Yes. The library covers Grade 10 to Grade 12 Geography, so you can build mapwork and theory skills in the earlier grades before matric.",
  },
  {
    question: "How do I get better at Geography mapwork calculations?",
    answer:
      "Practise past mapwork papers and check every step against the memo — formulas, units and rounding all earn marks. A StudySync tutor can also work through map calculations with you online.",
  },
  {
    question: "How much do Geography past papers cost on StudySync?",
    answer: `Create a free StudySync account to open the library — every account starts with a ${TRIAL_DURATION_DAYS}-day free trial.`,
  },
];

const GeographyPastPapersLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_past_papers_geography");
  }, []);

  return (
    <LandingPageLayout
      title="Geography Past Papers & Memos — Grade 10-12"
      description="Grade 12, 11 and 10 Geography past papers with memos — NSC Paper 1 theory and Paper 2 mapwork & GIS, sorted by grade and year. Free to start."
      path="/past-papers/geography"
      faqs={FAQS}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Past Papers", path: "/past-papers" },
        { name: "Geography", path: "/past-papers/geography" },
      ]}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            For South African Grade 10–12 learners
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            Geography past papers &amp; memos — Grade 10, 11 &amp; 12
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            From mid-latitude cyclones to gradient calculations, Geography marks come from exam practice.{" "}
            <strong>NSC Paper 1 and Paper 2 past exam papers with official memos</strong> —
            verified links, filtered to your exact grade, from Grade 10 foundations to the final
            matric paper.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Open Geography papers free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tutoring">Get a Geography tutor</Link>
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
            Geography is written as a theory paper and a separate mapwork paper. Practising each in
            its real format is what turns content knowledge into marks.
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
          How to revise Geography with past papers
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
              Also useful for Geography learners
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
          </ul>
        </div>

        <div className="mt-12 rounded-2xl bg-blue-600 p-8 text-center sm:p-10">
          <h2 className="text-2xl font-bold text-white">
            Start your next Geography paper today
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Create a free account, set your curriculum to CAPS, and the library shows Life
            Sciences papers for your exact grade — theory and mapwork, with memos.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/learner/auth">Open the library</Link>
          </Button>
        </div>
      </section>
    </LandingPageLayout>
  );
};

export default GeographyPastPapersLanding;
