/**
 * Unified learning timeline writer.
 *
 * Every meaningful learning action (study session, homework, lesson
 * reinforcement, quiz, mock exam, completed booking) should write a single
 * row to `learning_events` via `logLearningEvent`. Surfaces (learner activity,
 * tutor briefing, school analytics, SAIL) read from the same table so each
 * feature complements the others instead of maintaining isolated state.
 *
 * Best-effort: failures are logged but never thrown so callers don't have to
 * wrap them in try/catch and a logging outage can't break a user flow.
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

export type LearningEventSource =
  | "topic_session"
  | "school_homework"
  | "lesson_reinforcement"
  | "school_quiz"
  | "daily_task"
  | "mock_exam"
  | "booking_completed";

export interface LearningEventInput {
  source: LearningEventSource;
  userId?: string | null;
  schoolId?: string | null;
  subjectId?: string | null;
  topicName?: string | null;
  scorePct?: number | null;
  masteryDelta?: number | null;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}

export async function logLearningEvent(input: LearningEventInput): Promise<void> {
  try {
    let userId = input.userId ?? null;
    if (!userId) {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    }
    if (!userId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = await sb.from("learning_events").insert({
      user_id: userId,
      school_id: input.schoolId ?? null,
      subject_id: input.subjectId ?? null,
      topic_name: input.topicName ?? null,
      source: input.source,
      score_pct: input.scorePct ?? null,
      mastery_delta: input.masteryDelta ?? null,
      payload: input.payload ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    });
    if (error) logger.warn("[learningEvents] insert failed", error);
  } catch (e) {
    logger.warn("[learningEvents] unexpected error", e);
  }
}
