/**
 * useStudentInsights — React hook for Student Insights for Tutors
 *
 * Provides:
 *   - generateInsights(): trigger AI analysis of a student's learning profile
 *   - insights: the generated student insights
 *   - cachedInsights: check for cached insights before calling AI
 *   - isGenerating: loading state
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  StudentInsightsRequest,
  StudentInsightsResponse,
} from '@/sail/types/edgeFunctions';

interface UseStudentInsightsReturn {
  insights: StudentInsightsResponse | null;
  isGenerating: boolean;
  error: string | null;
  generateInsights: (studentId: string) => Promise<StudentInsightsResponse | null>;
  getCachedInsights: (studentId: string) => Promise<StudentInsightsResponse | null>;
  clearError: () => void;
  hasData: boolean;
}

export function useStudentInsights(tutorId?: string): UseStudentInsightsReturn {
  const [insights, setInsights] = useState<StudentInsightsResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for cached insights first
  const getCachedInsights = useCallback(
    async (studentId: string): Promise<StudentInsightsResponse | null> => {
      if (!tutorId) return null;

      try {
        const { data, error: fetchError } = await supabase
          .from('student_insights_cache')
          .select('insights, expires_at')
          .eq('student_id', studentId)
          .eq('tutor_id', tutorId)
          .maybeSingle();

        if (fetchError || !data) return null; // Table may not exist yet — silently return null

        // Check if cache is still valid
        if (new Date(data.expires_at) < new Date()) {
          return null; // Expired
        }

        const cachedInsights = data.insights as unknown as StudentInsightsResponse;
        setInsights(cachedInsights);
        return cachedInsights;
      } catch (err) {
        console.warn('Cache lookup failed:', err);
        return null;
      }
    },
    [tutorId]
  );

  // Generate fresh insights via edge function
  const generateInsights = useCallback(
    async (studentId: string): Promise<StudentInsightsResponse | null> => {
      if (!tutorId) {
        setError('No tutor ID provided');
        return null;
      }

      // Try cache first
      const cached = await getCachedInsights(studentId);
      if (cached) {
        return cached;
      }

      setIsGenerating(true);
      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Not authenticated');
        }

        const response = await supabase.functions.invoke(
          'generate-student-insights',
          {
            body: {
              student_id: studentId,
              tutor_id: tutorId,
            } as StudentInsightsRequest,
          }
        );

        if (response.error) {
          throw new Error(
            response.error.message || 'Failed to generate student insights'
          );
        }

        const result = response.data as StudentInsightsResponse;
        setInsights(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('Student insights generation error:', err);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [tutorId, getCachedInsights]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    insights,
    isGenerating,
    error,
    generateInsights,
    getCachedInsights,
    clearError,
    hasData: insights !== null,
  };
}
