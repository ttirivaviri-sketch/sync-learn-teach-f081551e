import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/utils/logger";

const Payments = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingPayouts: 0,
    completedToday: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Admin Payments | StudySync";
    loadPayments();
    loadStats();
  }, [statusFilter]);

  const loadStats = async () => {
    try {
      const [allPayments, pendingPayments, todayPayments] = await Promise.all([
        supabase.from('payments').select('amount').eq('status', 'succeeded'),
        supabase.from('payments').select('amount').eq('status', 'pending'),
        supabase.from('payments').select('amount').eq('status', 'succeeded')
          .gte('created_at', new Date().toISOString().split('T')[0]),
      ]);

      setStats({
        totalRevenue: allPayments.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
        pendingPayouts: pendingPayments.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
        completedToday: todayPayments.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
      });
    } catch (error) {
      logger.error('Error loading stats:', error);
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('payments')
        .select(`
          *,
          payer:profiles!payments_payer_id_fkey(full_name, email),
          booking:bookings(
            tutor:profiles!bookings_tutor_id_fkey(full_name),
            learner:profiles!bookings_learner_id_fkey(full_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      logger.error('Error loading payments:', error);
      toast({
        title: "Error",
        description: "Failed to load payments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentStatus = async (paymentId: string, newStatus: 'pending' | 'succeeded' | 'failed' | 'refunded') => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({ status: newStatus })
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `Payment status changed to ${newStatus}`,
      });

      loadPayments();
      loadStats();
    } catch (error) {
      logger.error('Error updating payment:', error);
      toast({
        title: "Error",
        description: "Failed to update payment status",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded': return 'default';
      case 'pending': return 'secondary';
      case 'failed': return 'destructive';
      case 'refunded': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Payments & Payouts</h1>
      <p className="text-muted-foreground mt-1">Manage transactions and payouts</p>

      <section className="grid gap-4 md:grid-cols-3 mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R{stats.totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R{stats.pendingPayouts.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R{stats.completedToday.toFixed(2)}</div>
          </CardContent>
        </Card>
      </section>

      <div className="mt-6 flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="succeeded">Succeeded</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={loadPayments} variant="outline">Refresh</Button>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Payer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Currency</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Provider</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No payments found</td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                        {payment.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-sm">{payment.payer?.full_name || 'Unknown'}</td>
                      <td className="px-4 py-3 text-sm font-semibold">R{Number(payment.amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">{payment.currency}</td>
                      <td className="px-4 py-3 text-sm">{payment.provider || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant={getStatusColor(payment.status)}>{payment.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {format(new Date(payment.created_at), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={payment.status}
                          onValueChange={(value) => updatePaymentStatus(payment.id, value as any)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="succeeded">Succeeded</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Payments;
