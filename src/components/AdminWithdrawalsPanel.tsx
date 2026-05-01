/**
 * AdminWithdrawalsPanel — Admin review queue for tutor withdrawal requests.
 *
 * Allows approve / mark-paid / reject via the resolve_payout_request RPC.
 */
import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Loader2, CheckCircle2, XCircle, Banknote, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/utils/logger";

interface AdminPayoutRequest {
  id: string;
  tutor_id: string;
  amount: number;
  currency: string;
  bank_account_holder: string;
  bank_name: string;
  bank_account_number: string;
  bank_branch_code: string | null;
  status: "pending" | "approved" | "paid" | "rejected" | "cancelled";
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  tutor?: { full_name: string | null; email: string | null } | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  paid: "default",
  rejected: "destructive",
  cancelled: "outline",
};

export default function AdminWithdrawalsPanel() {
  const [requests, setRequests] = useState<AdminPayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = (supabase as any)
        .from("payout_requests")
        .select(
          `*, tutor:profiles!payout_requests_tutor_id_fkey(full_name, email)`
        )
        .order("created_at", { ascending: false });
      // The FK may not exist; fall back to manual join below if needed.
      const { data, error } = await q;
      if (error) {
        // Manual join fallback
        const { data: rows, error: e2 } = await (supabase as any)
          .from("payout_requests")
          .select("*")
          .order("created_at", { ascending: false });
        if (e2) throw e2;
        const ids = Array.from(new Set((rows || []).map((r: any) => r.tutor_id)));
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        const profMap = new Map((profs || []).map((p: any) => [p.id, p]));
        setRequests(
          (rows || []).map((r: any) => ({
            ...r,
            tutor: profMap.get(r.tutor_id) || null,
          }))
        );
      } else {
        setRequests((data || []) as AdminPayoutRequest[]);
      }
    } catch (err) {
      logger.error("Load withdrawals failed", err);
      toast({
        title: "Failed to load withdrawals",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id: string, status: "approved" | "paid" | "rejected") => {
    setProcessing(id);
    try {
      const { error } = await (supabase as any).rpc("resolve_payout_request", {
        _request_id: id,
        _new_status: status,
        _admin_note: null,
      });
      if (error) throw error;
      toast({ title: `Marked ${status}` });
      await load();
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const filtered =
    statusFilter === "all" ? requests : requests.filter((r) => r.status === statusFilter);

  return (
    <Card className="mt-4">
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">Tutor Withdrawal Requests</h2>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={load} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Tutor</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Bank Details</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Requested</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No withdrawal requests found.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm">
                      <div>{r.tutor?.full_name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{r.tutor?.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">
                      R{Number(r.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>{r.bank_account_holder}</div>
                      <div className="text-muted-foreground">
                        {r.bank_name}
                        {r.bank_branch_code ? ` · Branch ${r.bank_branch_code}` : ""}
                      </div>
                      <div className="font-mono text-muted-foreground">
                        {r.bank_account_number}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={STATUS_VARIANT[r.status] || "outline"}>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "dd MMM yyyy, HH:mm")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processing === r.id}
                            onClick={() => resolve(r.id, "approved")}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Approve
                          </Button>
                        )}
                        {(r.status === "pending" || r.status === "approved") && (
                          <Button
                            size="sm"
                            disabled={processing === r.id}
                            onClick={() => resolve(r.id, "paid")}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" />
                            Mark paid
                          </Button>
                        )}
                        {r.status === "pending" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={processing === r.id}
                            onClick={() => resolve(r.id, "rejected")}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Reject
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
