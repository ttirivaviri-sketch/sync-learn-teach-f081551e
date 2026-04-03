import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';

export interface QuizAttempt {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_name: string;
  question: string;
  was_correct: boolean;
  difficulty_rating: number;
  next_review_date: string;
  review_count: number;
  ease_factor: number;
  interval_days: number;
  created_at: string;
}

export interface TopicReviewStatus {
  topic_name: string;
  subject_id: string | null;
  total_attempts: number;
  correct_attempts: number;
  accuracy: number;
  due_for_review: boolean;
  next_review_date: string | null;
  average_ease: number;
}

/**
 * SM-2 Algorithm implementation for spaced repetition
 * Based on SuperMemo algorithm with modifications for quiz context
 */
function calculateNextReview(
  wasCorrect: boolean,
  currentEaseFactor: number,
  currentInterval: number,
  reviewCount: number
): { newInterval: number; newEaseFactor: number } {
  // SM-2 quality grades: 0-2 = fail, 3-5 = pass
  // We simplify to binary: correct = 4, incorrect = 1
  const quality = wasCorrect ? 4 : 1;

  // Calculate new ease factor (minimum 1.3)
  let newEaseFactor = currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEaseFactor = Math.max(1.3, newEaseFactor);

  // Calculate new interval
  let newInterval: number;
  if (!wasCorrect) {
    // Reset interval on incorrect answer
    newInterval = 1;
  } else if (reviewCount === 0) {
    newInterval = 1;
  } else if (reviewCount === 1) {
    newInterval = 3;
  } else {
    newInterval = Math.round(currentInterval * newEaseFactor);
  }

  // Cap maximum interval at 180 days
  newInterval = Math.min(180, newInterval);

  return { newInterval, newEaseFactor };
}

