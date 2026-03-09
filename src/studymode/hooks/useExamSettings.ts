import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';

export interface ExamSettings {
  id: string;
  user_id: string;
  exam_name: string;
  exam_date: string;
  created_at: string;
  updated_at: string;
}

export function useExamSettings() {
  const [settings, setSettings] = useState<ExamSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch exam settings
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('exam_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      setSettings(data as ExamSettings | null);
    } catch (err) {
      console.error('Error fetching exam settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save or update exam settings
  const saveSettings = useCallback(async (examName: string, examDate: Date) => {
    setIsSaving(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const examDateStr = examDate.toISOString().split('T')[0];

      if (settings) {
        // Update existing
        const { data, error: updateError } = await supabase
          .from('exam_settings')
          .update({
            exam_name: examName.trim(),
            exam_date: examDateStr,
          })
          .eq('id', settings.id)
          .select()
          .single();

        if (updateError) throw updateError;
        setSettings(data as ExamSettings);
      } else {
        // Insert new
        const { data, error: insertError } = await supabase
          .from('exam_settings')
          .insert({
            user_id: session.user.id,
            exam_name: examName.trim(),
            exam_date: examDateStr,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(data as ExamSettings);
      }

      return true;
    } catch (err) {
      console.error('Error saving exam settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  // Get exam date as Date object
  const getExamDate = useCallback((): Date => {
    if (settings?.exam_date) {
      return new Date(settings.exam_date);
    }
    // Default to 45 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 45);
    return defaultDate;
  }, [settings]);

  // Get days until exam
  const getDaysUntilExam = useCallback((): number => {
    const examDate = getExamDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    examDate.setHours(0, 0, 0, 0);
    const diffTime = examDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [getExamDate]);

  // Load on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    isLoading,
    isSaving,
    error,
    saveSettings,
    getExamDate,
    getDaysUntilExam,
    refetch: fetchSettings,
  };
}
