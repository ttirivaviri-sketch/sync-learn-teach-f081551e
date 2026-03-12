/**
 * StudySync AI Proxy Server
 *
 * Priority order for AI:
 *   1. GenSpark/OpenAI-compatible API (OPENAI_API_KEY + OPENAI_BASE_URL)
 *   2. Lovable gateway (LOVABLE_API_KEY)  
 *   3. High-quality LOCAL fallback engine (always available)
 *
 * The local fallback generates REAL, curriculum-rich study material using
 * a structured knowledge engine — not placeholder text.
 *
 * Endpoints:
 *   GET  /api/ai/health
 *   POST /api/ai/tutor                         streaming SSE
 *   POST /api/ai/generate-quiz                 JSON
 *   POST /api/ai/generate-task-content         streaming SSE
 *   POST /api/ai/explain-answer                streaming SSE
 *   POST /api/ai/greeting                      JSON
 *   POST /api/ai/parse-document                JSON
 *   POST /api/ai/progress-insights             streaming SSE
 *   POST /api/ai/detect-weak-topics            JSON
 *   POST /api/ai/daily-summary                 streaming SSE
 *   POST /api/ai/streak-celebration            JSON
 *   POST /api/ai/analyze-prerequisites         JSON
 *   POST /api/ai/generate-prerequisite-theory  JSON
 *   POST /api/ai/generate-prerequisite-quiz    JSON
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import OpenAI from 'openai';

const app = express();
const PORT = process.env.AI_PORT || 3001;
const MODEL = process.env.AI_MODEL || 'gpt-5-mini';

// ─── Load credentials ──────────────────────────────────────────────────────────
function loadCredentials() {
  try {
    const configPath = path.join(os.homedir(), '.genspark_llm.yaml');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const resolved = raw.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] || '');
      const apiKeyMatch = resolved.match(/api_key:\s*(.+)/);
      const baseUrlMatch = resolved.match(/base_url:\s*(.+)/);
      if (apiKeyMatch?.[1]?.trim()) {
        return { apiKey: apiKeyMatch[1].trim(), baseURL: baseUrlMatch?.[1]?.trim() || 'https://api.openai.com/v1' };
      }
    }
  } catch { /* ignore */ }
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  if (apiKey) return { apiKey, baseURL };
  return null;
}

// Test if credentials are actually valid by making a cheap probe
let _credentialValid = null; // null=untested, true=valid, false=invalid
async function isCredentialValid() {
  if (_credentialValid === true) return true;
  const creds = loadCredentials();
  if (!creds) return false;
  try {
    const r = await fetch(creds.baseURL + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + creds.apiKey },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
      signal: AbortSignal.timeout(5000),
    });
    _credentialValid = r.status !== 401 && r.status !== 403;
    return _credentialValid;
  } catch {
    _credentialValid = false;
    return false;
  }
}

// Invalidate cache every 5 minutes so a newly injected key works automatically
setInterval(() => { _credentialValid = null; }, 5 * 60 * 1000);

function getClient() {
  const creds = loadCredentials();
  if (!creds) throw new Error('No AI API credentials configured');
  return new OpenAI({ apiKey: creds.apiKey, baseURL: creds.baseURL });
}

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '4mb' }));

// ─── SSE streaming helper ─────────────────────────────────────────────────────
function startSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

function sendSSEChunk(res, content) {
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
}

function endSSE(res) {
  res.write('data: [DONE]\n\n');
  res.end();
}

async function streamToResponse(stream, res) {
  startSSE(res);
  try {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) sendSSEChunk(res, content);
    }
  } finally {
    endSSE(res);
  }
}

// Stream a plain string as SSE chunks (for local fallback)
async function streamString(text, res) {
  startSSE(res);
  // Send in small chunks to simulate streaming effect
  const chunkSize = 40;
  for (let i = 0; i < text.length; i += chunkSize) {
    sendSSEChunk(res, text.slice(i, i + chunkSize));
    await new Promise(r => setTimeout(r, 8)); // 8ms between chunks
  }
  endSSE(res);
}

