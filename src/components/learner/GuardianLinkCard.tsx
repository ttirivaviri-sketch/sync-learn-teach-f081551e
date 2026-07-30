/**
 * GuardianLinkCard — learner-side control panel for the parent portal.
 *
 * The learner stays in control: they generate a short invite code, share it
 * with a parent/guardian, and can revoke access at any time. Guardians who
 * redeem the code get READ-ONLY visibility via get_guardian_learner_overview.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, HeartHandshake, Loader2, Plus, ShieldOff } from "lucide-react";

interface GuardianLink {
  id: string;
  guardian_label: string | null;
  invite_code: string;
  status: "invited" | "active" | "revoked";
  accepted_at: string | null;
}

export function GuardianLinkCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: links } = useQuery({
    queryKey: ["guardian-links", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guardian_links")
        .select("id,guardian_label,invite_code,status,accepted_at")
        .eq("learner_user_id", userId)
        .neq("status", "revoked")
        .order("created_at", { ascending: false });
      if (error) return [] as GuardianLink[];
      return (data ?? []) as GuardianLink[];
    },
  });

  const createInvite = async () => {
    setCreating(true);
    try {
      const { error } = await supabase
        .from("guardian_links")
        .insert({ learner_user_id: userId });
      if (error) throw error;
      toast.success("Invite code created — share it with your parent/guardian");
      qc.invalidateQueries({ queryKey: ["guardian-links", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create invite");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    const { error } = await supabase
      .from("guardian_links")
      .update({ status: "revoked" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Access revoked");
    qc.invalidateQueries({ queryKey: ["guardian-links", userId] });
  };

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code).then(
      () => toast.success("Code copied"),
      () => toast.error("Couldn't copy — long-press to select it"),
    );
  };

  return (
    <Card className="border-rose-500/25 bg-rose-500/[0.04]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0">
            <HeartHandshake className="h-5 w-5 text-rose-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">Parent / guardian access</p>
            <p className="text-xs text-muted-foreground">
              Share a code so a parent can follow your progress — read-only, and you
              can revoke it anytime.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={createInvite} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">Invite</span>
          </Button>
        </div>

        {(links ?? []).length > 0 && (
          <div className="space-y-2">
            {(links ?? []).map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {l.status === "invited" ? (
                    <>
                      <code className="font-mono text-sm font-semibold tracking-widest">
                        {l.invite_code}
                      </code>
                      <Badge variant="secondary" className="text-[10px]">awaiting parent</Badge>
                    </>
                  ) : (
                    <>
                      <span className="text-sm truncate">
                        {l.guardian_label || "Guardian"} linked
                      </span>
                      <Badge className="text-[10px] bg-emerald-600 text-white border-0">active</Badge>
                    </>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {l.status === "invited" && (
                    <Button size="sm" variant="ghost" onClick={() => copy(l.invite_code)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => revoke(l.id)} title="Revoke">
                    <ShieldOff className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
