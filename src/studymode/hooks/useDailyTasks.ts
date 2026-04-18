import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useEffect, useRef, useState } from 'react';
import { DailyTask, Subject } from '../types/study';
import type { AIContextPayload } from './useAIStudyIntelligence';
import { logger } from "@/utils/logger";

interface DbDailyTask {
  id: string;
  user_id: string;
  subject_id: string | null;
  task_type: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  is_locked: boolean;
  completed_at: string | null;
  task_date: string;
  created_at: string;
  updated_at: string;
}

const TASK_TYPES: DailyTask['type'][] = [
  'micro-revision', 'concept-learning', 'flashcards', 'active-recall', 'exam-question'
];

export function useDailyTasks(subjects: Subject[], aiContext?: AIContextPayload | null) {
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Fetch today's tasks from DB
  const { data: dbTasks, isLoading } = useQuery({
    queryKey: ['daily-tasks', userId, today],
    queryFn: async (): Promise<DbDailyTask[]> => {
      if (!userId) return [];

      try {
        const { data, error } = await supabase
          .from('daily_tasks')
          .select('*')
          .eq('user_id', userId)
          .eq('task_date', today);

        if (error) {
          logger.warn('daily_tasks table not available:', error.message);
          return [];
        }
        return (data as unknown as DbDailyTask[]) || [];
      } catch {
        return [];
      }
    },
    enabled: !!userId,
  });

  // Fetch yesterday's incomplete tasks for streak reminder
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const { data: yesterdayTasks } = useQuery({
    queryKey: ['daily-tasks-yesterday', userId, yesterday],
    queryFn: async (): Promise<DbDailyTask[]> => {
      if (!userId) return [];
      try {
        const { data, error } = await supabase
          .from('daily_tasks')
          .select('*')
          .eq('user_id', userId)
          .eq('task_date', yesterday);
        if (error) return [];
        return (data as unknown as DbDailyTask[]) || [];
      } catch {
        return [];
      }
    },
    enabled: !!userId,
  });

  const yesterdayIncomplete = yesterdayTasks?.filter(t => !t.is_completed) || [];
  const todayIncomplete = dbTasks?.filter(t => !t.is_completed) || [];

  // Generate tasks for a subject (used when no DB tasks exist)
  const generateTasksForSubject = (subject: Subject): DailyTask[] => {
    const topicName = subject.currentTopic?.name || 'General Review';
    const examWeight = subject.currentTopic?.examWeight || 5;

    const diffLevel = aiContext?.difficultyLevel || 'medium';
    const weakAreas = aiContext?.weakAreas || [];
    const isWeakTopic = weakAreas.some(w =>
      w.toLowerCase().includes(topicName.toLowerCase()) ||
      topicName.toLowerCase().includes(w.toLowerCase())
    );

    const difficultyLabel = diffLevel === 'easy' ? 'foundational'
      : diffLevel === 'exam-level' ? 'exam-style'
      : diffLevel;
    const urgencyNote = isWeakTopic ? ' (priority: weak area)' : '';

    return [
      {
        id: `${subject.id}-t1`,
        type: 'micro-revision',
        title: isWeakTopic ? 'Targeted Review' : 'Quick Review',
        description: isWeakTopic
          ? `Focus review: ${topicName} — address gaps identified by AI${urgencyNote}`
          : `2-3 ${difficultyLabel} questions from ${topicName}`,
        isCompleted: false,
        isLocked: false,
        subjectId: subject.id,
      },
      {
        id: `${subject.id}-t2`,
        type: 'concept-learning',
        title: isWeakTopic ? 'Concept Reinforcement' : 'Concept Learning',
        description: isWeakTopic
          ? `Strengthen understanding of ${topicName} with step-by-step explanations`
          : `Deep dive into ${topicName} at ${difficultyLabel} level`,
        isCompleted: false,
        isLocked: false,
        subjectId: subject.id,
      },
      {
        id: `${subject.id}-t3`,
        type: 'flashcards',
        title: 'Flashcard Review',
        description: `Key terms & concepts for ${topicName} — AI-curated from your syllabus`,
        isCompleted: false,
        isLocked: true,
        subjectId: subject.id,
      },
      {
        id: `${subject.id}-t4`,
        type: 'active-recall',
        title: 'Active Recall',
        description: `Test yourself on ${topicName} — ${difficultyLabel} difficulty${urgencyNote}`,
        isCompleted: false,
        isLocked: true,
        subjectId: subject.id,
      },
      {
        id: `${subject.id}-t5`,
        type: 'exam-question',
        title: 'AI Exam Question',
        description: `Exam-style question for ${topicName} (${examWeight}% exam weight) — matching your exam board format`,
        isCompleted: false,
        isLocked: true,
        subjectId: subject.id,
      },
    ];
  };

  // In-flight guard to prevent concurrent seeding (StrictMode double-mount, re-renders)
  const seedingRef = useRef(false);

  // Ensure today's tasks exist — create if missing
  const ensureTasks = useMutation({
    mutationFn: async () => {
      if (!userId || subjects.length === 0) return;
      // Wait for query to settle and only seed when truly empty
      if (isLoading) return;
      if (dbTasks && dbTasks.length > 0) return;
      if (seedingRef.current) return;
      seedingRef.current = true;

      try {
        const tasksToInsert = subjects.flatMap(subject => {
          const generated = generateTasksForSubject(subject);
          return generated.map(task => ({
            user_id: userId,
            subject_id: subject.id,
            task_type: task.type,
            title: task.title,
            description: task.description,
            is_completed: false,
            is_locked: task.isLocked,
            task_date: today,
          }));
        });

        const { error } = await supabase
          .from('daily_tasks')
          .upsert(tasksToInsert, {
            onConflict: 'user_id,subject_id,task_date,task_type,title',
            ignoreDuplicates: true,
          });

        if (error) {
          logger.warn('Could not persist tasks:', error.message);
        }
      } catch (e) {
        logger.warn('ensureTasks failed', e);
      } finally {
        seedingRef.current = false;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks', userId, today] });
    },
  });

  // Complete a task
  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error('Not authenticated');

      try {
        const { error } = await supabase
          .from('daily_tasks')
          .update({
            is_completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error) {
          logger.warn('Could not persist task completion:', error.message);
        }

        // Also unlock next task
        const allTasks = dbTasks || [];
        const taskIndex = allTasks.findIndex(t => t.id === taskId);
        if (taskIndex >= 0 && taskIndex < allTasks.length - 1) {
          const nextTask = allTasks[taskIndex + 1];
          if (nextTask.subject_id === allTasks[taskIndex].subject_id) {
            await supabase
              .from('daily_tasks')
              .update({ is_locked: false })
              .eq('id', nextTask.id)
              .eq('user_id', userId);
          }
        }
      } catch {
        // silent
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks', userId, today] });
      queryClient.invalidateQueries({ queryKey: ['daily-stats', userId] });
    },
  });

  // Add a bonus task for a subject
  const addBonusTask = useMutation({
    mutationFn: async (subjectId: string) => {
      if (!userId) throw new Error('Not authenticated');

      const subject = subjects.find(s => s.id === subjectId);
      if (!subject) throw new Error('Subject not found');

      const topicName = subject.currentTopic?.name || 'General Review';
      const randomType = TASK_TYPES[Math.floor(Math.random() * TASK_TYPES.length)];
      const taskTitles: Record<string, string> = {
        'micro-revision': 'Bonus Review',
        'concept-learning': 'Bonus Concept Deep Dive',
        'flashcards': 'Bonus Flashcards',
        'active-recall': 'Bonus Active Recall',
        'exam-question': 'Bonus Exam Question',
      };

      const taskRow = {
        user_id: userId,
        subject_id: subjectId,
        task_type: randomType,
        title: taskTitles[randomType] || 'Bonus Task',
        description: `Extra practice on ${topicName} — keep building mastery!`,
        is_completed: false,
        is_locked: false,
        task_date: today,
      };

      const { data, error } = await supabase
        .from('daily_tasks')
        .insert(taskRow)
        .select()
        .single();

      if (error) {
        logger.warn('Could not create bonus task:', error.message);
        throw error;
      }

      return data as unknown as DbDailyTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks', userId, today] });
    },
  });

  // Get tasks for a specific subject — prefer DB, fallback to generated
  const getTasksForSubject = (subject: Subject): DailyTask[] => {
    const subjectDbTasks = dbTasks?.filter(t => t.subject_id === subject.id) || [];
    
    if (subjectDbTasks.length > 0) {
      return subjectDbTasks.map(t => ({
        id: t.id,
        type: t.task_type as DailyTask['type'],
        title: t.title,
        description: t.description || '',
        isCompleted: t.is_completed,
        isLocked: t.is_locked,
        subjectId: t.subject_id || subject.id,
      }));
    }
    
    return generateTasksForSubject(subject);
  };

  return {
    getTasksForSubject,
    completeTask,
    ensureTasks,
    addBonusTask,
    isLoading,
    tasksCount: dbTasks?.length || 0,
    yesterdayIncomplete,
    todayIncomplete,
  };
}