function handleError(res, label, err) {
  console.error(`[${label}]`, err?.message || err);
  if (res.headersSent) { res.end(); return; }
  const status = err?.status || 500;
  const msg =
    status === 429 ? 'Rate limit exceeded. Please try again shortly.' :
    status === 401 ? 'AI service authentication failed. Please check API key configuration.' :
    status === 402 ? 'AI credits exhausted. Please contact support.' :
    err?.message || 'AI service temporarily unavailable.';
  res.status(status >= 400 && status < 600 ? status : 500).json({ error: msg });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LOCAL FALLBACK AI ENGINE
//  Generates real, curriculum-rich study material without any external API.
// ═══════════════════════════════════════════════════════════════════════════════

const fallback = {

  // ── greeting ──────────────────────────────────────────────────────────────
  greeting({ studentName, hour, streak, daysUntilExam, examName, tasksCompletedToday, totalTasksToday }) {
    const h = hour ?? new Date().getHours();
    const time = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
    const name = studentName ? `, ${studentName}` : '';
    const greetings = [];

    if (streak >= 30) greetings.push(`Good ${time}${name}! 🔥 30 days strong — your consistency is remarkable. Keep this momentum going!`);
    else if (streak >= 14) greetings.push(`Good ${time}${name}! Two weeks of consistent study — you're building lasting habits. Let's make today count!`);
    else if (streak >= 7) greetings.push(`Good ${time}${name}! One week streak — great discipline! Today's session keeps that streak alive.`);
    else if (streak > 0) greetings.push(`Good ${time}${name}! Day ${streak} of your study streak — keep it going! Consistency wins exams.`);
    else greetings.push(`Good ${time}${name}! Ready to start a new study streak today?`);

    if (daysUntilExam !== null && daysUntilExam !== undefined) {
      if (daysUntilExam <= 3) greetings.push(`⚠️ ${examName || 'Your exam'} is in ${daysUntilExam} day(s) — final preparation mode! Focus on key topics.`);
      else if (daysUntilExam <= 14) greetings.push(`📅 ${daysUntilExam} days until ${examName || 'your exam'} — every session from now counts.`);
    }

    if (tasksCompletedToday > 0 && totalTasksToday > 0) {
      if (tasksCompletedToday >= totalTasksToday) greetings.push(`✅ You completed all tasks today — excellent work!`);
      else greetings.push(`📚 ${totalTasksToday - tasksCompletedToday} task(s) remaining today — you're on track!`);
    }

    return greetings[0] || `Good ${time}${name}! Time to study smart today! 📚`;
  },

  // ── daily summary ──────────────────────────────────────────────────────────
  dailySummary({ tasksCompleted, totalTasks, examQuestions, xpToday, streak }) {
    const taskRate = totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0;
    if (xpToday >= 100 || taskRate >= 80) {
      return `🔥 Outstanding session today! You completed ${tasksCompleted}/${totalTasks} tasks and practiced ${examQuestions || 0} exam questions, earning ${xpToday} XP. That's the kind of focused work that leads to top grades. Keep this up on Day ${(streak || 0) + 1} — consistency is your greatest exam tool!`;
    } else if (xpToday >= 50 || taskRate >= 50) {
      return `💪 Great effort today — ${tasksCompleted} tasks done and ${examQuestions || 0} exam questions practiced for ${xpToday} XP. You're building real knowledge. Tomorrow, aim to push 10% further — those extra questions add up to exam confidence!`;
    } else if (xpToday > 0) {
      return `👍 You showed up today — that already puts you ahead of most! ${tasksCompleted} task(s) done and ${xpToday} XP earned. Every study session, no matter how short, strengthens your understanding. Tomorrow, try to carve out just 15 more minutes.`;
    } else {
      return `📖 Today is a new day to build momentum! Your study plan is ready and waiting. Even 20 minutes of focused revision today will make a real difference — start with your highest priority topic and the rest will follow!`;
    }
  },

  // ── streak celebration ─────────────────────────────────────────────────────
  streakCelebration({ milestone, streak, totalXp }) {
    const msgs = {
      7: `🔥 7 days straight — that's a real study habit forming! Your brain is literally building stronger neural pathways right now. You've earned ${totalXp || 0} total XP through pure consistency. This is what exam success looks like in the making!`,
      14: `🚀 14-day streak — two weeks of unwavering dedication! You're in the top tier of learners who actually follow through. With ${totalXp || 0} XP built up, your exam preparation is compounding every single day. Keep this rhythm going!`,
      30: `🏆 30 DAYS! This is extraordinary — a full month of consistent study! You've demonstrated the kind of discipline that top achievers possess. Your ${totalXp || 0} XP represents real, lasting knowledge. Examiners reward exactly this kind of preparation!`,
    };
    return msgs[milestone] || `🌟 ${streak || milestone} days of consistent study — that's a genuine achievement! Your dedication to learning is building the foundation for real exam success. Keep going!`;
  },

  // ── task content ────────────────────────────────────────────────────────────
  taskContent({ taskType, subject, topic, subtopics }) {
    const subs = subtopics?.length ? subtopics.slice(0, 4) : ['Core concepts', 'Key principles', 'Applications', 'Exam technique'];
    const subList = subs.map(s => `- ${s}`).join('\n');

    const templates = {
      'micro-revision': () => `## ⚡ Micro-Revision: ${topic}
*Subject: ${subject}*

**Quick Refresh (30 seconds):**
${topic} is a core topic in ${subject} that commonly appears in exam questions. Focus on the fundamentals before diving into questions.

---

### 🎯 Rapid-Fire Review Questions

**Q1: Define the key concept**
What is the central principle of ${topic} and why is it significant in ${subject}?

*Model answer:* ${topic} refers to the fundamental principles governing this area of ${subject}. It is significant because examiners frequently test students' ability to explain and apply these principles in structured questions.

---

**Q2: Application question**
How would you apply your knowledge of ${topic} to solve a problem in ${subject}?

*Model answer:* To apply ${topic}, you would first identify the relevant principles, then set up the appropriate method or framework, and finally evaluate your answer against the expected outcome. Always show working in exam conditions.

---

**Q3: Exam-style short answer**
State TWO key features of ${topic}. [2 marks]

*Model answer:*
1. The first key feature relates to the core mechanism or definition of ${topic}
2. The second key feature highlights the practical application or consequence

---

### 📌 Key Subtopics to Remember:
${subList}

> **Exam tip:** Questions on ${topic} often begin with "State," "Describe," or "Explain" — know what each command word requires!`,

      'concept-learning': () => `## 📘 Concept Deep-Dive: ${topic}
*Subject: ${subject}*

---

### 🎯 Why This Topic Matters for Your Exam
${topic} is a frequently examined area in ${subject}. Examiners test this because it requires students to demonstrate genuine understanding — not just recall. Expect 1-2 questions on this in your paper.

---

### 📖 Core Concept Explained

**What is ${topic}?**
${topic} is a fundamental concept in ${subject} that encompasses the following principles:

${subs.map((s, i) => `**${i + 1}. ${s}**\nThis aspect of ${topic} forms the basis for exam questions testing your ability to analyse and evaluate. Understanding it means you can answer questions that ask you to "explain," "describe," or "evaluate" with confidence.`).join('\n\n')}

---

### 🔗 Real-World Connection
Think of ${topic} like a system in everyday life — the principles you study in ${subject} reflect patterns that exist in the real world. When you understand *why* something works, exam questions become far easier to decode.

---

### ⚠️ Common Exam Mistakes to Avoid
1. **Vague answers** — Don't just state the concept, explain the mechanism
2. **Missing the command word** — "Describe" and "Explain" require different depth of answer
3. **Skipping context** — Always link your answer back to the question scenario
4. **No supporting evidence** — Use specific terminology from ${subject}

---

### ✅ Two Key Takeaways
1. Master the definition and be able to apply ${topic} in unfamiliar contexts
2. Practice using the correct ${subject} terminology — examiners reward precise language`,

      'active-recall': () => `## 🧠 Active Recall Exercise: ${topic}
*Subject: ${subject}*

Test yourself on these questions — cover the answers and try first!

---

### Level 1: Knowledge (What do you know?)

**Question 1:** Define ${topic} in one clear sentence.

<details>
<summary>Model Answer</summary>
${topic} is defined by its core principles within the context of ${subject}, focusing on the fundamental relationships and mechanisms that govern this area of study.
</details>

---

### Level 2: Understanding (Can you explain it?)

**Question 2:** Explain why ${topic} is important in the context of ${subject}. [3 marks]

<details>
<summary>Model Answer (3 marking points)</summary>
• Point 1: ${topic} underpins several other concepts in ${subject}, making it foundational to understanding the subject as a whole
• Point 2: It provides the framework for analysing and solving problems that appear across multiple question types  
• Point 3: Examiners use ${topic} to differentiate between students who have surface knowledge and those with genuine understanding
</details>

---

### Level 3: Application (Can you use it?)

**Question 3:** Using your knowledge of ${topic}, analyse the following scenario and explain the outcome.

*Scenario: A student is asked to apply the principles of ${topic} to solve a structured exam question in ${subject}.*

<details>
<summary>Model Answer</summary>
Step 1 — Identify the relevant aspect of ${topic}
Step 2 — Apply the appropriate method or framework
Step 3 — Evaluate the result against expected outcomes
Step 4 — State a clear, evidence-based conclusion using ${subject} terminology
</details>

---

### Level 4: Analysis (Can you evaluate?)

**Question 4:** Compare TWO approaches related to ${topic}. What are the advantages and limitations of each? [4 marks]

<details>
<summary>Model Answer (4 marking points)</summary>
• Approach 1 advantage: More direct and easier to apply in time-pressured exams
• Approach 1 limitation: May oversimplify complex scenarios
• Approach 2 advantage: More comprehensive and earns higher marks for analysis questions
• Approach 2 limitation: Requires deeper understanding and more time in exams
</details>

---

### Level 5: Synthesis (Can you evaluate deeper?)

**Question 5:** "Mastering ${topic} is essential for success in ${subject}." Evaluate this statement. [6 marks]

<details>
<summary>Model Answer</summary>
**Agree points:**
- ${topic} appears in multiple question types and mark allocations
- Understanding it allows transfer of knowledge to unfamiliar contexts
- It is foundational to related subtopics: ${subs.slice(0, 2).join(', ')}

**Partial disagreement:**
- Other topics like ${subs[2] || 'applications'} are equally important
- Exam technique and time management also determine success

**Conclusion:** ${topic} is a high-priority topic that provides significant leverage across the exam paper. Mastering it is essential but must be combined with broader subject knowledge.
</details>`,

      'flashcards': () => `## 🃏 Flashcards: ${topic}
*Subject: ${subject} | ${subs.length} subtopics covered*

---

**Card 1**
**Front:** What is the definition of ${topic}?
**Back:** ${topic} is the study/principle of [core concept] within ${subject}. It covers the fundamental mechanisms, relationships, and applications that examiners test in structured and essay questions.

---

**Card 2**
**Front:** What are the ${subs.length} main subtopics within ${topic}?
**Back:** ${subs.map((s, i) => `${i + 1}. ${s}`).join(' | ')}

---

**Card 3**
**Front:** What command word indicates you need to apply ${topic}?
**Back:** "Apply," "Calculate," "Determine," or "Use [concept] to explain..." — these require you to use the mechanism/formula of ${topic} in context.

---

**Card 4**
**Front:** State a common exam mistake in ${topic} questions.
**Back:** Stating the concept without explaining the mechanism. Examiners require you to show *how* and *why*, not just *what*. Always follow a definition with an explanation of the process.

---

**Card 5**
**Front:** How does ${subs[0] || 'this subtopic'} relate to ${topic}?
**Back:** It is a component of ${topic} that focuses on [specific aspect]. It typically appears in [mark allocation] mark questions and requires [approach: description/calculation/evaluation].

---

**Card 6**
**Front:** Write one exam-style question you might be asked about ${topic}.
**Back:** Example: "Explain how ${topic} affects [related process] in ${subject}. [4 marks]" — Answer by defining, explaining mechanism, giving example, and linking to context.

---

**Card 7**
**Front:** What is the highest-level question type for ${topic}?
**Back:** Evaluation questions: "Assess," "Evaluate," "To what extent..." — require balanced argument, evidence, and a supported conclusion. Worth 6-8 marks.

---

**Card 8**
**Front:** Name two real-world applications of ${topic}.
**Back:** 1. [Application in a professional/scientific context relevant to ${subject}] 2. [Application in everyday life or cross-disciplinary context]`,

      'summary': () => `## 📋 Exam Summary: ${topic}
*Subject: ${subject}*

---

### 🔑 Key Definitions & Terms
- **${topic}**: The core concept in ${subject} that examines [fundamental principle]
${subs.map(s => `- **${s}**: A key component of ${topic} that relates to [specific function or principle]`).join('\n')}

---

### 📌 Essential Points (Must Know for Exam)
1. ⭐ The definition and fundamental mechanism of ${topic}
2. ⭐ How to apply ${topic} in structured exam questions  
3. ⭐ The relationship between ${subs[0] || 'subtopic 1'} and ${subs[1] || 'subtopic 2'}
4. Common examples and real-world applications
5. Potential sources of error or limitations
6. How ${topic} connects to other areas of ${subject}

---

### 📊 Subtopic Breakdown
${subs.map((s, i) => `**${i + 1}. ${s}**\n- Key principle: [what students must know]\n- Exam relevance: Frequently tested in [question type] questions\n- Common question: "Explain/Describe/Calculate [aspect of ${s}]"`).join('\n\n')}

---

### 📝 Common Exam Questions
1. "Define ${topic} and explain its significance in ${subject}." [2-3 marks]
2. "Describe how ${subs[0] || 'the main component'} functions within ${topic}." [4 marks]
3. "Evaluate the importance of ${topic} in [context]." [6 marks]
4. "Using ${topic}, explain why [scenario occurs]." [4-6 marks]

---

### ✅ Quick Self-Test
1. Can you define ${topic} without looking at your notes?
2. Can you explain the mechanism of ${subs[0] || 'the key subtopic'} in 3 sentences?
3. Can you write a model answer for a 4-mark question on ${topic}?`,

      'revision-checklist': () => `## ✅ Revision Checklist: ${topic}
*Subject: ${subject}*

Track your progress through every key concept. Tick each item only when you can explain it confidently!

---

### Core Definitions
- [ ] ⭐ I can define **${topic}** accurately in my own words
- [ ] ⭐ I can list the ${subs.length} main subtopics: ${subs.join(', ')}
- [ ] I can explain the difference between key related terms
- [ ] I know the correct subject-specific vocabulary for ${subject}

---

### Understanding (Can I explain it?)
${subs.map(s => `- [ ] ⭐ I can explain **${s}** and its role within ${topic}
- [ ] I can give a real-world example of **${s}**`).join('\n')}

---

### Application (Can I use it in exam questions?)
- [ ] ⭐ I can answer a 2-mark "State" question on ${topic}
- [ ] ⭐ I can answer a 4-mark "Explain" question on ${topic}
- [ ] I can answer a 6-mark "Evaluate" or "Assess" question on ${topic}
- [ ] I can apply ${topic} to an unfamiliar exam scenario

---

### Analysis & Evaluation
- [ ] I can compare two approaches or aspects within ${topic}
- [ ] I can evaluate the significance of ${topic} in ${subject}
- [ ] I can construct a balanced argument with evidence
- [ ] I can write a supported conclusion

---

### Exam Technique
- [ ] I know what "Describe," "Explain," and "Evaluate" require
- [ ] I allocate time correctly (1 min per mark)
- [ ] I use ${subject}-specific terminology throughout my answers
- [ ] I check my answers include all marking points

---

### ⭐ Priority Items (do these first!)
The starred items (⭐) above are high-priority — master these before moving on to lower-weight topics.`,
    };

    const fn = templates[taskType] || templates['concept-learning'];
    return fn();
  },

  // ── quiz question ──────────────────────────────────────────────────────────
  generateQuiz({ subject, topic, subtopics }) {
    const subs = subtopics || ['Core concepts', 'Key principles', 'Applications'];
    const questionTypes = [
      {
        question: `Explain the significance of ${topic} in ${subject}, referring to at least TWO key principles. [4 marks]`,
        marks: 4,
        modelAnswer: `Award 1 mark each for up to 4 valid points:\n• Correct definition of ${topic} in the context of ${subject}\n• Explanation of the first key principle with supporting detail\n• Explanation of the second key principle with supporting detail\n• Application to a relevant context or real-world example`,
        keyPoints: [
          `Definition of ${topic} within ${subject}`,
          `First key principle with explanation`,
          `Second key principle with explanation`,
          `Application or contextual example`,
        ],
        difficulty: 'medium',
        commandWords: ['Explain', 'Referring to'],
        conceptsTested: [topic, subs[0]],
      },
      {
        question: `Describe how ${subs[0] || 'the main component'} functions within the context of ${topic}. [3 marks]`,
        marks: 3,
        modelAnswer: `Award 1 mark each for:\n• What ${subs[0]} is (definition/identification)\n• How it functions or operates within ${topic}\n• The effect or outcome of this function`,
        keyPoints: [
          `Definition/identification of ${subs[0]}`,
          `Mechanism of function within ${topic}`,
          `Effect or outcome`,
        ],
        difficulty: 'low',
        commandWords: ['Describe'],
        conceptsTested: [topic, subs[0]],
      },
      {
        question: `Evaluate the importance of ${topic} in determining outcomes in ${subject}. Use evidence to support your answer. [6 marks]`,
        marks: 6,
        modelAnswer: `Award up to 6 marks:\n• AO1 (2 marks): Accurate knowledge — define ${topic}, state 2+ key features\n• AO2 (2 marks): Application — use specific examples showing how ${topic} affects outcomes\n• AO3 (2 marks): Evaluation — identify limitations, compare to alternative explanations, reach a supported conclusion`,
        keyPoints: [
          `Knowledge: definition and key features of ${topic}`,
          `Application: specific example(s) of ${topic} in action`,
          `Analysis: explanation of how ${topic} determines outcomes`,
          `Evaluation: consideration of limitations or alternative factors`,
          `Conclusion: supported judgement on the importance of ${topic}`,
        ],
        difficulty: 'high',
        commandWords: ['Evaluate', 'Use evidence'],
        conceptsTested: [topic, subs[0], subs[1] || 'Applications'],
      },
      {
        question: `Calculate or determine the outcome when ${topic} principles are applied to the following scenario: A student is asked to demonstrate understanding of ${subs[0] || 'the key concept'} in an unfamiliar context. Outline the steps you would take. [5 marks]`,
        marks: 5,
        modelAnswer: `Award 1 mark each for:\n• Identify the relevant aspect of ${topic}\n• State the appropriate method or framework\n• Apply the method correctly to the scenario\n• Check or verify the result\n• State a clear, justified conclusion`,
        keyPoints: [
          `Identify relevant aspect of ${topic}`,
          `State appropriate method/framework`,
          `Correct application of method`,
          `Verification of result`,
          `Clear justified conclusion`,
        ],
        difficulty: 'medium',
        commandWords: ['Calculate', 'Determine', 'Outline'],
        conceptsTested: [topic, subs[0]],
      },
    ];
    // Rotate question type based on topic hash for variety
    const idx = topic.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % questionTypes.length;
    const q = questionTypes[idx];
    return { id: `q-${Date.now()}`, subject, topic, ...q };
  },

  // ── explain answer ─────────────────────────────────────────────────────────
  explainAnswer({ question, studentAnswer, modelAnswer, topic, subject }) {
    return `## 📝 Answer Feedback: ${topic || 'Your Response'}
*Subject: ${subject || 'Study'}*

---

### ✅ What You Got Right
Your answer shows engagement with the question and some understanding of the core concept. Attempting to apply your knowledge to the question is the right approach — now let's refine it.

---

### 🎯 Where to Improve

**The Gap:** Your answer addressed the question at a surface level but may be missing the specific mechanisms and depth that examiners look for. In ${subject} exams, it's not just *what* you say but *how precisely* you say it.

**Key Issue:** ${modelAnswer ? 
  'Compare your response to the model answer below — notice how the model answer provides specific mechanisms, uses subject terminology, and directly addresses each mark point.' : 
  'Focus on structuring your answer around the marking criteria: each mark requires a distinct, relevant point with supporting explanation.'}

---

### 📚 The Correct Explanation

${modelAnswer ? 
  `The model answer shows:\n\n> *${modelAnswer.substring(0, 400)}${modelAnswer.length > 400 ? '...' : ''}*\n\nKey technique: Each point earns a mark by stating a fact AND explaining its significance.` :
  `For this type of question:\n1. Start with a clear definition or statement\n2. Explain the mechanism or process\n3. Give a specific example or application\n4. Link back to the question context`}

---

### 💡 Your Improvement Strategy

**For next time:**
1. **Use command-word awareness** — "Explain" requires mechanism; "Describe" requires features; "Evaluate" requires judgement
2. **One point per mark** — Plan your answer with bullet points before writing
3. **Use ${subject} terminology** — Precise vocabulary signals understanding to examiners
4. **End with a conclusion** — For 4+ mark questions, always connect back to the question

---

### 🔑 Remember
The examiner cannot read your mind — write out every step of your reasoning. What seems obvious to you must be stated explicitly to earn marks.`;
  },

  // ── progress insights ──────────────────────────────────────────────────────
  progressInsights({ subjects, dailyStats, streak, xp, quizHistory }) {
    const topSubject = subjects?.[0]?.name || 'your main subject';
    const weakTopic = quizHistory?.find(q => (q.accuracy || 1) < 0.6)?.topic_name;
    const strongTopic = quizHistory?.find(q => (q.accuracy || 0) >= 0.8)?.topic_name;

    return `## 📊 Your Study Performance Insights

---

### 💪 Strengths
${strongTopic ? `- ✅ **${strongTopic}**: Strong performance! Your accuracy here shows solid understanding — keep reviewing to lock it in long-term.` : `- ✅ Your study streak of ${streak || 0} days demonstrates excellent consistency — this is the #1 predictor of exam success.`}
- 📈 You've earned **${xp || 0} total XP** — every point represents real knowledge acquired
${dailyStats?.tasksCompletedToday > 0 ? `- ✅ Today: ${dailyStats.tasksCompletedToday}/${dailyStats.totalTasksToday || '?'} tasks completed — you're actively working through your study plan` : ''}

---

### 🎯 Priority Focus Areas
${weakTopic ? `- ⚠️ **${weakTopic}** needs attention — accuracy below 60% means gaps in understanding. Prioritise this topic in today's session.` : `- 📚 Continue building mastery in **${topSubject}** — consistent daily practice compounds over time.`}
- 🔄 Review topics that are "due for review" in your spaced repetition schedule — these are at risk of being forgotten

---

### 📋 Today's Recommendation
1. **Start with** ${weakTopic || 'your most challenging topic'} — tackle your hardest content when your focus is fresh
2. **Complete** at least 3 exam-style questions to build exam technique
3. **Review** any topic where accuracy is below 70%

---

### 🌟 Personal Encouragement
${streak >= 7 ? `A ${streak}-day streak is exceptional — you're in the top tier of students who actually follow through on their study plans.` : streak > 0 ? `${streak} days of consistent study already sets you apart — keep building this habit.` : `Every journey starts with a single session — today's study puts you ahead of where you were yesterday.`}

> **Key insight:** Students who review weak topics first and do daily exam practice outscore those who only re-read notes by an average of 15-20%. You have the tools — now use them strategically.`;
  },

  // ── detect weak topics ──────────────────────────────────────────────────────
  detectWeakTopics({ topicStats }) {
    const weakTopics = (topicStats || [])
      .filter(t => (t.accuracy || 1) < 0.7)
      .sort((a, b) => (a.accuracy || 1) - (b.accuracy || 1))
      .slice(0, 5)
      .map(t => {
        const acc = Math.round((t.accuracy || 0) * 100);
        const severity = acc < 40 ? 'critical' : acc < 60 ? 'warning' : 'watch';
        return {
          topic: t.topic_name || 'Unknown topic',
          severity,
          reason: `${acc}% accuracy across ${t.total_attempts || 0} attempts — ${severity === 'critical' ? 'significant gaps in understanding detected' : severity === 'warning' ? 'inconsistent understanding needs targeted practice' : 'approaching mastery but needs reinforcement'}`,
          suggestion: severity === 'critical' ? 
            `Restart with concept-learning tasks for this topic before attempting more exam questions` :
            severity === 'warning' ? 
            `Complete 2-3 active-recall sessions and then retry exam questions` :
            `One focused revision session should push this to mastery level`,
        };
      });

    const hasWeakTopics = weakTopics.length > 0;
    const criticalCount = weakTopics.filter(t => t.severity === 'critical').length;

    return {
      weakTopics,
      overallMessage: hasWeakTopics ?
        `${weakTopics.length} topic(s) identified for priority revision${criticalCount > 0 ? ` — ${criticalCount} critical area(s) need immediate attention` : ''}. Focus your next sessions on these before moving to new material.` :
        `Great work! No significant weak areas detected. Continue your current study pattern and maintain regular review sessions to prevent knowledge decay.`,
      tutoringRecommended: criticalCount >= 2,
      tutoringReason: criticalCount >= 2 ? `${criticalCount} critical weak topics suggest you may benefit from one-to-one tuition to address foundational gaps` : null,
      studentStruggles: weakTopics.slice(0, 2).map(t => ({
        topic: t.topic,
        struggle: 'Accuracy below target threshold',
        misconception: 'May have surface-level understanding without deep conceptual grasp',
        suggestedApproach: 'Use concept-learning tasks to rebuild understanding from foundations, then test with exam questions',
      })),
    };
  },

  // ── analyze prerequisites ──────────────────────────────────────────────────
  analyzePrerequisites({ subject, topic }) {
    // Return empty gaps by default — topics usually have foundational prerequisites handled
    return { gaps: [] };
  },

  // ── prerequisite theory ────────────────────────────────────────────────────
  prerequisiteTheory({ subject, prerequisiteTopic, missingConcepts }) {
    const concepts = missingConcepts?.length ? missingConcepts : ['core principles', 'fundamental concepts'];
    return `## 📚 Foundation Lesson: ${prerequisiteTopic}
*${subject} — Prerequisite Review*

Before tackling your main topic, let's make sure you have the foundational understanding you need.

---

### Key Concepts to Know

${concepts.map((c, i) => `**${i + 1}. ${c}**
Understanding this concept means you can identify it in exam questions and explain how it works. In ${subject}, this appears in questions asking you to "describe the basis of..." or "explain why..."`).join('\n\n')}

---

### Connection to Your Main Topic

These prerequisites directly support your understanding of the next topic. When you encounter questions on the main topic, you'll draw on these foundations to build complete, mark-worthy answers.

---

### Quick Check
Before moving on, make sure you can:
- [ ] Define the key terms listed above
- [ ] Give one example of each concept
- [ ] Explain how each concept connects to ${subject} exam questions`;
  },

  // ── prerequisite quiz ──────────────────────────────────────────────────────
  prerequisiteQuiz({ subject, topic, questionCount = 3 }) {
    const n = Math.min(questionCount, 5);
    const questions = Array.from({ length: n }, (_, i) => ({
      question: [
        `Which of the following best describes the foundational principle of ${topic} in ${subject}?`,
        `When applying ${topic} in ${subject}, what is the first step to take?`,
        `Which concept is most closely related to ${topic}?`,
        `What does it mean to 'evaluate' a concept in ${subject} exams?`,
        `Which of the following is a key characteristic of ${topic}?`,
      ][i] || `What is a key principle of ${topic} in ${subject}?`,
      options: [
        `The systematic analysis of key principles and their applications`,
        `A memorisation strategy with no analytical component`,
        `An unrelated concept from a different subject area`,
        `A topic that does not appear in exam papers`,
      ],
      correctAnswer: 0,
      explanation: `The correct answer recognises that ${topic} in ${subject} involves systematic understanding and application, not mere memorisation. Examiners test your ability to analyse and apply — not just recall.`,
    }));
    return { questions };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  UNIFIED AI CALL: tries live API first, falls back to local engine
// ═══════════════════════════════════════════════════════════════════════════════

async function callAI(messages, options = {}) {
  const valid = await isCredentialValid();
  if (valid) {
    try {
      const client = getClient();
      const params = { model: MODEL, messages, ...options };
      return await client.chat.completions.create(params);
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        _credentialValid = false;
        console.warn('[AI proxy] API key invalid — switching to local fallback');
      } else {
        throw err;
      }
    }
  }
  return null; // signal: use local fallback
}

async function callAIStream(messages, options = {}) {
  const valid = await isCredentialValid();
  if (valid) {
    try {
      const client = getClient();
      const params = { model: MODEL, messages, stream: true, ...options };
      return await client.chat.completions.create(params);
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        _credentialValid = false;
        console.warn('[AI proxy] API key invalid — switching to local fallback');
      } else {
        throw err;
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/ai/health
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/ai/health', async (_req, res) => {
  const creds = loadCredentials();
  const valid = await isCredentialValid();
  res.json({
    status: 'ok',
    mode: valid ? 'live-api' : 'local-fallback',
    model: valid ? MODEL : 'local-engine',
    baseUrl: creds?.baseURL || 'local',
    hasKey: !!creds,
    keyValid: valid,
    message: valid ? 'Live AI API active' : 'Using local AI engine — inject a valid OPENAI_API_KEY to enable live AI',
    endpoints: [
      'POST /api/ai/tutor',
      'POST /api/ai/generate-quiz',
      'POST /api/ai/generate-task-content',
      'POST /api/ai/explain-answer',
      'POST /api/ai/greeting',
      'POST /api/ai/parse-document',
      'POST /api/ai/progress-insights',
      'POST /api/ai/detect-weak-topics',
      'POST /api/ai/daily-summary',
      'POST /api/ai/streak-celebration',
      'POST /api/ai/analyze-prerequisites',
      'POST /api/ai/generate-prerequisite-theory',
      'POST /api/ai/generate-prerequisite-quiz',
    ],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/tutor  (streaming SSE)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ai/tutor', async (req, res) => {
  try {
    const { messages, subject, topic, syllabusContext } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    let contextInfo = '';
    if (subject) contextInfo += `The student is currently studying ${subject}.`;
    if (topic) contextInfo += ` They are on the topic: ${topic}.`;

    const systemPrompt = `You are StudySync AI, a personal exam strategist and tutor. ${contextInfo}${syllabusContext || ''}

Core principles:
1. **Syllabus Authority**: All teaching must map to syllabus topics.
2. **Exam Focus**: Prioritise what examiners test most frequently.
3. **Efficient Learning**: Help students study smarter.

Teaching style:
- Be encouraging but direct
- Use precise academic terminology with simple language
- Give examples that connect to real life
- Highlight common exam mistakes
- Structure answers with headers and bullet points
- Use markdown formatting

When answering: 1) Explain the concept 2) Show exam application 3) Mention related topics`;

    const stream = await callAIStream([{ role: 'system', content: systemPrompt }, ...messages]);

    if (stream) {
      await streamToResponse(stream, res);
    } else {
      // Local fallback: generate a contextual tutor response
      const lastMsg = messages[messages.length - 1]?.content || '';
      const localResponse = `## StudySync AI Tutor

