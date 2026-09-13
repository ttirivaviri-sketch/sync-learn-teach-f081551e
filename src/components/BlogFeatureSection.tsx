import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { AI_EDUCATION_POST } from "@/content/blogPosts";

const BlogFeatureSection = () => (
  <section id="blog" className="bg-muted/50 py-20" aria-labelledby="blog-feature-heading">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-end justify-between gap-6">
        <div>
          <p className="mb-3 text-xs font-bold uppercase text-secondary">From the StudySync blog</p>
          <h2 id="blog-feature-heading" className="max-w-2xl text-3xl font-extrabold text-foreground md:text-4xl">
            Ideas shaping how we learn
          </h2>
        </div>
        <Link to="/blog" className="hidden items-center gap-2 text-sm font-bold text-primary hover:underline sm:flex">
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <article className="group grid overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-2">
        <Link to={AI_EDUCATION_POST.path} className="overflow-hidden">
          <img
            src={AI_EDUCATION_POST.image}
            alt={AI_EDUCATION_POST.imageAlt}
            width={1200}
            height={630}
            loading="lazy"
            className="aspect-[16/10] h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </Link>
        <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-12">
          <p className="text-xs font-bold uppercase text-secondary">{AI_EDUCATION_POST.topic}</p>
          <h3 className="mt-4 text-2xl font-bold leading-tight text-card-foreground sm:text-3xl">
            <Link to={AI_EDUCATION_POST.path} className="hover:text-primary">{AI_EDUCATION_POST.title}</Link>
          </h3>
          <p className="mt-4 leading-7 text-muted-foreground">{AI_EDUCATION_POST.excerpt}</p>
          <p className="mt-5 text-sm text-muted-foreground">
            By <span className="font-semibold text-foreground">{AI_EDUCATION_POST.author}</span> · {AI_EDUCATION_POST.readingTime}
          </p>
          <Link to={AI_EDUCATION_POST.path} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
            Read the article <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </article>
      <Link to="/blog" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline sm:hidden">
        View all articles <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  </section>
);

export default BlogFeatureSection;