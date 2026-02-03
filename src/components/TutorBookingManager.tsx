import { useState } from "react";
import { Calendar, Clock, CheckCircle, XCircle, RefreshCw, Video, MessageCircle, User, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { BookingRequest } from "@/hooks/useRealtimeBookings";
import { RescheduleDialog } from "@/components/RescheduleDialog";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, isToday, isTomorrow, isPast } from "date-fns";

interface TutorBookingManagerProps {
  bookings: BookingRequest[];
  loading: boolean;
  onAccept: (booking: BookingRequest) => Promise<void>;
  onDecline: (booking: BookingRequest) => Promise<void>;
  onJoinSession: (booking: BookingRequest) => void;
  onStartChat: (booking: BookingRequest) => void;
}

type FilterStatus = 'all' | 'requested' | 'confirmed' | 'completed' | 'canceled';

export const TutorBookingManager = ({
  bookings,
  loading,
  onAccept,
  onDecline,
  onJoinSession,
  onStartChat,
}: TutorBookingManagerProps) => {
  const [rescheduleBooking, setRescheduleBooking] = useState<BookingRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleReschedule = async (bookingId: string, newScheduledAt: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          scheduled_at: newScheduledAt,
          status: 'requested' // Reset to requested so learner can confirm
        })
        .eq('id', bookingId);

      if (error) throw error;

      toast({
        title: "Reschedule Proposed",
        description: "The learner has been notified of the new time.",
      });
    } catch (error) {
      console.error('Reschedule error:', error);
      toast({
        title: "Error",
        description: "Failed to reschedule booking. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleAcceptWithLoading = async (booking: BookingRequest) => {
    setProcessingId(booking.id);
    try {
      await onAccept(booking);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineWithLoading = async (booking: BookingRequest) => {
    setProcessingId(booking.id);
    try {
      await onDecline(booking);
    } finally {
      setProcessingId(null);
    }
  };

  // Filter and categorize bookings
  const filteredBookings = bookings.filter(b => 
    statusFilter === 'all' || b.status === statusFilter
  );

  const pendingRequests = filteredBookings.filter(b => b.status === 'requested');
  const upcomingSessions = filteredBookings.filter(b => 
    b.status === 'confirmed' && !isPast(new Date(b.scheduled_at))
  );
  const pastSessions = filteredBookings.filter(b => 
    b.status === 'completed' || 
    b.status === 'canceled' ||
    (b.status === 'confirmed' && isPast(new Date(b.scheduled_at)))
  );

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  const getStatusColor = (status: BookingRequest['status']) => {
    const colors = {
      requested: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      confirmed: 'bg-green-500/10 text-green-600 border-green-500/20',
      completed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      canceled: 'bg-red-500/10 text-red-600 border-red-500/20',
    };
    return colors[status];
  };

  const isSessionReady = (booking: BookingRequest) => {
    const sessionTime = new Date(booking.scheduled_at);
    const now = new Date();
    return booking.status === 'confirmed' && 
           Math.abs(sessionTime.getTime() - now.getTime()) < 15 * 60 * 1000;
  };

  const BookingCard = ({ booking, showActions = true }: { booking: BookingRequest; showActions?: boolean }) => {
    const isReady = isSessionReady(booking);
    const isProcessing = processingId === booking.id;

    return (
      <Card className={`transition-all ${
        booking.status === 'requested' ? 'ring-2 ring-primary/50 bg-primary/5' : ''
      } ${isReady ? 'ring-2 ring-green-500/50' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h4 className="font-medium">
                  {booking.learner_profile?.full_name || 'Student'}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {booking.learner_profile?.email}
                </p>
              </div>
            </div>
            <Badge className={getStatusColor(booking.status)}>
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </Badge>
          </div>

          {/* Session Details */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{getDateLabel(booking.scheduled_at)}</span>
              <span className="text-muted-foreground">
                {format(new Date(booking.scheduled_at), "h:mm a")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{booking.duration_minutes} minutes</span>
            </div>
            <div className="flex items-center justify-between">
              <Badge variant="outline">
                {booking.tutor_subjects?.subject} • {booking.tutor_subjects?.level}
              </Badge>
              <span className="font-semibold text-primary">R{booking.price}</span>
            </div>
          </div>

          {/* Action Buttons */}
          {showActions && (
            <div className="flex flex-wrap gap-2">
              {booking.status === 'requested' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleAcceptWithLoading(booking)}
                    disabled={isProcessing}
                    className="flex-1"
                  >
                    {isProcessing ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Accept
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRescheduleBooking(booking)}
                    disabled={isProcessing}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Reschedule
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeclineWithLoading(booking)}
                    disabled={isProcessing}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </>
              )}

              {booking.status === 'confirmed' && (
                <>
                  {isReady && (
                    <Button
                      size="sm"
                      onClick={() => onJoinSession(booking)}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Video className="h-4 w-4 mr-1" />
                      Join Now
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRescheduleBooking(booking)}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Reschedule
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStartChat(booking)}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Request age for pending */}
          {booking.status === 'requested' && (
            <p className="text-xs text-muted-foreground mt-2">
              Requested {formatDistanceToNow(new Date(booking.created_at), { addSuffix: true })}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bookings</SelectItem>
            <SelectItem value="requested">Pending Requests</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="canceled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="ml-auto">
          {filteredBookings.length} bookings
        </Badge>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" className="relative">
            Pending
            {pendingRequests.length > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming
            {upcomingSessions.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {upcomingSessions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                <h4 className="font-medium mb-1">All caught up!</h4>
                <p className="text-sm text-muted-foreground">
                  No pending booking requests right now.
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingRequests.map(booking => (
              <BookingCard key={booking.id} booking={booking} />
            ))
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4 space-y-3">
          {upcomingSessions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h4 className="font-medium mb-1">No upcoming sessions</h4>
                <p className="text-sm text-muted-foreground">
                  Confirmed sessions will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            upcomingSessions.map(booking => (
              <BookingCard key={booking.id} booking={booking} />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {pastSessions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h4 className="font-medium mb-1">No past sessions</h4>
                <p className="text-sm text-muted-foreground">
                  Your completed and cancelled sessions will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            pastSessions.map(booking => (
              <BookingCard key={booking.id} booking={booking} showActions={false} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Reschedule Dialog */}
      <RescheduleDialog
        booking={rescheduleBooking}
        open={!!rescheduleBooking}
        onOpenChange={(open) => !open && setRescheduleBooking(null)}
        onReschedule={handleReschedule}
      />
    </div>
  );
};
