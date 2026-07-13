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
import { MyWorkPanel } from "@/components/learner/MyWorkPanel";
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
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
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
  const displayedPast = showAllPast ? pastBookings : pastBookings.slice(0, 4);

  // "Starts in 2h 15m" pill for the featured next session (spec p.11 mockup)
  const startsInLabel = (iso: string): string => {
    const diffMs = new Date(iso).getTime() - Date.now();
    if (diffMs <= 0) return "Starting now";
    const mins = Math.round(diffMs / 60000);
    if (mins < 60) return `Starts in ${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h < 24) return m > 0 ? `Starts in ${h}h ${m}m` : `Starts in ${h}h`;
    const d = Math.floor(h / 24);
    return `Starts in ${d} day${d === 1 ? "" : "s"}`;
  };

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

      {/* Upcoming / Past pill toggle — spec p.11 */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("upcoming")}
          className={
            view === "upcoming"
              ? "rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-sm"
              : "rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground bg-card border border-border"
          }
          style={view === "upcoming" ? { background: "linear-gradient(135deg, hsl(228 89% 60%), hsl(248 88% 64%))" } : undefined}
        >
          Upcoming
        </button>
        <button
          onClick={() => setView("past")}
          className={
            view === "past"
              ? "rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-sm"
              : "rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground bg-card border border-border"
          }
          style={view === "past" ? { background: "linear-gradient(135deg, hsl(228 89% 60%), hsl(248 88% 64%))" } : undefined}
        >
          Past
        </button>
      </div>

      {bookingsLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      ) : (
        <>
          {view === "upcoming" && (
          <>
          {/* Upcoming */}
          <section className="space-y-3">
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
                {/* Featured NEXT SESSION card — dark indigo, Chat + emerald Join (spec p.11) */}
                {!showAllUpcoming && upcomingBookings[0] && (() => {
                  const next = upcomingBookings[0];
                  const tutorName = next.tutor_profile?.full_name || "Tutor";
                  return (
                    <div
                      className="rounded-2xl p-4 text-white shadow-md"
                      style={{ background: "linear-gradient(135deg, hsl(233 47% 26%), hsl(243 45% 34%))" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Next session</span>
                        <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold">
                          {startsInLabel(next.scheduled_at)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-bold shrink-0">
                          {tutorName.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">
                            {tutorName}{next.tutor_subjects?.subject ? ` · ${next.tutor_subjects.subject}` : ""}
                          </p>
                          <p className="text-xs text-white/70">
                            {new Date(next.scheduled_at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                            {" · "}
                            {new Date(next.scheduled_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            {" · "}{next.duration_minutes} min
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => onStartChat(next)}
                          className="rounded-full bg-white/15 py-2 text-xs font-semibold hover:bg-white/25 transition-colors"
                        >
                          Chat
                        </button>
                        <button
                          onClick={() => onJoinVideoSession(next)}
                          className="rounded-full bg-emerald-500 py-2 text-xs font-semibold hover:bg-emerald-600 transition-colors"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {showAllUpcoming && displayedUpcoming.map((booking) => (
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
                  <button
                    className="w-full text-center text-xs font-semibold text-primary py-1 hover:underline"
                    onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                  >
                    {showAllUpcoming
                      ? "Show less"
                      : `See all ${upcomingBookings.length} upcoming`}
                  </button>
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

          {/* Learning Filesystem — personal artifact vault */}
          <MyWorkPanel userId={userId} />
          </>
          )}

          {/* Past */}
          {view === "past" && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Past</h3>

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
                  <Card key={pastBooking.id} className={pastBooking.status !== "completed" ? "opacity-60" : undefined}>
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
                          {pastBooking.status === "completed" ? (
                            <Badge variant="outline" className="mt-1">Completed</Badge>
                          ) : (
                            <span className="mt-1 inline-block text-xs font-medium text-red-400">Cancelled</span>
                          )}
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
          )}
        </>
      )}
    </div>
  );
};
