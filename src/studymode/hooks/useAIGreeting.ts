import { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useUserProgress } from './useUserProgress';
import { useExamSettings } from './useExamSettings';

export function useAIGreeting() {
  const [greeting, setGreeting] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const { progress, dailyStats } = useUserProgress();
  const { settings: examSettings, getDaysUntilExam } = useExamSettings();

  useEffect(() => {
    const fetchGreeting = async () => {
      setIsLoading(true);
      const hour = new Date().getHours();

      try {
        const { data: { user } } = await supabase.auth.getUser();
        const studentName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';

        const daysUntilExam = getDaysUntilExam();

        const { data, error } = await supabase.functions.invoke('ai-greeting', {
          body: {
            studentName,
            hour,
            streak: progress?.streak || 0,
            daysUntilExam,
            examName: examSettings?.exam_name || 'exams',
            tasksCompletedToday: dailyStats.tasksCompletedToday,
            totalTasksToday: dailyStats.totalTasksToday,
            lastStudyDate: progress?.last_study_date || null,
            scheduleAdherence: dailyStats.totalTasksToday > 0
              ? `${Math.round((dailyStats.tasksCompletedToday / dailyStats.totalTasksToday) * 100)}%`
              : 'no tasks yet',
          },
        });

        if (error || data?.fallback) {
          setGreeting(getFallbackGreeting(hour, studentName));
        } else {
          setGreeting(data.greeting);
        }
      } catch {
        const hour = new Date().getHours();
        setGreeting(getFallbackGreeting(hour, ''));
      } finally {
        setIsLoading(false);
      }
    };

    // Small delay to let progress data load
    const timer = setTimeout(fetchGreeting, 500);
    return () => clearTimeout(timer);
  }, [progress?.streak, dailyStats.tasksCompletedToday, examSettings?.exam_name]);

  return { greeting, isLoading };
}

function getFallbackGreeting(hour: number, name: string): string {
  const prefix = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const nameStr = name ? ` ${name}` : '';
  return `${prefix}${nameStr}! Ready to study?`;
}
