import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/utils/logger";

const Bookings = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | 'all'>("all");
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Admin Bookings | StudySync";
    loadBookings();
  }, [statusFilter]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          learner:profiles!bookings_learner_id_fkey(full_name, email),
          tutor:profiles!bookings_tutor_id_fkey(full_name, email),
          tutor_subjects(subject, level)
        `)
        .order('scheduled_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      logger.error('Error loading bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load bookings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: 'requested' | 'confirmed' | 'completed' | 'canceled') => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `Booking status changed to ${newStatus}`,
      });

      loadBookings();
    } catch (error) {
      logger.error('Error updating booking:', error);
      toast({
        title: "Error",
        description: "Failed to update booking status",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'default';
      case 'completed': return 'secondary';
      case 'canceled': return 'destructive';
      case 'requested': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
      <p className="text-muted-foreground mt-1">View and manage all bookings</p>

      <div className="mt-6 flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bookings</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={loadBookings} variant="outline">Refresh</Button>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Learner</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Tutor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Subject</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Scheduled</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Duration</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Price</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No bookings found</td>
                  </tr>
                ) : (
                  bookings.map((booking) => (
                    <tr key={booking.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                        {booking.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-sm">{booking.learner?.full_name || 'Unknown'}</td>
                      <td className="px-4 py-3 text-sm">{booking.tutor?.full_name || 'Unknown'}</td>
                      <td className="px-4 py-3 text-sm">
                        {booking.tutor_subjects?.subject || 'N/A'}
                        <br />
                        <span className="text-xs text-muted-foreground">{booking.tutor_subjects?.level}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(booking.scheduled_at), 'MMM dd, yyyy')}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(booking.scheduled_at), 'HH:mm')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{booking.duration_minutes} min</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          R{Number(booking.price).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant={getStatusColor(booking.status)}>{booking.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={booking.status}
                          onValueChange={(value) => updateBookingStatus(booking.id, value as any)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="requested">Requested</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="canceled">Canceled</SelectItem>
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

export default Bookings;
