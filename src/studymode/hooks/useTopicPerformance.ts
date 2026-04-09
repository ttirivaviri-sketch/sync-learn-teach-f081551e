/**
 * useTopicPerformance
 *
 * Tracks a student's per-topic performance and exposes:
 *   - accuracy (correct / total attempts)
 *   - repeated mistake patterns (wrong concepts)
 *   - adaptive difficulty recommendation (easy / medium / hard)
 *   - mastery status (mastered / needs-practice / not-started)
 *   - whether a topic test should be triggered
 *
 * All logic lives in-memory from quiz_attempts data in Supabase.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';

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
  /** Should a topic test be triggered? */
  shouldTriggerTopicTest: boolean;
  /** Question texts the student got wrong more than once */
  repeatedMistakes: string[];
  /** Concept names that appear repeatedly in failed attempts */
  weakConcepts: string[];
  /** Average response time (if tracked) in seconds */
  avgResponseTimeSecs: number | null;
}

export interface PerformanceRecord {
  topic_name: string;
  question: string;
  was_correct: boolean;
  difficulty_rating: number;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** How many attempts before triggering a topic test */
const ATTEMPTS_FOR_TOPIC_TEST = 5;
/** Accuracy threshold for "mastered" */
const MASTERY_THRESHOLD = 0.70;
/** Accuracy threshold for "struggling" → show easier questions */
const STRUGGLING_THRESHOLD = 0.50;
/** Accuracy threshold for "performing well" → increase difficulty */
const PERFORMING_WELL_THRESHOLD = 0.80;

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

      // Fetch all attempts for this topic
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

      const total = (attempts as any[]).length;
      const correct = (attempts as any[]).filter((a: any) => a.was_correct).length;
      const accuracy = total > 0 ? correct / total : 0;

      // Mastery status
      let masteryStatus: MasteryStatus = 'needs-practice';
      if (total === 0) masteryStatus = 'not-started';
      else if (accuracy >= MASTERY_THRESHOLD) masteryStatus = 'mastered';
      else masteryStatus = 'needs-practice';

      // Adaptive difficulty
      let recommendedDifficulty: DifficultyLevel = 'medium';
      if (accuracy >= PERFORMING_WELL_THRESHOLD) recommendedDifficulty = 'hard';
      else if (accuracy < STRUGGLING_THRESHOLD) recommendedDifficulty = 'easy';

      // Find repeated mistakes: questions answered incorrectly 2+ times
      const incorrectQuestions: Record<string, number> = {};
      (attempts as any[]).filter((a: any) => !a.was_correct).forEach((a: any) => {
        const q = a.question?.substring(0, 100) || '';
        incorrectQuestions[q] = (incorrectQuestions[q] || 0) + 1;
      });
      const repeatedMistakes = Object.entries(incorrectQuestions)
        .filter(([, count]) => count >= 2)
        .map(([q]) => q)
        .slice(0, 5);

      // Weak concepts: simple keyword extraction from wrong questions
      const wrongTexts = (attempts as any[]).filter((a: any) => !a.was_correct).map((a: any) => a.question || '').join(' ');
      const conceptKeywords = extractConceptKeywords(wrongTexts, topicName);
      const weakConcepts = conceptKeywords.slice(0, 4);

      // Topic test trigger: after N attempts with consistent results
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
      console.error('[useTopicPerformance]', err);
    } finally {
      setIsLoading(false);
    }
  }, [subjectId, topicName]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  return { performance, isLoading, refresh: fetchPerformance };
}

// ─── Keyword extraction (lightweight, no NLP dependency) ──────────────────────

function extractConceptKeywords(text: string, topicName: string): string[] {
  if (!text) return [];

  // Remove common stop words and extract meaningful terms
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'this', 'that', 'these', 'those', 'it', 'its',
    'you', 'your', 'how', 'what', 'when', 'which', 'who', 'where', 'why',
    'calculate', 'explain', 'describe', 'state', 'define', 'evaluate', 'show',
    'find', 'determine', 'given', 'following', 'using', 'marks', 'question',
  ]);

  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && !stopWords.has(w));

  // Count frequency
  const freq: Record<string, number> = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  // Filter out the topic name itself
  const topicWords = new Set(topicName.toLowerCase().split(/\s+/));

  return Object.entries(freq)
    .filter(([w]) => !topicWords.has(w))
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 6);
}
