import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useEffect, useState } from 'react';
import { Badge } from '../types/study';
import { logger } from "@/utils/logger";
import { studySyncHaptic } from "@/lib/haptics";

// Level boundary: every 100 XP = 1 level. Adjust if app uses different curve.
const levelFor = (xp: number) => Math.floor(xp / 100);

interface UserProgressData {
  id: string;
  user_id: string;
  xp: number;
  streak: number;
  badges: Badge[];
  last_study_date: string | null;
  created_at: string;
  updated_at: string;
}

interface DailyProgressStats {
  tasksCompletedToday: number;
  totalTasksToday: number;
  examQuestionsToday: number;
  xpToday: number;
}

const DEFAULT_DAILY: DailyProgressStats = {
  tasksCompletedToday: 0,
  totalTasksToday: 0,
  examQuestionsToday: 0,
  xpToday: 0,
};

export function useUserProgress() {
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Fetch user progress from database (gracefully handles missing table)
  const { data: progress, isLoading, error } = useQuery({
    queryKey: ['user-progress', userId],
    queryFn: async (): Promise<UserProgressData | null> => {
      if (!userId) return null;

      try {
        const { data, error } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          // Table may not exist yet in this Supabase instance
          logger.warn('[useUserProgress] user_progress table unavailable:', error.message);
          return null;
        }

        // If no progress record exists, create initial one
        if (!data) {
          try {
            const { data: newProgress, error: insertError } = await supabase
              .from('user_progress')
              .insert({ user_id: userId, xp: 0, streak: 0, badges: [] })
              .select()
              .maybeSingle();

            if (insertError) {
              logger.warn('[useUserProgress] Could not create progress record:', insertError.message);
              return null;
            }
            return {
              ...(newProgress as unknown as UserProgressData),
              badges: [],
            };
          } catch {
            return null;
          }
        }

        return {
          ...(data as unknown as UserProgressData),
          badges: Array.isArray((data as unknown as UserProgressData).badges)
            ? ((data as unknown as UserProgressData).badges as unknown as Badge[])
            : [],
        };
      } catch {
        return null;
      }
    },
    enabled: !!userId,
  });

  // Calculate daily stats
  const { data: dailyStats } = useQuery({
    queryKey: ['daily-stats', userId],
    queryFn: async (): Promise<DailyProgressStats> => {
      if (!userId) return DEFAULT_DAILY;

      const today = new Date().toISOString().split('T')[0];

      try {
        // Get today's completed tasks from study_schedule
        const { data: scheduledTasks } = await supabase
          .from('study_schedule')
          .select('is_completed')
          .eq('user_id', userId)
          .eq('scheduled_date', today);

        const tasksCompletedToday = (scheduledTasks as unknown as Array<{ is_completed: boolean }> | null)?.filter(t => t.is_completed).length ?? 0;
        const totalTasksToday = scheduledTasks?.length ?? 0;

        // Get today's quiz attempts
        const { data: quizAttempts } = await supabase
          .from('quiz_attempts')
          .select('was_correct')
          .eq('user_id', userId)
          .gte('created_at', `${today}T00:00:00Z`);

        const examQuestionsToday = quizAttempts?.length ?? 0;
        const xpFromTasks = tasksCompletedToday * 10;
        const xpFromQuizzes = (quizAttempts as unknown as Array<{ was_correct: boolean }> | null)?.reduce(
          (acc, q) => acc + (q.was_correct ? 25 : 10),
          0
        ) ?? 0;

        return {
          tasksCompletedToday,
          totalTasksToday,
          examQuestionsToday,
          xpToday: xpFromTasks + xpFromQuizzes,
        };
      } catch {
        return DEFAULT_DAILY;
      }
    },
    enabled: !!userId,
  });

  // Add XP mutation
  const addXp = useMutation({
    mutationFn: async (xpAmount: number) => {
      if (!userId) return 0;

      try {
        const current = progress?.xp ?? 0;
        const newXp = current + xpAmount;
        const leveledUp = levelFor(newXp) > levelFor(current);

        if (progress?.id) {
          await supabase
            .from('user_progress')
            .update({ xp: newXp })
            .eq('user_id', userId);
        } else {
          await supabase
            .from('user_progress')
            .upsert({ user_id: userId, xp: newXp, streak: 0, badges: [] }, { onConflict: 'user_id' });
        }

        if (leveledUp) studySyncHaptic('xp.levelup');
        return newXp;
      } catch (err) {
        logger.warn('[addXp] Failed:', err);
        return progress?.xp ?? 0;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-progress', userId] });
    },
  });

  // Update streak mutation
  const updateStreak = useMutation({
    mutationFn: async () => {
      if (!userId) return 0;

      try {
        const today = new Date().toISOString().split('T')[0];
        const lastStudy = progress?.last_study_date;

        let newStreak = progress?.streak ?? 0;

        if (!lastStudy) {
          newStreak = 1;
        } else {
          const diffDays = Math.floor(
            (new Date(today).getTime() - new Date(lastStudy).getTime()) / 86_400_000
          );
          if (diffDays === 0) {
            // Same day
          } else if (diffDays === 1) {
            newStreak += 1;
          } else {
            newStreak = 1;
          }
        }

        await supabase
          .from('user_progress')
          .upsert(
            { user_id: userId, streak: newStreak, last_study_date: today, xp: progress?.xp ?? 0 },
            { onConflict: 'user_id' }
          );


        return newStreak;
      } catch (err) {
        logger.warn('[updateStreak] Failed:', err);
        return progress?.streak ?? 0;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-progress', userId] });
    },
  });

  // Award badge mutation
  const awardBadge = useMutation({
    mutationFn: async (badge: Badge) => {
      if (!userId) return [];

      try {
        const current = progress?.badges ?? [];
        if (current.some(b => b.id === badge.id)) return current;

        const newBadges = [...current, { ...badge, earnedAt: new Date() }];
        const badgesJson = newBadges.map(b => ({
          id: b.id,
          name: b.name,
          description: b.description,
          icon: b.icon,
          earnedAt: b.earnedAt?.toISOString?.() ?? null,
        }));

        await supabase
          .from('user_progress')
          .upsert({ user_id: userId, badges: badgesJson, xp: progress?.xp ?? 0, streak: progress?.streak ?? 0 });

        return newBadges;
      } catch (err) {
        logger.warn('[awardBadge] Failed:', err);
        return progress?.badges ?? [];
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-progress', userId] });
    },
  });

  return {
    progress,
    dailyStats: dailyStats ?? DEFAULT_DAILY,
    isLoading,
    error,
    addXp,
    updateStreak,
    awardBadge,
  };
}
