/**
 * Product feedback writer.
 *
 * Companion to `learningEvents.ts`: every AI output surface can capture a
 * lightweight thumbs up/down (`sendOutputFeedback`) and session-level
 * surfaces can ask a single "did this help?" pulse question
 * (`sendPulseFeedback`). Rows land in `feedback_events`.
 *
 * Best-effort: failures are logged but never thrown so a feedback outage
 * can never break a study flow.
 *
 * Pulse frequency capping lives here too (localStorage) so surfaces don't
 * nag: at most one pulse prompt per surface per PULSE_COOLDOWN_HOURS.
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

export type FeedbackSurface =
  | "photo_solve"
  | "photo_solve_practice"
  | "quiz"
  | "mock_exam"
  | "topic_session"
  | "school_homework"
  | "flashcards"
  | "ai_tutor"
  | "daily_task"
  | "explain_answer";

export type FeedbackReason =
  | "wrong_answer"
  | "too_easy"
  | "too_hard"
  | "confusing"
  | "off_syllabus"
  | "slow"
  | "other";

export const REASON_LABELS: Record<FeedbackReason, string> = {
  wrong_answer: "Marking seems wrong",
  too_easy: "Too easy",
  too_hard: "Too hard",
  confusing: "Confusing",
  off_syllabus: "Not in my syllabus",
  slow: "Too slow",
  other: "Something else",
};

export interface OutputFeedbackInput {
  surface: FeedbackSurface;
  sentiment: "up" | "down";
  reason?: FeedbackReason;
  comment?: string;
  subjectName?: string | null;
  topicName?: string | null;
  context?: Record<string, unknown>;
}

export interface PulseFeedbackInput {
  surface: FeedbackSurface;
  rating: number; // 1-5
  subjectName?: string | null;
  topicName?: string | null;
  context?: Record<string, unknown>;
}

async function insertFeedback(row: Record<string, unknown>): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = await sb.from("feedback_events").insert({ user_id: userId, ...row });
    if (error) {
      logger.warn("[feedback] insert failed", error);
      return false;
    }
    return true;
  } catch (e) {
    logger.warn("[feedback] unexpected error", e);
    return false;
  }
}

export async function sendOutputFeedback(input: OutputFeedbackInput): Promise<boolean> {
  return insertFeedback({
    kind: "output",
    surface: input.surface,
    sentiment: input.sentiment,
    reason: input.reason ?? null,
    comment: input.comment?.slice(0, 500) ?? null,
    subject_name: input.subjectName ?? null,
    topic_name: input.topicName ?? null,
    context: input.context ?? {},
  });
}

export async function sendPulseFeedback(input: PulseFeedbackInput): Promise<boolean> {
  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
  const ok = await insertFeedback({
    kind: "pulse",
    surface: input.surface,
    rating,
    subject_name: input.subjectName ?? null,
    topic_name: input.topicName ?? null,
    context: input.context ?? {},
  });
  if (ok) markPulseShown(input.surface);
  return ok;
}

// ─── Pulse frequency capping ────────────────────────────────────────────────

const PULSE_COOLDOWN_HOURS = 72;
const pulseKey = (surface: string) => `ss-pulse-last:${surface}`;

/** True when this surface may show its pulse prompt (not shown recently). */
export function shouldShowPulse(surface: FeedbackSurface): boolean {
  try {
    const raw = localStorage.getItem(pulseKey(surface));
    if (!raw) return true;
    const last = Number(raw);
    if (!Number.isFinite(last)) return true;
    return Date.now() - last > PULSE_COOLDOWN_HOURS * 3600_000;
  } catch {
    return true;
  }
}

/** Record that the pulse prompt was shown/answered/dismissed for a surface. */
export function markPulseShown(surface: FeedbackSurface | string): void {
  try {
    localStorage.setItem(pulseKey(surface), String(Date.now()));
  } catch {
    // ignore storage failures
  }
}
