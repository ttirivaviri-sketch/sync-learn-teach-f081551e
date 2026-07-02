/**
 * GuardianWorkspaceCard — shows guardians a link to their learner overview.
 * Adapted from the iScanner bundle: the project has no dedicated guardian
 * table yet, so this component detects guardianship by looking for a
 * school_membership row with role `guardian` (reserved for future use) and
 * renders null otherwise. Safe to mount anywhere; no visual noise for
 * non-guardians.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeartHandshake } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function GuardianWorkspaceCard({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["guardian-membership", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_memberships" as any)
        .select("id, school_id")
        .eq("user_id", userId)
        .eq("role", "guardian")
        .eq("status", "active")
        .limit(1);
      if (error) return [];
      return (data ?? []) as any[];
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <Card className="border-rose-500/25 bg-rose-500/[0.04]">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0">
          <HeartHandshake className="h-5 w-5 text-rose-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">Guardian view</p>
            <Badge variant="secondary" className="text-[10px]">Coming soon</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            You'll be able to follow your learner's mastery, homework and alerts here.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
