import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook for tutor-side management actions: online status, add/remove subjects.
 * Separated from useTutorData which is learner-facing discovery.
 */
export const useTutorManagement = () => {
  const { toast } = useToast();

  const updateOnlineStatus = async (isOnline: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          online_status: isOnline,
          last_seen: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: isOnline ? "You're now online" : "You're now offline",
        description: isOnline
          ? 'Students can see you\'re available'
          : 'Students won\'t see you as available',
      });
    } catch (error) {
      console.error('Error updating online status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update status. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const addTutorSubject = async (subject: string, level: string, hourlyRate: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('tutor_subjects')
        .insert({ user_id: user.id, subject, level, hourly_rate: hourlyRate });

      if (error) throw error;

      toast({
        title: 'Subject added',
        description: `${subject} (${level}) added to your profile`,
      });
    } catch (error) {
      console.error('Error adding subject:', error);
      toast({
        title: 'Error',
        description: 'Failed to add subject. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const removeTutorSubject = async (subjectId: string) => {
    try {
      const { error } = await supabase
        .from('tutor_subjects')
        .delete()
        .eq('id', subjectId);

      if (error) throw error;

      toast({
        title: 'Subject removed',
        description: 'Subject has been removed from your profile',
      });
    } catch (error) {
      console.error('Error removing subject:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove subject. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return { updateOnlineStatus, addTutorSubject, removeTutorSubject };
};
