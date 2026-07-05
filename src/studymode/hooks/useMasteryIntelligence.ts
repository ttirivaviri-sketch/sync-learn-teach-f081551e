// @ts-nocheck — LOS bundle targets hand-typed contract for tables not yet in generated types; see MANUAL_EDITS.md
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import { ConceptMasteryRollup, loadMasteryIntelligence } from '../lib/learningOps';

interface UseMasteryIntelligenceArgs {
  subjectId?: string;
  subjectName?: string;
}

interface MasteryIntelligenceState {
  strongest: ConceptMasteryRollup[];
  weakest: ConceptMasteryRollup[];
  rollups: ConceptMasteryRollup[];
  recentEvidence: Array<{
    concept_name: string;
    subject_name: string;
    topic_name: string;
    evidence_type: string;
    confidence: number;
    score_delta: number;
    recorded_at: string;
  }>;
}

export function useMasteryIntelligence({ subjectId, subjectName }: UseMasteryIntelligenceArgs) {
  const [data, setData] = useState<MasteryIntelligenceState>({
    strongest: [],
    weakest: [],
    rollups: [],
    recentEvidence: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        setData({ strongest: [], weakest: [], rollups: [], recentEvidence: [] });
        return;
      }

      const intelligence = await loadMasteryIntelligence({
        userId: user.id,
        subjectId: subjectId ?? null,
        subjectName,
      });

      setData(intelligence);
    } catch (err) {
      logger.error('[useMasteryIntelligence] failed', err);
      setError(err instanceof Error ? err.message : 'Failed to load mastery intelligence');
      setData({ strongest: [], weakest: [], rollups: [], recentEvidence: [] });
    } finally {
      setIsLoading(false);
    }
  }, [subjectId, subjectName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...data,
    isLoading,
    error,
    refresh,
  };
}