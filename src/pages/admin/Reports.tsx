import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp, Users, BookOpen, DollarSign, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, startOfMonth } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { logger } from "@/utils/logger";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#f59e0b', '#ef4444'];

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0, totalLearners: 0, totalTutors: 0,
    totalBookings: 0, completedBookings: 0, cancelledBookings: 0,
    totalRevenue: 0, averageSessionCost: 0, averageRating: 0,
  });
  const [bookingsByStatus, setBookingsByStatus] = useState<any[]>([]);
  const [revenueByDay, setRevenueByDay] = useState<any[]>([]);
  const [topSubjects, setTopSubjects] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Admin Reports | StudySync";
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const [usersRes, bookingsRes, paymentsRes, reviewsRes, subjectsRes] = await Promise.all([
        supabase.from('profiles').select('user_type'),
        supabase.from('bookings').select('status, price, scheduled_at, tutor_subject_id'),
        supabase.from('payments').select('amount, status, created_at').eq('status', 'succeeded'),
        supabase.from('reviews').select('rating'),
        supabase.from('tutor_subjects').select('subject'),
      ]);

      const users = usersRes.data || [];
      const bookings = bookingsRes.data || [];
      const payments = paymentsRes.data || [];
      const reviews = reviewsRes.data || [];

      const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const completedBookings = bookings.filter(b => b.status === 'completed').length;
      const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

      setStats({
        totalUsers: users.length,
        totalLearners: users.filter(u => u.user_type === 'learner').length,
        totalTutors: users.filter(u => u.user_type === 'tutor').length,
        totalBookings: bookings.length,
        completedBookings,
        cancelledBookings: bookings.filter(b => b.status === 'canceled').length,
        totalRevenue,
        averageSessionCost: completedBookings > 0 ? totalRevenue / completedBookings : 0,
        averageRating: Math.round(avgRating * 10) / 10,
      });

      // Bookings by status for pie chart
      const statusCounts: Record<string, number> = {};
      bookings.forEach(b => { statusCounts[b.status] = (statusCounts[b.status] || 0) + 1; });
      setBookingsByStatus(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

      // Revenue by day (last 14 days)
      const days: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        days[format(subDays(new Date(), i), 'MMM dd')] = 0;
      }
      payments.forEach(p => {
        const day = format(new Date(p.created_at), 'MMM dd');
        if (days[day] !== undefined) days[day] += Number(p.amount);
      });
      setRevenueByDay(Object.entries(days).map(([date, revenue]) => ({ date, revenue })));

      // Top subjects
      const subjectCounts: Record<string, number> = {};
      (subjectsRes.data || []).forEach(s => { subjectCounts[s.subject] = (subjectCounts[s.subject] || 0) + 1; });
      setTopSubjects(Object.entries(subjectCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })));
    } catch (error) {
      logger.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async (tableName: 'profiles' | 'bookings' | 'payments' | 'support_tickets' | 'reviews' | 'security_audit_logs', columns: string) => {
    try {
      const { data, error } = await supabase.from(tableName).select(columns);
      if (error) throw error;
      if (!data?.length) { toast({ title: "No Data", description: `No ${tableName} data to export`, variant: "destructive" }); return; }
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
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tableName}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: "Export Complete", description: `${tableName} data exported` });
    } catch (error) {
      toast({ title: "Export Failed", description: "Failed to export data.", variant: "destructive" });
    }
  };

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Reports & Analytics</h1>
      <p className="text-muted-foreground mt-1">Real-time platform metrics and data exports</p>

      {/* Key Metrics */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
        {[
          { title: "Total Users", value: stats.totalUsers, sub: `${stats.totalLearners} learners, ${stats.totalTutors} tutors`, icon: Users },
          { title: "Total Bookings", value: stats.totalBookings, sub: `${stats.completedBookings} completed`, icon: BookOpen },
          { title: "Total Revenue", value: `R${stats.totalRevenue.toFixed(2)}`, sub: `Avg R${stats.averageSessionCost.toFixed(2)}/session`, icon: DollarSign },
          { title: "Average Rating", value: stats.averageRating || "N/A", sub: "Across all reviews", icon: Star },
        ].map(({ title, value, sub, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '—' : value}</div>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Charts */}
      <section className="grid gap-4 md:grid-cols-2 mt-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue (Last 14 Days)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => `R${v.toFixed(2)}`} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Bookings by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={bookingsByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                  {bookingsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Top Subjects</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topSubjects}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* Exports */}
      <section className="mt-8">
        <h2 className="text-lg font-medium mb-4">Export Data</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { name: 'Users', table: 'profiles' as const, desc: 'All user profiles' },
            { name: 'Bookings', table: 'bookings' as const, desc: 'All booking records' },
            { name: 'Payments', table: 'payments' as const, desc: 'Payment transactions' },
            { name: 'Support Tickets', table: 'support_tickets' as const, desc: 'Support tickets' },
            { name: 'Reviews', table: 'reviews' as const, desc: 'Ratings and reviews' },
            { name: 'Security Logs', table: 'security_audit_logs' as const, desc: 'Audit events' },
          ].map(({ name, table, desc }) => (
            <Card key={table}>
              <CardHeader><CardTitle className="text-base">{name} Export</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{desc}</p>
                <Button onClick={() => exportToCSV(table, '*')} className="w-full">
                  <Download className="h-4 w-4 mr-2" />Export {name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Reports;
