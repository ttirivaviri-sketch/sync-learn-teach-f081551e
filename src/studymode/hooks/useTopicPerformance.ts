/**
 * useTopicPerformance — Phase 5
 *
 * Replaces the old "keyword-extraction from wrong questions" path with a
 * direct read against `concept_mastery_v` (an EWMA over the last 10
 * `concept_attempts`). Falls back to `quiz_attempts` for the per-topic
 * accuracy headline so existing UI keeps working.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { logger } from "@/utils/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MasteryStatus = 'mastered' | 'needs-practice' | 'not-started';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface TopicPerformanceData {
  topicName: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number; // 0–1
  masteryStatus: MasteryStatus;
  recommendedDifficulty: DifficultyLevel;
  shouldTriggerTopicTest: boolean;
  repeatedMistakes: string[];
  /** Concept labels with mastery_score < 0.6. */
  weakConcepts: string[];
  avgResponseTimeSecs: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ATTEMPTS_FOR_TOPIC_TEST = 5;
const MASTERY_THRESHOLD = 0.70;
const STRUGGLING_THRESHOLD = 0.50;
const PERFORMING_WELL_THRESHOLD = 0.80;
const WEAK_CONCEPT_THRESHOLD = 0.6; // mastery_score < this → weak

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTopicPerformance(subjectId: string | undefined, topicName: string | undefined) {
  const [performance, setPerformance] = useState<TopicPerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPerformance = useCallback(async () => {
    if (!subjectId || !topicName) return;

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // ── Headline accuracy from quiz_attempts ──────────────────────────────
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('topic_name, question, was_correct, difficulty_rating, created_at')
        .eq('user_id', user.id)
        .eq('subject_id', subjectId)
        .ilike('topic_name', `%${topicName}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!attempts || attempts.length === 0) {
        setPerformance({
          topicName,
          totalAttempts: 0,
          correctAttempts: 0,
          accuracy: 0,
          masteryStatus: 'not-started',
          recommendedDifficulty: 'easy',
          shouldTriggerTopicTest: false,
          repeatedMistakes: [],
          weakConcepts: [],
          avgResponseTimeSecs: null,
        });
        return;
      }

      const total = attempts.length;
      const correct = (attempts as any[]).filter((a) => a.was_correct).length;
      const accuracy = total > 0 ? correct / total : 0;

      let masteryStatus: MasteryStatus = 'needs-practice';
      if (accuracy >= MASTERY_THRESHOLD) masteryStatus = 'mastered';

      let recommendedDifficulty: DifficultyLevel = 'medium';
      if (accuracy >= PERFORMING_WELL_THRESHOLD) recommendedDifficulty = 'hard';
      else if (accuracy < STRUGGLING_THRESHOLD) recommendedDifficulty = 'easy';

      const incorrectQuestions: Record<string, number> = {};
      (attempts as any[]).filter((a) => !a.was_correct).forEach((a) => {
        const q = a.question?.substring(0, 100) || '';
        incorrectQuestions[q] = (incorrectQuestions[q] || 0) + 1;
      });
      const repeatedMistakes = Object.entries(incorrectQuestions)
        .filter(([, count]) => count >= 2)
        .map(([q]) => q)
        .slice(0, 5);

      // ── Weak concepts: query concept_mastery_v directly ───────────────────
      let weakConcepts: string[] = [];
      try {
        const { data: mastery } = await supabase
          .from('concept_mastery_v' as any)
          .select('concept_label, mastery_score, topic')
          .eq('user_id', user.id)
          .ilike('topic', `%${topicName}%`)
          .order('mastery_score', { ascending: true })
          .limit(6);

        weakConcepts = ((mastery ?? []) as any[])
          .filter((m) => typeof m.mastery_score === 'number' && m.mastery_score < WEAK_CONCEPT_THRESHOLD)
          .map((m) => String(m.concept_label))
          .slice(0, 4);
      } catch (err) {
        logger.warn('[useTopicPerformance] concept_mastery_v read failed', err);
      }

      const recentAttempts = (attempts as any[]).slice(0, ATTEMPTS_FOR_TOPIC_TEST);
      const shouldTriggerTopicTest =
        total >= ATTEMPTS_FOR_TOPIC_TEST &&
        recentAttempts.length >= ATTEMPTS_FOR_TOPIC_TEST;

      setPerformance({
        topicName,
        totalAttempts: total,
        correctAttempts: correct,
        accuracy,
        masteryStatus,
        recommendedDifficulty,
        shouldTriggerTopicTest,
        repeatedMistakes,
        weakConcepts,
        avgResponseTimeSecs: null,
      });
    } catch (err) {
      logger.error('[useTopicPerformance]', err);
    } finally {
      setIsLoading(false);
    }
  }, [subjectId, topicName]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  return { performance, isLoading, refresh: fetchPerformance };
}
