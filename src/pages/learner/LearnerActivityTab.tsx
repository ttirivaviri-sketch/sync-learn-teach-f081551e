/**
 * LearnerActivityTab — Pending payments, upcoming & past sessions.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveBookingCard } from "@/components/LiveBookingCard";
import { PendingPaymentCard } from "@/components/PendingPaymentCard";
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
}: LearnerActivityTabProps) => (
  <div className="space-y-4 p-4 mt-0">
    {/* Bookings needing payment */}
    {bookingsNeedingPayment.length > 0 && (
      <div className="mb-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
          Action Required — Complete Payment
        </h3>
        <div className="space-y-3">
          {bookingsNeedingPayment.map((booking) => (
            <PendingPaymentCard
              key={booking.id}
              booking={booking}
              onPaymentComplete={() => {}}
              onStartCheckout={onStartCheckout}
            />
          ))}
        </div>
      </div>
    )}

    {/* Upcoming Sessions */}
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Upcoming Sessions</h3>
        <Badge variant="outline">{bookings.length} active</Badge>
      </div>

      {bookingsLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Loading bookings...</p>
        </div>
      ) : bookings.length === 0 ? (
        <Card className="p-6">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No upcoming sessions</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
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
        </div>
      )}
    </div>

    {/* Past Sessions */}
    <div className="mt-6">
      <h3 className="font-semibold mb-3">Past Sessions</h3>
      {bookings.filter((b) => b.status === "completed" || b.status === "canceled").length === 0 ? (
        <Card className="p-6">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No past sessions yet</p>
          </div>
        </Card>
      ) : (
        bookings
          .filter((b) => b.status === "completed" || b.status === "canceled")
          .map((pastBooking) => (
            <Card key={pastBooking.id} className="mb-3">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{pastBooking.tutor_profile?.full_name || "Tutor"}</h4>
                    <p className="text-sm text-muted-foreground">{pastBooking.tutor_subjects?.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(pastBooking.scheduled_at).toLocaleDateString()} • {pastBooking.duration_minutes} min
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">R{pastBooking.price}</p>
                    <Badge variant={pastBooking.status === "completed" ? "outline" : "destructive"} className="mt-1">
                      {pastBooking.status === "completed" ? "Completed" : "Cancelled"}
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
                            reviewedName: pastBooking.tutor_profile?.full_name || "Tutor",
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
            </Card>
          ))
      )}
    </div>
  </div>
);
