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

export function useStructuredDailyTask(args: Args) {
  const { subjectId, subjectName, curriculum, topic, subtopics, availableConcepts, cachedTask } = args;

  const [task, setTask] = useState<StructuredTaskBundle | null>(cachedTask ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverageWarnings, setCoverageWarnings] = useState<string[]>([]);
  const [selectionReason, setSelectionReason] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setCoverageWarnings([]);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error('Not authenticated');

      // Fetch concept mastery (from topic_mastery for this subject, if any)
      let conceptMastery: Record<string, number> = {};
      let weakConcepts: string[] = [];
      if (subjectId) {
        const { data: masteryRows } = await supabase
          .from('topic_mastery')
          .select('topic_name, mastery_percentage')
          .eq('user_id', user.id)
          .eq('subject_id', subjectId);
        (masteryRows ?? []).forEach((r: any) => {
          conceptMastery[r.topic_name] = Number(r.mastery_percentage) || 0;
          if ((Number(r.mastery_percentage) || 0) < 60) weakConcepts.push(r.topic_name);
        });
      }

      // Fetch already-covered concepts for this subject
      const { data: coverage } = await supabase
        .from('daily_task_concepts')
        .select('concept')
        .eq('user_id', user.id)
        .eq('subject_name', subjectName);
      const completedConcepts = (coverage ?? []).map((c: any) => c.concept);

      // Fetch past paper patterns
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

      // Record concept coverage
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
    regenerate: generate,
  };
}
