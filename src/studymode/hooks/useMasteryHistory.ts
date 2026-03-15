import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useEffect, useState } from 'react';

interface MasteryDataPoint {
  date: string;
  [subjectName: string]: string | number;
}

interface SubjectInfo {
  name: string;
  color: string;
}

export function useMasteryHistory() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const query = useQuery({
    queryKey: ['mastery-history', userId],
    queryFn: async (): Promise<{ chartData: MasteryDataPoint[]; subjects: SubjectInfo[] }> => {
      if (!userId) return { chartData: [], subjects: [] };

      // Get quiz attempts grouped by date and subject to build trend data
      const { data: attempts, error: attemptsError } = await supabase
        .from('quiz_attempts' as any)
        .select('created_at, was_correct, subject_id, topic_name')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (attemptsError) throw attemptsError;

      // Get subjects for names/colors
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('user_id', userId);

      if (subjectsError) throw subjectsError;

      // Also get current topic_mastery as the latest data point
      const { data: currentMastery } = await supabase
        .from('topic_mastery')
        .select('subject_id, topic_name, mastery_percentage, updated_at')
        .eq('user_id', userId);

      const subjectMap = new Map(subjectsData?.map(s => [s.id, s.name]) ?? []);
      const subjectColors: Record<string, string> = {
        'Mathematics': 'hsl(220, 70%, 50%)',
        'Physics': 'hsl(25, 85%, 55%)',
        'Chemistry': 'hsl(145, 60%, 42%)',
        'Biology': 'hsl(340, 65%, 55%)',
        'English': 'hsl(270, 60%, 55%)',
        'History': 'hsl(40, 75%, 50%)',
        'Geography': 'hsl(185, 60%, 45%)',
        'Computer Science': 'hsl(215, 25%, 50%)',
      };

      if (!attempts || attempts.length === 0) {
        // If no quiz attempts, use current mastery as a single data point
        if (currentMastery && currentMastery.length > 0) {
          const subjectMastery: Record<string, number[]> = {};
          for (const m of currentMastery) {
            const name = subjectMap.get(m.subject_id) || 'Unknown';
            if (!subjectMastery[name]) subjectMastery[name] = [];
            subjectMastery[name].push(m.mastery_percentage);
          }

          const point: MasteryDataPoint = {
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          };
          const subjectInfos: SubjectInfo[] = [];
          for (const [name, values] of Object.entries(subjectMastery)) {
            point[name] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
            subjectInfos.push({ name, color: subjectColors[name] || 'hsl(200, 50%, 50%)' });
          }

          return { chartData: [point], subjects: subjectInfos };
        }
        return { chartData: [], subjects: [] };
      }

      // Group attempts by date and subject, calculate running accuracy
      const dateSubjectMap: Map<string, Map<string, { correct: number; total: number }>> = new Map();
      const allSubjectNames = new Set<string>();

      for (const attempt of attempts) {
        const date = new Date(attempt.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const subjectName = subjectMap.get(attempt.subject_id || '') || 'General';
        allSubjectNames.add(subjectName);

        if (!dateSubjectMap.has(date)) dateSubjectMap.set(date, new Map());
        const dateMap = dateSubjectMap.get(date)!;
        if (!dateMap.has(subjectName)) dateMap.set(subjectName, { correct: 0, total: 0 });

        const stats = dateMap.get(subjectName)!;
        stats.total++;
        if (attempt.was_correct) stats.correct++;
      }

      // Build cumulative accuracy over time
      const cumulativeStats: Record<string, { correct: number; total: number }> = {};
      const chartData: MasteryDataPoint[] = [];

      for (const [date, subjectStats] of dateSubjectMap) {
        const point: MasteryDataPoint = { date };

        for (const [subjectName, stats] of subjectStats) {
          if (!cumulativeStats[subjectName]) {
            cumulativeStats[subjectName] = { correct: 0, total: 0 };
          }
          cumulativeStats[subjectName].correct += stats.correct;
          cumulativeStats[subjectName].total += stats.total;
        }

        // Include all subjects in every data point for smooth lines
        for (const name of allSubjectNames) {
          const cumStats = cumulativeStats[name];
          if (cumStats && cumStats.total > 0) {
            point[name] = Math.round((cumStats.correct / cumStats.total) * 100);
          }
        }

        chartData.push(point);
      }

      const subjects: SubjectInfo[] = Array.from(allSubjectNames).map(name => ({
        name,
        color: subjectColors[name] || 'hsl(200, 50%, 50%)',
      }));

      return { chartData, subjects };
    },
    enabled: !!userId,
  });

  return {
    chartData: query.data?.chartData ?? [],
    subjects: query.data?.subjects ?? [],
    isLoading: query.isLoading,
  };
}
