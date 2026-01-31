import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Users, BookOpen, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBookings: 0,
    totalRevenue: 0,
    averageSessionCost: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Admin Reports | StudySync";
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [usersRes, bookingsRes, paymentsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('bookings').select('id, price', { count: 'exact' }),
        supabase.from('payments').select('amount').eq('status', 'succeeded'),
      ]);

      const totalRevenue = paymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const totalBookings = bookingsRes.count || 0;

      setStats({
        totalUsers: usersRes.count || 0,
        totalBookings,
        totalRevenue,
        averageSessionCost: totalBookings > 0 ? totalRevenue / totalBookings : 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const exportToCSV = async (tableName: 'profiles' | 'bookings' | 'payments' | 'support_tickets' | 'reviews' | 'security_audit_logs', columns: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select(columns);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "No Data",
          description: `No ${tableName} data to export`,
          variant: "destructive",
        });
        return;
      }

      // Convert to CSV
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => 
        Object.values(row).map(val => {
          if (val === null || val === undefined) return '';
          if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
          if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
          return String(val);
        }).join(',')
      );
      const csv = [headers, ...rows].join('\n');

      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tableName}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `${tableName} data exported successfully`,
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Reports & Analytics</h1>
      <p className="text-muted-foreground mt-1">Export data and view platform metrics</p>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBookings}</div>
          </CardContent>
        </Card>

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
            <CardTitle className="text-sm font-medium">Avg Session Cost</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R{stats.averageSessionCost.toFixed(2)}</div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium mb-4">Export Data</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Users Export</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Export all user profiles including tutors and learners
              </p>
              <Button
                onClick={() => exportToCSV('profiles', '*')}
                disabled={loading}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Users
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bookings Export</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Export all booking records with status and pricing
              </p>
              <Button
                onClick={() => exportToCSV('bookings', '*')}
                disabled={loading}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Bookings
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payments Export</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Export payment transactions and payout records
              </p>
              <Button
                onClick={() => exportToCSV('payments', '*')}
                disabled={loading}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Payments
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Support Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Export all support tickets and their status
              </p>
              <Button
                onClick={() => exportToCSV('support_tickets', '*')}
                disabled={loading}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Tickets
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reviews Export</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Export all reviews and ratings data
              </p>
              <Button
                onClick={() => exportToCSV('reviews', '*')}
                disabled={loading}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Reviews
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Export security audit logs and events
              </p>
              <Button
                onClick={() => exportToCSV('security_audit_logs', '*')}
                disabled={loading}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Logs
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
};

export default Reports;
