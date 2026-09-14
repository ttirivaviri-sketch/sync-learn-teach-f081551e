/**
 * Crawlable HTML shipped inside <div id="root"> for the blog routes.
 *
 * This app is a client-rendered SPA: crawlers that do not execute JavaScript
 * (GPTBot/ChatGPT, PerplexityBot, ClaudeBot, most link previews) otherwise see
 * an empty page and cannot read or cite the writing. scripts/prerenderOg.ts
 * injects this markup at build time; React clears it on hydration, so real
 * browsers are unaffected.
 */
import { AI_EDUCATION_ARTICLE_HTML } from "./aiEducationArticleHtml";
import { AI_EDUCATION_POST, BLOG_POSTS } from "./blogPosts";

const hubBody = `
<h1>StudySync Blog</h1>
<p>Evidence-informed writing about AI, teaching, assessment and the practical work of helping students learn, from StudySync in South Africa.</p>
<h2>Latest articles</h2>
<ul>
${BLOG_POSTS.map(
  (p) => `  <li>
    <a href="${p.path}">${p.title}</a>
    <p>${p.excerpt}</p>
    <p>By ${p.author} &middot; ${p.publishedLabel} &middot; ${p.readingTime} &middot; ${p.topic}</p>
  </li>`,
).join("\n")}
</ul>
<p><a href="/">StudySync home</a> &middot; <a href="/past-papers">Past papers</a> &middot; <a href="/tutoring">Find a tutor</a></p>
`;

const articleBody = `
<article>
  <p><a href="/blog">StudySync Blog</a> / ${AI_EDUCATION_POST.topic}</p>
  <h1>${AI_EDUCATION_POST.title}</h1>
  <p>The real question is not whether students will use AI. It is whether we will teach them to use it well.</p>
  <p>By ${AI_EDUCATION_POST.author} &middot; <time datetime="${AI_EDUCATION_POST.publishedAt}">${AI_EDUCATION_POST.publishedLabel}</time> &middot; ${AI_EDUCATION_POST.readingTime}</p>
  ${AI_EDUCATION_ARTICLE_HTML}
  <p><a href="/blog">More StudySync articles</a> &middot; <a href="/learner/auth">Start learning with StudySync</a></p>
</article>
`;

/** Route path → static body markup for that route. */
export const PRERENDER_BODIES: Record<string, string> = {
  "/blog": hubBody,
  [AI_EDUCATION_POST.path]: articleBody,
};

export default PRERENDER_BODIES;
