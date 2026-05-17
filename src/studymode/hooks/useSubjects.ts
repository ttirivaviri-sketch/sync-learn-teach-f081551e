import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { Subject, Topic } from '../types/study';
import { useEffect, useState } from 'react';

interface DbTopic {
  id: string;
  name: string;
  subtopics: string[];
  learningObjectives: string[];
  examWeight: number | null;
  prerequisites: string[];
}

interface DbSubject {
  id: string;
  user_id: string;
  name: string;
  syllabus_code: string | null;
  topics: DbTopic[];
  icon_emoji?: string | null;
  icon_gradient?: string | null;
  created_at: string;
  updated_at: string;
}

const subjectColors: Record<string, string> = {
  'Mathematics': 'from-blue-500 to-indigo-600',
  'Physics': 'from-orange-500 to-red-500',
  'Chemistry': 'from-green-500 to-emerald-600',
  'Biology': 'from-pink-500 to-rose-600',
  'English': 'from-purple-500 to-violet-600',
  'History': 'from-amber-500 to-yellow-600',
  'Geography': 'from-cyan-500 to-teal-600',
  'Computer Science': 'from-slate-500 to-gray-600',
};

const subjectIcons: Record<string, string> = {
  'Mathematics': '📐',
  'Physics': '⚡',
  'Chemistry': '🧪',
  'Biology': '🧬',
  'English': '📚',
  'History': '🏛️',
  'Geography': '🌍',
  'Computer Science': '💻',
};

export function useSubjects() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  return useQuery({
    queryKey: ['subjects', userId],
    queryFn: async (): Promise<Subject[]> => {
      if (!userId) return [];

      const { data: subjects, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      if (!subjects || subjects.length === 0) return [];

      // Fetch topic mastery for all subjects
      const { data: masteryData } = await supabase
        .from('topic_mastery')
        .select('*')
        .eq('user_id', userId);

      const masteryMap = new Map(
        masteryData?.map(m => [`${m.subject_id}-${m.topic_name}`, m]) ?? []
      );

      return subjects.map((subject: any) => {
        // Parse topics from JSON - handle both array and object formats
        const rawTopics = subject.topics as unknown;
        const dbTopics: DbTopic[] = Array.isArray(rawTopics) ? rawTopics : [];
        
        const topics: Topic[] = dbTopics.map((t, index) => {
          const mastery = masteryMap.get(`${subject.id}-${t.name}`);
          return {
            id: t.id || `topic-${index}`,
            name: t.name,
            subtopics: t.subtopics || [],
            mastery: mastery?.mastery_percentage ?? 0,
            isLocked: mastery?.is_locked ?? false,
            prerequisites: t.prerequisites || [],
            examWeight: t.examWeight ?? 0,
          };
        });

        const currentTopic = topics.find(t => !t.isLocked && t.mastery < 95) || topics[0];
        const overallMastery = topics.length > 0
          ? Math.round(topics.reduce((acc, t) => acc + t.mastery, 0) / topics.length)
          : 0;

        const subjectName = subject.name;
        const color = subject.icon_gradient || subjectColors[subjectName] || 'from-gray-500 to-slate-600';
        const icon = subject.icon_emoji || subjectIcons[subjectName] || '📖';

        return {
          id: subject.id,
          name: subjectName,
          color,
          icon,
          currentTopic: currentTopic || {
            id: 'placeholder',
            name: 'No topics available',
            subtopics: [],
            mastery: 0,
            isLocked: false,
            prerequisites: [],
            examWeight: 0,
          },
          topics,
          overallMastery,
        };
      });
    },
    enabled: !!userId,
  });
}

export function useTopicMastery(subjectId: string) {
  const queryClient = useQueryClient();

  const updateMastery = useMutation({
    mutationFn: async ({ topicName, mastery }: { topicName: string; mastery: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('topic_mastery')
        .upsert({
          user_id: user.id,
          subject_id: subjectId,
          topic_name: topicName,
          mastery_percentage: mastery,
          is_locked: false,
        }, {
          onConflict: 'user_id,subject_id,topic_name',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });

  return { updateMastery };
}
