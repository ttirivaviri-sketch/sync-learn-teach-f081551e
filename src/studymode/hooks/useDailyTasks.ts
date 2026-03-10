import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useEffect, useState } from 'react';
import { DailyTask, Subject } from '../types/study';

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

export function useDailyTasks(subjects: Subject[]) {
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
          .from('daily_tasks' as any)
          .select('*')
          .eq('user_id', userId)
          .eq('task_date', today);

        if (error) {
          // Table might not exist yet — fall back to in-memory
          console.warn('daily_tasks table not available:', error.message);
          return [];
        }
        return (data as unknown as DbDailyTask[]) || [];
      } catch {
        return [];
      }
    },
    enabled: !!userId,
  });

  // Generate tasks for a subject (used when no DB tasks exist)
  const generateTasksForSubject = (subject: Subject): DailyTask[] => {
    const topicName = subject.currentTopic?.name || 'General Review';
    return [
      {
        id: `${subject.id}-t1`,
        type: 'micro-revision',
        title: 'Quick Review',
        description: `2-3 questions from ${topicName}`,
        isCompleted: false,
        isLocked: false,
        subjectId: subject.id,
      },
      {
        id: `${subject.id}-t2`,
        type: 'concept-learning',
        title: 'Concept Learning',
        description: `Deep dive into ${topicName}`,
        isCompleted: false,
        isLocked: false,
        subjectId: subject.id,
      },
      {
        id: `${subject.id}-t3`,
        type: 'flashcards',
        title: 'Flashcard Review',
        description: `Key terms & concepts for ${topicName}`,
        isCompleted: false,
        isLocked: true,
        subjectId: subject.id,
      },
      {
        id: `${subject.id}-t4`,
        type: 'active-recall',
        title: 'Active Recall',
        description: `Test yourself on ${topicName}`,
        isCompleted: false,
        isLocked: true,
        subjectId: subject.id,
      },
      {
        id: `${subject.id}-t5`,
        type: 'exam-question',
        title: 'AI Exam Question',
        description: `Exam-style question (${subject.currentTopic?.examWeight || 5}% exam weight)`,
        isCompleted: false,
        isLocked: true,
        subjectId: subject.id,
      },
    ];
  };

  // Ensure today's tasks exist — create if missing
  const ensureTasks = useMutation({
    mutationFn: async () => {
      if (!userId || subjects.length === 0) return;

      // Check if tasks already exist for today
      if (dbTasks && dbTasks.length > 0) return;

      const tasksToInsert = subjects.flatMap(subject => {
        const topicName = subject.currentTopic?.name || 'General Review';
        return [
          {
            user_id: userId,
            subject_id: subject.id,
            task_type: 'micro-revision',
            title: 'Quick Review',
            description: `2-3 questions from ${topicName}`,
            is_completed: false,
            is_locked: false,
            task_date: today,
          },
          {
            user_id: userId,
            subject_id: subject.id,
            task_type: 'concept-learning',
            title: 'Concept Learning',
            description: `Deep dive into ${topicName}`,
            is_completed: false,
            is_locked: false,
            task_date: today,
          },
          {
            user_id: userId,
            subject_id: subject.id,
            task_type: 'flashcards',
            title: 'Flashcard Review',
            description: `Key terms & concepts for ${topicName}`,
            is_completed: false,
            is_locked: true,
            task_date: today,
          },
          {
            user_id: userId,
            subject_id: subject.id,
            task_type: 'active-recall',
            title: 'Active Recall',
            description: `Test yourself on ${topicName}`,
            is_completed: false,
            is_locked: true,
            task_date: today,
          },
          {
            user_id: userId,
            subject_id: subject.id,
            task_type: 'exam-question',
            title: 'AI Exam Question',
            description: `Exam-style question (${subject.currentTopic?.examWeight || 5}% exam weight)`,
            is_completed: false,
            is_locked: true,
            task_date: today,
          },
        ];
      });

      try {
        const { error } = await supabase
          .from('daily_tasks' as any)
          .insert(tasksToInsert as any);

        if (error) {
          console.warn('Could not persist tasks:', error.message);
        }
      } catch {
        // Table doesn't exist yet
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
        // Try to update in DB
        const { error } = await supabase
          .from('daily_tasks' as any)
          .update({
            is_completed: true,
            completed_at: new Date().toISOString(),
          } as any)
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error) {
          console.warn('Could not persist task completion:', error.message);
        }

        // Also unlock next task
        const allTasks = dbTasks || [];
        const taskIndex = allTasks.findIndex(t => t.id === taskId);
        if (taskIndex >= 0 && taskIndex < allTasks.length - 1) {
          const nextTask = allTasks[taskIndex + 1];
          if (nextTask.subject_id === allTasks[taskIndex].subject_id) {
            await supabase
              .from('daily_tasks' as any)
              .update({ is_locked: false } as any)
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
    isLoading,
    tasksCount: dbTasks?.length || 0,
  };
}
