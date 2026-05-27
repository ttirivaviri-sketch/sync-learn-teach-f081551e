import { useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { logger } from '@/utils/logger';

export interface AttemptInput {
  dailyTaskId?: string | null;
  subjectId?: string | null;
  subjectName: string;
  topic: string;
  concept?: string | null;
  question: string;
  userAnswer: string;
  modelAnswer: string;
  wasCorrect: boolean;
  marksAwarded: number;
  marksPossible: number;
  difficulty?: string | null;
  block: 'practice' | 'exam' | 'flashcard';
  timeSpentSeconds?: number;
}

/**
 * Logs a daily-task answer attempt and feeds it into topic_mastery so the next
 * daily-task generation reflects what the learner actually knows.
 */
export function useDailyTaskAttempts() {
  const logAttempt = useCallback(async (input: AttemptInput) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;

      await supabase.from('daily_task_attempts').insert({
        user_id: user.id,
        daily_task_id: input.dailyTaskId ?? null,
        subject_id: input.subjectId ?? null,
        subject_name: input.subjectName,
        topic: input.topic,
        concept: input.concept ?? null,
        question: input.question,
        user_answer: input.userAnswer,
        model_answer: input.modelAnswer,
        was_correct: input.wasCorrect,
        marks_awarded: input.marksAwarded,
        marks_possible: input.marksPossible,
        difficulty: input.difficulty ?? null,
        block: input.block,
        time_spent_seconds: input.timeSpentSeconds ?? null,
      });

      // Mirror into quiz_attempts so the unified mastery/spaced-rep pipeline
      // (used by the Quiz feature) sees these answers too.
      try {
        await supabase.from('quiz_attempts').insert({
          user_id: user.id,
          subject_id: input.subjectId ?? null,
          topic_name: input.topic,
          question: input.question,
          user_answer: input.userAnswer,
          model_answer: input.modelAnswer,
          was_correct: input.wasCorrect,
          marks_awarded: input.marksAwarded,
          marks_possible: input.marksPossible,
          concepts_tested: input.concept ? [input.concept] : null,
          difficulty_rating: input.difficulty === 'easy' ? 1 : input.difficulty === 'hard' ? 3 : 2,
        });
      } catch (e) {
        logger.warn('quiz_attempts mirror failed', e);
      }

      // Bump topic_mastery — recompute from last 20 attempts on this topic
      if (input.subjectId) {
        const { data: recent } = await supabase
          .from('daily_task_attempts')
          .select('was_correct, marks_awarded, marks_possible')
          .eq('user_id', user.id)
          .eq('subject_id', input.subjectId)
          .eq('topic', input.topic)
          .order('created_at', { ascending: false })
          .limit(20);

        const rows = recent ?? [];
        if (rows.length > 0) {
          const totalCorrect = rows.filter((r: any) => r.was_correct).length;
          const totalPossible = rows.reduce((s: number, r: any) => s + (Number(r.marks_possible) || 0), 0);
          const totalAwarded = rows.reduce((s: number, r: any) => s + (Number(r.marks_awarded) || 0), 0);
          const masteryPct = totalPossible > 0
            ? Math.round((totalAwarded / totalPossible) * 100)
            : Math.round((totalCorrect / rows.length) * 100);

          // Read current row to preserve attempts counters
          const { data: existing } = await supabase
            .from('topic_mastery')
            .select('id, total_attempts, correct_attempts')
            .eq('user_id', user.id)
            .eq('subject_id', input.subjectId)
            .eq('topic_name', input.topic)
            .maybeSingle();

          if (existing?.id) {
            await supabase
              .from('topic_mastery')
              .update({
                mastery_percentage: masteryPct,
                total_attempts: (existing.total_attempts ?? 0) + 1,
                correct_attempts: (existing.correct_attempts ?? 0) + (input.wasCorrect ? 1 : 0),
                last_reviewed_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
          } else {
            await supabase.from('topic_mastery').insert({
              user_id: user.id,
              subject_id: input.subjectId,
              topic_name: input.topic,
              mastery_percentage: masteryPct,
              total_attempts: 1,
              correct_attempts: input.wasCorrect ? 1 : 0,
              attempts: 1,
              last_reviewed_at: new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      logger.warn('logAttempt failed', e);
    }
  }, []);

  return { logAttempt };
}
