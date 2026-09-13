import { Suspense, lazy } from "react";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Seo, SITE_URL } from "@/components/Seo";
import { BlogHeader } from "@/components/blog/BlogHeader";
import { Button } from "@/components/ui/button";
import { AI_EDUCATION_POST } from "@/content/blogPosts";

const Footer = lazy(() => import("@/components/Footer"));
const post = AI_EDUCATION_POST;

const sourceLink = "font-semibold text-primary underline decoration-primary/25 underline-offset-4 hover:decoration-primary";

const SECTIONS = [
  ["assessment", "The assessment problem"],
  ["regulation", "Smart regulation"],
  ["missing-pieces", "Literacy, teachers and equity"],
  ["potential", "What AI can do well"],
  ["path-forward", "The path forward"],
];

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
              <p className="mt-0 text-xl font-medium leading-9 text-foreground">
                Stanford’s introductory programming course offers a useful glimpse of what this can look like. In “Infinite Story”, students build a choose-your-own-adventure game and integrate generative AI to extend it dynamically.
              </p>
              <p>
                The assignment was designed by Chris Piech and colleagues, with Mehran Sahami among its advisers. It does not ask students to outsource the programming. It makes AI one element inside a larger task that still requires structure, logic and judgement. That distinction gets to the heart of the conversation we need to have: instead of pretending AI can be kept outside education until graduation, we should decide what kind of instruction creates solid understanding while making thoughtful use of the tools students will encounter.
              </p>
              <p>
                This is not only a technological dilemma. It is a pedagogical one. It demands that we do three things at once: integrate AI meaningfully into learning, regulate it thoughtfully, and redesign education so AI becomes a tool for thinking rather than a shortcut around it.
              </p>

              <blockquote className="my-10 border-l-4 border-secondary bg-secondary-light px-6 py-5 text-xl font-semibold leading-8 text-foreground">
                If a task can be completed without the learner showing their reasoning, the problem may be the design of the task—not only the tool they used.
              </blockquote>

              <section id="assessment">
                <h2>The cheating problem is really an assessment problem</h2>
                <p>
                  It is tempting to frame generative AI as a cheating crisis. Academic integrity is a legitimate concern, but many traditional assessments were never designed to survive contact with a technology that can produce plausible prose or routine solutions on demand.
                </p>
                <p>
                  The constructive response is not to rely solely on detection software, which can be unreliable and raises privacy and fairness concerns. It is to redesign assessment. Error analysis, oral defence, staged drafts, portfolios that document how AI was used, and tasks grounded in local or personal evidence all make reasoning more visible. They also give a teacher a better view of what the student understands.
                </p>
                <p>
                  The goal should not be to make every task “AI-proof”. Early in learning, protected practice helps students build the knowledge they need to judge an AI answer. Later, carefully designed AI-supported work can ask them to compare approaches, test claims, identify errors and create something better than the first response a model supplies.
                </p>
              </section>

              <section id="regulation">
                <h2>Regulation is not optional—but it must be smart</h2>
                <p>
                  UNESCO’s September 2026 ministerial statement, adopted by more than 25 ministers and designated representatives, starts from a vital premise: education is a common good, and AI must not displace human relationships or professional judgement. It calls for stronger public oversight, teacher and student competencies, safeguards for educational data, and careful assessment of the full costs of adopting AI systems.
                </p>
                <p>
                  These are practical guardrails against education becoming a captive market for systems that schools cannot inspect, adapt or leave. Adoption decisions should account for interoperability, data portability, accessibility and teacher agency—not just the appeal of a free trial.
                </p>
                <p>
                  Technology also cannot compensate for missing foundations. A rigorous evaluation of Peru’s One Laptop per Child programme found improved computer skills but no evidence of gains in mathematics or language achievement. Hardware alone could not replace the infrastructure, teacher support and curricular integration needed to turn access into learning.
                </p>
              </section>

              <section id="missing-pieces">
                <h2>The missing pieces: AI literacy, teacher training and equity</h2>
                <p>
                  AI literacy is not the same as using AI. The 2026 OECD–European Union AI Literacy Framework for primary and secondary education asks learners to engage with AI, create with it, manage its effects and design responsibly. UNESCO’s separate 2024 competency frameworks for students and teachers likewise emphasise a human-centred mindset, ethics, foundational knowledge and responsible practice.
                </p>
                <p>
                  A young learner might explore how a classifier makes mistakes. An older student might verify a model’s answer against trustworthy sources, identify what evidence is missing, and explain why an output should not be accepted at face value. These experiences turn AI from an oracle into an object of inquiry.
                </p>
                <p>
                  Teacher preparation is the bottleneck. Microsoft’s 2026 survey reported widespread school-related AI use alongside persistent demand for formal training and clearer guidance. Prompt writing is not enough. Teachers need time and support to connect AI with subject pedagogy, assessment design, privacy, ethics and critical evaluation.
                </p>
                <p>
                  Equity is the fault line. An OECD review focused on Italy warns that infrastructure, digital skills and school capacity shape who can benefit from AI. The same concern is even sharper where connectivity, device access and teacher support are uneven. Personalisation can narrow gaps only when the surrounding system deliberately makes the opportunity inclusive.
                </p>
              </section>

              <section id="potential">
                <h2>What AI can actually do well</h2>
                <p>
                  None of this should obscure AI’s genuine educational potential. A semester-long study at UniDistance Suisse found that students who actively engaged with a personal AI tutor performed about 15 percentile points higher than students in a parallel course without it. The system used retrieval practice, spacing and personalisation rather than simply generating finished answers.
                </p>
                <p>
                  The pattern matters: effective systems guide learners through questions, hints, feedback and opportunities to retrieve knowledge. They are designed to strengthen cognitive autonomy, not remove the productive struggle through which durable learning develops.
                </p>
                <p>
                  Evidence from a World Bank evaluation in Edo State, Nigeria, points in the same direction. Students used generative AI in an after-school programme with teacher support rather than as an unattended replacement for teaching. The setting, training and human facilitation were part of the intervention—not incidental extras.
                </p>
              </section>

              <section id="path-forward">
                <h2>The path forward</h2>
                <p>The evidence suggests four principles for moving from experimentation to responsible practice.</p>
                <ol className="mt-6 space-y-5 pl-6 marker:font-bold marker:text-primary">
                  <li><strong className="text-foreground">AI should complement teachers, not replace them.</strong> The question is not whether a model can deliver an explanation, but whether the learning environment uses it to extend skilled teaching and meaningful feedback.</li>
                  <li><strong className="text-foreground">Assessment must evolve alongside AI.</strong> Learners should show their process, defend decisions, correct errors and disclose where tools influenced their work.</li>
                  <li><strong className="text-foreground">Regulation must reflect educational values.</strong> China’s 2026 <em>The Ethics of Digital Education: A Reference Framework</em> keeps human decision-making central and distinguishes encouraged, limited and prohibited uses. It is separate from China’s broader AI + Education Action Plan.</li>
                  <li><strong className="text-foreground">AI literacy must be universal.</strong> The divide is not only between those who can access a device and those who cannot, but between those who can interrogate an AI output and those who are expected merely to trust it.</li>
                </ol>
                <p>
                  The debate too often collapses into two camps: AI as a route to personalised learning, or AI as a threat to academic integrity. Both contain part of the truth. AI can adapt practice and feedback, but it can also bypass the mental work education is meant to develop.
                </p>
                <p>
                  Our task is not to choose one story. It is to build educational systems that use AI’s strengths while protecting the cognitive work, human relationships and public trust that learning depends on. That means investing in teachers, redesigning assessment, teaching AI literacy from the earliest grades and governing AI with the seriousness we apply to any intervention in children’s lives.
                </p>
                <p className="text-xl font-semibold leading-9 text-foreground">
                  AI is not simply a problem to contain. Used with judgement, it can become a tool students learn to master—rather than a tool that quietly does their learning for them.
                </p>
              </section>

              <section aria-labelledby="sources-heading" className="mt-14 border-t border-border pt-10">
                <h2 id="sources-heading" className="pt-0">Sources and further reading</h2>
                <ul className="mt-6 space-y-4 text-sm leading-6 text-muted-foreground">
                  <li><a className={sourceLink} href="https://nifty.stanford.edu/2025/piech-infinite-story/" target="_blank" rel="noopener noreferrer">Stanford University, “Infinite Story” (2025)</a></li>
                  <li><a className={sourceLink} href="https://unesdoc.unesco.org/ark:/48223/pf0000399360_eng" target="_blank" rel="noopener noreferrer">UNESCO, “Sustaining education as a common good in the age of AI” (2026)</a></li>
                  <li><a className={sourceLink} href="https://www.unesco.org/en/articles/what-you-need-know-about-unescos-new-ai-competency-frameworks-students-and-teachers" target="_blank" rel="noopener noreferrer">UNESCO AI competency frameworks for students and teachers (2024)</a></li>
                  <li><a className={sourceLink} href="https://ailiteracyframework.org/pdfs/framework_pdf/AILF_en.pdf" target="_blank" rel="noopener noreferrer">OECD–European Union, AI Literacy Framework for Primary and Secondary Education (2026)</a></li>
                  <li><a className={sourceLink} href="https://news.microsoft.com/source/2026/06/24/microsofts-new-ai-in-education-report-highlights-widespread-adoption-and-increasing-demand-for-support/" target="_blank" rel="noopener noreferrer">Microsoft, AI in Education Report announcement (2026)</a></li>
                  <li><a className={sourceLink} href="https://www.oecd.org/en/publications/ai-adoption-in-the-education-system_69bd0a4a-en.html" target="_blank" rel="noopener noreferrer">OECD, AI adoption in the education system: policy considerations for Italy (2025)</a></li>
                  <li><a className={sourceLink} href="https://doi.org/10.1007/s10639-024-12888-5" target="_blank" rel="noopener noreferrer">Baillifard et al., “Effective learning with a personal AI tutor” (2024)</a></li>
                  <li><a className={sourceLink} href="https://documents1.worldbank.org/curated/en/099548105192529324/pdf/IDU-c09f40d8-9ff8-42dc-b315-591157499be7.pdf" target="_blank" rel="noopener noreferrer">World Bank, “From Chalkboards to Chatbots” (2025)</a></li>
                  <li><a className={sourceLink} href="https://www.aeaweb.org/articles?id=10.1257%2Fapp.20150385" target="_blank" rel="noopener noreferrer">Cristia et al., One Laptop per Child evaluation in Peru (2017)</a></li>
                  <li><a className={sourceLink} href="http://en.moe.gov.cn/features/2026WorldDigitalEducationConference/Achievements/202605/t20260516_1436743.html" target="_blank" rel="noopener noreferrer">China Ministry of Education, <em>The Ethics of Digital Education: A Reference Framework</em> (2026)</a></li>
                </ul>
              </section>

              <aside className="mt-12 rounded-lg border border-border bg-muted/50 p-5 text-sm leading-6 text-muted-foreground">
                <strong className="text-foreground">Editorial note:</strong> This is evidence-informed commentary. StudySync has linked the primary or institutional sources behind its central claims and corrected details that could not be verified in the original draft.
              </aside>

              <section className="mt-12 rounded-lg bg-foreground p-7 text-background sm:p-9" aria-labelledby="try-heading">
                <p className="text-xs font-bold uppercase text-secondary-light">Put the principle into practice</p>
                <h2 id="try-heading" className="mt-3 pt-0 text-2xl text-background sm:text-3xl">AI that guides the learning, not just the answer</h2>
                <p className="text-background/70">StudySync combines curriculum-aligned practice, guided feedback and real tutor support for learners in South Africa and Zimbabwe.</p>
                <Button asChild className="mt-6 rounded-full">
                  <Link to="/learner/auth">Start learning <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </section>
            </div>
          </div>
        </div>
      </article>
    </main>
    <Suspense fallback={<div className="min-h-[20vh]" aria-hidden />}><Footer /></Suspense>
  </div>
);

export default AiInEducationArticle;