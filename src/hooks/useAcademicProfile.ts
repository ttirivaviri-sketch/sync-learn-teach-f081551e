import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AcademicProfile, SubjectExamDate } from "@/types/academicProfile";

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
        console.error("[useAcademicProfile] Error loading profile:", error);
      }

      if (data) {
        // Parse exam_dates from JSONB if it's a string
        const rawProfile = data as unknown as AcademicProfile;
        if (typeof rawProfile.exam_dates === 'string') {
          try {
            rawProfile.exam_dates = JSON.parse(rawProfile.exam_dates as unknown as string);
          } catch {
            rawProfile.exam_dates = [];
          }
        }
        setProfile(rawProfile);
        console.log("[useAcademicProfile] Profile loaded successfully:", {
          curriculum: rawProfile.curriculum,
          grade: rawProfile.grade,
          subjects: rawProfile.subjects?.length,
          exam_dates: rawProfile.exam_dates?.length,
          has_student_email: !!rawProfile.student_email,
          has_guardian_email: !!rawProfile.guardian_email,
        });
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("[useAcademicProfile] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const saveProfile = useCallback(
    async (data: Partial<AcademicProfile>): Promise<boolean> => {
      if (!userId) {
        console.error("[useAcademicProfile] Cannot save: no userId");
        return false;
      }
      setSaving(true);
      try {
        // Build exam_dates JSONB from the data
        const examDatesJson: SubjectExamDate[] = data.exam_dates || [];

        console.log("[useAcademicProfile] Saving profile:", {
          curriculum: data.curriculum,
          grade: data.grade,
          subjects: data.subjects?.length,
          exam_year: data.exam_year,
          exam_dates: examDatesJson.length,
          has_student_email: !!data.student_email,
          has_guardian_email: !!data.guardian_email,
        });

        // Call the updated RPC with new fields
        const { error: rpcError } = await supabase.rpc("upsert_academic_profile" as any, {
          p_curriculum: data.curriculum ?? "ZIMSEC",
          p_grade: data.grade ?? "",
          p_subjects: data.subjects ?? [],
          p_exam_year: data.exam_year ?? null,
          p_student_email: data.student_email ?? null,
          p_guardian_email: data.guardian_email ?? null,
          p_exam_dates: JSON.stringify(examDatesJson),
        });

        if (rpcError) {
          console.error("[useAcademicProfile] RPC error:", rpcError);
          // Fallback: try direct upsert if RPC signature mismatch (migration not yet applied)
          const { error: directError } = await supabase
            .from("academic_profiles")
            .upsert(
              {
                user_id: userId,
                curriculum: data.curriculum ?? "ZIMSEC",
                grade: data.grade ?? "",
                subjects: data.subjects ?? [],
                exam_year: data.exam_year ?? null,
                student_email: data.student_email ?? null,
                guardian_email: data.guardian_email ?? null,
                exam_dates: examDatesJson as any,
                updated_at: new Date().toISOString(),
              } as any,
              { onConflict: "user_id" }
            );

          if (directError) {
            console.error("[useAcademicProfile] Direct upsert error:", directError);
            throw directError;
          }
        }

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

          // Also sync exam dates to subject_exams table for Study Mode calendar
          if (examDatesJson.length > 0) {
            for (const examEntry of examDatesJson) {
              // Find the subject_id
              const { data: subjectRow } = await supabase
                .from("subjects")
                .select("id")
                .eq("user_id", userId)
                .ilike("name", examEntry.subject)
                .maybeSingle();

              if (subjectRow?.id) {
                // Check if exam already exists for this subject
                const { data: existingExam } = await (supabase
                  .from("subject_exams") as any)
                  .select("id")
                  .eq("user_id", userId)
                  .eq("subject_id", subjectRow.id)
                  .maybeSingle();

                if (existingExam?.id) {
                  // Update existing exam date
                  await (supabase
                    .from("subject_exams") as any)
                    .update({
                      exam_date: examEntry.date,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", existingExam.id);
                } else {
                  // Insert new exam record
                  await (supabase
                    .from("subject_exams") as any)
                    .insert({
                      user_id: userId,
                      subject_id: subjectRow.id,
                      subject_name: examEntry.subject,
                      exam_name: `${examEntry.subject} Exam`,
                      exam_date: examEntry.date,
                    });
                }

                console.log(`[useAcademicProfile] Synced exam date for ${examEntry.subject}: ${examEntry.date}`);
              }
            }
          }
        }

        await fetchProfile();
        console.log("[useAcademicProfile] Profile saved successfully");
        return true;
      } catch (err) {
        console.error("[useAcademicProfile] Save error:", err);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [userId, fetchProfile]
  );

  return { profile, loading, saving, saveProfile, refetch: fetchProfile };
}
