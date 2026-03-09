import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useEffect, useState } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export interface StudyScheduleItem {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_name: string;
  scheduled_date: string;
  duration_minutes: number;
  task_type: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  subject?: {
    name: string;
  };
}

export function useStudySchedule(month?: Date) {
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const currentMonth = month || new Date();

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
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

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

      if (error) throw error;
      return (data || []) as StudyScheduleItem[];
    },
    enabled: !!userId,
  });

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
          user_id: user.id,
          subject_id: item.subject_id,
          topic_name: item.topic_name,
          scheduled_date: item.scheduled_date,
          duration_minutes: item.duration_minutes || 30,
          task_type: item.task_type || 'revision',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-schedule'] });
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from('study_schedule')
        .update({ is_completed: isCompleted })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-schedule'] });
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
      daysPerWeek = 5,
    }: {
      subjects: { id: string; name: string; topics: { name: string; examWeight: number }[] }[];
      examDate: Date;
      daysPerWeek?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Calculate study plan based on exam weight and available days
      const today = new Date();
      const totalDays = Math.floor((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const studyDays = Math.floor(totalDays * (daysPerWeek / 7));

      // Collect all topics with their weights
      const allTopics: { subjectId: string; subjectName: string; topicName: string; weight: number }[] = [];
      subjects.forEach(subject => {
        subject.topics.forEach(topic => {
          allTopics.push({
            subjectId: subject.id,
            subjectName: subject.name,
            topicName: topic.name,
            weight: topic.examWeight || 1,
          });
        });
      });

      if (allTopics.length === 0) return;

      // Distribute topics across available days based on weight
      const totalWeight = allTopics.reduce((sum, t) => sum + t.weight, 0);
      const scheduleItems: {
        user_id: string;
        subject_id: string;
        topic_name: string;
        scheduled_date: string;
        duration_minutes: number;
        task_type: string;
      }[] = [];

      let currentDay = 0;
      let weekDayCount = 0;

      allTopics.forEach(topic => {
        const daysForTopic = Math.max(1, Math.round((topic.weight / totalWeight) * studyDays));
        
        for (let i = 0; i < daysForTopic && currentDay < totalDays; i++) {
          // Skip weekends if needed
          while (weekDayCount >= daysPerWeek) {
            currentDay += 7 - daysPerWeek;
            weekDayCount = 0;
          }

          const scheduleDate = new Date(today);
          scheduleDate.setDate(scheduleDate.getDate() + currentDay);

          scheduleItems.push({
            user_id: user.id,
            subject_id: topic.subjectId,
            topic_name: `${topic.subjectName}: ${topic.topicName}`,
            scheduled_date: format(scheduleDate, 'yyyy-MM-dd'),
            duration_minutes: 45,
            task_type: i === 0 ? 'concept_learning' : i === daysForTopic - 1 ? 'exam_prep' : 'revision',
          });

          currentDay++;
          weekDayCount++;
        }
      });

      // Insert all schedule items
      if (scheduleItems.length > 0) {
        const { error } = await supabase
          .from('study_schedule')
          .insert(scheduleItems);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-schedule'] });
    },
  });

  return {
    schedule: scheduleQuery.data || [],
    isLoading: scheduleQuery.isLoading,
    error: scheduleQuery.error,
    addScheduleItem,
    toggleComplete,
    deleteScheduleItem,
    generateSchedule,
  };
}
