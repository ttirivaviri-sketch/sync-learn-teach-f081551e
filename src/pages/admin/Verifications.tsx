/**
 * Admin Verifications — review tutor onboarding submissions.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, FileText, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Status = "pending" | "approved" | "rejected";

interface Row {
  id: string;
  user_id: string;
  id_number: string | null;
  id_document_url: string | null;
  profile_photo_url: string | null;
  transcript_url: string | null;
  qualification_url: string | null;
  student_status: string | null;
  verification_status: string;
  rejection_reason: string | null;
  submitted_at: string | null;
  created_at: string;
  profile?: { full_name: string | null; email: string | null };
}

export default function AdminVerifications() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status>("pending");
  const [reviewing, setReviewing] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["admin-verifications", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_verifications")
        .select("*, profile:profiles!tutor_verifications_user_id_fkey(full_name,email)")
        .eq("verification_status", tab)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        // fallback if FK relation alias not present
        const { data: d2 } = await supabase
          .from("tutor_verifications")
          .select("*")
          .eq("verification_status", tab)
          .order("created_at", { ascending: false })
          .limit(100);
        return (d2 ?? []) as Row[];
      }
      return (data ?? []) as Row[];
    },
  });

  const sign = async (path: string | null, bucket: string) => {
    if (!path) return null;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 30);
    return data?.signedUrl ?? null;
  };

  const decide = async (row: Row, decision: "approved" | "rejected") => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("tutor_verifications")
        .update({
          verification_status: decision,
          rejection_reason: decision === "rejected" ? (reason || "Documents do not meet our requirements.") : null,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", row.id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: row.user_id,
        title: decision === "approved" ? "You're verified! 🎉" : "Verification needs attention",
        message: decision === "approved"
          ? "Your tutor account has been approved. You can now start teaching."
          : `Your application was not approved: ${reason || "Please re-upload your documents."}`,
        type: decision === "approved" ? "success" : "warning",
      });

      toast({ title: `Tutor ${decision}` });
      setReviewing(null); setReason("");
      qc.invalidateQueries({ queryKey: ["admin-verifications"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Tutor verifications</h1>
      <p className="text-sm text-muted-foreground mb-4">Review and approve tutor onboarding applications.</p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {q.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (q.data ?? []).length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">No {tab} applications.</Card>
          ) : (
            <div className="grid gap-3">
              {q.data!.map((r) => (
                <Card key={r.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{r.profile?.full_name || r.profile?.email || r.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.student_status === "current_student" ? "Current student" : r.student_status === "graduate" ? "Graduate" : "—"}
                      {" · "}Submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.verification_status === "pending" && <Badge variant="secondary">Pending</Badge>}
                    {r.verification_status === "approved" && <Badge className="bg-emerald-600">Approved</Badge>}
                    {r.verification_status === "rejected" && <Badge variant="destructive">Rejected</Badge>}
                    <Button size="sm" variant="outline" onClick={() => setReviewing(r)}><Eye className="h-3.5 w-3.5 mr-1" />Review</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewing} onOpenChange={(o) => { if (!o) { setReviewing(null); setReason(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review application</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-3 text-sm">
              <Field label="Name" value={reviewing.profile?.full_name || "—"} />
              <Field label="Email" value={reviewing.profile?.email || "—"} />
              <Field label="ID number" value={reviewing.id_number || "—"} />
              <Field label="Status" value={reviewing.student_status || "—"} />
              <div className="flex flex-wrap gap-2 pt-1">
                <DocLink path={reviewing.id_document_url} bucket="tutor-documents" label="ID document" />
                <DocLink path={reviewing.profile_photo_url} bucket="profile-photos" label="Photo" />
                <DocLink path={reviewing.transcript_url} bucket="tutor-documents" label="Transcript" />
                <DocLink path={reviewing.qualification_url} bucket="tutor-documents" label="Qualification" />
              </div>
              {reviewing.verification_status === "pending" && (
                <>
                  <Textarea placeholder="Rejection reason (required for reject)" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
                  <DialogFooter>
                    <Button variant="destructive" disabled={busy || !reason.trim()} onClick={() => decide(reviewing, "rejected")}><X className="h-4 w-4 mr-1" />Reject</Button>
                    <Button disabled={busy} onClick={() => decide(reviewing, "approved")}><Check className="h-4 w-4 mr-1" />Approve</Button>
                  </DialogFooter>
                </>
              )}
              {reviewing.verification_status === "rejected" && reviewing.rejection_reason && (
                <div className="text-xs p-2 rounded bg-destructive/5 border border-destructive/20"><strong>Reason:</strong> {reviewing.rejection_reason}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-border/50">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function DocLink({ path, bucket, label }: { path: string | null; bucket: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  if (!path) return null;
  return (
    <Button variant="outline" size="sm" onClick={async () => {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 30);
      const u = data?.signedUrl;
      if (u) { setUrl(u); window.open(u, "_blank"); }
    }}>
      <FileText className="h-3.5 w-3.5 mr-1" />{label}
    </Button>
  );
}
