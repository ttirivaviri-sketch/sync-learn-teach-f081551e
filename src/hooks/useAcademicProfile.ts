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

        // ─── Strategy: try from safest to least safe ──────────────────────
        // 1. RPC v2 (7-param, supports emails + exam_dates) — works if migration applied
        // 2. RPC v1 (4-param, core fields only) — always existed
        // 3. Direct upsert of core-only columns — absolute fallback

        let saved = false;

        // --- Attempt 1: v2 RPC (full save, includes extended columns) ---
        try {
          const { error: rpcV2Error } = await supabase.rpc("upsert_academic_profile", {
            p_curriculum: data.curriculum ?? "ZIMSEC",
            p_grade: data.grade ?? "",
            p_subjects: data.subjects ?? [],
            p_exam_year: data.exam_year ?? null,
            p_student_email: data.student_email ?? null,
            p_guardian_email: data.guardian_email ?? null,
            p_exam_dates: JSON.stringify(examDatesJson),
          });

          if (!rpcV2Error) {
            console.log("[useAcademicProfile] Saved via RPC v2 (full)");
            saved = true;
          } else {
            console.warn("[useAcademicProfile] RPC v2 failed:", rpcV2Error.message);
          }
        } catch (rpcV2Err) {
          console.warn("[useAcademicProfile] RPC v2 exception:", rpcV2Err);
        }

        // --- Attempt 2: v1 RPC (core fields only, 4 params) ---
        if (!saved) {
          try {
            const { error: rpcV1Error } = await supabase.rpc("upsert_academic_profile", {
              p_curriculum: data.curriculum ?? "ZIMSEC",
              p_grade: data.grade ?? "",
              p_subjects: data.subjects ?? [],
              p_exam_year: data.exam_year ?? null,
            });

            if (!rpcV1Error) {
              console.log("[useAcademicProfile] Saved via RPC v1 (core only — run the migration to enable emails & exam dates)");
              saved = true;
            } else {
              console.warn("[useAcademicProfile] RPC v1 failed:", rpcV1Error.message);
            }
          } catch (rpcV1Err) {
            console.warn("[useAcademicProfile] RPC v1 exception:", rpcV1Err);
          }
        }

        // --- Attempt 3: direct upsert of core-only columns ---
        if (!saved) {
          const corePayload: Record<string, unknown> = {
            user_id: userId,
            curriculum: data.curriculum ?? "ZIMSEC",
            grade: data.grade ?? "",
            subjects: data.subjects ?? [],
            exam_year: data.exam_year ?? null,
            updated_at: new Date().toISOString(),
          };

          const { error: coreError } = await supabase
            .from("academic_profiles")
            .upsert(corePayload, { onConflict: "user_id" });

          if (coreError) {
            console.error("[useAcademicProfile] Direct upsert also failed:", coreError);
            throw coreError;
          }

          console.log("[useAcademicProfile] Saved via direct upsert (core only)");
          saved = true;
        }

        // If we used a fallback path (not v2 RPC), try adding extended data separately
        // so they persist when the migration IS applied later
        if (saved) {
          const hasExtended = data.student_email || data.guardian_email || examDatesJson.length > 0;
          if (hasExtended) {
            try {
              const extPayload: Record<string, unknown> = {
                user_id: userId,
                curriculum: data.curriculum ?? "ZIMSEC",
                grade: data.grade ?? "",
                subjects: data.subjects ?? [],
                exam_year: data.exam_year ?? null,
                updated_at: new Date().toISOString(),
              };
              if (data.student_email !== undefined) extPayload.student_email = data.student_email ?? null;
              if (data.guardian_email !== undefined) extPayload.guardian_email = data.guardian_email ?? null;
              if (examDatesJson.length > 0) extPayload.exam_dates = examDatesJson;

              await supabase
                .from("academic_profiles")
                .upsert(extPayload, { onConflict: "user_id" });
            } catch {
              // Extended columns missing — OK, core was already saved
            }
          }
        }

        // ── Sync subjects to learner_subjects & subjects tables ──────────
        if (data.subjects && data.subjects.length > 0) {
          for (const subjectName of data.subjects) {
            await supabase
              .from("learner_subjects")
              .upsert(
                { user_id: userId, subject: subjectName },
                { onConflict: "user_id,subject" }
              )
              .then(() => {});

            const { data: existing } = await supabase
              .from("subjects")
              .select("id")
              .eq("user_id", userId)
              .ilike("name", subjectName)
              .maybeSingle();

            if (!existing?.id) {
              await supabase.from("subjects").insert({
                user_id: userId,
                name: subjectName,
                syllabus_code: null,
                topics: [],
              });
            }
          }

          // Sync exam dates to subject_exams for Study Mode calendar
          if (examDatesJson.length > 0) {
            for (const examEntry of examDatesJson) {
              const { data: subjectRow } = await supabase
                .from("subjects")
                .select("id")
                .eq("user_id", userId)
                .ilike("name", examEntry.subject)
                .maybeSingle();

              if (subjectRow?.id) {
                const { data: existingExam } = await supabase
                  .from("subject_exams")
                  .select("id")
                  .eq("user_id", userId)
                  .eq("subject_id", subjectRow.id)
                  .maybeSingle();

                if (existingExam?.id) {
                  await supabase.from("subject_exams")
                    .update({ exam_date: examEntry.date, updated_at: new Date().toISOString() })
                    .eq("id", existingExam.id);
                } else {
                  await supabase.from("subject_exams")
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
