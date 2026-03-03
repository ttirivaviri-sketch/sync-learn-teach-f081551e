import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const Refunds = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Refund Requests | StudySync Admin";
    loadRequests();
  }, []);

  const loadRequests = async () => {
    const { data, error } = await supabase
      .from('refund_requests')
      .select('*, payments(amount, currency, booking_id)')
      .order('created_at', { ascending: false });

    if (!error) setRequests(data || []);
    setLoading(false);
  };

  const handleDecision = async (id: string, status: 'approved' | 'rejected') => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('refund_requests').update({
      status,
      admin_notes: adminNotes[id] || null,
      reviewed_by: user?.id,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) {
      toast({ title: "Error", description: "Failed to update refund request.", variant: "destructive" });
    } else {
      toast({ title: `Refund ${status}`, description: `The refund request has been ${status}.` });
      
      // If approved, update payment status to refunded
      if (status === 'approved') {
        const req = requests.find(r => r.id === id);
        if (req?.payment_id) {
          await supabase.from('payments').update({ status: 'refunded' }).eq('id', req.payment_id);
        }
      }
      loadRequests();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge variant="default">Approved</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Refund Requests</h1>
      <p className="text-muted-foreground mt-1">Review and process refund requests from learners</p>

      <div className="mt-6 space-y-4">
        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : requests.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No refund requests</CardContent></Card>
        ) : (
          requests.map((req) => (
            <Card key={req.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Refund Request — R{req.payments?.amount?.toFixed(2) || '0.00'}
                  </CardTitle>
                  {getStatusBadge(req.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm"><strong>Reason:</strong> {req.reason}</p>
                <p className="text-xs text-muted-foreground">
                  Submitted {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                </p>

                {req.status === 'pending' && (
                  <div className="space-y-3 border-t pt-3">
                    <Textarea
                      placeholder="Admin notes (optional)..."
                      value={adminNotes[req.id] || ''}
                      onChange={(e) => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => handleDecision(req.id, 'approved')} className="flex-1">Approve Refund</Button>
                      <Button variant="destructive" onClick={() => handleDecision(req.id, 'rejected')} className="flex-1">Reject</Button>
                    </div>
                  </div>
                )}

                {req.admin_notes && (
                  <p className="text-sm text-muted-foreground"><strong>Admin notes:</strong> {req.admin_notes}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </main>
  );
};

export default Refunds;