${subject ? `*Currently studying: **${subject}**${topic ? ` — ${topic}` : ''}*` : ''}

---

Thanks for your question! Let me help you with that.

**Understanding the concept:**
Your question relates to an important area in ${subject || 'your subject'}. Here's a structured explanation:

1. **Core principle**: The fundamental idea here is to understand the underlying mechanism and how examiners test it
2. **Application**: In exam conditions, you would approach this by first identifying what the question is asking (the command word), then structuring your answer to address each mark point
3. **Common mistake to avoid**: Many students answer these questions too briefly — always explain the *mechanism*, not just state the fact

**How this appears in exams:**
Examiners typically ask about this in "Explain" or "Evaluate" type questions worth 4-6 marks. A high-scoring answer includes: definition → mechanism → example → conclusion.

**Related topics you should also review:**
- The prerequisite concepts that underpin this topic
- Connected subtopics that often appear alongside it
- Real-world applications that examiners use as contexts

> 💡 **Tip**: Use the task cards in your study dashboard to generate active recall questions on this topic — that's the fastest way to solidify this knowledge before exams.

Feel free to ask a follow-up question or request a specific exam question on this topic!`;
      await streamString(localResponse, res);
    }
  } catch (err) {
    handleError(res, 'ai-tutor', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/generate-quiz  (JSON)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ai/generate-quiz', async (req, res) => {
  try {
    const { subject, topic, topicContext, curriculumContext, examWeight } = req.body;
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });

    const systemPrompt = `You are an expert exam question generator for ${subject}.
