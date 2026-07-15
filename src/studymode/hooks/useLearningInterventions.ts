import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import {
  InterventionQueueRecord,
  WorkspaceRole,
  loadInterventionQueue,
  syncInterventionQueue,
  updateInterventionQueueItem,
} from '../lib/learningOps';

export type InterventionSeverity = 'high' | 'medium' | 'low';
export type InterventionType =
  | 'concept-reteach'
  | 'guided-practice'
  | 'prerequisite-repair'
  | 'exam-sprint'
  | 'consistency-recovery';

export interface LearningIntervention {
  id: string;
  type: InterventionType;
  severity: InterventionSeverity;
  title: string;
  reason: string;
  recommendation: string;
  evidence: string[];
}

interface Args {
  subjectId?: string;
  subjectName?: string;
  topicName?: string;
}

function severityRank(severity: InterventionSeverity) {
  return severity === 'high' ? 0 : severity === 'medium' ? 1 : 2;
}

function daysSince(dateLike?: string | null): number | null {
  if (!dateLike) return null;
  const ts = new Date(dateLike).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / 86400000);
}

export function useLearningInterventions({ subjectId, subjectName, topicName }: Args) {
  const [interventions, setInterventions] = useState<LearningIntervention[]>([]);
  const [queue, setQueue] = useState<InterventionQueueRecord[]>([]);
  const [headline, setHeadline] = useState<string>('Stay consistent with your next study block.');
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    if (!subjectId || !subjectName || !topicName) {
      setInterventions([]);
      setQueue([]);
      setHeadline('Pick a subject topic to activate learning operations guidance.');
      setIsLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setInterventions([]);
        setQueue([]);
        setHeadline('Sign in to see your learning operations plan.');
        return;
      }

      const topicFilter = topicName.trim();
      const attemptQuery = supabase
        .from('quiz_attempts')
        .select('was_correct, concepts_tested, created_at, marks_awarded, marks_possible')
        .eq('user_id', user.id)
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false })
        .limit(25);

      const masteryQuery = supabase
        .from('topic_mastery')
        .select('mastery_percentage, last_reviewed_at')
        .eq('user_id', user.id)
        .eq('subject_id', subjectId)
        .eq('topic_name', topicName)
        .maybeSingle();

      const activityQuery = supabase
        .from('study_activity')
        .select('created_at, date, task_completed, score')
        .eq('user_id', user.id)
        .eq('subject', subjectName)
        .order('created_at', { ascending: false })
        .limit(21);

      const mockQuery = supabase
        .from('mock_exam_attempts')
        .select('percent, created_at')
        .eq('user_id', user.id)
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false })
        .limit(5);

      const [
        { data: attempts, error: attemptError },
        { data: mastery, error: masteryError },
        { data: activity, error: activityError },
        { data: mockAttempts, error: mockError },
      ] = await Promise.all([attemptQuery, masteryQuery, activityQuery, mockQuery]);

      if (attemptError) logger.warn('[useLearningInterventions] attempt lookup failed', attemptError);
      if (masteryError) logger.warn('[useLearningInterventions] mastery lookup failed', masteryError);
      if (activityError) logger.warn('[useLearningInterventions] activity lookup failed', activityError);
      if (mockError) logger.warn('[useLearningInterventions] mock lookup failed', mockError);

      const items: LearningIntervention[] = [];
      const recentAttempts = (attempts ?? []).filter(Boolean);
      const recentActivity = activity ?? [];
      const recentMocks = mockAttempts ?? [];
      const masteryPct = Number(mastery?.mastery_percentage ?? 0);

      const accuracy = recentAttempts.length > 0
        ? recentAttempts.filter((attempt) => !!attempt.was_correct).length / recentAttempts.length
        : null;

      const weakConceptCounts = new Map<string, number>();
      recentAttempts
        .filter((attempt) => !attempt.was_correct)
        .forEach((attempt) => {
          const concepts = Array.isArray(attempt.concepts_tested) ? attempt.concepts_tested : [];
          concepts.forEach((concept: string) => {
            const key = concept.toLowerCase().trim();
            if (!key) return;
            weakConceptCounts.set(key, (weakConceptCounts.get(key) ?? 0) + 1);
          });
        });

      const repeatedWeakConcepts = Array.from(weakConceptCounts.entries())
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([concept]) => concept);

      const lastActivityDate = recentActivity[0]?.created_at || recentActivity[0]?.date || recentAttempts[0]?.created_at || null;
      const inactivityDays = daysSince(lastActivityDate);

      const averageMock = recentMocks.length > 0
        ? Math.round(recentMocks.reduce((sum, attempt) => sum + Number(attempt.percent ?? 0), 0) / recentMocks.length)
        : null;

      if (typeof inactivityDays === 'number' && inactivityDays >= 3) {
        items.push({
          id: 'consistency-recovery',
          type: 'consistency-recovery',
          severity: inactivityDays >= 5 ? 'high' : 'medium',
          title: 'Consistency recovery plan needed',
          reason: `You have been away from ${subjectName} for ${inactivityDays} day${inactivityDays === 1 ? '' : 's'}.`,
          recommendation: 'Start with a shorter catch-up block: quick review, then one guided practice question before resuming full tasks.',
          evidence: [`Last recorded study activity: ${inactivityDays} day${inactivityDays === 1 ? '' : 's'} ago.`],
        });
      }

      if (masteryPct > 0 && masteryPct < 60) {
        items.push({
          id: 'concept-reteach',
          type: 'concept-reteach',
          severity: masteryPct < 40 ? 'high' : 'medium',
          title: 'Concept reteach recommended',
          reason: `${topicName} mastery is ${masteryPct}%, which is below confident exam readiness.`,
          recommendation: 'Switch the next session toward concept learning and worked examples before doing more timed exam practice.',
          evidence: [`Current mastery: ${masteryPct}%.`, `Focus topic: ${topicFilter}.`],
        });
      }

      if (accuracy !== null && recentAttempts.length >= 5 && accuracy < 0.55) {
        items.push({
          id: 'guided-practice',
          type: 'guided-practice',
          severity: accuracy < 0.4 ? 'high' : 'medium',
          title: 'Guided practice should replace free practice',
          reason: `Recent question accuracy is ${Math.round(accuracy * 100)}% across ${recentAttempts.length} attempts.`,
          recommendation: 'Use scaffolded questions, reveal mark-scheme steps earlier, and follow with active recall on the same concepts.',
          evidence: [`Recent attempt accuracy: ${Math.round(accuracy * 100)}%.`],
        });
      }

      if (repeatedWeakConcepts.length > 0) {
        items.push({
          id: 'prerequisite-repair',
          type: 'prerequisite-repair',
          severity: repeatedWeakConcepts.length >= 2 ? 'medium' : 'low',
          title: 'Prerequisite repair opportunity found',
          reason: `The same concepts keep appearing in incorrect answers: ${repeatedWeakConcepts.join(', ')}.`,
          recommendation: 'Route the learner through a prerequisite review before presenting harder application questions.',
          evidence: repeatedWeakConcepts.map((concept) => `Repeated weak concept: ${concept}.`),
        });
      }

      if (averageMock !== null && averageMock < 50) {
        items.push({
          id: 'exam-sprint',
          type: 'exam-sprint',
          severity: averageMock < 35 ? 'high' : 'medium',
          title: 'Exam sprint mode should be activated',
          reason: `Average mock exam performance is ${averageMock}%, showing a gap between practice and exam execution.`,
          recommendation: 'Prioritise timed, blueprint-shaped exam blocks plus post-paper repair on the weakest objectives.',
          evidence: [`Average mock exam score: ${averageMock}%.`],
        });
      }

      items.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
      setInterventions(items);

      if (items[0]) {
        setHeadline(items[0].recommendation);
      } else if (masteryPct >= 70) {
        setHeadline('You are in progression mode: keep mixing recall, practice, and one exam-style question.');
      } else {
        setHeadline('Keep building fluency with a balanced plan of concept learning, recall, and exam practice.');
      }

      await syncInterventionQueue({
        userId: user.id,
        subjectId,
        subjectName,
        topicName,
        interventions: items.map((item) => ({
          type: item.type,
          severity: item.severity,
          reason: item.reason,
          recommendation: item.recommendation,
          evidence: item.evidence,
        })),
      });

      const queueRows = await loadInterventionQueue({ userId: user.id, subjectId: subjectId ?? null });
      setQueue(queueRows);
    } catch (e) {
      logger.error('[useLearningInterventions] fatal', e);
      setInterventions([]);
      setQueue([]);
      setHeadline('Learning operations data is temporarily unavailable.');
    } finally {
      setIsLoading(false);
    }
  }, [subjectId, subjectName, topicName]);

  const updateQueueItem = useCallback(async (args: {
    interventionId: string;
    status?: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
    assignedRole?: WorkspaceRole | null;
    assignedToUserId?: string | null;
    note?: string | null;
  }) => {
    await updateInterventionQueueItem(args);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { interventions, queue, headline, isLoading, refresh, updateQueueItem };
}