import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TutorGateStatus =
  | "loading"
  | "not_submitted"   // no docs yet → onboarding wizard
  | "incomplete"      // docs ok but teaching profile not finished
  | "pending"         // submitted, waiting on admin
  | "rejected"        // admin rejected
  | "verified";       // ✅ full app

export interface TutorGateResult {
  status: TutorGateStatus;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  refetch: () => void;
}

export function useTutorVerificationGate(userId?: string): TutorGateResult {
  const q = useQuery({
    queryKey: ["tutor-verification-gate", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [verRes, profRes] = await Promise.all([
        supabase
          .from("tutor_verifications")
          .select("verification_status, rejection_reason, submitted_at, created_at")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("tutor_teaching_profile")
          .select("onboarding_completed_at")
          .eq("user_id", userId!)
          .maybeSingle(),
      ]);

      const v = verRes.data;
      const p = profRes.data;

      let status: TutorGateStatus = "not_submitted";
      if (!v) status = "not_submitted";
      else if (v.verification_status === "rejected") status = "rejected";
      else if (v.verification_status === "approved") {
        status = p?.onboarding_completed_at ? "verified" : "incomplete";
      } else status = "pending"; // pending or any unknown non-final

      return {
        status,
        rejectionReason: v?.rejection_reason ?? null,
        submittedAt: v?.submitted_at ?? v?.created_at ?? null,
      };
    },
    staleTime: 30_000,
  });

  return {
    status: q.isLoading ? "loading" : q.data?.status ?? "not_submitted",
    rejectionReason: q.data?.rejectionReason ?? null,
    submittedAt: q.data?.submittedAt ?? null,
    refetch: () => q.refetch(),
  };
}
