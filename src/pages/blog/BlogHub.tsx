import { Suspense, lazy } from "react";
import { BookOpen } from "lucide-react";
import { Seo } from "@/components/Seo";
import { BlogHeader } from "@/components/blog/BlogHeader";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { BLOG_POSTS } from "@/content/blogPosts";

const Footer = lazy(() => import("@/components/Footer"));

const BlogHub = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="StudySync Blog — Better Learning with AI & Evidence"
      description="Evidence-informed ideas on AI in education, assessment, teaching and study practice from StudySync in South Africa."
      path="/blog"
    />
    <BlogHeader />
    <main>
      <section className="border-b border-border bg-primary-light py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </div>
          <p className="mb-4 text-xs font-bold uppercase text-secondary">StudySync perspectives</p>
          <h1 className="max-w-4xl text-4xl font-extrabold leading-tight text-foreground sm:text-5xl lg:text-6xl">
            Better questions for a changing classroom
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Evidence-informed writing about AI, teaching, assessment and the practical work of helping students learn.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="latest-heading">
        <h2 id="latest-heading" className="mb-8 text-2xl font-bold text-foreground">Latest thinking</h2>
        <div className="space-y-8">
          {BLOG_POSTS.map((post) => <BlogPostCard key={post.slug} post={post} />)}
        </div>
      </section>
    </main>
    <Suspense fallback={<div className="min-h-[20vh]" aria-hidden />}><Footer /></Suspense>
  </div>
);

export default BlogHub;