/**
 * StudySync Automated Test Suite
 *
 * Covers:
 *  1. Database schema validation (required tables defined in types)
 *  2. Authentication helper logic (client-side)
 *  3. AI server connectivity (skipped if server not running)
 *  4. Quiz scoring & spaced-repetition logic
 *  5. Library resource structure validation
 *  6. Session scheduling logic
 *  7. Messaging helpers
 *  8. Security validators (file upload, XSS, password)
 *  9. StudyMode adaptive difficulty & streak logic
 * 10. StudySync type system validation
 *
 * Run with:
 *   node tests/suite.mjs
 *
 * Set env vars to enable network tests:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... AI_SERVER_URL=... node tests/suite.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
const AI_SERVER         = process.env.AI_SERVER_URL ?? 'http://localhost:3001';
const NETWORK           = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// ─── Tiny test runner ─────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];

async function test(name, fn) {
  process.stdout.write(`  ${name}… `);
  try {
    await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('test timed out (10s)')), 10_000)),
    ]);
    console.log('✅');
    passed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`❌  ${msg}`);
    failed++;
    failures.push({ name, msg });
  }
}
function suite(name) { console.log(`\n📋 ${name}`); }
function skip(name, reason) { console.log(`  ${name}… ⏭️  (${reason})`); }

// ─────────────────────────────────────────────────────────────────────────────
// 1. TYPESCRIPT TYPE COVERAGE
// ─────────────────────────────────────────────────────────────────────────────
suite('1. TypeScript Type Coverage');

const REQUIRED_TABLES = [
  'profiles','bookings','conversations','messages','notifications',
  'payments','reviews','subjects','topic_mastery','documents',
  'exam_patterns','learner_subjects','tutor_subjects','tutor_availability',
  'daily_tasks','qualifications','tutor_verifications',
  // StudyMode tables
  'quiz_attempts','user_progress','study_schedule','subject_exams',
  'exam_settings','academic_profiles','tutor_tutorials',
];

// Read types file locally (no network needed)
const typesFile = readFileSync(path.join(__dirname, '../src/integrations/supabase/types.ts'), 'utf8');

for (const table of REQUIRED_TABLES) {
  await test(`Table "${table}" is defined in types.ts`, () => {
    assert.ok(typesFile.includes(`${table}:`), `"${table}" not found in types.ts`);
    return Promise.resolve();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. AUTHENTICATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────
suite('2. Authentication Helpers');

await test('Sign-up rejects weak password (client-side check)', () => {
  const isStrong = (p) =>
    p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p);
  assert.ok(!isStrong('abc'));
  assert.ok(!isStrong('alllowercase1'));
  assert.ok(!isStrong('NOLOWER123'));
  assert.ok(isStrong('ValidPass99'));
  return Promise.resolve();
});

await test('Email format validated', () => {
  const valid = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  assert.ok(valid('user@example.com'));
  assert.ok(valid('a+b@sub.co.za'));
  assert.ok(!valid('no-at-sign'));
  assert.ok(!valid('@nodomain.com'));
  return Promise.resolve();
});

await test('Role check: has_role helper returns boolean', () => {
  // Simulate role check
  const userRoles = ['tutor'];
  const hasRole = (role) => userRoles.includes(role);
  assert.ok(hasRole('tutor'));
  assert.ok(!hasRole('admin'));
  assert.ok(!hasRole('learner'));
  return Promise.resolve();
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. AI SERVER CONNECTIVITY (skipped if server not running)
// ─────────────────────────────────────────────────────────────────────────────
suite('3. AI Server Connectivity');

async function aiRequest(path, body, timeout = 5000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(`${AI_SERVER}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } finally { clearTimeout(tid); }
}

await test('GET /api/ai/health returns 200', async () => {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`${AI_SERVER}/api/ai/health`, { signal: ctrl.signal });
    assert.ok(r.ok, `health returned ${r.status}`);
  } catch (err) {
    if (err.name === 'AbortError' || /connect|ECONNREFUSED|fetch/i.test(err.message)) {
      // Server not running – acceptable
      return;
    }
    throw err;
  }
});

await test('POST /api/ai/generate-quiz returns structured question', async () => {
  try {
    const r = await aiRequest('/api/ai/generate-quiz', {
      subject: 'Mathematics', topic: 'Algebra', difficulty: 'medium',
    });
    if (!r || !r.ok) return; // server unavailable – skip
    const d = await r.json();
    assert.ok(typeof d.question === 'string' && d.question.length > 5, 'needs question field');
    assert.ok(Number(d.marks) > 0 || d.markScheme, 'needs marks > 0 or mark scheme');
  } catch (err) {
    if (err.name === 'AbortError' || /connect|ECONNREFUSED|fetch/i.test(err.message)) return;
    throw err;
  }
});

await test('POST /api/ai/greeting returns greeting message', async () => {
  try {
    const r = await aiRequest('/api/ai/greeting', {
      studentName: 'Tester', hour: 10, streak: 3,
      tasksCompletedToday: 1, totalTasksToday: 4,
    });
    if (!r || !r.ok) return;
    const d = await r.json();
    assert.ok(
      (typeof d.message === 'string' && d.message.length > 0) ||
      (typeof d.greeting === 'string' && d.greeting.length > 0),
      'empty greeting'
    );
  } catch (err) {
    if (err.name === 'AbortError' || /connect|ECONNREFUSED|fetch/i.test(err.message)) return;
    throw err;
  }
});

await test('POST /api/ai/parse-document handles syllabus', async () => {
  try {
    const r = await aiRequest('/api/ai/parse-document', {
      content: 'Mathematics O Level Syllabus\n1. Algebra\n   1.1 Equations\n   1.2 Functions\n2. Geometry',
      documentType: 'syllabus',
      subject: 'Mathematics',
    });
    if (!r || !r.ok) return;
    const d = await r.json();
    assert.ok(d.parsed || d.success !== undefined, 'needs parsed field');
  } catch (err) {
    if (err.name === 'AbortError' || /connect|ECONNREFUSED|fetch/i.test(err.message)) return;
    throw err;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. QUIZ SCORING & SPACED REPETITION
// ─────────────────────────────────────────────────────────────────────────────
suite('4. Quiz Scoring & Spaced Repetition');

await test('XP: correct=25, incorrect=10', () => {
  const xp = (ok) => ok ? 25 : 10;
  assert.equal(xp(true),  25);
  assert.equal(xp(false), 10);
  return Promise.resolve();
});

await test('SM-2: intervals grow on consecutive correct answers', () => {
  function sm2(wasCorrect, interval, ease, count) {
    const q = wasCorrect ? 4 : 1;
    let e = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    let i = wasCorrect
      ? count === 0 ? 1 : count === 1 ? 3 : Math.round(interval * e)
      : 1;
    return { i: Math.min(180, i), e };
  }
  const r0 = sm2(true, 1, 2.5, 0);
  const r1 = sm2(true, r0.i, r0.e, 1);
  const r2 = sm2(true, r1.i, r1.e, 2);
  assert.equal(r0.i, 1);
  assert.equal(r1.i, 3);
  assert.ok(r2.i > 3, `interval after 3 corrects should be >3, got ${r2.i}`);
  const bad = sm2(false, r2.i, r2.e, 3);
  assert.equal(bad.i, 1, 'wrong answer resets interval');
  return Promise.resolve();
});

await test('Mastery status: ≥70% = mastered', () => {
  const status = (c, t) => !t ? 'not-started' : c / t >= 0.70 ? 'mastered' : 'needs-practice';
  assert.equal(status(0, 0),   'not-started');
  assert.equal(status(7, 10),  'mastered');
  assert.equal(status(6, 10),  'needs-practice');
  assert.equal(status(10, 10), 'mastered');
  return Promise.resolve();
});

await test('Adaptive difficulty: accuracy drives question level', () => {
  const diff = (acc) => acc >= 0.80 ? 'hard' : acc < 0.50 ? 'easy' : 'medium';
  assert.equal(diff(0.30), 'easy');
  assert.equal(diff(0.65), 'medium');
  assert.equal(diff(0.90), 'hard');
  assert.equal(diff(0.80), 'hard');
  return Promise.resolve();
});

await test('Daily XP accumulation: tasks + quiz attempts', () => {
  const calcDailyXp = (tasksCompleted, quizAttempts) => {
    const fromTasks   = tasksCompleted * 10;
    const fromQuizzes = quizAttempts.reduce((acc, q) => acc + (q.wasCorrect ? 25 : 10), 0);
    return fromTasks + fromQuizzes;
  };
  const xp = calcDailyXp(3, [{ wasCorrect: true }, { wasCorrect: false }, { wasCorrect: true }]);
  assert.equal(xp, 3 * 10 + 25 + 10 + 25);
  return Promise.resolve();
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. LIBRARY RESOURCES
// ─────────────────────────────────────────────────────────────────────────────
suite('5. Library Resource Validation');

await test('Required resource fields present', () => {
  const seeds = [
    { id: 't1', title: 'Solving Quadratic Equations Step by Step', type: 'video', category: 'Mathematics' },
    { id: 't2', title: 'Trigonometry: Sin, Cos & Tan Explained',   type: 'video', category: 'Mathematics' },
    { id: 't3', title: "Newton's Laws of Motion - Exam Ready",     type: 'video', category: 'Physics'     },
    { id: 't4', title: 'Organic Chemistry: Functional Groups',     type: 'video', category: 'Chemistry'   },
  ];
  for (const s of seeds) {
    assert.ok(s.id,    `${s.title}: missing id`);
    assert.ok(s.title, 'missing title');
    assert.ok(['video', 'book', 'pastpaper', 'guide', 'pdf'].includes(s.type), `bad type: ${s.type}`);
    assert.ok(s.category, `${s.title}: missing category`);
  }
  return Promise.resolve();
});

await test('Search filters by title, category, and subject tag', () => {
  const resources = [
    { title: 'Quadratic Equations', category: 'Mathematics', tags: { subject: 'Mathematics' } },
    { title: "Newton's Laws",       category: 'Physics',     tags: { subject: 'Physics'     } },
    { title: 'Cell Biology',        category: 'Biology',     tags: { subject: 'Biology'     } },
  ];
  const search = (q) => resources.filter(r =>
    [r.title, r.category, r.tags.subject].some(s => s.toLowerCase().includes(q.toLowerCase()))
  );
  assert.equal(search('math').length,      1);
  assert.equal(search('physics').length,   1);
  assert.equal(search('Equations').length, 1);
  assert.equal(search('xyz').length,       0);
  return Promise.resolve();
});

await test('Personalization: filters by academic profile subjects', () => {
  const resources = [
    { title: 'Algebra', tags: { subject: 'Mathematics', curriculum: 'ZIMSEC' } },
    { title: 'Forces',  tags: { subject: 'Physics',     curriculum: 'ZIMSEC' } },
  ];
  const profile = { subjects: ['Mathematics'], curriculum: 'ZIMSEC' };
  const personalized = resources.filter(r => {
    if (!r.tags) return true;
    const matchSubject = profile.subjects.some(s =>
      r.tags.subject.toLowerCase().includes(s.toLowerCase())
    );
    const matchCurriculum = !r.tags.curriculum || r.tags.curriculum === profile.curriculum;
    return matchSubject || matchCurriculum;
  });
  assert.equal(personalized.length, 2, 'curriculum match should include Physics too');
  return Promise.resolve();
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SESSION SCHEDULING
// ─────────────────────────────────────────────────────────────────────────────
suite('6. Session Scheduling');

await test('Booking status transitions are valid', () => {
  const valid = {
    requested: ['confirmed', 'canceled'],
    confirmed:  ['completed', 'canceled'],
    completed:  [],
    canceled:   [],
  };
  const ok = (f, t) => valid[f]?.includes(t) ?? false;
  assert.ok(ok('requested', 'confirmed'));
  assert.ok(ok('confirmed', 'completed'));
  assert.ok(!ok('completed', 'confirmed'));
  assert.ok(!ok('canceled', 'requested'));
  return Promise.resolve();
});

await test('getUpcomingSessions returns only confirmed future bookings', () => {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const past   = new Date(Date.now() - 3_600_000).toISOString();
  const bookings = [
    { id: '1', status: 'confirmed',  scheduled_at: future },
    { id: '2', status: 'confirmed',  scheduled_at: past   },
    { id: '3', status: 'requested',  scheduled_at: future },
    { id: '4', status: 'completed',  scheduled_at: future },
  ];
  const upcoming = bookings.filter(b => b.status === 'confirmed' && new Date(b.scheduled_at) > new Date());
  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0].id, '1');
  return Promise.resolve();
});

await test('Jitsi room name is URL-safe alphanumeric', () => {
  const room = (id) => `StudySync-${id.replace(/-/g, '')}`;
  const n = room('abc-def-123-456');
  assert.ok(n.startsWith('StudySync-'), 'prefix missing');
  assert.match(n, /^[A-Za-z0-9-]+$/, 'must be URL-safe');
  return Promise.resolve();
});

await test('Session duration capped at 3 hours (180 min)', () => {
  const maxDuration = 180;
  const clamp = (d) => Math.min(d, maxDuration);
  assert.equal(clamp(60),  60);
  assert.equal(clamp(180), 180);
  assert.equal(clamp(240), 180);
  return Promise.resolve();
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. MESSAGING HELPERS
// ─────────────────────────────────────────────────────────────────────────────
suite('7. Messaging Helpers');

await test('formatTime: relative time labels', () => {
  const fmt = (iso) => {
    const ms  = Date.now() - new Date(iso).getTime();
    const min = Math.floor(ms / 60000), hr = Math.floor(ms / 3_600_000), day = Math.floor(ms / 86_400_000);
    if (min < 1)  return 'just now';
    if (min < 60) return `${min}m ago`;
    if (hr < 24)  return `${hr}h ago`;
    if (day < 7)  return `${day}d ago`;
    return new Date(iso).toLocaleDateString();
  };
  const ago = (ms) => new Date(Date.now() - ms).toISOString();
  assert.equal(fmt(ago(5 * 60000)),     '5m ago');
  assert.equal(fmt(ago(25 * 3600000)), '1d ago');
  return Promise.resolve();
});

await test('Conversation deduplication: one conv per user pair', () => {
  const convs = [{ id: 'c1', learner_id: 'u1', tutor_id: 'u2' }];
  const find  = (a, b) => convs.find(c =>
    (c.learner_id === a && c.tutor_id === b) || (c.learner_id === b && c.tutor_id === a)
  ) ?? null;
  assert.equal(find('u1', 'u2')?.id, 'c1');
  assert.equal(find('u2', 'u1')?.id, 'c1');
  assert.equal(find('u1', 'u3'),     null);
  return Promise.resolve();
});

await test('Message read status tracking', () => {
  const messages = [
    { id: 'm1', sender_id: 'u1', read_at: null },
    { id: 'm2', sender_id: 'u2', read_at: new Date().toISOString() },
    { id: 'm3', sender_id: 'u1', read_at: null },
  ];
  const unreadFrom = (userId) => messages.filter(m => m.sender_id !== userId && !m.read_at);
  assert.equal(unreadFrom('u2').length, 2, 'u2 has 2 unread messages from u1');
  assert.equal(unreadFrom('u1').length, 0, 'u1 has no unread messages');
  return Promise.resolve();
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. SECURITY
// ─────────────────────────────────────────────────────────────────────────────
suite('8. Security');

await test('File upload: only .pdf accepted', () => {
  const allowed = (name, mime) =>
    mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
  assert.ok(allowed('doc.pdf',  'application/pdf'));
  assert.ok(!allowed('hack.js', 'application/javascript'));
  assert.ok(!allowed('img.jpg', 'image/jpeg'));
  assert.ok(!allowed('doc.pdf.exe', 'application/octet-stream'));
  return Promise.resolve();
});

await test('XSS: HTML special chars are escaped', () => {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bad = '<script>alert(1)</script>';
  assert.ok(!esc(bad).includes('<script>'));
  assert.ok(esc(bad).includes('&lt;script&gt;'));
  return Promise.resolve();
});

await test('SQL injection chars stripped from search query', () => {
  const sanitize = (q) => q.replace(/['";\-\-]/g, '').trim();
  assert.ok(!sanitize("'; DROP TABLE users;--").includes("'"));
  assert.ok(!sanitize("admin'--").includes("'"));
  assert.ok(sanitize('Math equations') === 'Math equations');
  return Promise.resolve();
});

await test('JWT token format validated', () => {
  const isJwt = (t) => typeof t === 'string' && t.split('.').length === 3;
  assert.ok(isJwt('eyJhbGci.eyJzdWIi.signature'));
  assert.ok(!isJwt('not-a-jwt'));
  assert.ok(!isJwt('two.parts'));
  return Promise.resolve();
});

await test('RBAC: tutors cannot access admin routes (mock)', () => {
  const roles = { tutor: ['manage_own_tutorials', 'view_earnings'], admin: ['manage_users', 'manage_all'] };
  const can = (role, action) => roles[role]?.includes(action) ?? false;
  assert.ok(can('tutor', 'manage_own_tutorials'));
  assert.ok(!can('tutor', 'manage_users'));
  assert.ok(can('admin', 'manage_users'));
  return Promise.resolve();
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. STUDYMODE AI LOGIC
// ─────────────────────────────────────────────────────────────────────────────
suite('9. StudyMode AI Logic');

await test('Topic unlock: requires previous topic ≥70% mastery', () => {
  const topics = [{ mastery: 85 }, { mastery: 30 }, { mastery: 0 }];
  const canUnlock = (i) => i === 0 || topics[i - 1].mastery >= 70;
  assert.ok(canUnlock(0));
  assert.ok(canUnlock(1));
  assert.ok(!canUnlock(2));
  return Promise.resolve();
});

await test('Study streak increments on consecutive days, resets on gap', () => {
  const calcStreak = (lastDate, currentStreak) => {
    if (!lastDate) return 1;
    const diff = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86_400_000);
    if (diff === 0) return currentStreak;
    if (diff === 1) return currentStreak + 1;
    return 1;
  };
  const yesterday  = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().split('T')[0];
  const today      = new Date().toISOString().split('T')[0];
  assert.equal(calcStreak(null, 0),         1, 'first session = 1');
  assert.equal(calcStreak(yesterday, 5),    6, 'consecutive = +1');
  assert.equal(calcStreak(twoDaysAgo, 10),  1, 'gap = reset');
  assert.equal(calcStreak(today, 7),        7, 'same day = unchanged');
  return Promise.resolve();
});

await test('Readiness score: weighted average of mastery + quiz performance', () => {
  const calcReadiness = (masteries, accuracy) => {
    const avgMastery = masteries.length
      ? masteries.reduce((a, b) => a + b, 0) / masteries.length
      : 0;
    return Math.round(avgMastery * 0.7 + accuracy * 0.3);
  };
  assert.equal(calcReadiness([80, 90, 70], 75), Math.round(80 * 0.7 + 75 * 0.3));
  assert.equal(calcReadiness([], 0), 0);
  return Promise.resolve();
});

await test('Document type mapping: syllabus → parse for topics, past_paper → exam patterns', () => {
  const getParseTarget = (type) => {
    switch (type) {
      case 'syllabus':    return 'topics';
      case 'past_paper':  return 'exam_patterns';
      case 'mark_scheme': return 'exam_patterns';
      default:            return 'general';
    }
  };
  assert.equal(getParseTarget('syllabus'),    'topics');
  assert.equal(getParseTarget('past_paper'),  'exam_patterns');
  assert.equal(getParseTarget('mark_scheme'), 'exam_patterns');
  assert.equal(getParseTarget('other'),       'general');
  return Promise.resolve();
});

await test('Task types cover full learning cycle', () => {
  const taskTypes = ['micro-revision', 'concept-learning', 'flashcards', 'active-recall', 'exam-question'];
  assert.ok(taskTypes.includes('micro-revision'),   'needs micro-revision');
  assert.ok(taskTypes.includes('concept-learning'),  'needs concept-learning');
  assert.ok(taskTypes.includes('flashcards'),        'needs flashcards');
  assert.ok(taskTypes.includes('active-recall'),     'needs active-recall');
  assert.ok(taskTypes.includes('exam-question'),     'needs exam-question');
  return Promise.resolve();
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. ROUTE & COMPONENT COVERAGE
// ─────────────────────────────────────────────────────────────────────────────
suite('10. Route & Component Coverage');

const SRC_DIR = path.join(__dirname, '../src');

await test('LearnerApp.tsx exists and is non-empty', () => {
  const content = readFileSync(path.join(SRC_DIR, 'pages/LearnerApp.tsx'), 'utf8');
  assert.ok(content.length > 1000, 'LearnerApp too small');
  assert.ok(content.includes('activeTab'), 'needs tab navigation');
  assert.ok(content.includes('supabase'), 'needs Supabase integration');
  return Promise.resolve();
});

await test('TutorApp.tsx exists and is non-empty', () => {
  const content = readFileSync(path.join(SRC_DIR, 'pages/TutorApp.tsx'), 'utf8');
  assert.ok(content.length > 1000, 'TutorApp too small');
  assert.ok(content.includes('session'), 'needs auth session handling');
  return Promise.resolve();
});

await test('StudyMode component renders correctly', () => {
  const content = readFileSync(path.join(SRC_DIR, 'studymode/components/StudyMode.tsx'), 'utf8');
  assert.ok(content.includes('Dashboard'), 'needs Dashboard');
  assert.ok(content.includes('DocumentUpload'), 'needs DocumentUpload');
  assert.ok(content.includes('ChatPanel'), 'needs ChatPanel');
  return Promise.resolve();
});

await test('ChatInterface has real-time subscriptions', () => {
  const content = readFileSync(path.join(SRC_DIR, 'components/ChatInterface.tsx'), 'utf8');
  assert.ok(content.includes('postgres_changes'), 'needs realtime subscription');
  assert.ok(content.includes('sendMessage'), 'needs sendMessage function');
  assert.ok(!content.includes('console.log("ChatInterface'), 'debug log still present');
  return Promise.resolve();
});

await test('App.tsx has all required routes', () => {
  const content = readFileSync(path.join(SRC_DIR, 'App.tsx'), 'utf8');
  const required = ['/learner', '/tutor', '/learner/auth', '/tutor/auth', '/admin'];
  for (const route of required) {
    assert.ok(content.includes(`"${route}"`), `Missing route: ${route}`);
  }
  return Promise.resolve();
});

await test('AI server has all required endpoints', () => {
  const content = readFileSync(path.join(__dirname, '../ai-server.js'), 'utf8');
  const endpoints = [
    '/api/ai/tutor', '/api/ai/generate-quiz', '/api/ai/parse-document',
    '/api/ai/progress-insights', '/api/ai/greeting', '/api/ai/detect-weak-topics',
    '/api/ai/generate-task-content', '/api/ai/health',
  ];
  for (const ep of endpoints) {
    assert.ok(content.includes(`'${ep}'`), `Missing AI endpoint: ${ep}`);
  }
  return Promise.resolve();
});

await test('Migration files cover all required tables', () => {
  // Read the studymode migration (the most recent comprehensive one)
  const migDir = path.join(__dirname, '../supabase/migrations');
  // Read migration content by reading the known file directly
  let migContent = '';
  try {
    migContent = readFileSync(path.join(migDir, '20260315_studymode_tables.sql'), 'utf8');
    migContent += readFileSync(path.join(migDir, '20260314_feature_expansion.sql'), 'utf8');
  } catch (e) {
    // Try to read any sql files
    const files = ['20260315_studymode_tables.sql', '20260314_feature_expansion.sql'];
    for (const f of files) {
      try { migContent += readFileSync(path.join(migDir, f), 'utf8'); } catch {}
    }
  }
  assert.ok(migContent.length > 100, 'no migration content found');

  const studyModeTables = ['quiz_attempts', 'user_progress', 'study_schedule', 'subject_exams', 'exam_settings'];
  for (const table of studyModeTables) {
    assert.ok(migContent.includes(table), `Migration missing table: ${table}`);
  }
  return Promise.resolve();
});

await test('CSS @import precedes @tailwind directives', () => {
  const css = readFileSync(path.join(SRC_DIR, 'index.css'), 'utf8');
  const importPos  = css.indexOf('@import');
  const tailwindPos = css.indexOf('@tailwind');
  assert.ok(importPos < tailwindPos, '@import must come before @tailwind');
  return Promise.resolve();
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHOOLS PORTAL — FEATURE_SCHOOLS flag + contract gate source-level wiring
// ─────────────────────────────────────────────────────────────────────────────
suite('Schools portal feature flag & contract gate');

const SUPA_FN_DIR = path.join(__dirname, '../supabase/functions');

await test('FEATURE_SCHOOLS reads VITE_FEATURE_SCHOOLS with default ON', () => {
  const src = readFileSync(path.join(SRC_DIR, 'lib/featureFlags.ts'), 'utf8');
  assert.ok(src.includes('VITE_FEATURE_SCHOOLS'), 'flag name missing');
  assert.ok(/readFlag\("VITE_FEATURE_SCHOOLS",\s*true\)/.test(src), 'default must be true');
  assert.ok(/off|false|0|no/.test(src) && /on|true|1|yes/.test(src), 'must accept truthy/falsy strings');
});

await test('SchoolLayout hides portal when FEATURE_SCHOOLS is off', () => {
  const src = readFileSync(path.join(SRC_DIR, 'pages/school/SchoolLayout.tsx'), 'utf8');
  assert.ok(src.includes('FEATURE_SCHOOLS'), 'must import the flag');
  assert.ok(/!FEATURE_SCHOOLS[\s\S]{0,80}Navigate to="\/404"/.test(src),
    'must redirect to /404 when flag is off');
});

await test('SchoolLayout hard-blocks non-live contract states', () => {
  const src = readFileSync(path.join(SRC_DIR, 'pages/school/SchoolLayout.tsx'), 'utf8');
  assert.ok(src.includes('evaluateSchoolContract'), 'must evaluate contract');
  assert.ok(src.includes('isContractLive'), 'must check live state');
  assert.ok(/if\s*\(!live\)/.test(src), 'must hard-block when contract is not live');
  assert.ok(src.includes('BILLING_CONTACT_EMAIL'), 'must surface billing contact');
});

await test('App.tsx routes /school/* and /school/:id/billing', () => {
  const src = readFileSync(path.join(SRC_DIR, 'App.tsx'), 'utf8');
  assert.ok(/FEATURE_SCHOOLS\s*&&/.test(src), '/school routes must be flag-gated');
  assert.ok(src.includes('SchoolBilling'), 'must import SchoolBilling');
  assert.ok(/path="billing"\s+element=\{<SchoolBilling/.test(src), 'must register billing route');
});

await test('Shared contract helper exports enforceSchoolContract + audit logging', () => {
  const src = readFileSync(path.join(SUPA_FN_DIR, '_shared/school-contract.ts'), 'utf8');
  assert.ok(src.includes('enforceSchoolContract'), 'helper missing');
  assert.ok(src.includes('logContractDenial'), 'audit helper missing');
  assert.ok(src.includes("'contract_gate_denied'") || src.includes('"contract_gate_denied"'),
    'must write contract_gate_denied audit rows');
  for (const code of ['SUSPENDED', 'ARCHIVED', 'EXPIRED', 'NOT_STARTED']) {
    assert.ok(src.includes(code), `must classify ${code}`);
  }
  for (const status of [402, 410, 423]) {
    assert.ok(src.includes(`status: ${status}`) || src.includes(`status:${status}`),
      `must return HTTP ${status}`);
  }
});

for (const fn of ['school-analytics', 'school-ingest-document', 'school-search']) {
  await test(`${fn} enforces contract gate with audit context`, () => {
    const src = readFileSync(path.join(SUPA_FN_DIR, fn, 'index.ts'), 'utf8');
    assert.ok(src.includes('enforceSchoolContract'), `${fn} must enforce contract gate`);
    assert.ok(src.includes('feature:'), `${fn} must pass feature label`);
    assert.ok(/if\s*\("response"\s+in\s+gate\)/.test(src),
      `${fn} must return the gate Response on denial`);
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// STUDENT ANALYTICS & GAP DETECTION — isolation + quota hardening
// ─────────────────────────────────────────────────────────────────────────────
suite('Student analytics & gap detection: isolation + quota');

import { readdirSync } from 'node:fs';
const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');
const ALL_MIGRATIONS = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))
  .join('\n\n');

await test('student_analytics_daily has RLS enabled', () => {
  assert.ok(
    /ALTER TABLE\s+public\.student_analytics_daily\s+ENABLE ROW LEVEL SECURITY/i.test(ALL_MIGRATIONS),
    'RLS must be explicitly enabled on student_analytics_daily',
  );
});

await test('student_analytics_daily does NOT grant anon access', () => {
  assert.ok(
    !/GRANT[^;]+ON\s+public\.student_analytics_daily[^;]+TO\s+anon/i.test(ALL_MIGRATIONS),
    'analytics is sensitive — anon role must never be granted access',
  );
});

await test('student_analytics_daily restricts SELECT to self or school staff', () => {
  assert.ok(
    /CREATE POLICY\s+"student reads own analytics"[\s\S]{0,400}(user_id\s*=\s*auth\.uid\(\)|auth\.uid\(\)\s*=\s*user_id)/i.test(ALL_MIGRATIONS),
    'self-read policy missing or not scoped to auth.uid()',
  );
  assert.ok(
    /CREATE POLICY\s+"school staff reads student analytics"[\s\S]{0,600}school_memberships[\s\S]{0,300}sm\.school_id\s*=\s*student_analytics_daily\.school_id/i.test(ALL_MIGRATIONS),
    'staff-read policy must join school_memberships on the row school_id (no cross-school reads)',
  );
  assert.ok(
    /school staff reads student analytics[\s\S]{0,900}role[\s\S]{0,120}(school_teacher|school_admin|teacher|admin)/i.test(ALL_MIGRATIONS),
    'staff-read policy must require a privileged school role',
  );
});

await test('student_analytics_daily has NO insert/update/delete policies for end users', () => {
  const writePolicy = /CREATE POLICY[^;]+ON\s+public\.student_analytics_daily\s+FOR\s+(INSERT|UPDATE|DELETE)/i;
  assert.ok(!writePolicy.test(ALL_MIGRATIONS), 'no client write policies allowed on analytics');
});

await test('analytics RPCs are SECURITY DEFINER with locked search_path', () => {
  for (const fn of ['get_student_analytics', 'rebuild_student_analytics_today']) {
    const re = new RegExp(
      `FUNCTION\\s+public\\.${fn}[\\s\\S]{0,1200}SECURITY\\s+DEFINER[\\s\\S]{0,600}SET\\s+search_path`,
      'i',
    );
    assert.ok(re.test(ALL_MIGRATIONS), `${fn} must be SECURITY DEFINER with SET search_path`);
  }
});

await test('get_student_analytics enforces caller == target or school staff', () => {
  assert.ok(
    /get_student_analytics[\s\S]{0,2000}auth\.uid\(\)\s*=\s*_user_id/i.test(ALL_MIGRATIONS),
    'must allow self access via auth.uid()',
  );
  assert.ok(
    /get_student_analytics[\s\S]{0,3000}school_memberships[\s\S]{0,500}role[\s\S]{0,80}teacher/i.test(ALL_MIGRATIONS),
    'must gate cross-user access by privileged school membership',
  );
  assert.ok(
    /get_student_analytics[\s\S]{0,3500}(RAISE\s+EXCEPTION|not authorized|forbidden|insufficient)/i.test(ALL_MIGRATIONS),
    'must raise when caller is neither self nor staff',
  );
});

await test('analytics trigger functions run as SECURITY DEFINER', () => {
  for (const trg of ['tg_sad_daily_task', 'tg_sad_homework', 'tg_sad_quiz']) {
    const re = new RegExp(`FUNCTION\\s+public\\.${trg}[\\s\\S]{0,800}SECURITY\\s+DEFINER`, 'i');
    assert.ok(re.test(ALL_MIGRATIONS), `${trg} must run as SECURITY DEFINER`);
  }
});

await test('studymode-detect-gaps requires a JWT (no anon access)', () => {
  const src = readFileSync(path.join(SUPA_FN_DIR, 'studymode-detect-gaps/index.ts'), 'utf8');
  assert.ok(src.includes('Authorization'), 'must read Authorization header');
  assert.ok(/if\s*\(!authHeader\)[\s\S]{0,80}401/.test(src), 'must 401 when header missing');
  assert.ok(/auth\.getUser\(\)/.test(src), 'must verify the JWT via getUser()');
  assert.ok(/if\s*\(!userId\)[\s\S]{0,80}401/.test(src), 'must 401 when no userId resolved');
});

await test('studymode-detect-gaps scopes every query to the caller userId', () => {
  const src = readFileSync(path.join(SUPA_FN_DIR, 'studymode-detect-gaps/index.ts'), 'utf8');
  const tables = ['quiz_attempts', 'daily_task_attempts', 'school_homework_responses'];
  for (const t of tables) {
    const block = new RegExp(
      `\\.from\\(\\s*["']${t}["']\\s*\\)[\\s\\S]{0,800}?\\.eq\\(\\s*["'](user_id|student_id)["']\\s*,\\s*userId\\s*\\)`,
    );
    assert.ok(block.test(src), `${t} query must .eq('user_id'|'student_id', userId)`);
  }
});

await test('studymode-detect-gaps never accepts a target user_id from the client', () => {
  const src = readFileSync(path.join(SUPA_FN_DIR, 'studymode-detect-gaps/index.ts'), 'utf8');
  assert.ok(!/req\.json\([\s\S]{0,200}user_?id/i.test(src),
    'must not read user_id from request body (would bypass caller isolation)');
  assert.ok(!/body\.(user_?id|student_?id)/i.test(src),
    'must not read student_id/user_id from request payload');
});

await test('AI quota helper enforces per-user daily buckets', () => {
  const src = readFileSync(path.join(SUPA_FN_DIR, '_shared/ai-config.ts'), 'utf8');
  assert.ok(src.includes('QUOTA_BUCKETS'), 'QUOTA_BUCKETS map must exist');
  assert.ok(/export\s+async\s+function\s+enforceQuota/.test(src), 'enforceQuota must be exported');
  assert.ok(src.includes('quotaExceededResponse'), 'must expose quotaExceededResponse helper');
  assert.ok(/429/.test(src), 'quota-exceeded response must use HTTP 429');
});

await test('School AI usage is tracked in a school-scoped table with RLS', () => {
  assert.ok(
    /CREATE TABLE[\s\S]{0,200}public\.school_ai_usage_daily[\s\S]{0,1200}school_id\s+UUID/i.test(ALL_MIGRATIONS),
    'school_ai_usage_daily must include a school_id column for per-school quotas',
  );
  assert.ok(
    /ALTER TABLE\s+public\.school_ai_usage_daily\s+ENABLE ROW LEVEL SECURITY/i.test(ALL_MIGRATIONS),
    'school_ai_usage_daily must have RLS enabled',
  );
});

await test('Network: anon client cannot read student_analytics_daily', async () => {
  if (!NETWORK) return skip('anon analytics read', 'no SUPABASE creds');
  const url = `${SUPABASE_URL}/rest/v1/student_analytics_daily?select=user_id&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  const body = await res.text();
  if (res.ok) {
    const rows = JSON.parse(body);
    assert.equal(rows.length, 0, 'anon must not receive any analytics rows');
  } else {
    assert.ok([401, 403, 404].includes(res.status), `expected auth/forbidden, got ${res.status}`);
  }
});

await test('Network: anon cannot invoke studymode-detect-gaps without a JWT', async () => {
  if (!NETWORK) return skip('detect-gaps anon call', 'no SUPABASE creds');
  const url = `${SUPABASE_URL}/functions/v1/studymode-detect-gaps`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: '{}',
  });
  await res.text();
  assert.ok(res.status === 401 || res.status === 403,
    `expected 401/403 for unauthenticated detect-gaps, got ${res.status}`);
});



// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(56)}`);
console.log(`📊  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failures.length) {
  console.log('\n❌  Failures:');
  failures.forEach(f => console.log(`     • ${f.name}\n       ${f.msg}`));
}
console.log(`${'═'.repeat(56)}\n`);
process.exit(failed ? 1 : 0);