Create realistic exam-style questions. Respond with ONLY valid JSON:
{"question":"string","marks":5,"modelAnswer":"string","keyPoints":["string"],"difficulty":"medium","commandWords":["string"],"conceptsTested":["string"]}`;

    let userPrompt = `Generate one exam-style question:\nSubject: ${subject}\nTopic: ${topic}`;
    if (topicContext) userPrompt += `\n${topicContext}`;
    if (examWeight) userPrompt += `\nExam weight: ${examWeight}%`;
    if (curriculumContext) userPrompt += `\n\nCurriculum:\n${String(curriculumContext).substring(0, 3000)}`;

    const completion = await callAI(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { response_format: { type: 'json_object' } }
    );

    if (completion) {
      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('AI did not return a question');
      let questionData;
      try { questionData = JSON.parse(content); }
      catch {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) questionData = JSON.parse(match[0]);
        else throw new Error('Could not parse AI response as JSON');
      }
      return res.json(questionData);
    }

    // Local fallback
    const subtopics = topicContext ? [topicContext.substring(0, 50)] : undefined;
    const questionData = fallback.generateQuiz({ subject, topic, subtopics });
    res.json(questionData);
  } catch (err) {
    // Even on error, return a local fallback question
    const { subject = 'Your Subject', topic = 'This Topic' } = req.body || {};
    console.error('[generate-quiz] Falling back to local:', err?.message);
    res.json(fallback.generateQuiz({ subject, topic }));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/generate-task-content  (streaming SSE)
// ─────────────────────────────────────────────────────────────────────────────
const TASK_PROMPTS = {
  'micro-revision': `You are an expert tutor. Create a 2-3 minute micro-revision session with 3 questions and brief model answers. Start with a 1-sentence refresher. Use markdown.`,
  'concept-learning': `You are an expert tutor. Create a concept deep-dive: WHY it matters for exams, step-by-step explanation, real example, common mistakes, 2 key takeaways. Use markdown headers.`,
  'active-recall': `You are an expert tutor. Create 5 active-recall questions (increasing difficulty): definitions → applications → analysis. Each has a hidden model answer. Use markdown.`,
  'exam-question': `You are an expert exam writer. Write one realistic exam question with marks, command word, and a full model answer / marking scheme. Use markdown.`,
  'flashcards': `You are an expert tutor. Create 6-8 flashcards: Front (question/term) → Back (answer). Cover key vocabulary and concepts. Format: **Front:** ... | **Back:** ...`,
  'summary': `You are an expert tutor. Create a comprehensive exam summary: key definitions, essential points (⭐ for high priority), common exam questions, self-test at the end. Use markdown.`,
  'revision-checklist': `You are an expert tutor. Create a revision checklist with checkboxes (- [ ]), grouped by subtopic, high-priority items marked ⭐. Include "I can explain..." and "I can apply..." items. Use markdown.`,
};

app.post('/api/ai/generate-task-content', async (req, res) => {
  try {
    const { taskType, subject, topic, subtopics, examWeight, curriculumContext } = req.body;
    if (!taskType || !subject || !topic) {
      return res.status(400).json({ error: 'taskType, subject, and topic are required' });
    }

    const systemPrompt = TASK_PROMPTS[taskType] || TASK_PROMPTS['concept-learning'];
    let userPrompt = `Subject: ${subject}\nTopic: ${topic}`;
    if (subtopics?.length) userPrompt += `\nSubtopics: ${subtopics.join(', ')}`;
    if (examWeight) userPrompt += `\nExam weight: ${examWeight}%`;
    if (curriculumContext) userPrompt += `\n\nCurriculum context:\n${String(curriculumContext).substring(0, 3000)}`;

    const stream = await callAIStream([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    if (stream) {
      await streamToResponse(stream, res);
    } else {
      const content = fallback.taskContent({ taskType, subject, topic, subtopics, examWeight });
      await streamString(content, res);
    }
  } catch (err) {
    // Even on error, stream local fallback
    const { taskType = 'concept-learning', subject = 'Your Subject', topic = 'This Topic', subtopics } = req.body || {};
    console.error('[generate-task-content] Falling back to local:', err?.message);
    const content = fallback.taskContent({ taskType, subject, topic, subtopics });
    if (!res.headersSent) await streamString(content, res);
    else res.end();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/explain-answer  (streaming SSE)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ai/explain-answer', async (req, res) => {
  try {
    const { question, studentAnswer, modelAnswer, topic, subject } = req.body;
    if (!question || !studentAnswer) {
      return res.status(400).json({ error: 'question and studentAnswer are required' });
    }

    const systemPrompt = `You are a supportive expert tutor. Help the student understand what they missed.
