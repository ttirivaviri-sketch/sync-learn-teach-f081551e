import { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle, XCircle, RefreshCw, Video, MessageCircle, User, Filter, BookOpen, GraduationCap, ChevronDown, ChevronUp } from "lucide-react";
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
  onAccept: (booking: BookingRequest) => void | Promise<void>;
  onDecline: (booking: BookingRequest) => void | Promise<void>;
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
  const [learnerSubjectsMap, setLearnerSubjectsMap] = useState<Record<string, string[]>>({});
  const [learnerAcademicProfiles, setLearnerAcademicProfiles] = useState<Record<string, {
    curriculum?: string | null;
    grade?: string | null;
    subjects?: string[] | null;
    exam_year?: number | null;
    school_name?: string | null;
    target_grade?: string | null;
  }>>({});
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Fetch learner subjects and academic profiles for all bookings
  useEffect(() => {
    const learnerIds = [...new Set(bookings.map(b => b.learner_id))];
    if (learnerIds.length === 0) return;

    const fetchLearnerSubjects = async () => {
      const { data } = await supabase
        .from('learner_subjects')
        .select('user_id, subject')
        .in('user_id', learnerIds);

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
        .from('academic_profiles')
        .select('user_id, curriculum, grade, subjects, exam_year, school_name, target_grade')
        .in('user_id', learnerIds);

      if (data) {
        const profileMap: Record<string, typeof data[0]> = {};
        for (const row of data) {
          if (row.user_id) {
            profileMap[row.user_id] = row;
          }
        }
        setLearnerAcademicProfiles(profileMap);
      }
    };

    fetchLearnerSubjects();
    fetchAcademicProfiles();
  }, [bookings]);

  const toggleProfileExpand = (bookingId: string) => {
    setExpandedProfiles(prev => {
      const next = new Set(prev);
      if (next.has(bookingId)) {
        next.delete(bookingId);
      } else {
        next.add(bookingId);
      }
      return next;
    });
  };

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
                {booking.learner_profile?.study_level && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <GraduationCap className="h-3 w-3" />
                    {booking.learner_profile.study_level === 'junior_primary' ? 'Junior Primary' :
                     booking.learner_profile.study_level === 'senior_primary' ? 'Senior Primary' :
                     booking.learner_profile.study_level === 'junior_high' ? 'Junior High' :
                     booking.learner_profile.study_level === 'senior_high' ? 'Senior High' :
                     booking.learner_profile.study_level === 'tertiary' ? 'Tertiary' : booking.learner_profile.study_level}
                  </p>
                )}
              </div>
            </div>
            <Badge className={getStatusColor(booking.status)}>
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </Badge>
          </div>

          {/* Academic Profile Section */}
          {(() => {
            const acadProfile = learnerAcademicProfiles[booking.learner_id];
            const learnerSubjects = learnerSubjectsMap[booking.learner_id];
            const isExpanded = expandedProfiles.has(booking.id);
            const hasProfile = acadProfile && (acadProfile.curriculum || acadProfile.grade || (acadProfile.subjects && acadProfile.subjects.length > 0));
            const hasSubjects = learnerSubjects && learnerSubjects.length > 0;

            if (!hasProfile && !hasSubjects) return null;

            return (
              <div className="mb-3 rounded-lg border border-primary/15 bg-primary/5 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-2.5 text-left hover:bg-primary/10 transition-colors"
                  onClick={() => toggleProfileExpand(booking.id)}
                >
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-primary">Academic Profile</span>
                    {acadProfile?.curriculum && (
                      <Badge variant="secondary" className="text-[10px] py-0 h-4">{acadProfile.curriculum}</Badge>
                    )}
                    {acadProfile?.grade && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4">{acadProfile.grade}</Badge>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-primary/10">
                    {/* Profile details grid */}
                    {hasProfile && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-2">
                        {acadProfile.curriculum && (
                          <>
                            <span className="text-muted-foreground">Curriculum</span>
                            <span className="font-medium">{acadProfile.curriculum}</span>
                          </>
                        )}
                        {acadProfile.grade && (
                          <>
                            <span className="text-muted-foreground">Grade</span>
                            <span className="font-medium">{acadProfile.grade}</span>
                          </>
                        )}
                        {acadProfile.exam_year && (
                          <>
                            <span className="text-muted-foreground">Exam Year</span>
                            <span className="font-medium">{acadProfile.exam_year}</span>
                          </>
                        )}
                        {acadProfile.school_name && (
                          <>
                            <span className="text-muted-foreground">School</span>
                            <span className="font-medium">{acadProfile.school_name}</span>
                          </>
                        )}
                        {acadProfile.target_grade && (
                          <>
                            <span className="text-muted-foreground">Target Grade</span>
                            <span className="font-medium">{acadProfile.target_grade}</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Academic profile subjects */}
                    {acadProfile?.subjects && acadProfile.subjects.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Registered Subjects</p>
                        <div className="flex flex-wrap gap-1">
                          {acadProfile.subjects.map((subj) => (
                            <Badge key={subj} variant="secondary" className="text-[10px] py-0 h-4">
                              <BookOpen className="h-2.5 w-2.5 mr-0.5" />
                              {subj}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Learner additional subjects (from learner_subjects table) */}
                    {hasSubjects && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Tutoring Subjects</p>
                        <div className="flex flex-wrap gap-1">
                          {learnerSubjects.map((subj) => (
                            <Badge key={subj} variant="outline" className="text-[10px] py-0 h-4">
                              <BookOpen className="h-2.5 w-2.5 mr-0.5" />
                              {subj}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

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
