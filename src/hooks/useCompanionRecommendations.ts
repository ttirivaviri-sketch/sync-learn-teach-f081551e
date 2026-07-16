/**
 * useCompanionRecommendations — the "sentient" recommendation engine behind
 * the LearningCompanion card.
 *
 * Fuses three live signals about what the student is studying RIGHT NOW:
 *   1. learner_state      — per-topic mastery / risk derived from every quiz,
 *                           daily task and homework event (last 30 days)
 *   2. school_homework    — published homework the student hasn't submitted
 *   3. subjects           — the learner's own subject names (id → name)
 *
 * …and matches them against two supply pools:
 *   a. library_system_resources — topic-tagged videos & books (Khan Academy,
 *      CrashCourse, OpenStax, Siyavula, …)
 *   b. tutor_subjects + profiles — real bookable tutors for the subject
 *
 * The output is a small set of CompanionSuggestion objects, each carrying a
 * natural-language message ("I see you're struggling with Photosynthesis —
 * here's a video by CrashCourse that breaks it down beautifully.") plus the
 * actual resource or tutor to act on. Message templates rotate daily (stable
 * hash of topic + date) so the companion feels alive without flickering
 * between renders.
 *
 * Everything runs under the caller's JWT — RLS restricts learner_state and
 * homework to the student's own rows; library + tutor tables are public-read.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Public types ─────────────────────────────────────────────────────────────

export type CompanionSuggestionKind =
  | "struggle_video"
  | "struggle_book"
  | "struggle_tutor"
  | "homework_video"
  | "homework_book"
  | "mastery_book"
  | "mastery_video";

export type CompanionMood = "concern" | "homework" | "encourage" | "tutor";

export interface CompanionResource {
  id: string;
  title: string;
  /** "video" | "textbook" | "guide" | … (library kind) */
  kind: string;
  /** Derived producer: "Khan Academy", "OpenStax", "CrashCourse", … */
  author: string;
  /** video_url for videos, pdf_url for books. */
  url: string;
  thumbnail: string | null;
  subject: string;
  topic: string | null;
}

export interface CompanionTutor {
  id: string;
  name: string;
  subject: string;
  level: string | null;
  hourlyRate: number | null;
  avatarUrl: string | null;
  online: boolean;
}

export interface CompanionSuggestion {
  /** Stable id — also the per-day dismissal key. */
  id: string;
  kind: CompanionSuggestionKind;
  mood: CompanionMood;
  /** The sentient one-liner shown with the typewriter effect. */
  message: string;
  /** Short factual justification ("62% avg across 5 attempts this month"). */
  reason: string;
  topic: string;
  subject: string | null;
  resource?: CompanionResource;
  tutor?: CompanionTutor;
}

// ── Internals ────────────────────────────────────────────────────────────────

interface Signal {
  topic: string;
  subjectId: string | null;
  subjectName: string | null;
  kind: "struggle" | "mastery" | "homework";
  scorePct: number | null;
  attempts: number;
}

/** Known open-education producers we can name-drop in messages. */
const KNOWN_AUTHORS = [
  "Khan Academy",
  "CrashCourse",
  "Crash Course",
  "OpenStax",
  "Siyavula",
  "CK-12",
  "Project Gutenberg",
  "Cambridge",
];