1. Acknowledge what's right (if anything)
2. Identify specific gaps/misconceptions
3. Explain the correct concept clearly
4. Show how model answer addresses marking criteria
5. Give a memorable tip

Tone: Encouraging, clear. Format: Markdown. 150-300 words.`;

    const userPrompt = `Subject: ${subject || 'Unknown'}\nTopic: ${topic || 'Unknown'}
**Question:** ${question}
**Student's Answer:** ${studentAnswer}
**Model Answer:** ${modelAnswer || 'Not provided'}
Please explain what was missed and how to improve.`;

    const stream = await callAIStream([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    if (stream) {
      await streamToResponse(stream, res);
    } else {
      const content = fallback.explainAnswer({ question, studentAnswer, modelAnswer, topic, subject });
      await streamString(content, res);
    }
  } catch (err) {
    const { question, studentAnswer, modelAnswer, topic, subject } = req.body || {};
    console.error('[explain-answer] Falling back to local:', err?.message);
    const content = fallback.explainAnswer({ question, studentAnswer, modelAnswer, topic, subject });
    if (!res.headersSent) await streamString(content, res);
    else res.end();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/greeting  (JSON)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ai/greeting', async (req, res) => {
  try {
    const { studentName, hour, streak, daysUntilExam, examName, tasksCompletedToday, totalTasksToday, lastStudyDate, scheduleAdherence } = req.body;
    const h = hour ?? new Date().getHours();
    const timeOfDay = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';

    const completion = await callAI([
      { role: 'system', content: `You are an encouraging AI study coach. Generate a short, personalised greeting (1-2 sentences MAX). Be warm, motivating, specific. No fluff.` },
      { role: 'user', content: `Greeting for:\n- Time: ${timeOfDay}\n- Name: ${studentName || 'student'}\n- Streak: ${streak || 0} days\n- Days until ${examName || 'exam'}: ${daysUntilExam ?? 'unknown'}\n- Progress: ${tasksCompletedToday || 0}/${totalTasksToday || 0} tasks\n- Adherence: ${scheduleAdherence || 'N/A'}\nKeep under 2 sentences.` },
    ], { max_tokens: 100 });

    if (completion) {
      const content = completion.choices[0]?.message?.content?.trim() || '';
      return res.json({ greeting: content || `Good ${timeOfDay}${studentName ? ', ' + studentName : ''}! Ready to study?` });
    }

    res.json({ greeting: fallback.greeting(req.body) });
  } catch (err) {
    console.error('[ai-greeting]', err?.message);
    res.json({ greeting: fallback.greeting(req.body || {}) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/parse-document  (JSON)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ai/parse-document', async (req, res) => {
  try {
    const { content, documentType, subject } = req.body;
    if (!content) return res.status(400).json({ error: 'content is required' });

    let systemPrompt, schemaHint;
    if (documentType === 'syllabus') {
      systemPrompt = `You are an expert curriculum analyst. Extract complete syllabus structure. Respond with ONLY valid JSON:`;
      schemaHint = `{"subject_name":"string","syllabus_code":"string|null","topics":[{"id":"topic-1","name":"string","subtopics":["string"],"learningObjectives":["string"],"examWeight":0,"prerequisites":[],"concepts":["string"]}]}`;
    } else if (documentType === 'past_paper') {
      systemPrompt = `You are an expert exam pattern analyst. Analyse this past paper. Respond with ONLY valid JSON:`;
      schemaHint = `{"paper_year":"string","paper_variant":"string","total_marks":0,"questions":[{"question_number":"1","topic":"string","subtopic":"string","marks":0,"question_type":"structured","difficulty":"medium","command_words":["string"],"concepts_tested":["string"]}],"topic_frequency":[{"topic":"string","total_marks":0,"question_count":0,"percentage_of_paper":0}]}`;
    } else {
      systemPrompt = `You are an expert exam analyst. Extract key information. Respond with ONLY valid JSON:`;
      schemaHint = `{"topics_covered":["string"],"key_points":[{"topic":"string","points":["string"],"common_mistakes":["string"]}]}`;
    }

    const completion = await callAI([
      { role: 'system', content: systemPrompt + '\n\nSchema:\n' + schemaHint },
      { role: 'user', content: `Subject: ${subject || 'Unknown'}\n\nDocument:\n${String(content).substring(0, 12000)}` },
    ], { response_format: { type: 'json_object' } });

    if (completion) {
      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error('AI did not return structured data');
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { const m = raw.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); else throw new Error('Could not parse AI response'); }
      return res.json({ success: true, parsed });
    }

    // Local fallback: basic structure extraction
    const lines = content.split('\n').filter(l => l.trim().length > 5).slice(0, 50);
    const topics = lines.slice(0, 10).map((l, i) => ({
      id: `topic-${i + 1}`,
      name: l.trim().substring(0, 60),
      subtopics: [],
      learningObjectives: ['Understand and apply the core concepts of this topic'],
      examWeight: Math.round(100 / Math.min(lines.length, 10)),
      prerequisites: [],
      concepts: [],
    }));
    res.json({
      success: true,
      parsed: documentType === 'syllabus' ?
        { subject_name: subject || 'Unknown', syllabus_code: null, topics } :
        { topics_covered: lines.slice(0, 10).map(l => l.trim().substring(0, 50)), key_points: [] },
    });
  } catch (err) {
    handleError(res, 'parse-document', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/progress-insights  (streaming SSE)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ai/progress-insights', async (req, res) => {
  try {
    const { subjects, dailyStats, streak, xp, quizHistory, masteryData } = req.body;

    const systemPrompt = `You are a personalised study coach AI. Analyse the student's performance and provide actionable insights.
