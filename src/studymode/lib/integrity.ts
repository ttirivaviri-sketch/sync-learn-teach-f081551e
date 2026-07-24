/**
 * Session integrity — shared types, scoring, and thresholds.
 *
 * IMPORTANT FRAMING: these are focus/independence SIGNALS, not cheating
 * proof. A tab switch can be a notification glance; a paste can be from the
 * student's own notes. Thresholds below are deliberately conservative so
 * only sustained patterns are surfaced to guardians/tutors/schools.
 */

export type IntegrityEventType =
  | "tab_hidden"       // document became hidden (tab switch / app background)
  | "window_blur"      // window lost focus (other app / split screen click)
  | "paste"            // paste into the answer field
  | "question_copied"; // question text copied to clipboard

export interface IntegrityEvent {
  q: number;                    // 1-based question index
  type: IntegrityEventType;
  at: string;                   // ISO timestamp
  away_ms?: number;             // for tab_hidden / window_blur: time until refocus
  paste_len?: number;           // for paste: pasted text length
  paste_similarity?: number;    // 0..1 — pasted text vs final submitted answer
}

export interface IntegritySummary {
  questionsTotal: number;
  questionsFlagged: number;
  focusScore: number;           // 0..100
  tabSwitches: number;
  totalAwayMs: number;
  pasteEvents: number;
  questionCopies: number;
  isFlagged: boolean;
  events: IntegrityEvent[];
}

// ── Thresholds (tuned for reliability — sustained patterns only) ────────────

/** Away for less than this is treated as a harmless glance (notifications). */
export const AWAY_IGNORE_MS = 5_000;

/** Away for at least this long during a question flags that question. */
export const AWAY_FLAG_MS = 10_000;

/** A paste flags the question when it makes up ≥ this share of the answer. */
export const PASTE_SIMILARITY_FLAG = 0.8;

/** Pastes shorter than this are ignored (pasting a formula/symbol is fine). */
export const PASTE_MIN_LEN = 25;

/** Session is flagged when ≥ this many questions are flagged… */
export const SESSION_FLAG_MIN_QUESTIONS = 3;

/** …or when ≥ this fraction of questions are flagged (short sessions). */
export const SESSION_FLAG_MIN_RATIO = 0.4;

/**
 * Weekly guardian-report threshold: only mention integrity when at least
 * this many sessions in the week were flagged. One bad session never
 * triggers a parent conversation on its own.
 */
export const WEEKLY_REPORT_MIN_FLAGGED_SESSIONS = 2;

// ── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Rough similarity: how much of the final answer is covered by the pasted
 * text. Uses normalized substring containment — cheap, dependency-free, and
 * good enough to distinguish "pasted the whole answer" from "pasted a term".
 */
export function pasteSimilarity(pasted: string, finalAnswer: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const p = norm(pasted);
  const a = norm(finalAnswer);
  if (!p || !a) return 0;
  if (a.includes(p)) return Math.min(1, p.length / a.length);
  // Fallback: token overlap
  const pTokens = new Set(p.split(" "));
  const aTokens = a.split(" ");
  if (aTokens.length === 0) return 0;
  const hit = aTokens.filter((t) => pTokens.has(t)).length;
  return hit / aTokens.length;
}

/** Which question indices (1-based) are flagged by the event log. */
export function flaggedQuestions(events: IntegrityEvent[]): Set<number> {
  const flagged = new Set<number>();
  const copiedQuestions = new Set<number>();

  for (const e of events) {
    switch (e.type) {
      case "tab_hidden":
      case "window_blur":
        if ((e.away_ms ?? 0) >= AWAY_FLAG_MS) flagged.add(e.q);
        // Copy-then-leave is a strong lookup pattern even for short absences.
        if (copiedQuestions.has(e.q) && (e.away_ms ?? 0) >= AWAY_IGNORE_MS) {
          flagged.add(e.q);
        }
        break;
      case "paste":
        if (
          (e.paste_len ?? 0) >= PASTE_MIN_LEN &&
          (e.paste_similarity ?? 0) >= PASTE_SIMILARITY_FLAG
        ) {
          flagged.add(e.q);
        }
        break;
      case "question_copied":
        copiedQuestions.add(e.q);
        break;
    }
  }
  return flagged;
}

/** Summarize a session's event log into the persisted aggregate shape. */
export function summarizeIntegrity(
  events: IntegrityEvent[],
  questionsTotal: number,
): IntegritySummary {
  const flagged = flaggedQuestions(events);
  const tabSwitches = events.filter(
    (e) => (e.type === "tab_hidden" || e.type === "window_blur") && (e.away_ms ?? 0) >= AWAY_IGNORE_MS,
  ).length;
  const totalAwayMs = events.reduce(
    (s, e) => s + ((e.type === "tab_hidden" || e.type === "window_blur") ? (e.away_ms ?? 0) : 0),
    0,
  );
  const pasteEvents = events.filter((e) => e.type === "paste" && (e.paste_len ?? 0) >= PASTE_MIN_LEN).length;
  const questionCopies = events.filter((e) => e.type === "question_copied").length;

  const questionsFlagged = flagged.size;
  const focusScore = questionsTotal > 0
    ? Math.round(((questionsTotal - questionsFlagged) / questionsTotal) * 100)
    : 100;

  const isFlagged =
    questionsTotal > 0 &&
    (questionsFlagged >= SESSION_FLAG_MIN_QUESTIONS ||
      questionsFlagged / questionsTotal >= SESSION_FLAG_MIN_RATIO);

  return {
    questionsTotal,
    questionsFlagged,
    focusScore,
    tabSwitches,
    totalAwayMs,
    pasteEvents,
    questionCopies,
    isFlagged,
    events,
  };
}
