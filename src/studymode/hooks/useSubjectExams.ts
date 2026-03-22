import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useEffect, useState } from 'react';
import { differenceInDays } from 'date-fns';

export interface SubjectExam {
  id: string;
  user_id: string;
  subject_id: string;
  exam_name: string;
  exam_date: string;
  paper_number: string | null;
  created_at: string;
  updated_at: string;
  subject?: { name: string };
}

export interface SubjectExamWithReadiness extends SubjectExam {
  daysRemaining: number;
  topicReadiness: number; // 0-100 overall readiness
  topicBreakdown: { name: string; mastery: number }[];
  quizAttempts: number;
  avgAccuracy: number;
}

export function useSubjectExams() {
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Fetch all subject exams with readiness data
  const examsQuery = useQuery({
    queryKey: ['subject-exams', userId],
    queryFn: async (): Promise<SubjectExamWithReadiness[]> => {
      if (!userId) return [];

      // Fetch exams
      const { data: exams, error: examsError } = await (supabase
        .from('subject_exams') as any)
        .select('*, subject:subjects(name)')
        .eq('user_id', userId)
        .order('exam_date', { ascending: true });

      if (examsError) throw examsError;
      if (!exams || exams.length === 0) return [];

      // Fetch topic mastery for all subjects
      const subjectIds = [...new Set((exams as any[]).map((e: any) => e.subject_id))];
      const { data: masteryData } = await supabase
        .from('topic_mastery')
        .select('*')
        .eq('user_id', userId)
        .in('subject_id', subjectIds);

      // Fetch quiz attempts for all subjects
      const { data: quizData } = await supabase
        .from('quiz_attempts' as any)
        .select('*')
        .eq('user_id', userId)
        .in('subject_id', subjectIds);

      // Fetch subjects for topic lists
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('id, topics')
        .in('id', subjectIds);

      const now = new Date();

      return (exams as any[]).map((exam: any) => {
        const examDate = new Date(exam.exam_date);
        const daysRemaining = differenceInDays(examDate, now);

        // Get topics for this subject
        const subjectData = subjectsData?.find((s: any) => s.id === exam.subject_id);
        const topics = Array.isArray(subjectData?.topics) ? subjectData.topics : [];

        // Get mastery for each topic
        const subjectMastery = (masteryData || []).filter((m: any) => m.subject_id === exam.subject_id);
        const topicBreakdown = topics.map((topic: any) => {
          const mastery = subjectMastery.find((m: any) => m.topic_name === (topic.name || topic));
          return {
            name: typeof topic === 'string' ? topic : topic.name || 'Unknown',
            mastery: mastery?.mastery_percentage || 0,
          };
        });

        // Overall readiness
        const topicReadiness = topicBreakdown.length > 0
          ? Math.round(topicBreakdown.reduce((sum: number, t: any) => sum + t.mastery, 0) / topicBreakdown.length)
          : 0;

        // Quiz stats for this subject
        const subjectQuizzes = (quizData || []).filter((q: any) => q.subject_id === exam.subject_id);
        const quizAttempts = subjectQuizzes.length;
        const avgAccuracy = quizAttempts > 0
          ? Math.round((subjectQuizzes.filter((q: any) => q.was_correct).length / quizAttempts) * 100)
          : 0;

        return {
          ...exam,
          daysRemaining,
          topicReadiness,
          topicBreakdown,
          quizAttempts,
          avgAccuracy,
        } as SubjectExamWithReadiness;
      });
    },
    enabled: !!userId,
  });

  const addExam = useMutation({
    mutationFn: async (exam: {
      subject_id: string;
      exam_name: string;
      exam_date: string;
      paper_number?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('subject_exams' as any)
        .insert({
          user_id: user.id,
          subject_id: exam.subject_id,
          exam_name: exam.exam_name,
          exam_date: exam.exam_date,
          paper_number: exam.paper_number || null,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subject-exams'] }),
  });

  const updateExam = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; exam_name?: string; exam_date?: string; paper_number?: string }) => {
      const { error } = await supabase
        .from('subject_exams' as any)
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subject-exams'] }),
  });

  const deleteExam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('subject_exams' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subject-exams'] }),
  });

  // Get the nearest exam
  const getNextExam = (): SubjectExamWithReadiness | null => {
    const exams = examsQuery.data || [];
    const upcoming = exams.filter(e => e.daysRemaining >= 0);
    return upcoming.length > 0 ? upcoming[0] : null;
  };

  // Get exams for a specific subject
  const getExamsForSubject = (subjectId: string): SubjectExamWithReadiness[] => {
    return (examsQuery.data || []).filter(e => e.subject_id === subjectId);
  };

  return {
    exams: examsQuery.data || [],
    isLoading: examsQuery.isLoading,
    error: examsQuery.error,
    addExam,
    updateExam,
    deleteExam,
    getNextExam,
    getExamsForSubject,
  };
}
