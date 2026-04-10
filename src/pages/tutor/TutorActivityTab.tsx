/**
 * TutorActivityTab — Booking manager, availability schedule, session history.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TutorBookingManager } from "@/components/TutorBookingManager";
import TutorAvailabilitySchedule from "@/components/TutorAvailabilitySchedule";
import SessionHistory from "@/components/SessionHistory";
import type { BookingRequest } from "@/hooks/useRealtimeBookings";

interface TutorActivityTabProps {
  bookings: BookingRequest[];
  bookingsLoading: boolean;
  tutorId: string;
  onAccept: (booking: BookingRequest) => void | Promise<void>;
  onDecline: (booking: BookingRequest) => void | Promise<void>;
  onJoinSession: (booking: BookingRequest) => void;
  onStartChat: (booking: BookingRequest) => void;
}

export const TutorActivityTab = ({
  bookings,
  bookingsLoading,
  tutorId,
  onAccept,
  onDecline,
  onJoinSession,
  onStartChat,
}: TutorActivityTabProps) => (
  <div className="space-y-4">
    {/* Booking Manager */}
    <TutorBookingManager
      bookings={bookings}
      loading={bookingsLoading}
      onAccept={onAccept}
      onDecline={onDecline}
      onJoinSession={onJoinSession}
      onStartChat={onStartChat}
    />

    {/* Availability Schedule */}
    <TutorAvailabilitySchedule tutorId={tutorId} />

    {/* Session History */}
    <Card>
      <CardHeader>
        <CardTitle>Session History</CardTitle>
      </CardHeader>
      <CardContent>
        <SessionHistory userType="tutor" userId={tutorId} />
      </CardContent>
    </Card>
  </div>
);
