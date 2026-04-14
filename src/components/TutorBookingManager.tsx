import { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { BookingRequest } from "@/hooks/useRealtimeBookings";
import { RescheduleDialog } from "@/components/RescheduleDialog";
import { supabase } from "@/integrations/supabase/client";
import { isPast } from "date-fns";
import { logger } from "@/utils/logger";
import { BookingCard } from "./booking-manager/BookingCard";

interface TutorBookingManagerProps {
  bookings: BookingRequest[];
  loading: boolean;
  onAccept: (booking: BookingRequest) => void | Promise<void>;
  onDecline: (booking: BookingRequest) => void | Promise<void>;
  onJoinSession: (booking: BookingRequest) => void;
  onStartChat: (booking: BookingRequest) => void;
}

type FilterStatus = "all" | "requested" | "confirmed" | "completed" | "canceled";

export const TutorBookingManager = ({
  bookings,
  loading,
  onAccept,
  onDecline,
  onJoinSession,
  onStartChat,
}: TutorBookingManagerProps) => {
  const [rescheduleBooking, setRescheduleBooking] = useState<BookingRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [learnerSubjectsMap, setLearnerSubjectsMap] = useState<Record<string, string[]>>({});
  const [learnerAcademicProfiles, setLearnerAcademicProfiles] = useState<
    Record<string, { curriculum?: string | null; grade?: string | null; subjects?: string[] | null; exam_year?: number | null; school_name?: string | null; target_grade?: string | null }>
  >({});
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Fetch learner subjects and academic profiles for all bookings
  useEffect(() => {
    const learnerIds = [...new Set(bookings.map((b) => b.learner_id))];
    if (learnerIds.length === 0) return;

    const fetchLearnerSubjects = async () => {
      const { data } = await supabase
        .from("learner_subjects")
        .select("user_id, subject")
        .in("user_id", learnerIds);
      if (data) {
        const map: Record<string, string[]> = {};
        for (const row of data) {
          if (!map[row.user_id]) map[row.user_id] = [];
          map[row.user_id].push(row.subject);
        }
        setLearnerSubjectsMap(map);
      }
    };

    const fetchAcademicProfiles = async () => {
      const { data } = await supabase
        .from("academic_profiles")
        .select("user_id, curriculum, grade, subjects, exam_year, school_name, target_grade")
        .in("user_id", learnerIds);
      if (data) {
        const profileMap: Record<string, (typeof data)[0]> = {};
        for (const row of data) {
          if (row.user_id) profileMap[row.user_id] = row;
        }
        setLearnerAcademicProfiles(profileMap);
      }
    };

    fetchLearnerSubjects();
    fetchAcademicProfiles();
  }, [bookings]);

  const toggleProfileExpand = (bookingId: string) => {
    setExpandedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });
  };

  const handleReschedule = async (bookingId: string, newScheduledAt: string, _reason?: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ scheduled_at: newScheduledAt, status: "requested" as any })
      .eq("id", bookingId);
    if (error) {
      logger.error("Reschedule error:", error);
      toast({ title: "Error", description: "Failed to reschedule booking. Please try again.", variant: "destructive" });
      throw error;
    }
    toast({ title: "Reschedule Proposed", description: "The learner has been notified of the new time." });
  };

  const handleAcceptWithLoading = async (booking: BookingRequest) => {
    setProcessingId(booking.id);
    try { await onAccept(booking); } finally { setProcessingId(null); }
  };

  const handleDeclineWithLoading = async (booking: BookingRequest) => {
    setProcessingId(booking.id);
    try { await onDecline(booking); } finally { setProcessingId(null); }
  };

  const isSessionReady = (booking: BookingRequest) => {
    const sessionTime = new Date(booking.scheduled_at);
    return booking.status === "confirmed" && Math.abs(sessionTime.getTime() - Date.now()) < 15 * 60 * 1000;
  };

  // Filter and categorize bookings
  const filteredBookings = bookings.filter((b) => statusFilter === "all" || b.status === statusFilter);
  const pendingRequests = filteredBookings.filter((b) => b.status === "requested");
  const upcomingSessions = filteredBookings.filter((b) => b.status === "confirmed" && !isPast(new Date(b.scheduled_at)));
  const pastSessions = filteredBookings.filter(
    (b) => b.status === "completed" || b.status === "canceled" || (b.status === "confirmed" && isPast(new Date(b.scheduled_at)))
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const renderBookingList = (list: BookingRequest[], emptyIcon: React.ReactNode, emptyTitle: string, emptyDesc: string, showActions = true) => {
    if (list.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            {emptyIcon}
            <h4 className="font-medium mb-1">{emptyTitle}</h4>
            <p className="text-sm text-muted-foreground">{emptyDesc}</p>
          </CardContent>
        </Card>
      );
    }
    return list.map((booking) => (
      <BookingCard
        key={booking.id}
        booking={booking}
        showActions={showActions}
        isProcessing={processingId === booking.id}
        isSessionReady={isSessionReady(booking)}
        isProfileExpanded={expandedProfiles.has(booking.id)}
        academicProfile={learnerAcademicProfiles[booking.learner_id]}
        learnerSubjects={learnerSubjectsMap[booking.learner_id]}
        onAccept={() => handleAcceptWithLoading(booking)}
        onDecline={() => handleDeclineWithLoading(booking)}
        onReschedule={() => setRescheduleBooking(booking)}
        onJoinSession={() => onJoinSession(booking)}
        onStartChat={() => onStartChat(booking)}
        onToggleProfile={() => toggleProfileExpand(booking.id)}
      />
    ));
  };

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
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming
            {upcomingSessions.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">{upcomingSessions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {renderBookingList(
            pendingRequests,
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />,
            "All caught up!",
            "No pending booking requests right now."
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4 space-y-3">
          {renderBookingList(
            upcomingSessions,
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />,
            "No upcoming sessions",
            "Confirmed sessions will appear here."
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {renderBookingList(
            pastSessions,
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />,
            "No past sessions",
            "Your completed and cancelled sessions will appear here.",
            false
          )}
        </TabsContent>
      </Tabs>

      <RescheduleDialog
        booking={rescheduleBooking}
        open={!!rescheduleBooking}
        onOpenChange={(open) => !open && setRescheduleBooking(null)}
        onReschedule={handleReschedule}
      />
    </div>
  );
};
