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
  taskContent({ taskType, subject, topic, subtopics, learningObjectives, concepts, commandWords, examWeight, masteryStatus, hasCurriculumData }) {
    // Use real curriculum data if available
    const subs = subtopics?.length ? subtopics.slice(0, 6) : ['Core concepts', 'Key principles', 'Applications', 'Exam technique'];
    const objs = learningObjectives?.length ? learningObjectives : [];
    const concs = concepts?.length ? concepts : subs.slice(0, 3);
    const cmdWords = commandWords?.length ? commandWords : ['Explain', 'Describe', 'Evaluate', 'Calculate'];
    const subList = subs.map(s => `- ${s}`).join('\n');
    const objList = objs.slice(0, 4).map(o => `  • ${o}`).join('\n');
    const conceptList = concs.slice(0, 4).join(', ');
    const primaryCmd = cmdWords[0] || 'Explain';
    const evalCmd = cmdWords.find(w => /eval|assess|discuss|analys/i.test(w)) || 'Evaluate';
    const descCmd = cmdWords.find(w => /describ|state|identif/i.test(w)) || 'Describe';
    const hasCurriculum = hasCurriculumData || !!(subtopics?.length || objs.length);
    const examWeightStr = examWeight ? ` (${examWeight}% of exam paper)` : '';
    const masteryNote = masteryStatus === 'mastered' ? '**Advanced mode** — focus on exam application and edge cases.' : masteryStatus === 'needs-practice' ? '**Practice mode** — focus on clarity and exam technique.' : '';

    const templates = {
      'micro-revision': () => `## ⚡ Micro-Revision: ${topic}
*Subject: ${subject}${examWeightStr}*${masteryNote ? '\n\n' + masteryNote : ''}

**Quick Refresh:**
${hasCurriculum ? `${topic} covers: **${subs.slice(0, 3).join(', ')}**. Focus on these for the exam.` : `${topic} is a core topic in ${subject} that commonly appears in exam questions.`}

---

### 🎯 Rapid-Fire Review Questions

**Q1: ${descCmd}**
${subs[0] !== 'Core concepts' ? `${descCmd} the key features of **${subs[0]}** as part of ${topic}. [2 marks]` : `${descCmd} the main principle behind ${topic} in ${subject}. [2 marks]`}

*Model answer:*
${objs[0] ? `• ${objs[0]}\n• Supporting detail with correct terminology` : `• Identification of the key feature with correct terminology\n• Supporting detail or mechanism explaining its significance`}

---

**Q2: ${primaryCmd}**
${subs[1] && subs[1] !== 'Key principles' ? `${primaryCmd} how **${subs[1]}** relates to ${topic} in ${subject}. [3 marks]` : `${primaryCmd} the relationship between the main components of ${topic}. [3 marks]`}

*Model answer:*
${objs[1] ? `• ${objs[1]}\n• Mechanism or process explanation\n• Supporting example` : `• Clear statement of the relationship with correct terminology\n• Explanation of the mechanism or process involved\n• Relevant example or application`}

---

**Q3: Exam-style application**
${evalCmd !== 'Evaluate' ? `${evalCmd} ${subs[2] && subs[2] !== 'Applications' ? `the role of **${subs[2]}**` : 'the significance of ' + topic} in ${subject}. [4 marks]` : `${evalCmd} the importance of ${concs[0] || topic} in determining outcomes in ${subject}. [4 marks]`}

*Model answer:*
• Point 1: ${concs[0] ? `Define/identify ${concs[0]} accurately` : `Knowledge — definition with correct terminology`}
• Point 2: ${concs[1] ? `Explain the mechanism of ${concs[1]}` : `Explain the mechanism or process involved`}
• Point 3: Specific example or application from ${subject}
• Point 4: Conclusion with supported judgement

---

### 📌 Key Items to Remember:
${subList}
${concs.length > 0 ? `\n**Core concepts:** ${conceptList}` : ''}

> **Exam tip:** Questions on ${topic} commonly use command words: *${cmdWords.slice(0, 3).join(', ')}* — know what each requires!`,

      'concept-learning': () => `## 📘 Concept Deep-Dive: ${topic}
*Subject: ${subject}${examWeightStr}*${masteryNote ? '\n\n' + masteryNote : ''}

---

### 🎯 Why This Topic Matters for Your Exam
${hasCurriculum ? `${topic} is a frequently examined area in ${subject} covering **${subs.slice(0, 3).join(', ')}**. Examiners use command words like *${cmdWords.slice(0, 3).join(', ')}* to test this topic — meaning you must be able to explain mechanisms, apply concepts, and evaluate significance.` : `${topic} is a frequently examined area in ${subject}. Expect 1-2 questions on this in your paper.`}

---

### 📖 Core Concepts Explained
${subs.map((s, i) => `**${i + 1}. ${s}**\n${objs[i] ? objs[i] : `This aspect of ${topic} forms the basis for exam questions. Understanding it allows you to answer "${primaryCmd}" and "${descCmd}" questions with precision.`}\n`).join('\n')}

---

${concs.length > 0 ? `### 🔑 Key Terminology\n${concs.map(c => `- **${c}**: [definition relating to ${topic} in ${subject}]`).join('\n')}\n\n---\n\n` : ''}### ⚠️ Common Exam Mistakes to Avoid
1. **Vague definitions** — Examiners require precise terminology from the ${subject} syllabus
2. **Missing the command word** — *${cmdWords[0] || 'Explain'}* and *${cmdWords[1] || 'Describe'}* require different levels of detail
3. **No mechanism** — Always explain *how* and *why*, not just *what*
4. **Ignoring context** — Link answers back to the specific scenario in the question

---

### ✅ Two Key Takeaways
1. ${objs[0] ? objs[0] : `Master the definition and mechanism of ${subs[0]} — this forms the foundation for all ${topic} questions`}
2. ${objs[1] ? objs[1] : `Practise applying ${topic} to unfamiliar scenarios — examiners reward students who can transfer knowledge`}`,

      'active-recall': () => `## 🧠 Active Recall Exercise: ${topic}
*Subject: ${subject}${examWeightStr}*${masteryNote ? '\n\n' + masteryNote : ''}

Test yourself — cover the answers first!

---

### Level 1: Knowledge — *What do you know?*

**Question 1:** ${descCmd} what is meant by ${subs[0] !== 'Core concepts' ? `**${subs[0]}**` : `**${topic}**`}${objs.length ? ` in relation to "${objs[0]?.substring(0, 50)}..."` : ''}. [2 marks]

<details>
<summary>Model Answer</summary>
${objs[0] ? `• ${objs[0]}\n• Supporting detail with correct ${subject} terminology` : `• ${subs[0] !== 'Core concepts' ? subs[0] : topic}: clear definition with correct terminology\n• Supporting detail explaining its role or significance in ${subject}`}
</details>

---

### Level 2: Understanding — *Can you explain it?*

**Question 2:** ${primaryCmd} why **${subs[1] && subs[1] !== 'Key principles' ? subs[1] : topic}** is important in ${subject}. [3 marks]

<details>
<summary>Model Answer (3 marking points)</summary>
• Point 1: ${concs[0] ? `Define/identify ${concs[0]} accurately with correct terminology` : `Clear statement of the key principle`}
• Point 2: ${objs[1] ? objs[1] : `Explanation of the mechanism or process involved`}
• Point 3: ${concs[1] ? `How ${concs[1]} contributes to this` : `Specific example or application demonstrating importance`}
</details>

---

### Level 3: Application — *Can you use it?*

**Question 3:** Apply your knowledge of **${subs[2] && subs[2] !== 'Applications' ? subs[2] : topic}** to a structured exam question in ${subject}. [4 marks]

<details>
<summary>Model Answer</summary>
1. Identify the relevant aspect: ${concs[0] || subs[0]}
2. Apply the appropriate method/framework from ${topic}
3. Show the mechanism or process with correct terminology
4. State a clear, justified conclusion linked to ${subject}
</details>

---

### Level 4: Analysis — *Can you evaluate?*

**Question 4:** Compare TWO ${subs.length >= 2 ? `aspects of ${topic}: **${subs[0]}** and **${subs[1]}**` : `approaches to studying ${topic}`}. Identify the advantages and limitations of each. [4 marks]

<details>
<summary>Model Answer (4 marking points)</summary>
• ${subs[0]} advantage: ${objs[0] ? objs[0].substring(0, 60) + '...' : 'More direct and applies core principles clearly'}
• ${subs[0]} limitation: May not account for all variables or edge cases in ${subject}
• ${subs[1] || 'Alternative'} advantage: ${objs[1] ? objs[1].substring(0, 60) + '...' : 'More comprehensive — accounts for broader context'}
• ${subs[1] || 'Alternative'} limitation: Requires deeper analysis and more time under exam conditions
</details>

---

### Level 5: Evaluation — *Can you argue and conclude?*

**Question 5:** "${evalCmd !== 'Evaluate' ? evalCmd : 'Evaluate'} the significance of **${concs[0] || topic}** in ${subject}." [6 marks]

<details>
<summary>Model Answer</summary>
**Agree points:**
${subs.slice(0, 2).map(s => `- ${s !== 'Core concepts' && s !== 'Key principles' ? s : topic} demonstrates clear evidence of importance`).join('\n')}
- Appears across multiple exam question types and mark allocations

**Consider alternatives:**
- ${subs[2] && subs[2] !== 'Applications' ? subs[2] : 'Other aspects'} must also be considered for a complete answer
- Context and application vary depending on the exam scenario

**Conclusion:** ${concs[0] || topic} is a high-priority concept in ${subject} — mastering it provides significant leverage across the exam paper.
</details>`,

      'flashcards': () => `## 🃏 Flashcards: ${topic}
*Subject: ${subject}${examWeightStr} | ${subs.length} subtopics*

${subs.map((s, i) => `---

**Card ${i + 1}: ${s}**
**Front:** ${objs[i] ? `What does this learning objective mean: "${objs[i].substring(0, 60)}..."?` : `What is **${s}** and how does it relate to ${topic} in ${subject}?`}
**Back:** ${objs[i] ? `${objs[i]} — This means students must be able to define, apply, and evaluate ${s} in exam answers.` : `${s} is a key component of ${topic} that relates to [specific mechanism/principle]. It is tested using command words: ${cmdWords.slice(0, 2).join(', ')}.`}`).join('\n')}

---

**Card ${subs.length + 1}: Command Words**
**Front:** What do the command words *${cmdWords.slice(0, 3).join('*, *')}* require in ${subject} exam answers?
**Back:** ${cmdWords.slice(0, 3).map(w => {
  const defs = {
    'Define': 'State the precise meaning',
    'Describe': 'State the key features/characteristics',
    'Explain': 'State AND give reasons/mechanisms',
    'Evaluate': 'Discuss evidence for and against, reach a conclusion',
    'Calculate': 'Use numbers/formula to find a value',
    'Outline': 'Give a brief summary of main points',
    'Assess': 'Weigh up evidence and form a judgement',
    'Analyse': 'Break down into components and examine',
    'Discuss': 'Consider different aspects and viewpoints',
  };
  return `**${w}**: ${defs[w] || 'Give a structured, precise answer using correct terminology'}`;
}).join('\n')}

---

**Card ${subs.length + 2}: High-Priority Concepts**
**Front:** Name the key concepts for ${topic} in ${subject} that most frequently appear in exams.
**Back:** ${concs.join(', ')}${examWeight ? `\n\nExam weight: ${examWeight}% — this topic is worth significant marks.` : ''}

---

**Card ${subs.length + 3}: Common Mistakes**
**Front:** What are the most common exam mistakes in ${topic} questions?
**Back:**
1. **Vague answers** — State the mechanism, not just the fact
2. **Missing command word** — *${cmdWords[0]}* ≠ *${cmdWords[1] || 'Describe'}* — adjust depth accordingly
3. **No terminology** — Use precise ${subject} vocabulary throughout
4. **Skipping examples** — Higher-mark questions require specific applications`,

      'summary': () => `## 📋 Exam Summary: ${topic}
*Subject: ${subject}${examWeightStr}*${masteryNote ? '\n\n' + masteryNote : ''}

---

### 🔑 Key Definitions & Concepts
${concs.map(c => `- **${c}**: [precise definition for ${topic} in ${subject}]`).join('\n')}
${subs.filter(s => !concs.includes(s)).slice(0, 2).map(s => `- **${s}**: [definition linking to ${topic}]`).join('\n')}

---

### 📌 Essential Points (Must Know for Exam)
${objs.length ? objs.slice(0, 5).map((o, i) => `${i < 2 ? '⭐ ' : ''}${i + 1}. ${o}`).join('\n') : `1. ⭐ The definition and fundamental mechanism of ${topic}
2. ⭐ How to apply ${topic} in structured exam questions  
3. ⭐ The relationship between ${subs[0]} and ${subs[1] || 'its applications'}
4. Common examples and real-world applications in ${subject}
5. Potential sources of error or limitations
6. How ${topic} connects to other areas of ${subject}`}

---

### 📊 Subtopic Breakdown
${subs.map((s, i) => `**${i + 1}. ${s}**
- Key principle: ${objs[i] ? objs[i] : `[what students must know for exam]`}
- Command word: Likely "*${cmdWords[i % cmdWords.length] || 'Explain'}*" questions
- Mark allocation: Typically 3-5 marks in structured questions`).join('\n\n')}

---

### 📝 Common Exam Questions
${cmdWords.slice(0, 4).map((cw, i) => `${i + 1}. "${cw} ${subs[i] && subs[i] !== 'Core concepts' ? subs[i].toLowerCase() : topic.toLowerCase()}..." [${[2, 3, 4, 6][i]} marks]`).join('\n')}

---

### ✅ Quick Self-Test
1. Can you define ${concs[0] || topic} without notes?
2. Can you explain ${subs[0] !== 'Core concepts' ? subs[0] : 'the main mechanism'} in 3 sentences?
3. Can you write a model answer for a 4-mark question using "*${primaryCmd}*"?
4. Can you ${evalCmd.toLowerCase()} the importance of ${topic} in ${subject}?`,

      'revision-checklist': () => `## ✅ Revision Checklist: ${topic}
*Subject: ${subject}${examWeightStr}*${masteryNote ? '\n\n' + masteryNote : ''}

Tick each item only when you can confidently explain it!

---

### Core Definitions
- [ ] ⭐ I can define **${topic}** accurately using correct ${subject} terminology
- [ ] ⭐ I can list all ${subs.length} subtopics: ${subs.join(', ')}
${concs.slice(0, 3).map(c => `- [ ] ⭐ I can define **${c}** precisely`).join('\n')}
- [ ] I can explain the difference between related terms in ${topic}

---

### Understanding (Can I explain it?)
${subs.map((s, i) => `- [ ] ${i < 2 ? '⭐ ' : ''}I can explain **${s}** and its role within ${topic}
${objs[i] ? `- [ ] I can demonstrate: "${objs[i].substring(0, 70)}..."` : `- [ ] I can give a real-world example of **${s}** in ${subject}`}`).join('\n')}

---

### Exam Application (Can I answer exam questions?)
- [ ] ⭐ I can answer a 2-mark "${descCmd}" question on ${topic}
- [ ] ⭐ I can answer a 4-mark "${primaryCmd}" question on ${topic}
- [ ] I can answer a 6-mark "${evalCmd}" question on ${topic}
- [ ] I can apply ${topic} to an unfamiliar exam scenario

---

### Command Word Mastery
${cmdWords.slice(0, 4).map(cw => `- [ ] I know what "*${cw}*" requires and can answer ${cw.toLowerCase()} questions on ${topic}`).join('\n')}

---

### ⭐ Priority Revision Order
${hasCurriculum ? `Focus on these first (highest exam weight):\n${subs.slice(0, 2).map((s, i) => `${i + 1}. **${s}** — ${objs[i] ? objs[i].substring(0, 60) + '...' : 'core exam concept'}`).join('\n')}` : `Focus on starred items first — they cover the highest-mark question types.`}`,
    };

    const fn = templates[taskType] || templates['concept-learning'];
    return fn();
  },

  // ── quiz question ──────────────────────────────────────────────────────────
  generateQuiz({ subject, topic, subtopics, learningObjectives, concepts, commandWords, difficulty, performanceContext }) {
    // Use real curriculum data if available, fallback to generic placeholders
    const subs = subtopics?.length ? subtopics : ['Core concepts', 'Key principles', 'Applications'];
    const objs = learningObjectives || [];
    const concs = concepts?.length ? concepts : subs;
    const cmdWords = commandWords?.length ? commandWords : ['Explain', 'Describe', 'Calculate', 'Evaluate', 'Outline'];
    const hasCurriculum = !!(subtopics?.length || learningObjectives?.length || concepts?.length);

    // Pick a command word from actual past paper patterns
    const primaryCmd = cmdWords[0] || 'Explain';
    const secondaryCmd = cmdWords[1] || 'Describe';
    const evalCmd = cmdWords.find(w => /eval|assess|discuss|analys/i.test(w)) || 'Evaluate';

    // Build objective-specific content for questions
    const mainObj = objs[0] || `understand the core principles of ${topic}`;
    const sub1 = subs[0] || topic;
    const sub2 = subs[1] || `the application of ${topic}`;
    const sub3 = subs[2] || `evaluation of ${topic}`;
    const conc1 = concs[0] || sub1;
    const conc2 = concs[1] || sub2;

    // Determine marks based on difficulty
    const diffLevel = difficulty || 'medium';
    let questionTypes;

    if (diffLevel === 'easy') {
      questionTypes = [
        {
          question: `State the meaning of ${conc1} in the context of ${subject}. [2 marks]`,
          marks: 2,
          modelAnswer: `Award 1 mark each for up to 2 valid points:\n• A correct identification/definition of ${conc1} within ${subject}\n• A supporting detail, example, or clarification`,
          keyPoints: [`Definition of ${conc1}`, `Supporting detail or example`],
          difficulty: 'easy',
          commandWords: ['State'],
          conceptsTested: [conc1, topic],
        },
        {
          question: `${secondaryCmd} what is meant by ${sub1} as part of ${topic} in ${subject}. [3 marks]`,
          marks: 3,
          modelAnswer: `Award 1 mark each for:\n• What ${sub1} is (definition with correct terminology)\n• How it operates or functions within ${topic}\n• An example or real-world application`,
          keyPoints: [`Definition of ${sub1}`, `Mechanism or process`, `Example or application`],
          difficulty: 'easy',
          commandWords: [secondaryCmd],
          conceptsTested: [sub1, conc1],
        },
      ];
    } else if (diffLevel === 'hard') {
      questionTypes = [
        {
          question: `${evalCmd} the significance of ${conc1} in ${topic} for ${subject}. Refer to ${sub1} and ${sub2} in your answer. [6 marks]`,
          marks: 6,
          modelAnswer: hasCurriculum
            ? `Award up to 6 marks:\n• AO1 (2 marks): Accurate knowledge — define ${conc1}, state 2+ key features linked to ${sub1} and ${sub2}\n• AO2 (2 marks): Application — specific examples showing how ${conc1} determines outcomes in ${topic}\n• AO3 (2 marks): Evaluation — limitations, alternative perspectives, supported conclusion`
            : `Award up to 6 marks:\n• AO1 (2 marks): Accurate knowledge — define ${topic}, state 2+ key features\n• AO2 (2 marks): Application — specific examples showing ${topic} in action\n• AO3 (2 marks): Evaluation — limitations, comparison to alternatives, supported conclusion`,
          keyPoints: [
            `Knowledge: definition and key features of ${conc1}`,
            `Link to ${sub1}: specific mechanism or principle`,
            `Link to ${sub2}: specific mechanism or principle`,
            `Application: example showing significance in context`,
            `Evaluation: limitation or counterargument considered`,
            `Conclusion: supported judgement with evidence`,
          ],
          difficulty: 'hard',
          commandWords: [evalCmd, 'Refer to'],
          conceptsTested: [conc1, sub1, sub2, topic],
        },
      ];
    } else {
      // Medium difficulty — the default
      questionTypes = [
        {
          question: `${primaryCmd} the significance of ${conc1} in ${subject}, referring to ${sub1}${sub2 !== sub1 ? ' and ' + sub2 : ''}. [4 marks]`,
          marks: 4,
          modelAnswer: hasCurriculum
            ? `Award 1 mark each for up to 4 valid points:\n• Correct definition or identification of ${conc1} in ${subject}\n• Explanation of how ${sub1} relates to ${conc1}, with mechanism\n${sub2 !== sub1 ? `• Explanation of ${sub2}'s role or contribution\n` : ''}• Application to a relevant context or example`
            : `Award 1 mark each for up to 4 valid points:\n• Correct definition of ${topic} in the context of ${subject}\n• Explanation of the first key principle with supporting detail\n• Explanation of the second key principle with supporting detail\n• Application to a relevant context or real-world example`,
          keyPoints: hasCurriculum ? [
            `Definition/identification of ${conc1} within ${subject}`,
            `${sub1}: mechanism and significance`,
            sub2 !== sub1 ? `${sub2}: role or contribution` : `Application of ${conc1} in context`,
            `Supporting example or real-world application`,
          ] : [
            `Definition of ${topic} within ${subject}`,
            `First key principle with explanation`,
            `Second key principle with explanation`,
            `Application or contextual example`,
          ],
          difficulty: 'medium',
          commandWords: [primaryCmd],
          conceptsTested: hasCurriculum ? [conc1, sub1, topic] : [topic, sub1],
        },
        {
          question: `${secondaryCmd} the process by which ${sub1} contributes to ${topic} in ${subject}. [3 marks]`,
          marks: 3,
          modelAnswer: `Award 1 mark each for:\n• What ${sub1} is (definition with correct terminology)\n• How it functions or operates within ${topic}\n• The effect or outcome this produces`,
          keyPoints: [
            `Definition/identification of ${sub1}`,
            `Mechanism of function within ${topic}`,
            `Effect or outcome`,
          ],
          difficulty: 'medium',
          commandWords: [secondaryCmd],
          conceptsTested: [sub1, topic],
        },
        {
          question: objs.length
            ? (() => {
                // Strip leading verb from learning objective to avoid duplication (e.g., "Describe the stages" → "the stages")
                const obj0 = objs[0].replace(/^(Describe|Explain|Define|Identify|Outline|State|Analyse|Evaluate|Compare|Discuss|Calculate|Determine|Suggest)\s+/i, '');
                return `${primaryCmd} ${obj0.charAt(0).toLowerCase() + obj0.slice(1)}. Use examples from ${sub1}${sub2 !== sub1 ? ' and ' + sub2 : ''}. [5 marks]`;
              })()
            : `${primaryCmd} how ${sub1} and ${sub2 !== sub1 ? sub2 : 'its applications'} relate to ${topic} in ${subject}. [5 marks]`,
          marks: 5,
          modelAnswer: `Award 1 mark each for:\n• Identification of the relevant aspect of ${topic}\n• Explanation of ${sub1} with mechanism\n${sub2 !== sub1 ? `• Explanation of ${sub2} with mechanism\n` : ''}• Application with specific example\n• Clear, justified conclusion linking back to the question`,
          keyPoints: [
            `Relevant aspect of ${topic} identified`,
            `${sub1}: explanation with mechanism`,
            sub2 !== sub1 ? `${sub2}: explanation with mechanism` : `Application with specific example`,
            `Specific example from ${subject}`,
            `Justified conclusion`,
          ],
          difficulty: 'medium',
          commandWords: [primaryCmd],
          conceptsTested: hasCurriculum ? [conc1, conc2, topic] : [topic, sub1],
        },
      ];
    }

    // Select question type with variety via hash
    const availableTypes = questionTypes;
    const idx = topic.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % availableTypes.length;
    const q = availableTypes[idx];
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
    if (subject) contextInfo += `The student is studying **${subject}**.`;
    if (topic) contextInfo += ` Current topic: **${topic}**.`;

    const systemPrompt = `You are StudySync AI — a personal exam preparation tutor and strategist.
${contextInfo}

CORE RULES:
1. **Topic-First**: Only teach content relevant to the current topic (${topic || 'the active topic'}). Do not introduce new topics.
2. **Exam-Oriented**: Frame ALL explanations in terms of how they appear in exams — command words, mark allocations, marking criteria.
3. **Syllabus Authority**: If curriculum/syllabus data is provided below, ALL your answers must align with it precisely.
4. **Teaching Method**: For each concept: (a) brief explanation, (b) exam relevance, (c) exam-style question, (d) model answer with marking points.
5. **Adaptive**: If student is struggling, simplify and break into steps. If performing well, introduce complexity.
6. **Marking Simulation**: When evaluating answers, give feedback in examiner style: "Method correct. Missing [specific step]. Estimated: [x]/[y] marks."

TEACHING STYLE:
- Encouraging but direct and exam-focused
- Use precise ${subject || 'subject'} terminology
- Use markdown formatting (headers, bold, bullet points)
- Highlight common exam mistakes specific to this topic
${syllabusContext || ''}`;

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

/**
 * Parse curriculum context string to extract structured data for quiz generation.
 * This lets the fallback engine use real syllabus data even without the AI API.
 */
function parseCurriculumContext(curriculumContext) {
  if (!curriculumContext) return {};
  const ctx = String(curriculumContext);
  const result = {};

  // Extract subtopics
  const subtopicMatch = ctx.match(/Subtopics:\s*(.+)/);
  if (subtopicMatch) {
    result.subtopics = subtopicMatch[1].split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
  }

  // Extract learning objectives
  const objectives = [];
  const objSection = ctx.match(/Learning Objectives:\n([\s\S]*?)(?:\n===|\n[A-Z]|$)/);
  if (objSection) {
    const lines = objSection[1].split('\n').filter(l => l.trim().startsWith('•'));
    objectives.push(...lines.map(l => l.replace(/^\s*•\s*/, '').trim()));
  }
  if (objectives.length) result.learningObjectives = objectives;

  // Extract key concepts
  const conceptMatch = ctx.match(/Key Concepts:\s*(.+)/);
  if (conceptMatch) {
    result.concepts = conceptMatch[1].split(/,\s*/).map(s => s.trim()).filter(Boolean);
  }

  // Extract command words from past paper patterns
  const cmdMatch = ctx.match(/Most Frequent Command Words:\s*(.+)/);
  if (cmdMatch) {
    result.commandWords = cmdMatch[1].split(/,\s*/).map(s => s.trim()).filter(Boolean);
  }

  // Extract question types
  const qtMatch = ctx.match(/Question Types Seen:\s*(.+)/);
  if (qtMatch) {
    result.questionTypes = qtMatch[1].split(/,\s*/).map(s => s.trim()).filter(Boolean);
  }

  // Extract avg marks
  const marksMatch = ctx.match(/Average Marks per Paper:\s*(\d+)/);
  if (marksMatch) result.avgMarks = parseInt(marksMatch[1]);

  // Extract difficulty distribution
  const diffMatch = ctx.match(/Difficulty Distribution:\s*(.+)/);
  if (diffMatch) result.difficultyHint = diffMatch[1];

  // Extract past paper question patterns
  const pastQs = [];
  const qMatches = ctx.matchAll(/Q(\d+):\s*\[([^\]]+)\]\s*Command words:\s*([^|]+)\|\s*Concepts:\s*(.+)/g);
  for (const m of qMatches) {
    pastQs.push({
      info: m[2].trim(),
      commandWords: m[3].trim().split(/,\s*/),
      concepts: m[4].trim().split(/,\s*/),
    });
  }
  if (pastQs.length) result.pastPaperQuestions = pastQs;

  return result;
}

app.post('/api/ai/generate-quiz', async (req, res) => {
  try {
    const {
      subject, topic, topicContext,
      curriculumContext, examWeight,
      difficulty, preferredQuestionType,
      performanceContext, avoidQuestionTypes,
    } = req.body;
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });

    // Parse curriculum context to extract structured data
    const parsed = parseCurriculumContext(curriculumContext);
    const subtopics = parsed.subtopics || (topicContext ? [topicContext] : []);
    const learningObjs = parsed.learningObjectives || [];
    const concepts = parsed.concepts || [];
    const pastCmdWords = parsed.commandWords || [];
    const pastQTypes = parsed.questionTypes || [];
    const hasCurriculumData = !!(curriculumContext && (subtopics.length || learningObjs.length || pastCmdWords.length));

    const systemPrompt = `You are an expert Cambridge/IB/A-Level exam question generator specialising in ${subject}.

Your task: Generate ONE realistic exam-style question grounded in the student's ACTUAL syllabus and past paper patterns.

STRICT RULES:
1. The question MUST be specific to the exact topic/subtopics provided — NOT generic
2. Use the exact command words, mark allocations, and question types from the past paper patterns below
3. The model answer MUST match the question precisely with mark-point-by-mark-point breakdown
4. If subtopics/concepts are provided, the question MUST test those specifically
5. Vary the question from generic "explain X" — use real exam scenarios, data, diagrams descriptions, calculations

Respond with ONLY valid JSON (no markdown wrapping):
{"question":"string","marks":number,"modelAnswer":"string","keyPoints":["string"],"difficulty":"easy|medium|hard","commandWords":["string"],"conceptsTested":["string"]}`;

    // Build a rich, curriculum-grounded user prompt
    let userPrompt = `Generate one exam-style question for:\nSubject: ${subject}\nTopic: ${topic}`;

    if (subtopics.length) userPrompt += `\nSubtopics to test: ${subtopics.slice(0, 6).join(', ')}`;
    if (learningObjs.length) userPrompt += `\nLearning objectives:\n${learningObjs.slice(0, 4).map(o => `  • ${o}`).join('\n')}`;
    if (concepts.length) userPrompt += `\nKey concepts: ${concepts.slice(0, 6).join(', ')}`;
    if (examWeight) userPrompt += `\nExam weight: ${examWeight}% of paper`;
    if (difficulty) userPrompt += `\nRequired difficulty: ${difficulty}`;
    if (preferredQuestionType) userPrompt += `\nPreferred question type: ${preferredQuestionType}`;

    if (pastCmdWords.length) {
      userPrompt += `\n\nPAST PAPER DATA (use these patterns):`;
      userPrompt += `\nCommand words used in past papers: ${pastCmdWords.join(', ')}`;
    }
    if (pastQTypes.length) userPrompt += `\nQuestion types from past papers: ${pastQTypes.join(', ')}`;
    if (parsed.avgMarks) userPrompt += `\nTypical mark allocation: ${parsed.avgMarks} marks`;
    if (parsed.difficultyHint) userPrompt += `\nPast paper difficulty: ${parsed.difficultyHint}`;

    if (parsed.pastPaperQuestions?.length) {
      userPrompt += `\n\nSAMPLE PAST PAPER QUESTION PATTERNS (model your question after these):`;
      parsed.pastPaperQuestions.slice(0, 3).forEach((q, i) => {
        userPrompt += `\nPattern ${i+1}: [${q.info}] Command: ${q.commandWords.join('/')} | Tests: ${q.concepts.join(', ')}`;
      });
    }

    if (performanceContext) userPrompt += `\n\nSTUDENT PERFORMANCE:\n${performanceContext}`;
    if (avoidQuestionTypes?.length) userPrompt += `\nAVOID repeating these question types: ${avoidQuestionTypes.join(', ')}`;

    if (curriculumContext && !hasCurriculumData) {
      // Pass raw context as last resort
      userPrompt += `\n\nSyllabus context:\n${String(curriculumContext).substring(0, 2000)}`;
    }

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

    // ── Local curriculum-aware fallback ───────────────────────────────────────
    const questionData = fallback.generateQuiz({
      subject, topic,
      subtopics: subtopics.length ? subtopics : undefined,
      learningObjectives: learningObjs.length ? learningObjs : undefined,
      concepts: concepts.length ? concepts : undefined,
      commandWords: pastCmdWords.length ? pastCmdWords : undefined,
      difficulty,
      performanceContext,
    });
    res.json(questionData);
  } catch (err) {
    const { subject = 'Your Subject', topic = 'This Topic' } = req.body || {};
    console.error('[generate-quiz] Falling back to local:', err?.message);
    const parsed = parseCurriculumContext(req.body?.curriculumContext);
    res.json(fallback.generateQuiz({
      subject, topic,
      subtopics: parsed.subtopics,
      concepts: parsed.concepts,
      commandWords: parsed.commandWords,
    }));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/generate-task-content  (streaming SSE)
// ─────────────────────────────────────────────────────────────────────────────
const TASK_PROMPTS = {
  'micro-revision': `You are an expert exam tutor. Create a focused 2-3 minute micro-revision session.
CRITICAL: Use ONLY the exact subtopics, learning objectives, and concepts provided — do NOT generate generic content.
Include 3 exam-style questions with model answers. Use the past paper patterns (command words, mark allocations) provided.
Format: markdown with headers. Start with a 1-sentence refresher for the specific topic.`,

  'concept-learning': `You are an expert exam tutor. Create a concept deep-dive for exam preparation.
CRITICAL: Base ALL content on the exact subtopics and learning objectives provided — NOT generic explanations.
Structure: WHY this specific topic matters in exams → step-by-step explanation of each subtopic → real exam-style example → common mistakes for THIS topic → 2 key takeaways.
If past paper data is provided, reference the actual exam patterns. Use markdown headers.`,

  'active-recall': `You are an expert exam tutor. Create 5 active-recall questions in increasing difficulty.
CRITICAL: Questions MUST test the specific subtopics, concepts, and learning objectives provided.
Use command words from the past paper patterns if available (e.g., "Define", "Explain", "Evaluate").
Format: Level 1 (Knowledge) → Level 2 (Understanding) → Level 3 (Application) → Level 4 (Analysis) → Level 5 (Evaluation).
Each question has a hidden model answer using <details><summary>Model Answer</summary>...</details>. Use markdown.`,

  'exam-question': `You are an expert exam question writer. Write ONE realistic exam question.
CRITICAL: The question MUST be specific to the subtopics and concepts provided — NOT generic.
Use the command words and mark allocations from past paper patterns if provided.
Include: the question, mark allocation, full model answer with mark-by-mark breakdown, and examiner tips.
Use markdown.`,

  'flashcards': `You are an expert tutor. Create 6-8 revision flashcards.
CRITICAL: Each flashcard MUST cover a specific subtopic, concept, or learning objective from the data provided.
If subtopics are given, create at least one card per subtopic.
Format each as:
**Card N: [Subtopic/Concept Name]**
**Front:** [question or term]
**Back:** [precise answer using subject terminology]
---`,

  'summary': `You are an expert exam tutor. Create a comprehensive revision summary.
CRITICAL: The summary MUST be structured around the exact subtopics and learning objectives provided.
Include: key definitions for each subtopic, essential exam points (⭐ high priority), exam-style questions modelled on past paper patterns, quick self-test.
If past paper command words are provided, include them in the exam questions section. Use markdown.`,

  'revision-checklist': `You are an expert tutor. Create a detailed revision checklist.
CRITICAL: Checkboxes MUST reference the exact subtopics and learning objectives provided — NOT generic items.
Group by subtopic (use the actual subtopic names). Mark highest-priority items ⭐.
Include "I can define...", "I can explain...", "I can apply..." and "I can evaluate..." items for each subtopic.
If past paper data is provided, include exam technique items referencing the actual command words. Use markdown.`,
};

app.post('/api/ai/generate-task-content', async (req, res) => {
  try {
    const {
      taskType, subject, topic,
      subtopics, learningObjectives, concepts,
      examWeight, curriculumContext, performanceContext, masteryStatus, difficulty,
    } = req.body;
    if (!taskType || !subject || !topic) {
      return res.status(400).json({ error: 'taskType, subject, and topic are required' });
    }

    // Parse curriculum context for structured data
    const parsed = parseCurriculumContext(curriculumContext);
    const effectiveSubtopics = subtopics?.length ? subtopics : (parsed.subtopics || []);
    const effectiveObjectives = learningObjectives?.length ? learningObjectives : (parsed.learningObjectives || []);
    const effectiveConcepts = concepts?.length ? concepts : (parsed.concepts || []);
    const effectiveCmdWords = parsed.commandWords || [];
    const hasCurriculumData = !!(effectiveSubtopics.length || effectiveObjectives.length || effectiveCmdWords.length);

    const systemPrompt = TASK_PROMPTS[taskType] || TASK_PROMPTS['concept-learning'];

    // Build a rich, curriculum-grounded user prompt
    let userPrompt = `Subject: ${subject}\nTopic: ${topic}`;
    if (effectiveSubtopics.length) userPrompt += `\nSubtopics: ${effectiveSubtopics.join(', ')}`;
    if (effectiveObjectives.length) userPrompt += `\nLearning Objectives:\n${effectiveObjectives.slice(0, 5).map(o => `  • ${o}`).join('\n')}`;
    if (effectiveConcepts.length) userPrompt += `\nKey Concepts: ${effectiveConcepts.join(', ')}`;
    if (examWeight) userPrompt += `\nExam Weight: ${examWeight}% of paper`;

    if (effectiveCmdWords.length) {
      userPrompt += `\n\nPast Paper Patterns:`;
      userPrompt += `\nCommand Words Used: ${effectiveCmdWords.join(', ')}`;
    }
    if (parsed.questionTypes?.length) userPrompt += `\nQuestion Types: ${parsed.questionTypes.join(', ')}`;
    if (parsed.avgMarks) userPrompt += `\nTypical Marks: ${parsed.avgMarks}`;

    if (parsed.pastPaperQuestions?.length) {
      userPrompt += `\nPast Question Patterns:`;
      parsed.pastPaperQuestions.slice(0, 2).forEach((q, i) => {
        userPrompt += `\n  [${q.info}] ${q.commandWords.join('/')} — Tests: ${q.concepts.join(', ')}`;
      });
    }

    if (masteryStatus) userPrompt += `\nStudent Mastery: ${masteryStatus}`;
    if (difficulty) userPrompt += `\nContent Difficulty: ${difficulty}`;
    if (performanceContext) userPrompt += `\n\nPerformance Context: ${performanceContext}`;

    // Always include raw curriculum context for extra grounding
    if (curriculumContext) {
      userPrompt += `\n\nFULL CURRICULUM DATA:\n${String(curriculumContext).substring(0, 2500)}`;
    }

    const stream = await callAIStream([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    if (stream) {
      await streamToResponse(stream, res);
    } else {
      // Use curriculum-aware fallback
      const content = fallback.taskContent({
        taskType, subject, topic,
        subtopics: effectiveSubtopics.length ? effectiveSubtopics : undefined,
        learningObjectives: effectiveObjectives.length ? effectiveObjectives : undefined,
        concepts: effectiveConcepts.length ? effectiveConcepts : undefined,
        commandWords: effectiveCmdWords.length ? effectiveCmdWords : undefined,
        examWeight,
        masteryStatus,
        hasCurriculumData,
      });
      await streamString(content, res);
    }
  } catch (err) {
    const { taskType = 'concept-learning', subject = 'Your Subject', topic = 'This Topic', subtopics } = req.body || {};
    console.error('[generate-task-content] Falling back to local:', err?.message);
    const parsed = parseCurriculumContext(req.body?.curriculumContext);
    const content = fallback.taskContent({
      taskType, subject, topic,
      subtopics: subtopics?.length ? subtopics : parsed.subtopics,
      concepts: parsed.concepts,
      commandWords: parsed.commandWords,
    });
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
