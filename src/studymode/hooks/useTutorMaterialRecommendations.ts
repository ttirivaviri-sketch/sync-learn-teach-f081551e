/**
 * useTutorMaterialRecommendations — surfaces published tutor tutorials whose
 * curriculum + subject match the student's school context. Read-only.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TutorMaterial {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  topic: string | null;
  thumbnail_url: string | null;
  duration_label: string | null;
  tutor_full_name: string | null;
}

export function useTutorMaterialRecommendations(args: {
  curriculum: string | null;
  subjects: string[];
}) {
  const { curriculum, subjects } = args;
  return useQuery<TutorMaterial[]>({
    queryKey: ["tutor-material-recs", curriculum, subjects.join(",")],
    enabled: !!curriculum && subjects.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_tutorials")
        .select("id,title,description,subject,topic,thumbnail_url,duration_label,tutor_id,curriculum,status")
        .eq("status", "published")
        .eq("curriculum", curriculum!)
        .in("subject", subjects)
        .limit(12);
      if (error) return [];
      const list = (data ?? []) as any[];
      const tutorIds = Array.from(new Set(list.map((r) => r.tutor_id).filter(Boolean)));
      let names = new Map<string, string>();
      if (tutorIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", tutorIds);
        names = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return list.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        subject: r.subject,
        topic: r.topic,
        thumbnail_url: r.thumbnail_url,
        duration_label: r.duration_label,
        tutor_full_name: names.get(r.tutor_id) ?? null,
      }));
    },
  });
}
