import { Suspense, lazy } from "react";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Seo, SITE_URL } from "@/components/Seo";
import { BlogHeader } from "@/components/blog/BlogHeader";
import { BlogComments } from "@/components/blog/BlogComments";
import { Button } from "@/components/ui/button";
import { AI_EDUCATION_POST } from "@/content/blogPosts";
import { AI_EDUCATION_ARTICLE_HTML, ARTICLE_SECTIONS } from "@/content/aiEducationArticleHtml";

const Footer = lazy(() => import("@/components/Footer"));
const post = AI_EDUCATION_POST;

const SECTIONS = ARTICLE_SECTIONS;

const articleJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: post.title,
  description: post.excerpt,
  image: `${SITE_URL}${post.image}`,
  datePublished: post.publishedAt,
  dateModified: post.publishedAt,
  author: { "@type": "Person", name: post.author },
  publisher: {
    "@type": "Organization",
    name: "StudySync",
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/lovable-uploads/studysync-logo.png` },
  },
  mainEntityOfPage: `${SITE_URL}${post.path}`,
});

const breadcrumbJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
    { "@type": "ListItem", position: 3, name: post.title, item: `${SITE_URL}${post.path}` },
  ],
});

const AiInEducationArticle = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="AI in Education: From Cheating Tool to Learning Partner"
      description="How schools can redesign assessment, build AI literacy and keep teachers central as students learn to use AI well."
      path={post.path}
      image={post.image}
      type="article"
    />
    <Helmet>
      <meta property="article:published_time" content={post.publishedAt} />
      <meta property="article:author" content={post.author} />
      <meta property="article:section" content="AI and education" />
      <script type="application/ld+json">{articleJsonLd}</script>
      <script type="application/ld+json">{breadcrumbJsonLd}</script>
    </Helmet>
    <BlogHeader />

    <main>
      <article>
        <header className="border-b border-border bg-primary-light">
          <div className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10 lg:px-8">
            <nav aria-label="Breadcrumb" className="mb-10 flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/blog" className="inline-flex items-center gap-1.5 hover:text-primary">
                <ArrowLeft className="h-4 w-4" /> Blog
              </Link>
              <span aria-hidden>/</span>
              <span>AI & learning</span>
            </nav>
            <div className="max-w-4xl">
              <p className="mb-5 text-xs font-bold uppercase text-secondary">{post.topic}</p>
              <h1 className="text-4xl font-extrabold leading-[1.08] text-foreground sm:text-5xl lg:text-6xl">
                {post.title}
              </h1>
              <p className="mt-7 max-w-3xl text-xl leading-8 text-muted-foreground sm:text-2xl sm:leading-9">
                The real question is not whether students will use AI. It is whether we will teach them to use it well.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                <span>By <strong className="text-foreground">{post.author}</strong></span>
                <span aria-hidden>·</span>
                <time dateTime={post.publishedAt}>{post.publishedLabel}</time>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{post.readingTime}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <figure>
            <img
              src={post.image}
              alt={post.imageAlt}
              width={1200}
              height={630}
              className="aspect-[16/9] w-full rounded-lg object-cover"
            />
            <figcaption className="mt-3 text-sm text-muted-foreground">
              The strongest uses of AI keep teachers, judgement and the work of learning in the frame.
            </figcaption>
          </figure>

          <div className="mt-12 grid gap-12 lg:grid-cols-[220px_minmax(0,720px)] lg:justify-center">
            <aside className="hidden lg:block">
              <nav aria-label="Article contents" className="sticky top-8 border-l border-border pl-5">
                <p className="mb-4 text-xs font-bold uppercase text-muted-foreground">In this article</p>
                <ul className="space-y-3 text-sm">
                  {SECTIONS.map(([id, label]) => (
                    <li key={id}><a href={`#${id}`} className="text-muted-foreground hover:text-primary">{label}</a></li>
                  ))}
                </ul>
              </nav>
            </aside>

            <div className="min-w-0 text-[1.05rem] leading-8 text-foreground/85 [&_h2]:scroll-mt-8 [&_h2]:pt-8 [&_h2]:text-3xl [&_h2]:font-extrabold [&_h2]:leading-tight [&_h2]:text-foreground [&_p]:mt-5">
              {/* Same markup the build injects into the static HTML, so crawlers and readers see identical text. */}
              <div dangerouslySetInnerHTML={{ __html: AI_EDUCATION_ARTICLE_HTML }} />

              <section className="mt-12 rounded-lg bg-foreground p-7 text-background sm:p-9" aria-labelledby="try-heading">
                <p className="text-xs font-bold uppercase text-secondary-light">Put the principle into practice</p>
                <h2 id="try-heading" className="mt-3 pt-0 text-2xl text-background sm:text-3xl">AI that guides the learning, not just the answer</h2>
                <p className="text-background/70">StudySync combines curriculum-aligned practice, guided feedback and real tutor support for learners in South Africa and Zimbabwe.</p>
                <Button asChild className="mt-6 rounded-full">
                  <Link to="/learner/auth">Start learning <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </section>

              <BlogComments postSlug={post.slug} />
            </div>
          </div>
        </div>
      </article>
    </main>
    <Suspense fallback={<div className="min-h-[20vh]" aria-hidden />}><Footer /></Suspense>
  </div>
);

export default AiInEducationArticle;