/**
 * useLearnerArtifacts — the Learning Filesystem read layer.
 *
 * Aggregates a learner's personal artifacts (homework submissions, lesson
 * notes, AI reinforcement sets) into one chronologically ordered list so the
 * UI can show "everything I've worked on" without each surface re-querying.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ArtifactKind = "homework_submission" | "lesson_notes" | "reinforcement_set";

export interface LearnerArtifact {
  id: string;
  kind: ArtifactKind;
  title: string;
  subtitle: string;
  occurred_at: string;
  route?: string;
  score_pct?: number | null;
}

interface Options {
  userId?: string | null;
  limit?: number;
  enabled?: boolean;
}

export function useLearnerArtifacts({ userId = null, limit = 30, enabled = true }: Options = {}) {
  return useQuery<LearnerArtifact[]>({
    queryKey: ["learner-artifacts", userId, limit],
    enabled: enabled && !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;

      const [hwRes, notesRes, reinfRes] = await Promise.all([
        sb
          .from("school_homework_responses")
          .select("id, homework_id, status, submitted_at, ai_score, school_homework:homework_id(title, subject_id)")
          .eq("student_id", userId)
          .not("submitted_at", "is", null)
          .order("submitted_at", { ascending: false })
          .limit(limit),
        sb
          .from("lesson_notes")
          .select("id, booking_id, summary, created_at, audience")
          .eq("owner_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit),
        sb
          .from("lesson_reinforcement_sets")
          .select("id, booking_id, completed_at, created_at, concepts")
          .eq("learner_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);

      const out: LearnerArtifact[] = [];

      for (const r of hwRes.data ?? []) {
        out.push({
          id: `hw-${r.id}`,
          kind: "homework_submission",
          title: r.school_homework?.title ?? "Homework",
          subtitle: r.status === "graded" ? "Graded" : "Submitted",
          occurred_at: r.submitted_at,
          route: `/learner?tab=homework&hw=${r.homework_id}`,
          score_pct: typeof r.ai_score === "number" ? Number(r.ai_score) : null,
        });
      }
      for (const n of notesRes.data ?? []) {
        out.push({
          id: `note-${n.id}`,
          kind: "lesson_notes",
          title: "Lesson notes",
          subtitle: (n.summary ?? "").slice(0, 80) || "Saved notes",
          occurred_at: n.created_at,
          route: n.booking_id ? `/learner?tab=activity&booking=${n.booking_id}` : undefined,
        });
      }
      for (const s of reinfRes.data ?? []) {
        const concepts = Array.isArray(s.concepts) ? s.concepts : [];
        out.push({
          id: `reinf-${s.id}`,
          kind: "reinforcement_set",
          title: "Lesson reinforcement",
          subtitle: concepts.length ? concepts.slice(0, 3).join(" • ") : "Quiz + flashcards",
          occurred_at: s.completed_at ?? s.created_at,
          route: s.booking_id ? `/lesson/${s.booking_id}/reinforce` : undefined,
        });
      }

      out.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
      return out.slice(0, limit);
    },
  });
}