export function useSpacedRepetition(userId: string | null) {
  const [dueReviews, setDueReviews] = useState<QuizAttempt[]>([]);
  const [topicStats, setTopicStats] = useState<TopicReviewStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch reviews that are due today or earlier
  const fetchDueReviews = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error: fetchError } = await supabase
        .from('quiz_attempts' as any)
        .select('*')
        .eq('user_id', userId)
        .lte('next_review_date', today)
        .order('next_review_date', { ascending: true });

      if (fetchError) throw fetchError;

      setDueReviews((data as unknown as QuizAttempt[]) || []);
    } catch (err) {
      console.error('Error fetching due reviews:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch reviews');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Get aggregated stats per topic
  const fetchTopicStats = useCallback(async () => {
    if (!userId) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error: fetchError } = await supabase
        .from('quiz_attempts' as any)
        .select('*')
        .eq('user_id', userId);

      if (fetchError) throw fetchError;

      // Aggregate by topic
      const statsMap = new Map<string, {
        topic_name: string;
        subject_id: string | null;
        total: number;
        correct: number;
        nextReviewDate: string | null;
        easeSum: number;
      }>();

      (data as unknown as QuizAttempt[])?.forEach(attempt => {
        const key = `${attempt.subject_id || 'none'}-${attempt.topic_name}`;
        const existing = statsMap.get(key);

        if (existing) {
          existing.total++;
          if (attempt.was_correct) existing.correct++;
          existing.easeSum += attempt.ease_factor;
          // Track earliest next review date
          if (!existing.nextReviewDate || attempt.next_review_date < existing.nextReviewDate) {
            existing.nextReviewDate = attempt.next_review_date;
          }
        } else {
          statsMap.set(key, {
            topic_name: attempt.topic_name,
            subject_id: attempt.subject_id,
            total: 1,
            correct: attempt.was_correct ? 1 : 0,
            nextReviewDate: attempt.next_review_date,
            easeSum: attempt.ease_factor,
          });
        }
      });

      const stats: TopicReviewStatus[] = Array.from(statsMap.values()).map(s => ({
        topic_name: s.topic_name,
        subject_id: s.subject_id,
        total_attempts: s.total,
        correct_attempts: s.correct,
        accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
        due_for_review: s.nextReviewDate ? s.nextReviewDate <= today : false,
        next_review_date: s.nextReviewDate,
        average_ease: s.total > 0 ? s.easeSum / s.total : 2.5,
      }));

      // Sort by accuracy (lowest first = struggling topics)
      stats.sort((a, b) => a.accuracy - b.accuracy);

      setTopicStats(stats);
    } catch (err) {
      console.error('Error fetching topic stats:', err);
    }
  }, [userId]);

  // Record a new quiz attempt
  const recordAttempt = useCallback(async (
    topicName: string,
    question: string,
    wasCorrect: boolean,
    subjectId?: string,
    difficultyRating: number = 3,
    options?: {
      conceptsTested?: string[];
      userAnswer?: string;
      modelAnswer?: string;
      commandWord?: string;
      marksAwarded?: number;
      marksPossible?: number;
    }
  ) => {
    if (!userId) return null;

    try {
      // Check if this question was asked before (for review)
      const { data: existingAttempts } = await supabase
        .from('quiz_attempts' as any)
        .select('*')
        .eq('user_id', userId)
        .eq('topic_name', topicName)
        .eq('question', question)
        .order('created_at', { ascending: false })
        .limit(1);

      const existingAttempt = existingAttempts?.[0] as unknown as QuizAttempt | undefined;

      if (existingAttempt) {
        // Update existing attempt with new review
        const { newInterval, newEaseFactor } = calculateNextReview(
          wasCorrect,
          existingAttempt.ease_factor,
          existingAttempt.interval_days,
          existingAttempt.review_count
        );

        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

        const { data, error: updateError } = await supabase
          .from('quiz_attempts' as any)
          .update({
            was_correct: wasCorrect,
            ease_factor: newEaseFactor,
            interval_days: newInterval,
            next_review_date: nextReviewDate.toISOString().split('T')[0],
            review_count: existingAttempt.review_count + 1,
            difficulty_rating: difficultyRating,
            ...(options?.conceptsTested && { concepts_tested: options.conceptsTested }),
            ...(options?.userAnswer && { user_answer: options.userAnswer }),
            ...(options?.modelAnswer && { model_answer: options.modelAnswer }),
            ...(options?.commandWord && { command_word: options.commandWord }),
            ...(options?.marksAwarded != null && { marks_awarded: options.marksAwarded }),
            ...(options?.marksPossible != null && { marks_possible: options.marksPossible }),
          })
          .eq('id', existingAttempt.id)
          .select()
          .single();

        if (updateError) throw updateError;

        // Refresh data
        await Promise.all([fetchDueReviews(), fetchTopicStats()]);
        return data;
      } else {
        // Create new attempt
        const { newInterval, newEaseFactor } = calculateNextReview(
          wasCorrect,
          2.5, // Default ease factor
          0,
          0
        );

        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

        const { data, error: insertError } = await supabase
          .from('quiz_attempts' as any)
          .insert({
            user_id: userId,
            subject_id: subjectId || null,
            topic_name: topicName,
            question: question,
            was_correct: wasCorrect,
            difficulty_rating: difficultyRating,
            ease_factor: newEaseFactor,
            interval_days: newInterval,
            next_review_date: nextReviewDate.toISOString().split('T')[0],
            review_count: 1,
            ...(options?.conceptsTested && { concepts_tested: options.conceptsTested }),
            ...(options?.userAnswer && { user_answer: options.userAnswer }),
            ...(options?.modelAnswer && { model_answer: options.modelAnswer }),
            ...(options?.commandWord && { command_word: options.commandWord }),
            ...(options?.marksAwarded != null && { marks_awarded: options.marksAwarded }),
            ...(options?.marksPossible != null && { marks_possible: options.marksPossible }),
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Refresh data
        await Promise.all([fetchDueReviews(), fetchTopicStats()]);
        return data;
      }
    } catch (err) {
      console.error('Error recording quiz attempt:', err);
      setError(err instanceof Error ? err.message : 'Failed to record attempt');
      return null;
    }
  }, [userId, fetchDueReviews, fetchTopicStats]);

  // Get struggling topics (accuracy < 70%)
  const getStrugglingTopics = useCallback(() => {
    return topicStats.filter(t => t.accuracy < 70 && t.total_attempts >= 2);
  }, [topicStats]);

  // Get topics due for review today
  const getTopicsDueToday = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return topicStats.filter(t => t.next_review_date && t.next_review_date <= today);
  }, [topicStats]);

  // Load data on mount
  useEffect(() => {
    if (userId) {
      fetchDueReviews();
      fetchTopicStats();
    }
  }, [userId, fetchDueReviews, fetchTopicStats]);

  return {
    dueReviews,
    topicStats,
    isLoading,
    error,
    recordAttempt,
    getStrugglingTopics,
    getTopicsDueToday,
    refreshData: useCallback(() => {
      fetchDueReviews();
      fetchTopicStats();
    }, [fetchDueReviews, fetchTopicStats]),
  };
}
