import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AcademicProfile } from "@/types/academicProfile";

interface UseAcademicProfileReturn {
  profile: AcademicProfile | null;
  loading: boolean;
  saving: boolean;
  saveProfile: (data: Partial<AcademicProfile>) => Promise<boolean>;
  refetch: () => void;
}

export function useAcademicProfile(userId?: string): UseAcademicProfileReturn {
  const [profile, setProfile] = useState<AcademicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("academic_profiles")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading academic profile:", error);
      }
      setProfile((data as unknown as AcademicProfile | null) ?? null);
    } catch (err) {
      console.error("Academic profile fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const saveProfile = useCallback(
    async (data: Partial<AcademicProfile>): Promise<boolean> => {
      if (!userId) return false;
      setSaving(true);
      try {
        const { error } = await supabase.rpc("upsert_academic_profile", {
          p_curriculum: data.curriculum ?? "ZIMSEC",
          p_grade: data.grade ?? "",
          p_subjects: data.subjects ?? [],
          p_exam_year: data.exam_year ?? undefined,
        });
        if (error) throw error;

        // Sync subjects to learner_subjects and subjects tables for Study Mode integration
        if (data.subjects && data.subjects.length > 0) {
          for (const subjectName of data.subjects) {
            // Sync to learner_subjects (for tutor booking visibility)
            await supabase
              .from("learner_subjects")
              .upsert(
                { user_id: userId, subject: subjectName },
                { onConflict: "user_id,subject" }
              )
              .then(() => {});

            // Sync to subjects table (for Study Mode) - only create if doesn't exist
            const { data: existing } = await supabase
              .from("subjects")
              .select("id")
              .eq("user_id", userId)
              .ilike("name", subjectName)
              .maybeSingle();

            if (!existing?.id) {
              await (supabase.from("subjects") as any).insert({
                user_id: userId,
                name: subjectName,
                syllabus_code: null,
                topics: [],
              });
            }
          }
        }

        await fetchProfile();
        return true;
      } catch (err) {
        console.error("Save academic profile error:", err);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [userId, fetchProfile]
  );

  return { profile, loading, saving, saveProfile, refetch: fetchProfile };
}
