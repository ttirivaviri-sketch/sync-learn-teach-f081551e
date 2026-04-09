import { useState, useEffect } from "react";
import { Calendar, Clock, Star, DollarSign, Video, MapPin, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import StarRating from "@/components/StarRating";
import ReviewModal from "@/components/ReviewModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/utils/logger";

interface Session {
  id: string;
  personName: string;
  personId: string;
  subject: string;
  level: string;
  date: string;
  time: string;
  duration: string;
  price: string;
  status: "completed" | "cancelled" | "no-show";
  rating?: number;
  review?: string;
  hasReview?: boolean;
}

interface SessionHistoryProps {
  userType: "tutor" | "learner";
  userId: string;
}

const SessionHistory = ({ userType, userId }: SessionHistoryProps) => {
  const [selectedTab, setSelectedTab] = useState("all");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSessionHistory = async () => {
      if (!userId) return;

      try {
        // Fetch completed and canceled bookings
        const query = supabase
          .from('bookings')
          .select(`
            *,
            learner_profile:profiles!bookings_learner_id_fkey(id, full_name, email),
            tutor_profile:profiles!bookings_tutor_id_fkey(id, full_name, email),
            tutor_subjects(subject, level)
          `)
          .in('status', ['completed', 'canceled'])
          .order('scheduled_at', { ascending: false });

        if (userType === 'learner') {
          query.eq('learner_id', userId);
        } else {
          query.eq('tutor_id', userId);
        }

        const { data: bookings, error } = await query;

        if (error) {
          logger.error('Error fetching session history:', error);
          toast({
            title: 'Error',
            description: 'Failed to load session history',
            variant: 'destructive',
          });
          return;
        }

        // Fetch reviews for these bookings
        const bookingIds = bookings?.map(b => b.id) || [];
        let reviewsMap: Record<string, { rating: number; comment: string | null }> = {};

        if (bookingIds.length > 0) {
          const { data: reviews } = await supabase
            .from('reviews')
            .select('booking_id, rating, comment')
            .in('booking_id', bookingIds);

          if (reviews) {
            reviewsMap = reviews.reduce((acc, review) => {
              if (review.booking_id) {
                acc[review.booking_id] = { rating: review.rating, comment: review.comment };
              }
              return acc;
            }, {} as Record<string, { rating: number; comment: string | null }>);
          }
        }

        // Transform bookings to sessions
        const transformedSessions: Session[] = (bookings || []).map(booking => {
          const scheduledAt = new Date(booking.scheduled_at);
          const review = reviewsMap[booking.id];
          const person = userType === 'tutor' ? booking.learner_profile : booking.tutor_profile;
          
          // Map database status to display status
          let displayStatus: "completed" | "cancelled" | "no-show" = "completed";
          if (booking.status === 'canceled') {
            displayStatus = 'cancelled';
          } else if (booking.status === 'completed') {
            displayStatus = 'completed';
          }

          return {
            id: booking.id,
            personName: person?.full_name || 'Unknown',
            personId: userType === 'tutor' ? booking.learner_id : booking.tutor_id,
            subject: booking.tutor_subjects?.subject || 'Unknown Subject',
            level: booking.tutor_subjects?.level || '',
            date: scheduledAt.toISOString().split('T')[0],
            time: scheduledAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
            duration: `${booking.duration_minutes}min`,
            price: `R${booking.price}`,
            status: displayStatus,
            rating: review?.rating,
            review: review?.comment || undefined,
            hasReview: !!review,
          };
        });

        setSessions(transformedSessions);
      } catch (error) {
        logger.error('Error in fetchSessionHistory:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionHistory();
  }, [userId, userType, toast]);

  const filteredSessions = sessions.filter(session => {
    if (selectedTab === "all") return true;
    return session.status === selectedTab;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "cancelled": return "destructive";
      case "no-show": return "secondary";
      default: return "outline";
    }
  };

  const handleLeaveReview = (session: Session) => {
    setSelectedSession(session);
    setShowReviewModal(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              <TabsTrigger value="no-show">No Show</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-4">
              <div className="space-y-4">
                {filteredSessions.map((session) => (
                  <Card key={session.id} className="shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{session.personName}</h4>
                          <p className="text-sm text-muted-foreground">
                            {session.subject} • {session.level}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={getStatusColor(session.status)}>
                            {session.status.replace("-", " ").toUpperCase()}
                          </Badge>
                          {session.status === "completed" && (
                            <div className="mt-1">
                              <StarRating rating={session.rating || 0} readonly size="sm" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{new Date(session.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{session.time} ({session.duration})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Video className="h-4 w-4 text-muted-foreground" />
                          <span>Online</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>{session.price}</span>
                        </div>
                      </div>

                      {session.review && (
                        <div className="bg-muted p-3 rounded-lg mb-3">
                          <p className="text-sm italic">"{session.review}"</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {session.status === "completed" && userType === "learner" && !session.hasReview && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLeaveReview(session)}
                          >
                            <Star className="h-4 w-4 mr-1" />
                            Leave Review
                          </Button>
                        )}
                        <Button size="sm" variant="outline">
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Contact
                        </Button>
                        {session.status === "completed" && (
                          <Button size="sm" variant="outline">
                            Book Again
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredSessions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No sessions found for this filter.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Review Modal */}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setSelectedSession(null);
        }}
        bookingId={selectedSession?.id || ""}
        reviewedId={selectedSession?.personId || ""}
        reviewedName={selectedSession?.personName || ""}
        userType={userType}
        onReviewSubmitted={() => {
          setShowReviewModal(false);
          setSelectedSession(null);
          // Refresh sessions to show the new review
          setSessions(prev => prev.map(s => 
            s.id === selectedSession?.id 
              ? { ...s, hasReview: true } 
              : s
          ));
        }}
      />
    </div>
  );
};

export default SessionHistory;