Your response: 1) Highlight strengths 2) Identify top 1-2 focus areas 3) Give concrete recommendation for today 4) Motivate with personalised encouragement
Concise (4-6 bullet points). Markdown with emojis. Direct and supportive.`;

    const userPrompt = `Student data:
- Streak: ${streak || 0} days | Total XP: ${xp || 0}
- Today: ${dailyStats?.tasksCompletedToday || 0}/${dailyStats?.totalTasksToday || 0} tasks, ${dailyStats?.examQuestionsToday || 0} exam questions, +${dailyStats?.xpToday || 0} XP
Subjects: ${(subjects || []).map(s => `${s.name}: ${s.mastery}% mastery (${s.currentTopic})`).join(', ') || 'None yet'}
Quiz: ${(quizHistory || []).slice(0, 5).map(q => `${q.topic_name}: ${Math.round((q.accuracy || 0) * 100)}%`).join(', ') || 'None yet'}
Mastery: ${(masteryData || []).map(m => `${m.name}: ${m.current}% (${m.change >= 0 ? '+' : ''}${m.change}%)`).join(', ') || 'None yet'}`;

    const stream = await callAIStream([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    if (stream) {
      await streamToResponse(stream, res);
    } else {
      const content = fallback.progressInsights({ subjects, dailyStats, streak, xp, quizHistory, masteryData });
      await streamString(content, res);
    }
  } catch (err) {
    const content = fallback.progressInsights(req.body || {});
    if (!res.headersSent) await streamString(content, res);
    else res.end();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/detect-weak-topics  (JSON)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ai/detect-weak-topics', async (req, res) => {
  try {
    const { topicStats, subjects } = req.body;

    const systemPrompt = `You are an expert educational diagnostician. Analyse quiz performance data.
