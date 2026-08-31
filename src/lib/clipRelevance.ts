import type { LibraryResource } from "@/types/academicProfile";
import { subjectMatches } from "@/lib/personalization";

/**
 * Clip relevance — shared scoring/grouping used by:
 *  1. Study Mode "Clips for this topic" rail (subject + topic + weak-concept aware)
 *  2. Topic-first Clips browsing in the Library (topic shelves scoping the reels)
 *
 * Pure functions only — no React, fully unit-testable.
 */

// ─── Text helpers ──────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "part", "grade", "gr", "form", "level", "intro", "introduction", "lesson",
  "how", "what", "why", "your", "into", "from", "using", "between",
  "all", "topics", "topic",
]);

/** Lowercase, strip punctuation, split into meaningful tokens. */
export function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

// ─── Relevance scoring ─────────────────────────────────────────────────────

export interface ClipContext {
  subject?: string | null;
  topic?: string | null;
  /** Concept labels the learner is currently weak on (highest priority). */
  weakConcepts?: string[];
  /** Clip ids the learner liked — mild boost (proven-useful signal). */
  likedIds?: string[];
  /** Clip id → watch count — already-watched clips sink so fresh ones surface. */
  watchCounts?: Record<string, number>;
}

/**
 * Score how relevant a clip is to what the learner is studying right now.
 *  - subject match (aliased: physics ≈ physical sciences) → +30
 *  - topic tag match (exact/substring)                    → +40
 *  - topic keyword overlap with clip title/summary        → +8 per token (max 24)
 *  - weak-concept keyword hit in title/topic/summary      → +12 per concept (max 36)
 * Returns 0 when nothing matches.
 */
export function scoreClipRelevance(clip: LibraryResource, ctx: ClipContext): number {
  let score = 0;

  const clipSubject = clip.tags?.subject || clip.category || "";
  const clipTopic = (clip.tags?.topic || "").toLowerCase();
  const haystack = `${clip.title} ${clipTopic} ${clip.summary || ""}`.toLowerCase();

  // Subject
  if (ctx.subject && subjectMatches(clipSubject, [ctx.subject])) {
    score += 30;
  } else if (ctx.subject) {
    // Wrong subject entirely → weak-concept/topic hits are usually coincidental.
    // Still allow token matches but at no subject bonus.
  }

  // Topic tag match
  if (ctx.topic) {
    const t = ctx.topic.toLowerCase().trim();
    if (t && clipTopic && (clipTopic.includes(t) || t.includes(clipTopic)) && clipTopic !== "all topics") {
      score += 40;
    }
    // Keyword overlap between topic name and clip text
    const topicTokens = tokenize(ctx.topic);
    let hits = 0;
    for (const tok of topicTokens) {
      if (haystack.includes(tok)) hits++;
    }
    score += Math.min(hits * 8, 24);
  }

  // Weak concepts — the highest-value signal for "watch this next"
  if (ctx.weakConcepts?.length) {
    let conceptHits = 0;
    for (const concept of ctx.weakConcepts) {
      const tokens = tokenize(concept);
      if (tokens.length === 0) continue;
      const matched = tokens.filter((tok) => haystack.includes(tok)).length;
      // Require at least half the concept's tokens to appear to count a hit.
      if (matched >= Math.max(1, Math.ceil(tokens.length / 2))) conceptHits++;
    }
    score += Math.min(conceptHits * 12, 36);
  }

  // Engagement signals — only adjust clips that already match on content.
  if (score > 0) {
    const id = String(clip.id);
    if (ctx.likedIds?.includes(id)) score += 10;
    const watches = ctx.watchCounts?.[id] ?? 0;
    // Repeat-watch penalty: watched clips sink (but stay in the pool for revision).
    if (watches > 0) score -= Math.min(watches * 8, 24);
    if (score <= 0) score = 1; // matching clips never fully disappear
  }

  return score;
}

/**
 * Rank clips for a study context. Only returns clips with a positive score,
 * best first. `limit` caps the result (default 12).
 */
export function rankClipsForContext(
  clips: LibraryResource[],
  ctx: ClipContext,
  limit = 12,
): LibraryResource[] {
  const scored: Array<{ clip: LibraryResource; score: number }> = [];
  for (const clip of clips) {
    const score = scoreClipRelevance(clip, ctx);
    if (score > 0) scored.push({ clip, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.clip);
}

// ─── Topic-first browsing ──────────────────────────────────────────────────

export interface TopicShelf {
  subject: string;
  topic: string;
  clips: LibraryResource[];
}

const GENERIC_TOPICS = new Set(["all topics", "general", ""]);

/**
 * Group clips into subject → topic shelves for the topic-first Clips browser.
 * - Shelves are keyed on the clip's `tags.topic` (fallback "More clips").
 * - Within a subject, shelves are ordered by size (biggest topics first).
 * - Subjects the learner takes come first (via `prioritySubjects`).
 */
export function buildTopicShelves(
  clips: LibraryResource[],
  prioritySubjects: string[] = [],
): TopicShelf[] {
  const bySubject = new Map<string, Map<string, LibraryResource[]>>();

  for (const clip of clips) {
    const subject = clip.tags?.subject || clip.category || "General";
    const rawTopic = (clip.tags?.topic || "").trim();
    const topic = GENERIC_TOPICS.has(rawTopic.toLowerCase()) ? "More clips" : rawTopic;
    let topics = bySubject.get(subject);
    if (!topics) {
      topics = new Map();
      bySubject.set(subject, topics);
    }
    const arr = topics.get(topic);
    if (arr) arr.push(clip);
    else topics.set(topic, [clip]);
  }

  const isPriority = (subject: string) =>
    prioritySubjects.some((s) => subjectMatches(subject, [s]));

  const subjects = Array.from(bySubject.keys()).sort((a, b) => {
    const pa = isPriority(a) ? 0 : 1;
    const pb = isPriority(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    // Bigger subjects first within each priority band
    const sizeA = Array.from(bySubject.get(a)!.values()).reduce((n, v) => n + v.length, 0);
    const sizeB = Array.from(bySubject.get(b)!.values()).reduce((n, v) => n + v.length, 0);
    return sizeB - sizeA;
  });

  const shelves: TopicShelf[] = [];
  for (const subject of subjects) {
    const topics = bySubject.get(subject)!;
    const entries = Array.from(topics.entries()).sort((a, b) => {
      // "More clips" always last within a subject
      if (a[0] === "More clips") return 1;
      if (b[0] === "More clips") return -1;
      return b[1].length - a[1].length;
    });
    for (const [topic, items] of entries) {
      shelves.push({ subject, topic, clips: items });
    }
  }
  return shelves;
}
