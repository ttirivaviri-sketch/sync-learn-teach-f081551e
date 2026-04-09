import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useEffect, useState, useCallback } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { useAdaptiveLearningEngine } from './useAdaptiveLearningEngine';
import { logger } from "@/utils/logger";

export interface StudyScheduleItem {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_name: string;
  scheduled_date: string;
  duration_minutes: number;
  task_type: string;
  is_completed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  subject?: {
    name: string;
  };
}

// XP awarded per task type
const TASK_XP: Record<string, number> = {
  concept_learning:    15,
  active_recall:       20,
  exam_question:       25,
  past_paper_practice: 25,
  micro_revision:      10,
  flashcard_review:    12,
  revision:            12,
};

const ADAPTATION_THRESHOLD = 0.7; // 70% completion → regenerate plan

export function useStudySchedule(month?: Date) {
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const currentMonth = month || new Date();
  const { generateStudyPlan, isGeneratingPlan, checkAndAdapt } = useAdaptiveLearningEngine();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const scheduleQuery = useQuery({
    queryKey: ['study-schedule', userId, format(currentMonth, 'yyyy-MM')],
    queryFn: async (): Promise<StudyScheduleItem[]> => {
      if (!userId) return [];

      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate   = format(endOfMonth(currentMonth),   'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('study_schedule')
        .select(`
          *,
          subject:subjects(name)
        `)
        .eq('user_id', userId)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date', { ascending: true });

      if (error) {
        logger.warn('[useStudySchedule] Table unavailable:', error.message);
        return [];
      }
      return (data || []) as unknown as StudyScheduleItem[];
    },
    enabled: !!userId,
  });

  // ── Award XP when a task is completed ──────────────────────────────────────
  const awardXP = useCallback(async (taskType: string, userId: string) => {
    const xpAmount = TASK_XP[taskType] ?? 12;
    try {
      // Fetch current XP
      const { data: prog } = await supabase
        .from('user_progress')
        .select('xp, streak, last_study_date')
        .eq('user_id', userId)
        .maybeSingle();

      const currentXp = prog?.xp ?? 0;
      const newXp     = currentXp + xpAmount;

      // Calculate streak
      const today         = new Date().toISOString().split('T')[0];
      const lastStudyDate = prog?.last_study_date;
      const yesterday     = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
      let newStreak       = prog?.streak ?? 0;
      if (lastStudyDate === yesterday) {
        newStreak += 1; // continuing streak
      } else if (lastStudyDate !== today) {
        newStreak = 1;  // restart streak
      }
      // else: already studied today — keep streak as-is

      await supabase
        .from('user_progress')
        .upsert(
          {
            user_id:         userId,
            xp:              newXp,
            streak:          newStreak,
            last_study_date: today,
          },
          { onConflict: 'user_id' }
        );

      queryClient.invalidateQueries({ queryKey: ['user-progress'] });
    } catch (err) {
      logger.warn('[useStudySchedule] XP award failed:', err);
    }
  }, [queryClient]);

  // ── Check 70% completion and trigger adaptive plan ─────────────────────────
  const checkAdaptiveTrigger = useCallback(async (userId: string) => {
    try {
      const today       = new Date().toISOString().split('T')[0];
      const monthStart  = today.substring(0, 7) + '-01';

      const { data } = await supabase
        .from('study_schedule')
        .select('is_completed')
        .eq('user_id', userId)
        .gte('scheduled_date', monthStart)
        .lte('scheduled_date', today);

      if (!data || data.length === 0) return;

      const total     = data.length;
      const completed = data.filter((r: any) => r.is_completed).length;
      const rate      = completed / total;

      if (rate >= ADAPTATION_THRESHOLD) {
        // Cooldown check is inside checkAndAdapt
        checkAndAdapt().catch((e) => logger.warn(e));
      }
    } catch (err) {
      logger.warn('[useStudySchedule] Adaptive check failed:', err);
    }
  }, [checkAndAdapt]);

  const addScheduleItem = useMutation({
    mutationFn: async (item: {
      subject_id: string | null;
      topic_name: string;
      scheduled_date: string;
      duration_minutes?: number;
      task_type?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('study_schedule')
        .insert({
          user_id:          user.id,
          subject_id:       item.subject_id,
          topic_name:       item.topic_name,
          scheduled_date:   item.scheduled_date,
          duration_minutes: item.duration_minutes || 30,
          task_type:        item.task_type || 'revision',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-schedule'] });
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async ({
      id,
      isCompleted,
      taskType = 'revision',
    }: {
      id: string;
      isCompleted: boolean;
      taskType?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('study_schedule')
        .update({ is_completed: isCompleted })
        .eq('id', id);

      if (error) throw error;

      // Award XP only when marking complete (not un-completing)
      if (isCompleted) {
        await awardXP(taskType, user.id);
        // Check if we've hit the 70% threshold
        await checkAdaptiveTrigger(user.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['user-progress'] });
    },
  });

  const deleteScheduleItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('study_schedule')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-schedule'] });
    },
  });

  const generateSchedule = useMutation({
    mutationFn: async ({
      subjects,
      examDate,
    }: {
      subjects: { id: string; name: string; topics: { name: string; examWeight: number }[] }[];
      examDate: Date;
      daysPerWeek?: number;
    }) => {
      // Use the AI adaptive learning engine instead of algorithmic scheduling
      await generateStudyPlan('initial');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-schedule'] });
    },
  });

  return {
    schedule:          scheduleQuery.data || [],
    isLoading:         scheduleQuery.isLoading || isGeneratingPlan,
    error:             scheduleQuery.error,
    addScheduleItem,
    toggleComplete,
    deleteScheduleItem,
    generateSchedule,
  };
}
