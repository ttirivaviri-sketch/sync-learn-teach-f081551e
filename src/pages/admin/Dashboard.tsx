import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, DollarSign, Users, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSessions: 0,
    todayRevenue: 0,
    pendingVerifications: 0,
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Admin Dashboard | StudySync";
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load stats
      const [usersRes, bookingsRes, paymentsRes, verificationsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('payments').select('amount').eq('status', 'succeeded').gte('created_at', new Date().toISOString().split('T')[0]),
        supabase.from('tutor_verifications').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
      ]);

      const todayRevenue = paymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      setStats({
        totalUsers: usersRes.count || 0,
        activeSessions: bookingsRes.count || 0,
        todayRevenue,
        pendingVerifications: verificationsRes.count || 0,
      });

      // Load recent bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select(`
          id,
          scheduled_at,
          status,
          price,
          learner_id,
          tutor_id,
          tutor_subjects(subject),
          learner:profiles!bookings_learner_id_fkey(full_name),
          tutor:profiles!bookings_tutor_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentBookings(bookings || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'default';
      case 'completed': return 'secondary';
      case 'canceled': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
      <p className="text-muted-foreground mt-1">Key metrics and recent activity</p>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : stats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : stats.activeSessions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : `R${stats.todayRevenue.toFixed(2)}`}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : stats.pendingVerifications}</div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium mb-3">Recent Bookings</h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Learner</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Tutor</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Subject</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Scheduled</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Price</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
                    </tr>
                  ) : recentBookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No bookings yet</td>
                    </tr>
                  ) : (
                    recentBookings.map((booking) => (
                      <tr key={booking.id} className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm">{booking.learner?.full_name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-sm">{booking.tutor?.full_name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-sm">{booking.tutor_subjects?.subject || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm">{formatDistanceToNow(new Date(booking.scheduled_at), { addSuffix: true })}</td>
                        <td className="px-4 py-3 text-sm">R{Number(booking.price).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant={getStatusColor(booking.status)}>{booking.status}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default AdminDashboard;
