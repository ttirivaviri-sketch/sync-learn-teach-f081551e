import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { logger } from '@/utils/logger';

export interface WeakConcept {
  concept: string;
  topic: string | null;
  weakness_score: number;
}

/**
 * Phase 5: weak-concept reads now flow from `concept_mastery_v` (EWMA over
 * the last 10 attempts). The legacy `weak_concepts` table is still written
 * by `recordWeakness` for backward compatibility, but reads prefer the view
 * and fall back to the table if the view is unavailable.
 */
export function useWeakConcepts(subject?: string, curriculum: string = 'ZIMSEC') {
  const qc = useQueryClient();

  const { data: weakConcepts = [] } = useQuery({
    queryKey: ['weak_concepts', subject, curriculum],
    enabled: !!subject,
    queryFn: async (): Promise<WeakConcept[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !subject) return [];

      // Preferred: concept_mastery_v (always-fresh EWMA)
      try {
        const { data: mastery } = await supabase
          .from('concept_mastery_v' as any)
          .select('concept_label, topic, weakness_score')
          .eq('user_id', user.id)
          .eq('subject_name', subject)
          .order('weakness_score', { ascending: false })
          .limit(10);

        if (mastery && mastery.length > 0) {
          return (mastery as any[]).map((m) => ({
            concept: String(m.concept_label),
            topic: m.topic ?? null,
            weakness_score: Number(m.weakness_score ?? 0),
          }));
        }
      } catch (err) {
        logger.warn('[useWeakConcepts] view read failed, falling back', err);
      }

      // Fallback: legacy weak_concepts table
      const { data, error } = await supabase
        .from('weak_concepts' as any)
        .select('concept, topic, weakness_score')
        .eq('user_id', user.id)
        .eq('subject', subject)
        .eq('curriculum', curriculum)
        .order('weakness_score', { ascending: false })
        .limit(10);
      if (error) {
        logger.warn('[useWeakConcepts] legacy read failed', error.message);
        return [];
      }
      return (data ?? []) as unknown as WeakConcept[];
    },
  });

  const recordWeakness = useMutation({
    mutationFn: async ({
      concepts,
      topic,
      delta,
    }: { concepts: string[]; topic?: string; delta: number }) => {
      if (!subject || !concepts?.length) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Kept for backward compat — the canonical write path now goes through
      // `concept_attempts` + the `sync_weak_concepts_from_attempt` trigger.
      for (const concept of concepts) {
        const { data: existing } = await supabase
          .from('weak_concepts' as any)
          .select('weakness_score')
          .eq('user_id', user.id)
          .eq('subject', subject)
          .eq('curriculum', curriculum)
          .eq('concept', concept)
          .maybeSingle();
        const prev = (existing as any)?.weakness_score ?? 0.5;
        const next = Math.max(0, Math.min(1, prev + delta));
        await supabase.from('weak_concepts' as any).upsert(
          {
            user_id: user.id,
            subject,
            curriculum,
            concept,
            topic: topic ?? null,
            weakness_score: next,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,subject,curriculum,concept' },
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weak_concepts', subject, curriculum] });
    },
  });

  return { weakConcepts, recordWeakness };
}
