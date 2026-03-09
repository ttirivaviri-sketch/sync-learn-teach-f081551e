import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useEffect, useState } from 'react';
import { Badge } from '../types/study';

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

export function useUserProgress() {
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Fetch user progress from database
  const { data: progress, isLoading, error } = useQuery({
    queryKey: ['user-progress', userId],
    queryFn: async (): Promise<UserProgressData | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      
      // If no progress exists, create initial record
      if (!data) {
        const { data: newProgress, error: insertError } = await supabase
          .from('user_progress')
          .insert({
            user_id: userId,
            xp: 0,
            streak: 0,
            badges: [],
          })
          .select()
          .single();
        
        if (insertError) throw insertError;
        
        // Parse badges from JSON
        return {
          ...newProgress,
          badges: Array.isArray(newProgress.badges) 
            ? (newProgress.badges as unknown as Badge[]) 
            : [],
        };
      }
      
      // Parse badges from JSON
      return {
        ...data,
        badges: Array.isArray(data.badges) 
          ? (data.badges as unknown as Badge[]) 
          : [],
      };
    },
    enabled: !!userId,
  });

  // Calculate daily stats from study_schedule and quiz_attempts
  const { data: dailyStats } = useQuery({
    queryKey: ['daily-stats', userId],
    queryFn: async (): Promise<DailyProgressStats> => {
      if (!userId) return { tasksCompletedToday: 0, totalTasksToday: 0, examQuestionsToday: 0, xpToday: 0 };

      const today = new Date().toISOString().split('T')[0];

      // Get today's scheduled tasks
      const { data: scheduledTasks } = await supabase
        .from('study_schedule')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', today);

      const tasksCompletedToday = scheduledTasks?.filter(t => t.is_completed).length || 0;
      const totalTasksToday = scheduledTasks?.length || 0;

      // Get today's quiz attempts
      const { data: quizAttempts } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`);

      const examQuestionsToday = quizAttempts?.length || 0;
      
      // Calculate XP earned today (10 XP per task, 25 XP per correct quiz, 10 XP per incorrect)
      const xpFromTasks = tasksCompletedToday * 10;
      const xpFromQuizzes = quizAttempts?.reduce((acc, q) => {
        return acc + (q.was_correct ? 25 : 10);
      }, 0) || 0;

      return {
        tasksCompletedToday,
        totalTasksToday,
        examQuestionsToday,
        xpToday: xpFromTasks + xpFromQuizzes,
      };
    },
    enabled: !!userId,
  });

  // Add XP mutation
  const addXp = useMutation({
    mutationFn: async (xpAmount: number) => {
      if (!userId || !progress) throw new Error('Not authenticated');

      const newXp = progress.xp + xpAmount;
      const { error } = await supabase
        .from('user_progress')
        .update({ xp: newXp })
        .eq('user_id', userId);

      if (error) throw error;
      return newXp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-progress', userId] });
    },
  });

  // Update streak mutation
  const updateStreak = useMutation({
    mutationFn: async () => {
      if (!userId || !progress) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];
      const lastStudy = progress.last_study_date;
      
      let newStreak = progress.streak;
      
      if (!lastStudy) {
        // First study session
        newStreak = 1;
      } else {
        const lastDate = new Date(lastStudy);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
          // Same day, no change
        } else if (diffDays === 1) {
          // Consecutive day
          newStreak += 1;
        } else {
          // Streak broken
          newStreak = 1;
        }
      }

      const { error } = await supabase
        .from('user_progress')
        .update({ 
          streak: newStreak, 
          last_study_date: today,
        })
        .eq('user_id', userId);

      if (error) throw error;
      return newStreak;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-progress', userId] });
    },
  });

  // Award badge mutation
  const awardBadge = useMutation({
    mutationFn: async (badge: Badge) => {
      if (!userId || !progress) throw new Error('Not authenticated');

      // Check if badge already earned
      if (progress.badges.some(b => b.id === badge.id)) {
        return progress.badges;
      }

      const newBadges = [...progress.badges, { ...badge, earnedAt: new Date() }];
      
      // Convert to JSON-safe format
      const badgesJson = newBadges.map(b => ({
        id: b.id,
        name: b.name,
        description: b.description,
        icon: b.icon,
        earnedAt: b.earnedAt?.toISOString() || null,
      }));
      
      const { error } = await supabase
        .from('user_progress')
        .update({ badges: badgesJson })
        .eq('user_id', userId);

      if (error) throw error;
      return newBadges;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-progress', userId] });
    },
  });

  return {
    progress,
    dailyStats: dailyStats || { tasksCompletedToday: 0, totalTasksToday: 0, examQuestionsToday: 0, xpToday: 0 },
    isLoading,
    error,
    addXp,
    updateStreak,
    awardBadge,
  };
}
