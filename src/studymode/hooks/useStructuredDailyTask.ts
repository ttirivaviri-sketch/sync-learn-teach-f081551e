import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { aiRequestJSON } from '../lib/aiClient';
import { logger } from '@/utils/logger';

export interface PracticeQuestion {
  question: string;
  concept: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'mcq' | 'short' | 'structured';
  answer: string;
  marks: number;
}

export interface ExamQuestion {
  question: string;
  concepts: string[];
  marks: number;
  expected_steps: string[];
}

export interface StructuredTaskBundle {
  topic: string;
  subtopic: string;
  concepts: string[];
  blocks: {
    concept_learning: string;
    quick_review: string;
    practice_questions: PracticeQuestion[];
    exam_question: ExamQuestion;
  };
}

interface GenerateResponse {
  task: StructuredTaskBundle;
  selection_reason: 'uncovered' | 'weak' | 'syllabus-order';
  selected_concepts: string[];
  coverage_warnings: string[];
}

interface Args {
  subjectId: string | null;
  subjectName: string;
  curriculum?: string;
  topic: string;
  subtopics?: string[];
  availableConcepts?: string[];
  /** When provided, the cached task_payload is used and no AI call is made. */
  cachedTask?: StructuredTaskBundle | null;
}

// Mastery-driven decay window — concepts re-enter the "uncovered" pool after
// this many days, scaled by current topic mastery. Lower mastery = shorter window.
function decayWindowDays(masteryPct: number): number {
  if (masteryPct >= 80) return 60;
  if (masteryPct >= 60) return 21;
  if (masteryPct >= 30) return 7;
  return 3;
}

const MAX_REGEN_PER_DAY = 3;