Respond with ONLY valid JSON:
{"weakTopics":[{"topic":"string","severity":"critical|warning|watch","reason":"string","suggestion":"string"}],"overallMessage":"string","tutoringRecommended":false,"tutoringReason":null,"studentStruggles":[{"topic":"string","struggle":"string","misconception":"string","suggestedApproach":"string"}]}
Severity: critical=<40% accuracy, warning=40-60%, watch=60-70%`;

    const userPrompt = `Topic performance:\n${(topicStats || []).map(t => `- ${t.topic_name}: ${Math.round((t.accuracy || 0) * 100)}% accuracy, ${t.total_attempts || 0} attempts${t.due_for_review ? ', DUE FOR REVIEW' : ''}`).join('\n') || 'No data yet'}\nSubjects: ${(subjects || []).map(s => s.name).join(', ') || 'Unknown'}`;

    const completion = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { response_format: { type: 'json_object' } });

    if (completion) {
      const raw = completion.choices[0]?.message?.content;
      if (!raw) return res.json(fallback.detectWeakTopics({ topicStats, subjects }));
      let result;
      try { result = JSON.parse(raw); } catch { result = fallback.detectWeakTopics({ topicStats, subjects }); }
      return res.json(result);
    }

    res.json(fallback.detectWeakTopics({ topicStats, subjects }));
  } catch (err) {
    console.error('[detect-weak-topics]', err?.message);
    res.json(fallback.detectWeakTopics(req.body || {}));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/daily-summary  (streaming SSE)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ai/daily-summary', async (req, res) => {
  try {
    const { tasksCompleted, totalTasks, examQuestions, xpToday, streak, totalXp, badgeCount } = req.body;

    const systemPrompt = `You are an encouraging AI study coach. Write 2-3 sentences acknowledging what the student accomplished (be specific), motivate them, give one brief tip. Tone: Warm, genuine. Use 1-2 relevant emojis. Plain text, no markdown headers.`;

    const userPrompt = `Today:\n- Tasks: ${tasksCompleted || 0}/${totalTasks || 0}\n- Exam questions: ${examQuestions || 0}\n- XP today: ${xpToday || 0}\n- Streak: ${streak || 0} days\n- Total XP: ${totalXp || 0} | Badges: ${badgeCount || 0}`;

    const stream = await callAIStream([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { max_tokens: 150 });

    if (stream) {
      await streamToResponse(stream, res);
    } else {
      const content = fallback.dailySummary(req.body || {});
      await streamString(content, res);
    }
  } catch (err) {
    const content = fallback.dailySummary(req.body || {});
    if (!res.headersSent) await streamString(content, res);
    else res.end();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/streak-celebration  (JSON)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ai/streak-celebration', async (req, res) => {
  try {
    const { milestone, streak, totalXp, badgeCount, tasksCompletedToday } = req.body;

    const completion = await callAI([
      { role: 'system', content: 'You are an enthusiastic AI coach celebrating a study streak milestone. Write ONE personalised celebration message (2-3 sentences). Be genuinely excited. Use 1-2 emojis.' },
      { role: 'user', content: `Student just hit a ${milestone}-day streak! Stats: ${streak} days, ${totalXp} XP, ${badgeCount} badges, ${tasksCompletedToday} tasks today.` },
    ], { max_tokens: 100 });

    if (completion) {
      const message = completion.choices[0]?.message?.content?.trim();
      return res.json({ message: message || fallback.streakCelebration(req.body) });
    }
    res.json({ message: fallback.streakCelebration(req.body || {}) });
  } catch (err) {
    console.error('[streak-celebration]', err?.message);
    res.json({ message: fallback.streakCelebration(req.body || {}) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/analyze-prerequisites  (JSON)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ai/analyze-prerequisites', async (req, res) => {
  try {
    const { subject, topic } = req.body;
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });

    const completion = await callAI([
      {
        role: 'system',
        content: `You are an expert curriculum analyst. What prerequisite knowledge is needed before studying a specific topic?
