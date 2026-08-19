/**
 * /books — SEO landing page targeting "free textbooks", "OpenStax textbooks",
 * "set work novels", "study guides South Africa / Zimbabwe".
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, BookMarked, Library, PlayCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRIAL_DURATION_DAYS } from "@/sail/types";
import { analytics } from "@/utils/analytics";
import LandingPageLayout, { type LandingFaq } from "@/components/landing/LandingPageLayout";

const COLLECTIONS = [
  {
    icon: BookOpen,
    name: "Free openly licensed textbooks",
    detail:
      "Peer-reviewed OpenStax textbooks for Maths, Physics, Chemistry, Biology, Economics, Business and more — full PDFs for Grade 10–12 / Form 4 and A Level, free to read, legally licensed.",
  },
  {
    icon: BookMarked,
    name: "Set-work novels & literature",
    detail:
      "Classic novels and plays studied for English literature — from Animal Farm to Things Fall Apart era classics — via Project Gutenberg's public-domain library.",
  },
  {
    icon: Library,
    name: "Syllabi & study guides",
    detail:
      "Official syllabus documents and curriculum-aligned guides for CAPS/NSC, IEB, Cambridge IGCSE / O Level / A Level and ZIMSEC O & A Level so you always know exactly what your exam expects.",
  },
  {
    icon: PlayCircle,
    name: "Topic video clips",
    detail:
      "Short, curriculum-matched explainer videos from trusted education channels, linked to the exact topics in your subjects.",
  },
];

const FAQS: LandingFaq[] = [
  {
    question: "Are the textbooks on StudySync really free?",
    answer: "Yes. The library links to openly licensed textbooks (such as OpenStax, licensed under Creative Commons) and public-domain novels from Project Gutenberg. They are legally free to read and download from their publishers.",
  },
  {
    question: "Which subjects have textbooks and study guides?",
    answer: "Mathematics, Physics, Chemistry, Biology, Economics, Business Studies, Accounting, English and more — organised for CAPS/NSC Grade 10–12 matric, IEB, Cambridge IGCSE / O Level / A Level and ZIMSEC O & A Level learners by grade and level.",
  },
  {
    question: "Do you have the set-work novels for English literature?",
    answer: "The library includes classic public-domain novels and plays commonly studied for English literature, readable free via Project Gutenberg, alongside study notes support in AI StudyMode.",
  },
  {
    question: "Is this legal? Who owns the content?",
    answer: "StudySync links to openly licensed and public-domain sources and credits the original publishers. We don't claim ownership of third-party material, and rights holders can request removal through our copyright policy.",
  },
  {
    question: "How do I access the library?",
    answer: `Create a free StudySync account — every account starts with a ${TRIAL_DURATION_DAYS}-day free trial. The library filters to your curriculum and grade, so you only see books relevant to your studies.`,
  },
];

const BooksLanding = () => {
  useEffect(() => {
    analytics.pageView("landing_books");
  }, []);

  return (
    <LandingPageLayout
      title="Free Textbooks, Set Works & Study Guides | StudySync"
      description="Free openly licensed textbooks, set-work novels and study guides for CAPS/NSC Grade 10–12, IEB, Cambridge IGCSE/A Level and ZIMSEC O & A Level."
      path="/books"
      faqs={FAQS}
    >
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            The study library
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
            Free textbooks, novels &amp; study guides in one library
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Textbooks are expensive — good ones don't have to be. StudySync curates{" "}
            <strong>openly licensed textbooks</strong>, <strong>public-domain set-work novels</strong>{" "}
            and study guides for CAPS/NSC Grade 10–12 matric, IEB, Cambridge IGCSE, O Level &amp; A Level and ZIMSEC O &amp; A Level — organised by your subject and grade.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/learner/auth">Open the library free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/past-papers">See past papers too</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {TRIAL_DURATION_DAYS}-day free trial · Legally licensed sources · Curriculum-organised
          </p>
        </div>
      </section>

      {/* Collections */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
            What's in the StudySync library
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {COLLECTIONS.map(({ icon: Icon, name, detail }) => (
              <div key={name} className="rounded-2xl border border-gray-200 bg-white p-6">
                <Icon className="mb-3 h-6 w-6 text-blue-600" aria-hidden />
                <h3 className="mb-1.5 text-lg font-semibold text-gray-900">{name}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust note + CTA */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-2xl font-bold text-gray-900 sm:text-3xl">
              Legally sourced, properly credited
            </h2>
            <p className="leading-relaxed text-gray-600">
              Every book in the library comes from an openly licensed or public-domain source —
              publishers like OpenStax (Creative Commons) and Project Gutenberg. We credit the
              original source on every resource, verify each link before adding it, and honour
              takedown requests from rights holders.
            </p>
            <div className="mt-5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <ShieldCheck className="h-5 w-5 text-blue-600" aria-hidden />
              Read our{" "}
              <Link to="/legal/library" className="text-blue-600 underline">
                library content disclaimer
              </Link>
            </div>
          </div>
          <div className="rounded-2xl bg-blue-600 p-8 text-center sm:p-10">
            <h2 className="text-2xl font-bold text-white">Stop paying for what's free</h2>
            <p className="mx-auto mt-2 max-w-md text-blue-100">
              Create a free account, choose your curriculum and grade, and the library fills with
              books and guides matched to your subjects.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-6">
              <Link to="/learner/auth">Start reading free</Link>
            </Button>
          </div>
        </div>
      </section>
    </LandingPageLayout>
  );
};

export default BooksLanding;
