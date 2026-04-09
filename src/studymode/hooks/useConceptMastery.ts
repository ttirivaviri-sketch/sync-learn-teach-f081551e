/**
 * useConceptMastery
 * 
 * Tracks per-concept correctness across spaced attempts.
 * When a concept is answered correctly 3 times in spaced reviews,
 * the parent topic's mastery_percentage is updated proportionally
 * based on the concept's weight within the topic.
 */

import { useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';

const MASTERY_THRESHOLD = 3; // correct spaced attempts needed

interface ConceptAttempt {
  concepts_tested: string[] | null;
  was_correct: boolean;
  created_at: string;
  topic_name: string;
  subject_id: string;
}

/**
 * Given a list of attempts for one concept, check if there are >= 3 correct
 * attempts that are spaced apart (not all on the same day).
 */
function hasSpacedMastery(attempts: ConceptAttempt[]): boolean {
  const correctDates = attempts
    .filter(a => a.was_correct)
    .map(a => a.created_at.split('T')[0]);

  if (correctDates.length < MASTERY_THRESHOLD) return false;

  // Count distinct days
  const uniqueDays = new Set(correctDates);
  // Require at least 2 distinct days among the 3+ correct attempts
  return uniqueDays.size >= 2;
}

export function useConceptMastery() {

  /**
   * After recording a quiz attempt, call this to check if any concepts
   * in `conceptsTested` have now crossed the mastery threshold.
   * If so, bump topic_mastery proportionally.
   */
  const checkAndUpdateMastery = useCallback(async (
    userId: string,
    subjectId: string,
    topicName: string,
    conceptsTested: string[],
  ) => {
    if (!conceptsTested.length) return;

    try {
      // 1. Fetch all attempts for this topic that include concepts
      const { data: allAttempts } = await supabase
        .from('quiz_attempts')
        .select('concepts_tested, was_correct, created_at, topic_name, subject_id')
        .eq('user_id', userId)
        .eq('subject_id', subjectId)
        .ilike('topic_name', `%${topicName}%`);

      if (!allAttempts) return;

      const attempts = allAttempts as unknown as ConceptAttempt[];

      // 2. Get unique concepts across all attempts for this topic
      const allConcepts = new Set<string>();
      attempts.forEach(a => {
        (a.concepts_tested || []).forEach(c => allConcepts.add(c.toLowerCase().trim()));
      });

      if (allConcepts.size === 0) return;

      // 3. For each tested concept, check mastery
      let masteredCount = 0;
      const totalConcepts = allConcepts.size;

      for (const concept of allConcepts) {
        // Find attempts that tested this concept
        const conceptAttempts = attempts.filter(a =>
          (a.concepts_tested || []).some(c => c.toLowerCase().trim() === concept)
        );

        if (hasSpacedMastery(conceptAttempts)) {
          masteredCount++;
        }
      }

      // 4. Calculate mastery percentage based on concept coverage
      const masteryPercentage = Math.min(100, Math.round((masteredCount / totalConcepts) * 100));

      // 5. Upsert topic_mastery — only increase, never decrease
      const { data: existing } = await supabase
        .from('topic_mastery')
        .select('mastery_percentage, id')
        .eq('user_id', userId)
        .eq('subject_id', subjectId)
        .eq('topic_name', topicName)
        .maybeSingle();

      const currentMastery = (existing as any)?.mastery_percentage ?? 0;

      if (masteryPercentage > currentMastery) {
        if (existing) {
          await supabase
            .from('topic_mastery')
            .update({
              mastery_percentage: masteryPercentage,
              last_reviewed_at: new Date().toISOString(),
              is_locked: false,
            })
            .eq('id', (existing as any).id);
        } else {
          // Count totals for the insert
          const totalAttempts = attempts.length;
          const correctAttempts = attempts.filter(a => a.was_correct).length;

          await supabase
            .from('topic_mastery')
            .insert({
              user_id: userId,
              subject_id: subjectId,
              topic_name: topicName,
              mastery_percentage: masteryPercentage,
              total_attempts: totalAttempts,
              correct_attempts: correctAttempts,
              attempts: totalAttempts,
              last_reviewed_at: new Date().toISOString(),
              is_locked: false,
            });
        }

        console.log(
          `[ConceptMastery] ${topicName}: ${masteredCount}/${totalConcepts} concepts mastered → ${masteryPercentage}%`
        );
      }

      return { masteredCount, totalConcepts, masteryPercentage };
    } catch (err) {
      console.error('[useConceptMastery] Error:', err);
      return null;
    }
  }, []);

  return { checkAndUpdateMastery };
}