Respond with ONLY valid JSON: {"gaps":[{"topic":"string","description":"string","exampleQuestions":["string"],"missingConcepts":["string"]}]}
Return 0-3 gaps. If no significant gaps, return {"gaps":[]}. Only flag truly foundational gaps.`,
      },
      { role: 'user', content: `Subject: ${subject}\nTopic: ${topic}\nList prerequisite knowledge gaps.` },
    ], { response_format: { type: 'json_object' } });

    if (completion) {
      const raw = completion.choices[0]?.message?.content;
      let result;
      try { result = JSON.parse(raw || '{}'); } catch { result = { gaps: [] }; }
      if (!result.gaps) result = { gaps: [] };
      return res.json(result);
    }
    res.json(fallback.analyzePrerequisites({ subject, topic }));
  } catch (err) {
    console.error('[analyze-prerequisites]', err?.message);
    res.json({ gaps: [] });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/generate-prerequisite-theory  (JSON)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ai/generate-prerequisite-theory', async (req, res) => {
  try {
    const { subject, prerequisiteTopic, missingConcepts } = req.body;
    if (!subject || !prerequisiteTopic) return res.status(400).json({ error: 'subject and prerequisiteTopic are required' });

    const completion = await callAI([
      {
        role: 'system',
        content: `You are an expert tutor. Create a focused prerequisite theory lesson (under 300 words). Cover essential foundational concepts, 2-3 key points, and show connection to the next topic. Use markdown.`,
      },
      {
        role: 'user',
        content: `Subject: ${subject}\nPrerequisite topic: ${prerequisiteTopic}\nMissing concepts: ${(missingConcepts || []).join(', ') || 'General foundations'}\n\nCreate a concise prerequisite lesson.`,
      },
    ], { max_tokens: 600 });

    if (completion) {
      const theory = completion.choices[0]?.message?.content?.trim();
      return res.json({ theory: theory || fallback.prerequisiteTheory(req.body) });
    }
    res.json({ theory: fallback.prerequisiteTheory(req.body || {}) });
  } catch (err) {
    console.error('[generate-prerequisite-theory]', err?.message);
    res.json({ theory: fallback.prerequisiteTheory(req.body || {}) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/generate-prerequisite-quiz  (JSON)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ai/generate-prerequisite-quiz', async (req, res) => {
  try {
    const { subject, topic, questionCount = 3 } = req.body;
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });

    const completion = await callAI([
      {
        role: 'system',
        content: `You are an expert quiz creator. Generate ${questionCount} multiple-choice questions.
ONLY valid JSON: {"questions":[{"question":"string","options":["A","B","C","D"],"correctAnswer":0,"explanation":"string"}]}
correctAnswer is 0-based index. Make distractors plausible.`,
      },
      { role: 'user', content: `Subject: ${subject}\nTopic: ${topic}\nGenerate ${questionCount} basic multiple-choice questions.` },
    ], { response_format: { type: 'json_object' } });

    if (completion) {
      const raw = completion.choices[0]?.message?.content;
      let result;
      try { result = JSON.parse(raw || '{}'); }
      catch { const m = (raw || '').match(/\{[\s\S]*\}/); result = m ? JSON.parse(m[0]) : { questions: [] }; }
      if (!result.questions) result = { questions: [] };
      return res.json(result);
    }
    res.json(fallback.prerequisiteQuiz({ subject, topic, questionCount }));
  } catch (err) {
    console.error('[generate-prerequisite-quiz]', err?.message);
    res.json(fallback.prerequisiteQuiz(req.body || {}));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Start server
// ─────────────────────────────────────────────────────────────────────────────
const creds = loadCredentials();
console.log(`\n🚀 StudySync AI proxy starting...`);
console.log(`   Credentials: ${creds ? `loaded (key: ${creds.apiKey.substring(0, 8)}...)` : 'none configured'}`);
console.log(`   Model: ${MODEL}`);
console.log(`   Local fallback: ALWAYS active`);

app.listen(PORT, () => {
  console.log(`\n✅ StudySync AI proxy running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/ai/health`);
  console.log(`   13 endpoints ready (live API + local fallback)\n`);
});
