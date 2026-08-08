import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/utils/logger";
import { format } from "date-fns";
import { Loader2, ExternalLink } from "lucide-react";
import { METHOD_LABELS } from "@/lib/manualPayment";

interface Row {
  id: string;
  user_id: string;
  method: "deposit" | "eft" | "ecocash";
  reference: string;
  amount: number;
  currency: string;
  proof_path: string | null;
  access_days: number;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const STATUS_VARIANT: Record<Row["status"], "secondary" | "default" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

const AdminManualDepositsPanel = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [statusFilter, setStatusFilter] = useState<Row["status"] | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      let q = (supabase as any)
        .from("manual_payment_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      const list = (data ?? []) as Row[];
      setRows(list);

      const ids = [...new Set(list.map((r) => r.user_id))];
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        const map: Record<string, { full_name: string | null; email: string | null }> = {};
        (profs ?? []).forEach((p: any) => { map[p.id] = { full_name: p.full_name, email: p.email }; });
        setProfiles(map);
      }
    } catch (e) {
      logger.error("Failed to load manual payment requests", e as Error);
      toast({ title: "Could not load deposits", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter]);

  const review = async (row: Row, status: "approved" | "rejected") => {
    setBusyId(row.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("manual_payment_requests")
        .update({
          status,
          review_note: notes[row.id]?.trim() || null,
          reviewed_by: user?.id ?? null,
        })
        .eq("id", row.id);
      if (error) throw error;
      toast({
        title: status === "approved" ? "Payment confirmed" : "Payment rejected",
        description: status === "approved" ? `Study Mode unlocked for ${row.access_days} days.` : "Learner has been notified.",
      });
      load();
    } catch (e) {
      logger.error("Review failed", e as Error);
      toast({ title: "Review failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const openProof = async (path: string) => {
    const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast({ title: "Could not open proof", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Manual deposits (EFT / cash / EcoCash)</CardTitle>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {!loading && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No {statusFilter === "all" ? "" : statusFilter} deposits.</p>
        )}
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {profiles[row.user_id]?.full_name || profiles[row.user_id]?.email || row.user_id.slice(0, 8)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {METHOD_LABELS[row.method]} · ref {row.reference} · {format(new Date(row.created_at), "d MMM yyyy HH:mm")}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{row.currency} {Number(row.amount).toFixed(2)}</p>
                <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {row.proof_path && (
                <Button size="sm" variant="outline" onClick={() => openProof(row.proof_path!)}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View proof
                </Button>
              )}
              {row.status === "pending" && (
                <>
                  <Input
                    className="h-9 max-w-xs"
                    placeholder="Note (shown to learner if rejected)"
                    value={notes[row.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [row.id]: e.target.value }))}
                  />
                  <Button size="sm" disabled={busyId === row.id} onClick={() => review(row, "approved")}>
                    Approve ({row.access_days}d)
                  </Button>
                  <Button size="sm" variant="destructive" disabled={busyId === row.id} onClick={() => review(row, "rejected")}>
                    Reject
                  </Button>
                </>
              )}
              {row.status !== "pending" && row.review_note && (
                <p className="text-xs text-muted-foreground">Note: {row.review_note}</p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AdminManualDepositsPanel;
