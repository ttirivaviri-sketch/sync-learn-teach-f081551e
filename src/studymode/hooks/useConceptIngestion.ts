/**
 * useConceptIngestion
 *
 * Phase 3.1 hook. Loads pending / promoted concept-ingestion staging records
 * for a workspace and exposes review + promote actions.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import {
  StagedConceptRecord,
  loadStagedConceptIngestions,
  promoteStagedConceptIngestion,
  reviewStagedConceptIngestion,
} from '../lib/learningOps';

interface Args {
  workspaceId: string | null;
}

export interface IngestionRunResult {
  runId: string | null;
  staged: number;
  rejected: number;
  concepts: Array<{ concept_name?: string; subtopic_name?: string; confidence?: number; topic_name?: string }>;
}

export function useConceptIngestion({ workspaceId }: Args) {
  const [pending, setPending] = useState<StagedConceptRecord[]>([]);
  const [recent, setRecent] = useState<StagedConceptRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<IngestionRunResult | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pendingRows, recentRows] = await Promise.all([
        loadStagedConceptIngestions({ workspaceId, status: 'pending', limit: 100 }),
        loadStagedConceptIngestions({ workspaceId, limit: 50 }),
      ]);
      setPending(pendingRows);
      setRecent(recentRows.filter((row) => row.status !== 'pending'));
    } catch (err) {
      logger.warn('[useConceptIngestion] load failed', err);
      setPending([]);
      setRecent([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  const ingestDocument = useCallback(async (args: {
    documentId: string;
    subjectId?: string | null;
    subjectName: string;
    topicName?: string;
    curriculum?: string;
    sourceKind?: 'syllabus' | 'past_paper' | 'notes' | 'manual';
    maxConcepts?: number;
  }): Promise<IngestionRunResult> => {
    const { data, error } = await supabase.functions.invoke('ingest-document-concepts', {
      body: {
        document_id: args.documentId,
        workspace_id: workspaceId,
        subject_id: args.subjectId ?? null,
        subject_name: args.subjectName,
        topic_name: args.topicName ?? null,
        curriculum: args.curriculum ?? 'GENERAL',
        source_kind: args.sourceKind ?? 'syllabus',
        max_concepts: args.maxConcepts ?? 40,
      },
    });
    if (error) throw error;
    const payload = (data ?? {}) as Partial<IngestionRunResult> & { run_id?: string };
    const result: IngestionRunResult = {
      runId: payload.run_id ?? null,
      staged: Number(payload.staged ?? 0),
      rejected: Number(payload.rejected ?? 0),
      concepts: Array.isArray(payload.concepts) ? payload.concepts : [],
    };
    setLastRun(result);
    await refresh();
    return result;
  }, [workspaceId, refresh]);

  const approve = useCallback(async (stagingId: string, reviewNote?: string) => {
    setBusyId(stagingId);
    try {
      await reviewStagedConceptIngestion({ stagingId, status: 'approved', reviewNote });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  const reject = useCallback(async (stagingId: string, reviewNote?: string) => {
    setBusyId(stagingId);
    try {
      await reviewStagedConceptIngestion({ stagingId, status: 'rejected', reviewNote });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  const promote = useCallback(async (stagingId: string) => {
    setBusyId(stagingId);
    try {
      const catalogId = await promoteStagedConceptIngestion(stagingId);
      await refresh();
      return catalogId;
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    pending,
    recent,
    isLoading,
    busyId,
    lastRun,
    refresh,
    ingestDocument,
    approve,
    reject,
    promote,
  };
}