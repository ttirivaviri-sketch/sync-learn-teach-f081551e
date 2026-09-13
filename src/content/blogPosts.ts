import aiEducationImage from "@/assets/ai-education-learning-partner.jpg.asset.json";

export interface BlogPostSummary {
  slug: string;
  path: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  publishedLabel: string;
  readingTime: string;
  topic: string;
  image: string;
  imageAlt: string;
}

export const AI_EDUCATION_POST: BlogPostSummary = {
  slug: "ai-in-education-learning-partner",
  path: "/blog/ai-in-education-learning-partner",
  title: "AI in Education: From Cheating Tool to Learning Partner",
  excerpt:
    "The question is not whether students will use AI, but whether education will teach them to use it with judgement, curiosity and intellectual honesty.",
  author: "Ashlie Potera",
  publishedAt: "2026-09-13",
  publishedLabel: "13 September 2026",
  readingTime: "12 min read",
  topic: "AI & learning",
  image: aiEducationImage.url,
  imageAlt: "A teacher guiding a secondary school student as they work with a laptop and handwritten notes",
};

export const BLOG_POSTS = [AI_EDUCATION_POST];