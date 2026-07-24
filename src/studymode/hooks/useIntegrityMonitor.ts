/**
 * useIntegrityMonitor — captures focus/independence signals during a study
 * session and persists an aggregate report when the session ends.
 *
 * Design notes:
 * - DISCLOSED monitoring: session UIs show a "Focus tracking on" indicator
 *   and the student sees their own focus score afterwards. This is a
 *   self-discipline feature first, a transparency layer second.
 * - The hook only listens while `active` is true and a question index is set,
 *   so opening menus/summaries between questions doesn't accumulate noise.
 * - Persistence is best-effort fire-and-forget; a failed insert never
 *   disrupts the study session itself.
 */
import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";
import {
  IntegrityEvent,
  IntegritySummary,
  pasteSimilarity,
  summarizeIntegrity,
  AWAY_IGNORE_MS,
} from "../lib/integrity";

export type SessionKind = "topic_session" | "exam_mode" | "active_recall";

interface UseIntegrityMonitorOptions {
  /** Only record while true (question visible & awaiting an answer). */
  active: boolean;
  /** 1-based index of the current question. */
  questionIndex: number;
}

export function useIntegrityMonitor({ active, questionIndex }: UseIntegrityMonitorOptions) {
  const eventsRef = useRef<IntegrityEvent[]>([]);
  const hiddenAtRef = useRef<number | null>(null);
  const blurredAtRef = useRef<number | null>(null);
  // Pastes are recorded per question, then similarity is resolved at submit
  // time when we know the final answer text.
  const pendingPastesRef = useRef<Map<number, string[]>>(new Map());
  const activeRef = useRef(active);
  const qRef = useRef(questionIndex);
  activeRef.current = active;
  qRef.current = questionIndex;

  const record = useCallback((e: Omit<IntegrityEvent, "q" | "at">) => {
    eventsRef.current.push({ ...e, q: qRef.current, at: new Date().toISOString() });
  }, []);

  // ── Tab visibility + window focus ─────────────────────────────────────────
  useEffect(() => {
    const onVisibility = () => {
      if (!activeRef.current) return;
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else if (hiddenAtRef.current !== null) {
        const away = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (away >= AWAY_IGNORE_MS) record({ type: "tab_hidden", away_ms: away });
      }
    };
    const onBlur = () => {
      if (!activeRef.current) return;
      // Visibility change will handle full tab switches; blur catches
      // focus moving to another window with our tab still visible.
      if (!document.hidden) blurredAtRef.current = Date.now();
    };
    const onFocus = () => {
      if (blurredAtRef.current !== null) {
        const away = Date.now() - blurredAtRef.current;
        blurredAtRef.current = null;
        if (activeRef.current && away >= AWAY_IGNORE_MS) {
          record({ type: "window_blur", away_ms: away });
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [record]);

  // ── Handlers the session UI attaches to its elements ─────────────────────

  /** Attach to the answer input's onPaste. */
  const onAnswerPaste = useCallback((e: React.ClipboardEvent) => {
    if (!activeRef.current) return;
    const text = e.clipboardData?.getData("text") ?? "";
    if (!text) return;
    const q = qRef.current;
    const list = pendingPastesRef.current.get(q) ?? [];
    list.push(text);
    pendingPastesRef.current.set(q, list);
  }, []);

  /** Attach to the question container's onCopy. */
  const onQuestionCopy = useCallback(() => {
    if (!activeRef.current) return;
    record({ type: "question_copied" });
  }, [record]);

  /**
   * Call at answer submission with the final answer text — resolves any
   * pending pastes for the question into scored events. Defaults to the
   * current question; batch-submit flows (exam mode) pass an explicit
   * 1-based question index per answer.
   */
  const resolveAnswer = useCallback((finalAnswer: string, questionIdx?: number) => {
    const q = questionIdx ?? qRef.current;
    const pastes = pendingPastesRef.current.get(q);
    if (!pastes?.length) return;
    pendingPastesRef.current.delete(q);
    for (const pasted of pastes) {
      eventsRef.current.push({
        q,
        type: "paste",
        at: new Date().toISOString(),
        paste_len: pasted.length,
        paste_similarity: pasteSimilarity(pasted, finalAnswer),
      });
    }
  }, []);

  /** Live snapshot for in-session UI (focus indicator). */
  const getSummary = useCallback(
    (questionsTotal: number): IntegritySummary =>
      summarizeIntegrity(eventsRef.current, questionsTotal),
    [],
  );

  /**
   * Persist the aggregate report. Call once when the session completes.
   * Returns the summary so the UI can show the student their focus score.
   */
  const persist = useCallback(
    async (opts: {
      sessionKind: SessionKind;
      sessionRef?: string | null;
      subjectName?: string;
      topicName?: string;
      questionsTotal: number;
    }): Promise<IntegritySummary> => {
      const summary = summarizeIntegrity(eventsRef.current, opts.questionsTotal);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && opts.questionsTotal > 0) {
          await supabase.from("session_integrity_reports" as never).insert({
            user_id: user.id,
            session_kind: opts.sessionKind,
            session_ref: opts.sessionRef ?? null,
            subject_name: opts.subjectName ?? null,
            topic_name: opts.topicName ?? null,
            questions_total: summary.questionsTotal,
            questions_flagged: summary.questionsFlagged,
            focus_score: summary.focusScore,
            tab_switches: summary.tabSwitches,
            total_away_ms: summary.totalAwayMs,
            paste_events: summary.pasteEvents,
            question_copies: summary.questionCopies,
            events: summary.events.slice(0, 200), // hard cap payload
            is_flagged: summary.isFlagged,
          } as never);
        }
      } catch (err) {
        logger.warn("[useIntegrityMonitor] persist failed (non-fatal):", err);
      }
      return summary;
    },
    [],
  );

  /** Reset all captured state (new session in the same mount). */
  const reset = useCallback(() => {
    eventsRef.current = [];
    pendingPastesRef.current.clear();
    hiddenAtRef.current = null;
    blurredAtRef.current = null;
  }, []);

  return { onAnswerPaste, onQuestionCopy, resolveAnswer, getSummary, persist, reset };
}
