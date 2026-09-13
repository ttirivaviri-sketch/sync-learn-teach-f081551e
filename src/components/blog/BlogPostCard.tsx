import { ArrowUpRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import type { BlogPostSummary } from "@/content/blogPosts";

export const BlogPostCard = ({ post }: { post: BlogPostSummary }) => (
  <article className="group grid overflow-hidden rounded-lg border border-border bg-card md:grid-cols-[1.08fr_0.92fr]">
    <Link to={post.path} className="overflow-hidden" aria-label={`Read ${post.title}`}>
      <img
        src={post.image}
        alt={post.imageAlt}
        width={1200}
        height={630}
        loading="lazy"
        className="aspect-[16/10] h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
      />
    </Link>
    <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
      <p className="mb-4 text-xs font-bold uppercase text-secondary">{post.topic}</p>
      <h2 className="text-2xl font-bold leading-tight text-card-foreground sm:text-3xl">
        <Link to={post.path} className="hover:text-primary">{post.title}</Link>
      </h2>
      <p className="mt-4 text-base leading-7 text-muted-foreground">{post.excerpt}</p>
      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{post.author}</span>
        <span aria-hidden>·</span>
        <time dateTime={post.publishedAt}>{post.publishedLabel}</time>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{post.readingTime}</span>
      </div>
      <Link to={post.path} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
        Read the article <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  </article>
);