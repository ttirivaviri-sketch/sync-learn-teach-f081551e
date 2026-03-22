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
    async (
      data: Omit<AcademicProfile, "id" | "user_id" | "created_at" | "updated_at">
    ): Promise<boolean> => {
      if (!userId) return false;
      setSaving(true);
      try {
        const payload = {
          user_id: userId,
          curriculum: data.curriculum,
          grade: data.grade,
          subjects: data.subjects,
          exam_year: data.exam_year ?? null,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("academic_profiles")
          .upsert(
            {
              ...payload,
              created_at: profile?.created_at ?? new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
        if (error) throw error;

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
