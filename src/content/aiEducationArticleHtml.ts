/**
 * Single source of truth for the article body.
 *
 * The React page renders this HTML, and scripts/prerenderOg.ts injects the same
 * markup into the static HTML shipped for /blog/ai-in-education-learning-partner
 * so crawlers that do not execute JavaScript (ChatGPT/GPTBot, Perplexity,
 * ClaudeBot, most social and link previews) can read the full text.
 */

const SOURCE_LINK =
  'class="font-semibold text-primary underline decoration-primary/25 underline-offset-4 hover:decoration-primary" target="_blank" rel="noopener noreferrer"';

export const ARTICLE_SECTIONS: [string, string][] = [
  ["assessment", "The assessment problem"],
  ["regulation", "Smart regulation"],
  ["missing-pieces", "Literacy, teachers and equity"],
  ["potential", "What AI can do well"],
  ["path-forward", "The path forward"],
];

export const AI_EDUCATION_ARTICLE_HTML = `
<p class="mt-0 text-xl font-medium leading-9 text-foreground">Stanford&rsquo;s introductory programming course offers a useful glimpse of what this can look like. In &ldquo;Infinite Story&rdquo;, students build a choose-your-own-adventure game and integrate generative AI to extend it dynamically.</p>
<p>The assignment was designed by Chris Piech and colleagues, with Mehran Sahami among its advisers. It does not ask students to outsource the programming. It makes AI one element inside a larger task that still requires structure, logic and judgement. That distinction gets to the heart of the conversation we need to have: instead of pretending AI can be kept outside education until graduation, we should decide what kind of instruction creates solid understanding while making thoughtful use of the tools students will encounter.</p>
<p>This is not only a technological dilemma. It is a pedagogical one. It demands that we do three things at once: integrate AI meaningfully into learning, regulate it thoughtfully, and redesign education so AI becomes a tool for thinking rather than a shortcut around it.</p>

<blockquote class="my-10 border-l-4 border-secondary bg-secondary-light px-6 py-5 text-xl font-semibold leading-8 text-foreground">If a task can be completed without the learner showing their reasoning, the problem may be the design of the task&mdash;not only the tool they used.</blockquote>

<section id="assessment">
  <h2>The cheating problem is really an assessment problem</h2>
  <p>It is tempting to frame generative AI as a cheating crisis. Academic integrity is a legitimate concern, but many traditional assessments were never designed to survive contact with a technology that can produce plausible prose or routine solutions on demand.</p>
  <p>The constructive response is not to rely solely on detection software, which can be unreliable and raises privacy and fairness concerns. It is to redesign assessment. Error analysis, oral defence, staged drafts, portfolios that document how AI was used, and tasks grounded in local or personal evidence all make reasoning more visible. They also give a teacher a better view of what the student understands.</p>
  <p>The goal should not be to make every task &ldquo;AI-proof&rdquo;. Early in learning, protected practice helps students build the knowledge they need to judge an AI answer. Later, carefully designed AI-supported work can ask them to compare approaches, test claims, identify errors and create something better than the first response a model supplies.</p>
</section>

<section id="regulation">
  <h2>Regulation is not optional&mdash;but it must be smart</h2>
  <p>UNESCO&rsquo;s September 2026 ministerial statement, adopted by more than 25 ministers and designated representatives, starts from a vital premise: education is a common good, and AI must not displace human relationships or professional judgement. It calls for stronger public oversight, teacher and student competencies, safeguards for educational data, and careful assessment of the full costs of adopting AI systems.</p>
  <p>These are practical guardrails against education becoming a captive market for systems that schools cannot inspect, adapt or leave. Adoption decisions should account for interoperability, data portability, accessibility and teacher agency&mdash;not just the appeal of a free trial.</p>
  <p>Technology also cannot compensate for missing foundations. A rigorous evaluation of Peru&rsquo;s One Laptop per Child programme found improved computer skills but no evidence of gains in mathematics or language achievement. Hardware alone could not replace the infrastructure, teacher support and curricular integration needed to turn access into learning.</p>
</section>

<section id="missing-pieces">
  <h2>The missing pieces: AI literacy, teacher training and equity</h2>
  <p>AI literacy is not the same as using AI. The 2026 OECD&ndash;European Union AI Literacy Framework for primary and secondary education asks learners to engage with AI, create with it, manage its effects and design responsibly. UNESCO&rsquo;s separate 2024 competency frameworks for students and teachers likewise emphasise a human-centred mindset, ethics, foundational knowledge and responsible practice.</p>
  <p>A young learner might explore how a classifier makes mistakes. An older student might verify a model&rsquo;s answer against trustworthy sources, identify what evidence is missing, and explain why an output should not be accepted at face value. These experiences turn AI from an oracle into an object of inquiry.</p>
  <p>Teacher preparation is the bottleneck. Microsoft&rsquo;s 2026 survey reported widespread school-related AI use alongside persistent demand for formal training and clearer guidance. Prompt writing is not enough. Teachers need time and support to connect AI with subject pedagogy, assessment design, privacy, ethics and critical evaluation.</p>
  <p>Equity is the fault line. An OECD review focused on Italy warns that infrastructure, digital skills and school capacity shape who can benefit from AI. The same concern is even sharper where connectivity, device access and teacher support are uneven. Personalisation can narrow gaps only when the surrounding system deliberately makes the opportunity inclusive.</p>
</section>

<section id="potential">
  <h2>What AI can actually do well</h2>
  <p>None of this should obscure AI&rsquo;s genuine educational potential. A semester-long study at UniDistance Suisse found that students who actively engaged with a personal AI tutor performed about 15 percentile points higher than students in a parallel course without it. The system used retrieval practice, spacing and personalisation rather than simply generating finished answers.</p>
  <p>The pattern matters: effective systems guide learners through questions, hints, feedback and opportunities to retrieve knowledge. They are designed to strengthen cognitive autonomy, not remove the productive struggle through which durable learning develops.</p>
  <p>Evidence from a World Bank evaluation in Edo State, Nigeria, points in the same direction. Students used generative AI in an after-school programme with teacher support rather than as an unattended replacement for teaching. The setting, training and human facilitation were part of the intervention&mdash;not incidental extras.</p>
</section>

<section id="path-forward">
  <h2>The path forward</h2>
  <p>The evidence suggests four principles for moving from experimentation to responsible practice.</p>
  <ol class="mt-6 space-y-5 pl-6 marker:font-bold marker:text-primary">
    <li><strong class="text-foreground">AI should complement teachers, not replace them.</strong> The question is not whether a model can deliver an explanation, but whether the learning environment uses it to extend skilled teaching and meaningful feedback.</li>
    <li><strong class="text-foreground">Assessment must evolve alongside AI.</strong> Learners should show their process, defend decisions, correct errors and disclose where tools influenced their work.</li>
    <li><strong class="text-foreground">Regulation must reflect educational values.</strong> China&rsquo;s 2026 <em>The Ethics of Digital Education: A Reference Framework</em> keeps human decision-making central and distinguishes encouraged, limited and prohibited uses. It is separate from China&rsquo;s broader AI + Education Action Plan.</li>
    <li><strong class="text-foreground">AI literacy must be universal.</strong> The divide is not only between those who can access a device and those who cannot, but between those who can interrogate an AI output and those who are expected merely to trust it.</li>
  </ol>
  <p>The debate too often collapses into two camps: AI as a route to personalised learning, or AI as a threat to academic integrity. Both contain part of the truth. AI can adapt practice and feedback, but it can also bypass the mental work education is meant to develop.</p>
  <p>Our task is not to choose one story. It is to build educational systems that use AI&rsquo;s strengths while protecting the cognitive work, human relationships and public trust that learning depends on. That means investing in teachers, redesigning assessment, teaching AI literacy from the earliest grades and governing AI with the seriousness we apply to any intervention in children&rsquo;s lives.</p>
  <p class="text-xl font-semibold leading-9 text-foreground">AI is not simply a problem to contain. Used with judgement, it can become a tool students learn to master&mdash;rather than a tool that quietly does their learning for them.</p>
</section>

<section aria-labelledby="sources-heading" class="mt-14 border-t border-border pt-10">
  <h2 id="sources-heading" class="pt-0">Sources and further reading</h2>
  <ul class="mt-6 space-y-4 text-sm leading-6 text-muted-foreground">
    <li><a ${SOURCE_LINK} href="https://nifty.stanford.edu/2025/piech-infinite-story/">Stanford University, &ldquo;Infinite Story&rdquo; (2025)</a></li>
    <li><a ${SOURCE_LINK} href="https://unesdoc.unesco.org/ark:/48223/pf0000399360_eng">UNESCO, &ldquo;Sustaining education as a common good in the age of AI&rdquo; (2026)</a></li>
    <li><a ${SOURCE_LINK} href="https://www.unesco.org/en/articles/what-you-need-know-about-unescos-new-ai-competency-frameworks-students-and-teachers">UNESCO AI competency frameworks for students and teachers (2024)</a></li>
    <li><a ${SOURCE_LINK} href="https://ailiteracyframework.org/pdfs/framework_pdf/AILF_en.pdf">OECD&ndash;European Union, AI Literacy Framework for Primary and Secondary Education (2026)</a></li>
    <li><a ${SOURCE_LINK} href="https://news.microsoft.com/source/2026/06/24/microsofts-new-ai-in-education-report-highlights-widespread-adoption-and-increasing-demand-for-support/">Microsoft, AI in Education Report announcement (2026)</a></li>
    <li><a ${SOURCE_LINK} href="https://www.oecd.org/en/publications/ai-adoption-in-the-education-system_69bd0a4a-en.html">OECD, AI adoption in the education system: policy considerations for Italy (2025)</a></li>
    <li><a ${SOURCE_LINK} href="https://doi.org/10.1007/s10639-024-12888-5">Baillifard et al., &ldquo;Effective learning with a personal AI tutor&rdquo; (2024)</a></li>
    <li><a ${SOURCE_LINK} href="https://documents1.worldbank.org/curated/en/099548105192529324/pdf/IDU-c09f40d8-9ff8-42dc-b315-591157499be7.pdf">World Bank, &ldquo;From Chalkboards to Chatbots&rdquo; (2025)</a></li>
    <li><a ${SOURCE_LINK} href="https://www.aeaweb.org/articles?id=10.1257%2Fapp.20150385">Cristia et al., One Laptop per Child evaluation in Peru (2017)</a></li>
    <li><a ${SOURCE_LINK} href="http://en.moe.gov.cn/features/2026WorldDigitalEducationConference/Achievements/202605/t20260516_1436743.html">China Ministry of Education, <em>The Ethics of Digital Education: A Reference Framework</em> (2026)</a></li>
  </ul>
</section>

<aside class="mt-12 rounded-lg border border-border bg-muted/50 p-5 text-sm leading-6 text-muted-foreground"><strong class="text-foreground">Editorial note:</strong> This is evidence-informed commentary. StudySync has linked the primary or institutional sources behind its central claims and corrected details that could not be verified in the original draft.</aside>
`;

export default AI_EDUCATION_ARTICLE_HTML;
