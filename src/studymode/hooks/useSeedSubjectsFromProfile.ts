import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * On first StudyMode entry, ensure the learner has a `subjects` row per
 * academic_profile.subject with topics copied from `curriculum_topic_templates`.
 * If a template is missing, lazily call `seed-curriculum-topics` for that combo.
 * Idempotent — only fills missing/empty topic trees.
 */
export function useSeedSubjectsFromProfile() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("academic_profiles")
          .select("curriculum, grade, subjects")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!profile?.curriculum || !profile?.grade || !profile?.subjects?.length) return;

        const { data: existing } = await supabase
          .from("subjects")
          .select("id, name, topics")
          .eq("user_id", user.id);
        const existingMap = new Map((existing ?? []).map((s: any) => [s.name, s]));

        for (const subjectName of profile.subjects) {
          const current = existingMap.get(subjectName);
          const hasTopics = Array.isArray(current?.topics) && current.topics.length > 0;
          if (hasTopics) continue;

          // 1. Try template
          let { data: tpl } = await supabase
            .from("curriculum_topic_templates")
            .select("topics")
            .eq("curriculum", profile.curriculum)
            .eq("grade", profile.grade)
            .eq("subject", subjectName)
            .maybeSingle();

          // 2. Lazy seed if missing
          if (!tpl?.topics) {
            try {
              await supabase.functions.invoke("seed-curriculum-topics", {
                body: { curriculum: profile.curriculum, grade: profile.grade, subject: subjectName },
              });
              const r = await supabase
                .from("curriculum_topic_templates")
                .select("topics")
                .eq("curriculum", profile.curriculum)
                .eq("grade", profile.grade)
                .eq("subject", subjectName)
                .maybeSingle();
              tpl = r.data as any;
            } catch (e) {
              console.warn("lazy seed failed", subjectName, e);
              continue;
            }
          }
          if (!tpl?.topics) continue;

          // 3. Upsert into user subjects
          if (current) {
            await supabase.from("subjects")
              .update({ topics: tpl.topics })
              .eq("id", current.id);
          } else {
            await supabase.from("subjects").insert({
              user_id: user.id,
              name: subjectName,
              topics: tpl.topics,
            });
          }
        }
      } catch (e) {
        console.warn("useSeedSubjectsFromProfile error", e);
      }
    })();
  }, []);
}
