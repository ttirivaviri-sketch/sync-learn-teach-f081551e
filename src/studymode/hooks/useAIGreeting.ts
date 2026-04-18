import { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useUserProgress } from './useUserProgress';
import { useExamSettings } from './useExamSettings';
import { aiRequest } from '../lib/aiClient';

// Primary: Supabase Edge Function "ai-greeting"; fallback: local /api/ai/greeting proxy
const GREETING_ENDPOINT = 'greeting';

const CACHE_KEY = 'ss_ai_greeting_v1';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h

export function useAIGreeting() {
  const [greeting, setGreeting] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const { progress, dailyStats } = useUserProgress();
  const { settings: examSettings, getDaysUntilExam } = useExamSettings();

  useEffect(() => {
    const hour = new Date().getHours();

    // 1. Try cache first — avoids a network call on every dashboard mount.
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { greeting: string; ts: number; hour: number };
        const fresh = Date.now() - parsed.ts < CACHE_TTL_MS;
        const sameHourBucket = Math.floor(parsed.hour / 6) === Math.floor(hour / 6);
        if (fresh && sameHourBucket && parsed.greeting) {
          setGreeting(parsed.greeting);
          setIsLoading(false);
          return;
        }
      }
    } catch {
      /* ignore cache errors */
    }

    let cancelled = false;

    const fetchGreeting = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const studentName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';

        const daysUntilExam = getDaysUntilExam();

        const resp = await aiRequest(GREETING_ENDPOINT, {
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
        });

        if (cancelled) return;

        if (!resp.ok) {
          setGreeting(getFallbackGreeting(hour, studentName));
          return;
        }

        const data = await resp.json();
        const next = (data?.fallback || !data?.greeting)
          ? getFallbackGreeting(hour, studentName)
          : data.greeting as string;
        setGreeting(next);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ greeting: next, ts: Date.now(), hour }));
        } catch { /* ignore */ }
      } catch {
        if (!cancelled) setGreeting(getFallbackGreeting(hour, ''));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    // Defer the network call so it doesn't compete with first paint.
    const timer = setTimeout(fetchGreeting, 1200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [progress?.streak, dailyStats.tasksCompletedToday, examSettings?.exam_name]);

  return { greeting, isLoading };
}

function getFallbackGreeting(hour: number, name: string): string {
  const prefix = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const nameStr = name ? ` ${name}` : '';
  return `${prefix}${nameStr}! Ready to study?`;
}