function deriveAuthor(title: string): string {
  for (const a of KNOWN_AUTHORS) {
    if (title.toLowerCase().includes(a.toLowerCase())) {
      return a === "Crash Course" ? "CrashCourse" : a;
    }
  }
  // "Producer — Topic" seed convention.
  const dash = title.split("—");
  if (dash.length > 1 && dash[0].trim().length > 2 && dash[0].trim().length < 40) {
    return dash[0].trim();
  }
  return "our library";
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Pick a template deterministically per (topic, day) so it rotates daily. */
function pick(pool: string[], seed: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return pool[hashStr(`${seed}:${day}`) % pool.length];
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

// ── Message pools — the companion's "voice" ─────────────────────────────────

const STRUGGLE_VIDEO = [
  "I see you're struggling with {topic} — here's a video by {author} that breaks it down beautifully.",
  "{topic} has been giving you a hard time lately. This {author} video should clear things up.",
  "I noticed your recent {topic} scores. Watch this — {author} explains it better than most textbooks.",
  "Don't let {topic} knock your confidence. {author} made a video that makes it click.",
];

const STRUGGLE_BOOK = [
  "You've been wrestling with {topic}. I found a book by {author} that approaches it from a different angle.",
  "Sometimes {topic} just needs a slower read. This {author} book walks through it step by step.",
];

const STRUGGLE_TUTOR = [
  "Your score for {topic} can be better — how about booking {tutor}? A one-on-one session can make a huge difference.",
  "Sometimes a topic needs a human touch. {tutor} tutors {subject} — one session could unlock {topic} for you.",
  "I've watched you push at {topic} on your own. {tutor} can get you over the hump faster — want to book a session?",
];

const HOMEWORK_VIDEO = [
  "Your school homework is on {topic} — here's a video by {author} to help you with the basics.",
  "I peeked at your homework: {topic}. This {author} video covers exactly what you'll need.",
  "Homework on {topic} is waiting. Ten minutes with this {author} video first will make it much easier.",
];

const HOMEWORK_BOOK = [
  "Your homework covers {topic} — this {author} book has a chapter that maps to it almost perfectly.",
];

const MASTERY_BOOK = [
  "You seem to be grasping the fundamentals of {topic} — here's a book by {author} that can broaden your understanding.",
  "You're doing brilliantly at {topic}. Ready to go deeper? {author} has just the book.",
  "{topic} is becoming one of your strengths. This {author} book will take you beyond the syllabus.",
];

const MASTERY_VIDEO = [
  "You've nailed the basics of {topic}. This {author} video pushes into the more interesting territory.",
  "Since {topic} is going so well for you, here's a {author} video to stretch you a little further.",
];

// ── Matching helpers ─────────────────────────────────────────────────────────

interface LibRow {
  id: string;
  title: string;
  subject: string;
  topic: string | null;
  kind: string;
  pdf_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  curriculum: string;
}

function sanitizeTerm(t: string): string {
  // ilike terms inside .or() must not contain commas/parens/percent.
  return t.replace(/[,%()]/g, " ").trim();
}

/** Score how well a library row matches a topic/subject signal. */
function matchScore(row: LibRow, topic: string, subjectName: string | null): number {
  const t = topic.toLowerCase();
  const rowTopic = (row.topic ?? "").toLowerCase();
  const rowTitle = row.title.toLowerCase();
  const rowSubject = row.subject.toLowerCase();
  let score = 0;
  if (rowTopic && (rowTopic.includes(t) || t.includes(rowTopic))) score += 6;
  if (rowTitle.includes(t)) score += 4;
  // Word-level overlap (e.g. "Algebraic equations" ↔ topic "Algebra")
  const words = t.split(/\s+/).filter((w) => w.length > 3);
  for (const w of words) {
    if (rowTopic.includes(w)) score += 3;
    if (rowTitle.includes(w)) score += 2;
  }
  if (subjectName && rowSubject.includes(subjectName.toLowerCase())) score += 1;
  return score;
}

function toResource(row: LibRow): CompanionResource | null {
  const isVideo = row.kind === "video" && !!row.video_url;
  const url = isVideo ? row.video_url! : row.pdf_url;
  if (!url) return null;
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    author: deriveAuthor(row.title),
    url,
    thumbnail: row.thumbnail_url,
    subject: row.subject,
    topic: row.topic,
  };
}

/** Find best video / best book for a signal from the fetched pool. */
function bestMatches(pool: LibRow[], topic: string, subjectName: string | null) {
  let bestVideo: { row: LibRow; score: number } | null = null;
  let bestBook: { row: LibRow; score: number } | null = null;
  for (const row of pool) {
    const s = matchScore(row, topic, subjectName);
    if (s <= 0) continue;
    if (row.kind === "video" && row.video_url) {
      if (!bestVideo || s > bestVideo.score) bestVideo = { row, score: s };
    } else if (row.pdf_url) {
      if (!bestBook || s > bestBook.score) bestBook = { row, score: s };
    }
  }
  return {
    video: bestVideo && bestVideo.score >= 3 ? toResource(bestVideo.row) : null,
    book: bestBook && bestBook.score >= 3 ? toResource(bestBook.row) : null,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCompanionRecommendations(userId: string | null | undefined) {
  return useQuery<CompanionSuggestion[]>({
    queryKey: ["companion-recommendations", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return [];

      // ── 1. Gather signals in parallel ──────────────────────────────────
      const [stateRes, hwRes, subjectsRes, feedbackRes] = await Promise.all([
        supabase
          .from("learner_state")
          .select("topic_name, subject_id, risk_level, mastery_pct, ewma_score_pct, attempts, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(60),
        supabase
          .from("school_homework")
          .select("id, title, topic, subject_id, due_at, status")
          .eq("status", "published")
          .order("due_at", { ascending: true })
          .limit(5),
        supabase.from("subjects").select("id, name").eq("user_id", userId),
        // Feedback loop: the learner's own recent interaction history
        // (companion_interactions may not exist in envs behind on migrations —
        // errors are tolerated and treated as "no history").
        supabase
          .from("companion_interactions" as never)
          .select("suggestion_kind, event, topic, created_at" as never)
          .eq("user_id" as never, userId as never)
          .gte("created_at" as never, new Date(Date.now() - 30 * 86400_000).toISOString() as never)
          .order("created_at", { ascending: false })
          .limit(300)
          .then((r) => r, () => ({ data: null, error: null })),
      ]);

      const subjectName = new Map<string, string>(
        (subjectsRes.data ?? []).map((s) => [s.id, s.name])
      );

      // ── 1b. Digest feedback history ───────────────────────────────────
      type FeedbackRow = {
        suggestion_kind: string;
        event: string;
        topic: string | null;
        created_at: string;
      };
      const feedback: FeedbackRow[] = Array.isArray(feedbackRes?.data)
        ? (feedbackRes.data as unknown as FeedbackRow[])
        : [];

      // Topics the learner dismissed in the last 3 days — give them a rest.
      const cooloffMs = 3 * 86400_000;
      const snoozedTopics = new Set(
        feedback
          .filter(
            (f) =>
              f.event === "dismissed" &&
              f.topic &&
              Date.now() - new Date(f.created_at).getTime() < cooloffMs
          )
          .map((f) => f.topic!.toLowerCase())
      );

      // Per-kind engagement score: (clicked + booked − dismissed) / shown.
      // Positive → the learner acts on this kind; negative → they wave it away.
      const kindStats = new Map<string, { shown: number; engaged: number; dismissed: number }>();
      for (const f of feedback) {
        const s = kindStats.get(f.suggestion_kind) ?? { shown: 0, engaged: 0, dismissed: 0 };
        if (f.event === "shown") s.shown += 1;
        else if (f.event === "clicked" || f.event === "booked") s.engaged += 1;
        else if (f.event === "dismissed") s.dismissed += 1;
        kindStats.set(f.suggestion_kind, s);
      }
      const kindScore = (kind: string): number => {
        const s = kindStats.get(kind);
        if (!s || s.shown < 3) return 0; // not enough history — neutral
        return (s.engaged - s.dismissed) / s.shown;
      };

      const signals: Signal[] = [];

      // Pending homework (exclude already-submitted).
      const hw = hwRes.data ?? [];
      if (hw.length) {
        const { data: responses } = await supabase
          .from("school_homework_responses")
          .select("homework_id, status")
          .in("homework_id", hw.map((h) => h.id))
          .eq("student_id", userId);
        const done = new Set(
          (responses ?? [])
            .filter((r) => r.status === "submitted" || r.status === "graded")
            .map((r) => r.homework_id)
        );
        const next = hw.find((h) => !done.has(h.id));
        if (next) {
          signals.push({
            topic: next.topic || next.title,
            subjectId: next.subject_id,
            subjectName: next.subject_id ? subjectName.get(next.subject_id) ?? null : null,
            kind: "homework",
            scorePct: null,
            attempts: 0,
          });
        }
      }

      // Struggling + mastered topics from learner_state.
      const state = stateRes.data ?? [];
      const struggling = state
        .filter((s) => s.risk_level === "critical" || s.risk_level === "warning")
        .sort((a, b) => Number(a.ewma_score_pct ?? 100) - Number(b.ewma_score_pct ?? 100));
      const mastered = state
        .filter((s) => s.risk_level === "mastered" || Number(s.mastery_pct ?? 0) >= 80)
        .sort((a, b) => Number(b.mastery_pct ?? 0) - Number(a.mastery_pct ?? 0));

      for (const s of struggling.slice(0, 3)) {
        signals.push({
          topic: s.topic_name,
          subjectId: s.subject_id,
          subjectName: s.subject_id ? subjectName.get(s.subject_id) ?? null : null,
          kind: "struggle",
          scorePct: s.ewma_score_pct != null ? Number(s.ewma_score_pct) : null,
          attempts: s.attempts ?? 0,
        });
      }
      for (const s of mastered.slice(0, 1)) {
        signals.push({
          topic: s.topic_name,
          subjectId: s.subject_id,
          subjectName: s.subject_id ? subjectName.get(s.subject_id) ?? null : null,
          kind: "mastery",
          scorePct: s.mastery_pct != null ? Number(s.mastery_pct) : null,
          attempts: s.attempts ?? 0,
        });
      }

      if (signals.length === 0) return [];

      // ── 2. Fetch matching supply (library + tutors) ────────────────────
      const terms = Array.from(
        new Set(
          signals
            .flatMap((s) => {
              const t = sanitizeTerm(s.topic);
              const words = t.split(/\s+/).filter((w) => w.length > 3);
              return [t, ...words.slice(0, 2)];
            })
            .filter((t) => t.length > 2)
        )
      ).slice(0, 10);

      const subjectTerms = Array.from(
        new Set(signals.map((s) => sanitizeTerm(s.subjectName ?? "")).filter((t) => t.length > 2))
      ).slice(0, 4);

      const libOr = [
        ...terms.flatMap((t) => [`topic.ilike.%${t}%`, `title.ilike.%${t}%`]),
        ...subjectTerms.map((t) => `subject.ilike.%${t}%`),
      ].join(",");

      const tutorSubjects = subjectTerms.length ? subjectTerms : terms.slice(0, 3);
      const tutorOr = tutorSubjects.map((t) => `subject.ilike.%${t}%`).join(",");

      const [libRes, tutorSubRes] = await Promise.all([
        libOr
          ? supabase
              .from("library_system_resources")
              .select("id, title, subject, topic, kind, pdf_url, video_url, thumbnail_url, curriculum")
              .or(libOr)
              .limit(60)
          : Promise.resolve({ data: [] as LibRow[] }),
        tutorOr
          ? supabase
              .from("tutor_subjects")
              .select("id, user_id, subject, level, hourly_rate")
              .or(tutorOr)
              .limit(12)
          : Promise.resolve({ data: [] as { id: string; user_id: string; subject: string; level: string; hourly_rate: number | null }[] }),
      ]);

      const libPool = (libRes.data ?? []) as LibRow[];

      // Resolve tutor identities (exclude the learner themself).
      const tutorRows = (tutorSubRes.data ?? []).filter((t) => t.user_id !== userId);
      const tutorsBySubject = new Map<string, CompanionTutor>();
      if (tutorRows.length) {
        const ids = Array.from(new Set(tutorRows.map((t) => t.user_id)));
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, online_status")
          .in("id", ids)
          .eq("is_suspended", false);
        const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
        for (const t of tutorRows) {
          const p = profileById.get(t.user_id);
          if (!p?.full_name) continue;
          const key = t.subject.toLowerCase();
          // Prefer online tutors, then first seen.
          const existing = tutorsBySubject.get(key);
          const candidate: CompanionTutor = {
            id: t.user_id,
            name: p.full_name,
            subject: t.subject,
            level: t.level ?? null,
            hourlyRate: t.hourly_rate != null ? Number(t.hourly_rate) : null,
            avatarUrl: p.avatar_url ?? null,
            online: !!p.online_status,
          };
          if (!existing || (!existing.online && candidate.online)) {
            tutorsBySubject.set(key, candidate);
          }
        }
      }

      const findTutor = (subject: string | null): CompanionTutor | null => {
        if (!subject) return tutorsBySubject.values().next().value ?? null;
        const s = subject.toLowerCase();
        for (const [key, t] of tutorsBySubject) {
          if (key.includes(s) || s.includes(key)) return t;
        }
        return tutorsBySubject.values().next().value ?? null;
      };

      // ── 3. Compose suggestions ─────────────────────────────────────────
      const suggestions: CompanionSuggestion[] = [];
      const usedTopics = new Set<string>();
      const usedResources = new Set<string>();

      const firstName = (full: string) => full.split(/\s+/)[0];

      for (const sig of signals) {
        const topicKey = sig.topic.toLowerCase();
        if (usedTopics.has(topicKey)) continue;

        const { video, book } = bestMatches(libPool, sig.topic, sig.subjectName);
        const vid = video && !usedResources.has(video.id) ? video : null;
        const bk = book && !usedResources.has(book.id) ? book : null;

        if (sig.kind === "homework") {
          const res = vid ?? bk;
          if (!res) continue;
          suggestions.push({
            id: `hw:${topicKey}:${res.id}`,
            kind: res.kind === "video" ? "homework_video" : "homework_book",
            mood: "homework",
            message: fill(pick(res.kind === "video" ? HOMEWORK_VIDEO : HOMEWORK_BOOK, topicKey), {
              topic: sig.topic,
              author: res.author,
            }),
            reason: "Matched to your pending school homework",
            topic: sig.topic,
            subject: sig.subjectName,
            resource: res,
          });
          usedTopics.add(topicKey);
          usedResources.add(res.id);
        } else if (sig.kind === "struggle") {
          const scoreTxt =
            sig.scorePct != null
              ? `${Math.round(sig.scorePct)}% average across ${sig.attempts} recent attempt${sig.attempts === 1 ? "" : "s"}`
              : "recent low scores";

          // Primary: a video or book fix.
          const res = vid ?? bk;
          if (res) {
            suggestions.push({
              id: `str:${topicKey}:${res.id}`,
              kind: res.kind === "video" ? "struggle_video" : "struggle_book",
              mood: "concern",
              message: fill(pick(res.kind === "video" ? STRUGGLE_VIDEO : STRUGGLE_BOOK, topicKey), {
                topic: sig.topic,
                author: res.author,
              }),
              reason: scoreTxt,
              topic: sig.topic,
              subject: sig.subjectName,
              resource: res,
            });
            usedTopics.add(topicKey);
            usedResources.add(res.id);
          }

          // Secondary: for the single weakest topic, also offer a human.
          const tutor = findTutor(sig.subjectName);
          if (tutor && !suggestions.some((s) => s.kind === "struggle_tutor")) {
            suggestions.push({
              id: `tut:${topicKey}:${tutor.id}`,
              kind: "struggle_tutor",
              mood: "tutor",
              message: fill(pick(STRUGGLE_TUTOR, `${topicKey}:tutor`), {
                topic: sig.topic,
                tutor: firstName(tutor.name),
                subject: tutor.subject,
              }),
              reason: scoreTxt,
              topic: sig.topic,
              subject: sig.subjectName,
              tutor,
            });
            usedTopics.add(topicKey);
          }
        } else if (sig.kind === "mastery") {
          const res = bk ?? vid;
          if (!res) continue;
          suggestions.push({
            id: `mas:${topicKey}:${res.id}`,
            kind: res.kind === "video" ? "mastery_video" : "mastery_book",
            mood: "encourage",
            message: fill(pick(res.kind === "video" ? MASTERY_VIDEO : MASTERY_BOOK, topicKey), {
              topic: sig.topic,
              author: res.author,
            }),
            reason:
              sig.scorePct != null
                ? `${Math.round(sig.scorePct)}% mastery — you're ahead here`
                : "You're ahead on this topic",
            topic: sig.topic,
            subject: sig.subjectName,
            resource: res,
          });
          usedTopics.add(topicKey);
          usedResources.add(res.id);
        }

        if (suggestions.length >= 4) break;
      }

      // ── 4. Feedback-aware ordering ────────────────────────────────────
      // Drop suggestions for topics dismissed in the last 3 days, then order
      // by the learner's own historical engagement with each suggestion kind
      // (stable sort keeps the signal-priority order within equal scores).
      const filtered = suggestions.filter(
        (s) => !s.topic || !snoozedTopics.has(s.topic.toLowerCase())
      );
      const pool = filtered.length > 0 ? filtered : suggestions;
      const ranked = pool
        .map((s, i) => ({ s, i, score: kindScore(s.kind) }))
        .sort((a, b) => b.score - a.score || a.i - b.i)
        .map((x) => x.s);

      return ranked.slice(0, 4);
    },
  });
}