export function useStructuredDailyTask(args: Args) {
  const { subjectId, subjectName, curriculum, topic, subtopics, availableConcepts, cachedTask } = args;

  const [task, setTask] = useState<StructuredTaskBundle | null>(cachedTask ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverageWarnings, setCoverageWarnings] = useState<string[]>([]);
  const [selectionReason, setSelectionReason] = useState<string | null>(null);
  const [dailyTaskRowId, setDailyTaskRowId] = useState<string | null>(null);
  const [regenCount, setRegenCount] = useState(0);

  const generate = useCallback(async (opts?: { force?: boolean }) => {
    setIsLoading(true);
    setError(null);
    setCoverageWarnings([]);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];

      // 1. Try cached bundle for today first (kills 60-80% of AI calls)
      if (!opts?.force && subjectId) {
        const { data: existingRows } = await supabase
          .from('daily_tasks')
          .select('id, task_payload, selection_reason')
          .eq('user_id', user.id)
          .eq('subject_id', subjectId)
          .eq('task_date', today)
          .eq('task_type', 'structured-bundle')
          .limit(1);
        const existing = existingRows?.[0];
        if (existing?.task_payload) {
          setTask(existing.task_payload as unknown as StructuredTaskBundle);
          setSelectionReason((existing.selection_reason as string) ?? null);
          setDailyTaskRowId(existing.id);
          setIsLoading(false);
          return;
        }
      }

      // 2. Fetch topic mastery for decay + AI input
      const conceptMastery: Record<string, number> = {};
      const weakConcepts: string[] = [];
      const masteryByTopic: Record<string, number> = {};
      if (subjectId) {
        const { data: masteryRows } = await supabase
          .from('topic_mastery')
          .select('topic_name, mastery_percentage')
          .eq('user_id', user.id)
          .eq('subject_id', subjectId);
        (masteryRows ?? []).forEach((r: any) => {
          const pct = Number(r.mastery_percentage) || 0;
          conceptMastery[r.topic_name] = pct;
          masteryByTopic[(r.topic_name || '').toLowerCase()] = pct;
          if (pct < 60) weakConcepts.push(r.topic_name);
        });
      }

      // 3. Apply mastery-driven decay to "covered" concepts
      const { data: coverage } = await supabase
        .from('daily_task_concepts')
        .select('concept, topic, last_covered_at')
        .eq('user_id', user.id)
        .eq('subject_name', subjectName);
      const now = Date.now();
      const completedConcepts = (coverage ?? [])
        .filter((c: any) => {
          const pct = masteryByTopic[(c.topic || '').toLowerCase()] ?? 0;
          const windowMs = decayWindowDays(pct) * 86400000;
          const last = new Date(c.last_covered_at).getTime();
          return now - last < windowMs;
        })
        .map((c: any) => c.concept);

      // 4. Past paper patterns
      let pastPaperPatterns: any[] = [];
      if (subjectId) {
        const { data: patterns } = await supabase
          .from('exam_patterns')
          .select('topic_name, question_types, avg_marks, difficulty_level')
          .eq('user_id', user.id)
          .eq('subject_id', subjectId)
          .limit(10);
        pastPaperPatterns = patterns ?? [];
      }

      const result = await aiRequestJSON<GenerateResponse>('generate-daily-task', {
        subject: subjectName,
        curriculum: curriculum ?? 'ZIMSEC',
        topic,
        subtopics: subtopics ?? [],
        available_concepts: availableConcepts && availableConcepts.length > 0
          ? availableConcepts
          : (subtopics ?? []),
        concept_mastery: conceptMastery,
        completed_concepts: completedConcepts,
        weak_concepts: weakConcepts,
        past_paper_patterns: pastPaperPatterns,
      });

      setTask(result.task);
      setSelectionReason(result.selection_reason);
      setCoverageWarnings(result.coverage_warnings ?? []);

      // 5. Persist bundle to daily_tasks for caching/idempotency
      try {
        if (dailyTaskRowId) {
          await supabase
            .from('daily_tasks')
            .update({
              task_payload: result.task as any,
              selection_reason: result.selection_reason,
              concepts_covered: result.task.concepts ?? [],
              title: `Daily Task — ${result.task.topic || topic}`,
              description: result.task.subtopic || null,
            })
            .eq('id', dailyTaskRowId)
            .eq('user_id', user.id);
        } else {
          const { data: inserted } = await supabase
            .from('daily_tasks')
            .insert({
              user_id: user.id,
              subject_id: subjectId,
              task_date: today,
              task_type: 'structured-bundle',
              title: `Daily Task — ${result.task.topic || topic}`,
              description: result.task.subtopic || null,
              task_payload: result.task as any,
              selection_reason: result.selection_reason,
              concepts_covered: result.task.concepts ?? [],
              is_locked: false,
            })
            .select('id')
            .single();
          if (inserted?.id) setDailyTaskRowId(inserted.id);
        }
      } catch (e) {
        logger.warn('Failed to cache structured bundle', e);
      }


      // 6. Record concept coverage (trigger bumps last_covered_at/coverage_count)
      if (result.task?.concepts?.length) {
        const rows = result.task.concepts.map((concept) => ({
          user_id: user.id,
          subject_id: subjectId,
          subject_name: subjectName,
          topic: result.task.topic || topic,
          subtopic: result.task.subtopic || null,
          concept,
        }));
        await supabase
          .from('daily_task_concepts')
          .upsert(rows, { onConflict: 'user_id,subject_name,concept', ignoreDuplicates: false });
      }
    } catch (e) {
      logger.error('useStructuredDailyTask.generate failed', e);
      setError(e instanceof Error ? e.message : 'Failed to generate task');
    } finally {
      setIsLoading(false);
    }
  }, [subjectId, subjectName, curriculum, topic, subtopics, availableConcepts]);

  useEffect(() => {
    if (cachedTask) {
      setTask(cachedTask);
      return;
    }
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, subjectId]);

  return {
    task,
    isLoading,
    error,
    coverageWarnings,
    selectionReason,
    dailyTaskRowId,
    regenerate: () => generate({ force: true }),
  };
}
