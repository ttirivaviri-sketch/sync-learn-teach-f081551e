/**
 * LearnerActivityTab — Clean-first activity view with expandable sections.
 * Now also surfaces the unified learning timeline (homework, topic sessions,
 * lesson reinforcement) so bookings and study activity live in one place.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Activity, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveBookingCard } from "@/components/LiveBookingCard";
import { PendingPaymentCard } from "@/components/PendingPaymentCard";
import { LessonNotesCard } from "@/components/lesson/LessonNotesCard";
import { LearningEventRow } from "@/components/learner/LearningEventRow";
import { useLearningTimeline } from "@/hooks/useLearningTimeline";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";
import type { BookingRequest } from "@/hooks/useRealtimeBookings";

interface ReviewData {
  bookingId: string;
  reviewedId: string;
  reviewedName: string;
  userType: "learner" | "tutor";
}

interface LearnerActivityTabProps {
  bookings: BookingRequest[];
  bookingsLoading: boolean;
  bookingsNeedingPayment: BookingRequest[];
  needsPayment: (id: string) => boolean;
  onJoinVideoSession: (booking: unknown) => void;
  onPayNow: (booking: unknown) => void;
  onStartCheckout: (booking: unknown) => void;
  onStartChat: (booking: BookingRequest) => void;
  onReview: (data: ReviewData) => void;
}

export const LearnerActivityTab = ({
  bookings,
  bookingsLoading,
  bookingsNeedingPayment,
  needsPayment,
  onJoinVideoSession,
  onPayNow,
  onStartCheckout,
  onStartChat,
  onReview,
}: LearnerActivityTabProps) => {
  const [showAllPending, setShowAllPending] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [showAllLearning, setShowAllLearning] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
  }, []);

  const { data: timeline = [] } = useLearningTimeline({ userId, limit: 25 });

  const todayWins = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return timeline.filter((e) => e.occurred_at.slice(0, 10) === todayStr).length;
  }, [timeline]);

  const displayedLearning = showAllLearning ? timeline : timeline.slice(0, 4);

  const upcomingBookings = bookings.filter(
    (b) => b.status !== "completed" && b.status !== "canceled"
  );
  const pastBookings = bookings.filter(
    (b) => b.status === "completed" || b.status === "canceled"
  );

  const displayedPending = showAllPending
    ? bookingsNeedingPayment
    : bookingsNeedingPayment.slice(0, 1);
  const displayedUpcoming = showAllUpcoming
    ? upcomingBookings
    : upcomingBookings.slice(0, 1);
  const displayedPast = showAllPast ? pastBookings : pastBookings.slice(0, 2);

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Activity</h2>
        {todayWins > 0 && (
          <Badge variant="secondary" className="gap-1 animate-scale-in">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            {todayWins} today
          </Badge>
        )}
      </div>

      {bookingsLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      ) : (
        <>
          {/* Upcoming */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold">Upcoming</h3>

            {/* Pending payments subsection */}
            {bookingsNeedingPayment.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-600 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                  Payment required
                </p>
                {displayedPending.map((booking) => (
                  <PendingPaymentCard
                    key={booking.id}
                    booking={booking}
                    onPaymentComplete={() => {}}
                    onStartCheckout={onStartCheckout}
                  />
                ))}
                {bookingsNeedingPayment.length > 1 && (
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => setShowAllPending(!showAllPending)}
                  >
                    {showAllPending
                      ? "Show less"
                      : `See all ${bookingsNeedingPayment.length} pending`}
                  </Button>
                )}
              </div>
            )}

            {/* Upcoming sessions */}
            {upcomingBookings.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-1">
                    No upcoming sessions
                  </p>
                  <button className="text-sm font-medium text-primary inline-flex items-center gap-1">
                    Book a tutor <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {displayedUpcoming.map((booking) => (
                  <LiveBookingCard
                    key={booking.id}
                    booking={booking}
                    userType="learner"
                    onJoinSession={onJoinVideoSession}
                    onPayNow={onPayNow}
                    hasPendingPayment={needsPayment(booking.id)}
                    onStartChat={(b) => onStartChat(b as BookingRequest)}
                  />
                ))}
                {upcomingBookings.length > 1 && (
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                  >
                    {showAllUpcoming
                      ? "Show less"
                      : `See all ${upcomingBookings.length} upcoming`}
                  </Button>
                )}
              </div>
            )}
          </section>

          {/* Learning timeline — unified study activity feed */}
          {timeline.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Recent learning
              </h3>
              <div className="space-y-2">
                {displayedLearning.map((event) => (
                  <LearningEventRow key={event.id} event={event} onClick={() => haptic("light")} />
                ))}
                {timeline.length > 4 && (
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => setShowAllLearning(!showAllLearning)}
                  >
                    {showAllLearning ? "Show less" : `See all ${timeline.length} events`}
                  </Button>
                )}
              </div>
            </section>
          )}

          {/* Past */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold">Past</h3>

            {pastBookings.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No past sessions yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {displayedPast.map((pastBooking) => (
                  <Card key={pastBooking.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">
                            {pastBooking.tutor_profile?.full_name || "Tutor"}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {pastBooking.tutor_subjects?.subject}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(pastBooking.scheduled_at).toLocaleDateString()}{" "}
                            • {pastBooking.duration_minutes} min
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">R{pastBooking.price}</p>
                          <Badge
                            variant={
                              pastBooking.status === "completed"
                                ? "outline"
                                : "destructive"
                            }
                            className="mt-1"
                          >
                            {pastBooking.status === "completed"
                              ? "Completed"
                              : "Cancelled"}
                          </Badge>
                          {pastBooking.status === "completed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() =>
                                onReview({
                                  bookingId: pastBooking.id,
                                  reviewedId: pastBooking.tutor_id,
                                  reviewedName:
                                    pastBooking.tutor_profile?.full_name ||
                                    "Tutor",
                                  userType: "learner",
                                })
                              }
                            >
                              Rate & Review
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                    {pastBooking.status === "completed" && (
                      <div className="px-4 pb-3">
                        <LessonNotesCard bookingId={pastBooking.id} audience="learner" />
                      </div>
                    )}
                  </Card>
                ))}
                {pastBookings.length > 2 && (
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => setShowAllPast(!showAllPast)}
                  >
                    {showAllPast
                      ? "Show less"
                      : `View all ${pastBookings.length} past sessions`}
                  </Button>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
