import aiEducationImage from "@/assets/ai-education-learning-partner.jpg";
import aiVirusImage from "@/assets/ai-cure-or-incurable-virus.jpg";

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
  image: aiEducationImage,
  imageAlt: "A teacher guiding a secondary school student as they work with a laptop and handwritten notes",
};

export const AI_VIRUS_POST: BlogPostSummary = {
  slug: "ai-cure-or-incurable-virus",
  path: "/blog/ai-cure-or-incurable-virus",
  title: "AI: The Cure for the Lack of Intelligence, or the Incurable Virus?",
  excerpt:
    "From DNA and viruses to software and malware to AI itself: three times history has taught the same lesson about self-replicating systems — and the OpenAI–Hugging Face incident suggests we are learning it late again.",
  author: "Ashlie Potera",
  publishedAt: "2026-09-15",
  publishedLabel: "15 September 2026",
  readingTime: "14 min read",
  topic: "AI & society",
  image: aiVirusImage,
  imageAlt:
    "Editorial illustration of a DNA double helix transforming into digital circuit traces and neural network nodes",
};

export const BLOG_POSTS = [AI_VIRUS_POST, AI_EDUCATION_POST];