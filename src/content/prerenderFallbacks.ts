/**
 * Crawlable HTML shipped inside <div id="root"> for the blog routes.
 *
 * This app is a client-rendered SPA: crawlers that do not execute JavaScript
 * (GPTBot/ChatGPT, PerplexityBot, ClaudeBot, most link previews) otherwise see
 * an empty page and cannot read or cite the writing. scripts/prerenderOg.ts
 * injects this markup at build time; React clears it on hydration, so real
 * browsers are unaffected.
 *
 * Kept free of asset imports so the Vite config can load it at build time.
 */
import { AI_EDUCATION_ARTICLE_HTML } from "./aiEducationArticleHtml";

const ARTICLE_PATH = "/blog/ai-in-education-learning-partner";

const hubBody = `
<h1>StudySync Blog</h1>
<p>Evidence-informed writing about AI, teaching, assessment and the practical work of helping students learn, from StudySync in South Africa.</p>
<h2>Latest articles</h2>
<ul>
  <li>
    <a href="${ARTICLE_PATH}">AI in Education: From Cheating Tool to Learning Partner</a>
    <p>The question is not whether students will use AI, but whether education will teach them to use it with judgement, curiosity and intellectual honesty.</p>
    <p>By Ashlie Potera &middot; 13 September 2026 &middot; 12 min read &middot; AI &amp; learning</p>
  </li>
</ul>
<p><a href="/">StudySync home</a> &middot; <a href="/past-papers">Past papers</a> &middot; <a href="/tutoring">Find a tutor</a></p>
`;

const articleBody = `
<article>
  <p><a href="/blog">StudySync Blog</a> / AI &amp; learning</p>
  <h1>AI in Education: From Cheating Tool to Learning Partner</h1>
  <p>The real question is not whether students will use AI. It is whether we will teach them to use it well.</p>
  <p>By Ashlie Potera &middot; <time datetime="2026-09-13">13 September 2026</time> &middot; 12 min read</p>
  ${AI_EDUCATION_ARTICLE_HTML}
  <p><a href="/blog">More StudySync articles</a> &middot; <a href="/learner/auth">Start learning with StudySync</a></p>
</article>
`;

/** Route path → static body markup for that route. */
export const PRERENDER_BODIES: Record<string, string> = {
  "/blog": hubBody,
  [ARTICLE_PATH]: articleBody,
};

export default PRERENDER_BODIES;
