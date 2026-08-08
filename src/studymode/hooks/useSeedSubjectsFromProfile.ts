import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { templateSubjectCandidates } from "@/lib/subjectAliases";

/**
 * Keeps StudyMode subjects in sync with the learner's academic profile.
 *
 * Ensures the learner has a `subjects` row per academic_profile.subject with
 * topics copied from `curriculum_topic_templates`. If a template is missing, it
 * lazily calls `seed-curriculum-topics` for that combo.
 *
 * Re-runs whenever the profile's curriculum / grade / subject list changes
 * (not just once per mount), and invalidates the `subjects` query afterwards so
 * the dashboard updates without a manual reload.
 */
export function useSeedSubjectsFromProfile() {
  const queryClient = useQueryClient();
  const doneSignatures = useRef<Set<string>>(new Set());
  const [signature, setSignature] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    curriculum: string;
    grade: string;
    subjects: string[];
  } | null>(null);

  // 1. Watch the academic profile (initial load + realtime updates).
  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;

      const fetchProfile = async () => {
        const { data } = await supabase
          .from("academic_profiles")
          .select("curriculum, grade, subjects")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!active) return;
        if (!data?.curriculum || !data?.grade || !data?.subjects?.length) {
          setProfile(null);
          setSignature(null);
          return;
        }
        const next = {
          curriculum: data.curriculum,
          grade: data.grade,
          subjects: data.subjects as string[],
        };
        setProfile(next);
        setSignature(
          `${next.curriculum}|${next.grade}|${[...next.subjects].sort().join(",")}`
        );
      };

      await fetchProfile();

      channel = supabase
        .channel(`academic-profile-sync-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "academic_profiles",
            filter: `user_id=eq.${user.id}`,
          },
          () => { void fetchProfile(); }
        )
        .subscribe();
    };

    void load();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // 2. Seed topics for any subject that is missing them.
  useEffect(() => {
    if (!profile || !signature) return;
    if (doneSignatures.current.has(signature)) return;
    doneSignatures.current.add(signature);

    let cancelled = false;

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: existing } = await supabase
          .from("subjects")
          .select("id, name, topics")
          .eq("user_id", user.id);
        const existingMap = new Map((existing ?? []).map((s: any) => [s.name, s]));

        let changed = false;

        for (const subjectName of profile.subjects) {
          if (cancelled) return;
          const current = existingMap.get(subjectName);
          const hasTopics = Array.isArray(current?.topics) && current.topics.length > 0;
          if (hasTopics) continue;

          // 1. Try template — exact name first, then curriculum-specific aliases.
          const candidates = templateSubjectCandidates(profile.curriculum, subjectName);
          let tpl: { topics: unknown } | null = null;
          for (const candidate of candidates) {
            const { data } = await supabase
              .from("curriculum_topic_templates")
              .select("topics")
              .eq("curriculum", profile.curriculum)
              .eq("grade", profile.grade)
              .eq("subject", candidate)
              .maybeSingle();
            if (data?.topics && Array.isArray(data.topics) && data.topics.length > 0) {
              tpl = data as any;
              break;
            }
          }

          // 2. Lazy seed if missing (exact name only — the seeder owns naming)
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

          // 3. Upsert into user subjects (create the row even without topics so
          //    the subject appears in StudyMode immediately).
          const topics = (tpl?.topics as any) ?? [];
          if (current) {
            if (Array.isArray(topics) && topics.length > 0) {
              await supabase.from("subjects").update({ topics }).eq("id", current.id);
              changed = true;
            }
          } else {
            await supabase.from("subjects").insert({
              user_id: user.id,
              name: subjectName,
              topics,
            });
            changed = true;
          }
        }

        if (changed && !cancelled) {
          await queryClient.invalidateQueries({ queryKey: ["subjects"] });
        }
      } catch (e) {
        console.warn("useSeedSubjectsFromProfile error", e);
      }
    })();

    return () => { cancelled = true; };
  }, [profile, signature, queryClient]);
}
