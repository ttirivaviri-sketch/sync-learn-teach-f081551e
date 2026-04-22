import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { logger } from '@/utils/logger';

export interface WeakConcept {
  concept: string;
  topic: string | null;
  weakness_score: number;
}

/**
 * Reads + updates rolling weak-concept memory for a user/subject/curriculum.
 * Used to bias generate-topic-session toward known gaps.
 */
export function useWeakConcepts(subject?: string, curriculum: string = 'ZIMSEC') {
  const qc = useQueryClient();

  const { data: weakConcepts = [] } = useQuery({
    queryKey: ['weak_concepts', subject, curriculum],
    enabled: !!subject,
    queryFn: async (): Promise<WeakConcept[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !subject) return [];
      const { data, error } = await supabase
        .from('weak_concepts' as any)
        .select('concept, topic, weakness_score')
        .eq('user_id', user.id)
        .eq('subject', subject)
        .eq('curriculum', curriculum)
        .order('weakness_score', { ascending: false })
        .limit(10);
      if (error) {
        logger.warn('[useWeakConcepts] read failed', error.message);
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

      for (const concept of concepts) {
        // Read existing
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
