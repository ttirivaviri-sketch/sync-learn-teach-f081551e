import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { Subject } from '../types/study';
import { useToast } from './use-toast';

const MASTERY_THRESHOLD = 95;

export function useTopicProgression() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Advance to next topic when mastery >= 95%
  const advanceToNextTopic = useMutation({
    mutationFn: async ({ subject, currentTopicIndex }: { subject: Subject; currentTopicIndex: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const nextIndex = currentTopicIndex + 1;
      if (nextIndex >= subject.topics.length) {
        throw new Error('All topics completed!');
      }

      const nextTopic = subject.topics[nextIndex];

      // Unlock the next topic in topic_mastery
      const { error } = await supabase
        .from('topic_mastery')
        .upsert({
          user_id: user.id,
          subject_id: subject.id,
          topic_name: nextTopic.name,
          mastery_percentage: 0,
          is_locked: false,
        }, {
          onConflict: 'user_id,subject_id,topic_name',
        });

      if (error) throw error;

      return nextTopic;
    },
    onSuccess: (nextTopic) => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast({
        title: '🎉 Topic Unlocked!',
        description: `You've advanced to: ${nextTopic.name}`,
      });
    },
    onError: (error) => {
      if (error.message === 'All topics completed!') {
        toast({
          title: '🏆 Subject Complete!',
          description: "You've mastered all topics in this subject!",
        });
      }
    },
  });

  // Check if current topic is ready for advancement
  const canAdvance = (subject: Subject): boolean => {
    return subject.currentTopic.mastery >= MASTERY_THRESHOLD;
  };

  const getCurrentTopicIndex = (subject: Subject): number => {
    return subject.topics.findIndex(t => t.id === subject.currentTopic.id);
  };

  return {
    advanceToNextTopic,
    canAdvance,
    getCurrentTopicIndex,
    MASTERY_THRESHOLD,
  };
}
