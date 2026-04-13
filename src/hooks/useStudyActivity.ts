import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

export interface StudyActivityEntry {
  id: string;
  user_id: string;
  subject: string;
  activity_type: string; // task, quiz, revision, flashcard, exam_practice
  task_completed: boolean;
  score: number | null;
  topic: string | null;
  duration_minutes: number | null;
  metadata: Record<string, unknown>;
  date: string;
  created_at: string;
}

export interface WeeklySubjectSummary {
  subject: string;
  tasksCompleted: number;
  tasksMissed: number;
  avgScore: number;
  totalActivities: number;
  topicsCovered: string[];
}

export function useStudyActivity(userId?: string) {
  const [recentActivity, setRecentActivity] = useState<StudyActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch last 7 days of activity
  const fetchRecent = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data, error } = await supabase
        .from("study_activity")
        .select("*")
        .eq("user_id", userId)
        .gte("date", weekAgo.toISOString().split("T")[0])
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        logger.warn("[useStudyActivity] Fetch error (table may not exist):", error.message);
        return;
      }

      setRecentActivity((data || []) as unknown as StudyActivityEntry[]);
    } catch (err) {
      logger.error("[useStudyActivity] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  // Log a new activity entry
  const logActivity = useCallback(
    async (entry: {
      subject: string;
      activity_type?: string;
      task_completed?: boolean;
      score?: number | null;
      topic?: string | null;
      duration_minutes?: number | null;
      metadata?: Record<string, unknown>;
    }) => {
      if (!userId) return;
      try {
        const { error } = await supabase
          .from("study_activity")
          .insert([{
            user_id: userId,
            subject: entry.subject,
            activity_type: entry.activity_type || "task",
            task_completed: entry.task_completed ?? true,
            score: entry.score ?? null,
            topic: entry.topic ?? null,
            duration_minutes: entry.duration_minutes ?? null,
            metadata: entry.metadata ?? {},
            date: new Date().toISOString().split("T")[0],
          }]);

        if (error) {
          logger.warn("[useStudyActivity] Insert error:", error.message);
        } else {
          logger.info("[useStudyActivity] Logged:", entry.subject, entry.activity_type);
          // Refresh activity list
          fetchRecent();
        }
      } catch (err) {
        logger.error("[useStudyActivity] Log error:", err);
      }
    },
    [userId, fetchRecent]
  );

  // Get weekly summary per subject
  const getWeeklySummary = useCallback((): WeeklySubjectSummary[] => {
    const subjectMap: Record<string, {
      completed: number;
      missed: number;
      scores: number[];
      topics: Set<string>;
      total: number;
    }> = {};

    for (const entry of recentActivity) {
      if (!subjectMap[entry.subject]) {
        subjectMap[entry.subject] = {
          completed: 0,
          missed: 0,
          scores: [],
          topics: new Set(),
          total: 0,
        };
      }
      const s = subjectMap[entry.subject];
      s.total++;
      if (entry.task_completed) {
        s.completed++;
      } else {
        s.missed++;
      }
      if (entry.score !== null && entry.score !== undefined) {
        s.scores.push(entry.score);
      }
      if (entry.topic) {
        s.topics.add(entry.topic);
      }
    }

    return Object.entries(subjectMap).map(([subject, stats]) => ({
      subject,
      tasksCompleted: stats.completed,
      tasksMissed: stats.missed,
      avgScore: stats.scores.length > 0
        ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length)
        : 0,
      totalActivities: stats.total,
      topicsCovered: Array.from(stats.topics),
    }));
  }, [recentActivity]);

  // Get today's activity count for a subject
  const getTodayCount = useCallback(
    (subject: string): number => {
      const today = new Date().toISOString().split("T")[0];
      return recentActivity.filter(
        (a) => a.subject === subject && a.date === today
      ).length;
    },
    [recentActivity]
  );

  return {
    recentActivity,
    loading,
    logActivity,
    getWeeklySummary,
    getTodayCount,
    refetch: fetchRecent,
  };
}
