/**
 * useMockExamUnlock
 *
 * Calls check_mock_exam_unlock RPC for every paper blueprint the user has,
 * returns per-paper unlock progress for the gamified mock exam UI.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../integrations/supabase/client";
import { logger } from "@/utils/logger";

export interface MockExamUnlock {
  subjectId: string;
  subjectName: string;
  paperCode: string;
  unlocked: boolean;
  hasBlueprint: boolean;
  topicsTotal: number;
  topicsMastered: number;
  unmasteredTopics: { topic: string; mastery: number; weight: number }[];
  readinessPercent: number;
  masteryThreshold: number;
  readinessThreshold: number;
  totalMarks?: number | null;
  durationMinutes?: number | null;
}

export function useMockExamUnlock() {
  const [data, setData] = useState<MockExamUnlock[]>([]);
  const [isLoading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setData([]);
        return;
      }

      const { data: blueprints } = await supabase
        .from("paper_blueprints" as any)
        .select("subject_id, subject_name, paper_code")
        .eq("user_id", user.id);

      if (!blueprints) {
        setData([]);
        return;
      }

      const results: MockExamUnlock[] = [];
      for (const bp of blueprints as any[]) {
        try {
          const { data: r } = await supabase.rpc("check_mock_exam_unlock" as any, {
            p_subject_id: bp.subject_id,
            p_paper_code: bp.paper_code,
          });
          const p: any = r || {};
          results.push({
            subjectId: bp.subject_id,
            subjectName: bp.subject_name,
            paperCode: bp.paper_code,
            unlocked: !!p.unlocked,
            hasBlueprint: !!p.has_blueprint,
            topicsTotal: Number(p.topics_total || 0),
            topicsMastered: Number(p.topics_mastered || 0),
            unmasteredTopics: Array.isArray(p.unmastered_topics) ? p.unmastered_topics : [],
            readinessPercent: Number(p.readiness_percent || 0),
            masteryThreshold: Number(p.mastery_threshold || 80),
            readinessThreshold: Number(p.readiness_threshold || 75),
            totalMarks: p.total_marks ?? null,
            durationMinutes: p.duration_minutes ?? null,
          });
        } catch (e) {
          logger.warn("[useMockExamUnlock] RPC failed", bp.paper_code, e);
        }
      }
      setData(results);
    } catch (e) {
      logger.error("[useMockExamUnlock]", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { papers: data, isLoading, refresh };
}
