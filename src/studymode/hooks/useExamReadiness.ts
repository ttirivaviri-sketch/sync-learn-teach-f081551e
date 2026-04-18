/**
 * useExamReadiness
 *
 * Calls the get_exam_readiness RPC for each (subject, paper_code) combination
 * the user has a blueprint for. Returns per-paper readiness scores derived from
 * paper_blueprints + topic_mastery + quiz_attempts.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../integrations/supabase/client";
import { logger } from "@/utils/logger";

export interface PaperReadiness {
  subjectId: string;
  subjectName: string;
  paperCode: string;
  readinessPercent: number;
  confidenceBand: "ready" | "building" | "low" | "unknown";
  weakestTopics: { topic: string; mastery: number; weight: number }[];
  weakestQuestionTypes: { question_type: string; accuracy: number; paper_share: number }[];
  totalMarks?: number | null;
  durationMinutes?: number | null;
  yearsAnalysed?: string[];
}

export function useExamReadiness() {
  const [data, setData] = useState<PaperReadiness[]>([]);
  const [isLoading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setData([]);
        return;
      }

      const { data: blueprints, error } = await supabase
        .from("paper_blueprints" as any)
        .select("subject_id, subject_name, paper_code")
        .eq("user_id", user.id);

      if (error || !blueprints) {
        setData([]);
        return;
      }

      const results: PaperReadiness[] = [];
      for (const bp of blueprints as any[]) {
        try {
          const { data: r } = await supabase.rpc("get_exam_readiness" as any, {
            p_subject_id: bp.subject_id,
            p_paper_code: bp.paper_code,
          });
          const payload: any = r || {};
          results.push({
            subjectId: bp.subject_id,
            subjectName: bp.subject_name,
            paperCode: bp.paper_code,
            readinessPercent: Number(payload.readiness_percent || 0),
            confidenceBand: (payload.confidence_band || "unknown") as any,
            weakestTopics: Array.isArray(payload.weakest_topics) ? payload.weakest_topics : [],
            weakestQuestionTypes: Array.isArray(payload.weakest_question_types)
              ? payload.weakest_question_types
              : [],
            totalMarks: payload.total_marks ?? null,
            durationMinutes: payload.duration_minutes ?? null,
            yearsAnalysed: Array.isArray(payload.years_analysed) ? payload.years_analysed : [],
          });
        } catch (e) {
          logger.warn("[useExamReadiness] RPC failed for", bp.paper_code, e);
        }
      }
      setData(results);
    } catch (e) {
      logger.error("[useExamReadiness]", e);
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
