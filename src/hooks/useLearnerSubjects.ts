import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from "@/utils/logger";

export interface LearnerSubject {
  id: string;
  user_id: string;
  subject: string;
  created_at: string;
  updated_at: string;
}

export const useLearnerSubjects = (userId?: string) => {
  const [subjects, setSubjects] = useState<LearnerSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSubjects = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('learner_subjects')
        .select('*')
        .eq('user_id', userId)
        .order('subject');

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      logger.error('Error fetching learner subjects:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const addSubject = async (subject: string) => {
    if (!userId) return false;
    const trimmed = subject.trim();
    if (!trimmed) return false;

    try {
      const { error } = await supabase
        .from('learner_subjects')
        .insert({ user_id: userId, subject: trimmed });

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Already added', description: `${trimmed} is already in your syllabus.` });
        } else {
          throw error;
        }
        return false;
      }

      toast({ title: 'Subject added', description: `${trimmed} added to your syllabus.` });
      await fetchSubjects();
      return true;
    } catch (error) {
      logger.error('Error adding subject:', error);
      toast({ title: 'Error', description: 'Failed to add subject.', variant: 'destructive' });
      return false;
    }
  };

  const removeSubject = async (subjectId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('learner_subjects')
        .delete()
        .eq('id', subjectId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({ title: 'Subject removed', description: 'Subject removed from your syllabus.' });
      await fetchSubjects();
    } catch (error) {
      logger.error('Error removing subject:', error);
      toast({ title: 'Error', description: 'Failed to remove subject.', variant: 'destructive' });
    }
  };

  return { subjects, loading, addSubject, removeSubject, refreshSubjects: fetchSubjects };
};
