/**
 * LandingPageLayout — shared shell for SEO landing pages (/tutoring,
 * /past-papers, /books).
 *
 * These pages exist to rank for long-tail searches ("online tutors South
 * Africa", "ZIMSEC past papers", "free textbooks CAPS"), so the layout keeps
 * real crawlable text in the DOM, emits FAQPage structured data for rich
 * results, and interlinks the landing pages + homepage for crawl discovery.
 */
import { Suspense, lazy, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";

const Footer = lazy(() => import("@/components/Footer"));

export interface LandingFaq {
  question: string;
  answer: string;
}

export interface LandingBreadcrumb {
  name: string;
  path: string;
}

interface Props {
  title: string;
  description: string;
  path: string;
  faqs: LandingFaq[];
  /** Optional trail for BreadcrumbList rich results, e.g. Home > Past Papers > Physical Sciences. */
  breadcrumbs?: LandingBreadcrumb[];
  children: ReactNode;
}

/** Cross-links so every landing page passes link equity to its siblings. */
const LANDING_NAV = [
  { label: "Find a Tutor", path: "/tutoring" },
  { label: "Past Papers", path: "/past-papers" },
  { label: "Books & Study Guides", path: "/books" },
];

const faqJsonLd = (faqs: LandingFaq[]) =>
  JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  });

const breadcrumbJsonLd = (crumbs: LandingBreadcrumb[]) =>
  JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `https://studysync.co.za${c.path === "/" ? "/" : c.path}`,
    })),
  });

export default function LandingPageLayout({ title, description, path, faqs, breadcrumbs, children }: Props) {
  return (
    <div className="min-h-screen bg-white">
      <Seo title={title} description={description} path={path} />
      {faqs.length > 0 && (
        <Helmet>
          <script type="application/ld+json">{faqJsonLd(faqs)}</script>
        </Helmet>
      )}
      {breadcrumbs && breadcrumbs.length > 1 && (
        <Helmet>
          <script type="application/ld+json">{breadcrumbJsonLd(breadcrumbs)}</script>
        </Helmet>
      )}

      {/* Slim navbar — logo home link + sibling landing pages + CTA */}
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5" aria-label="StudySync home">
            <img
              src="/lovable-uploads/studysync-logo.png"
              alt="StudySync"
              className="h-9 w-auto object-contain sm:h-10"
            />
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            {LANDING_NAV.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm font-medium transition-colors ${
                  item.path === path ? "text-blue-600" : "text-gray-700 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Link to="/learner/auth">Start free</Link>
          </Button>
        </div>
      </nav>

      <main>{children}</main>

      {/* FAQ — visible text mirrors the FAQPage JSON-LD exactly */}
      {faqs.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="mb-6 text-2xl font-bold text-gray-900 sm:text-3xl">
            Frequently asked questions
          </h2>
          <div className="space-y-3">
            {faqs.map((f) => (
              <details
                key={f.question}
                className="group rounded-xl border border-gray-200 bg-gray-50 px-5 py-4"
              >
                <summary className="cursor-pointer list-none text-base font-semibold text-gray-900 marker:content-none">
                  {f.question}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Sibling landing pages — internal links for crawlers and humans */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">
            Explore StudySync
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Link to="/" className="text-sm font-medium text-blue-600 hover:underline">
              StudySync home
            </Link>
            {LANDING_NAV.filter((i) => i.path !== path).map((i) => (
              <Link key={i.path} to={i.path} className="text-sm font-medium text-blue-600 hover:underline">
                {i.label}
              </Link>
            ))}
            <Link to="/tutor/auth" className="text-sm font-medium text-blue-600 hover:underline">
              Become a tutor
            </Link>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="min-h-[20vh]" aria-hidden />}>
        <Footer />
      </Suspense>
    </div>
  );
}
