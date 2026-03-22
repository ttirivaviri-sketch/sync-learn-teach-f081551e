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
        const payload: Record<string, unknown> = {
          user_id: userId,
          updated_at: new Date().toISOString(),
        };
        if (data.curriculum !== undefined) payload.curriculum = data.curriculum;
        if (data.grade !== undefined) payload.grade = data.grade;
        if (data.study_level !== undefined) payload.study_level = data.study_level;
        if (data.subjects !== undefined) payload.subjects = data.subjects;
        if (data.exam_board !== undefined) payload.exam_board = data.exam_board;
        if (data.school_name !== undefined) payload.school_name = data.school_name;
        if (data.target_grade !== undefined) payload.target_grade = data.target_grade;

        const { error } = await supabase
          .from("academic_profiles")
          .upsert(payload as any, { onConflict: "user_id" });
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
