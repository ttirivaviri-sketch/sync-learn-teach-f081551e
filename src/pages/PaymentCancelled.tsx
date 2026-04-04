import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XCircle, CreditCard, ArrowLeft, Calendar, Clock, User, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface BookingDetails {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  price: number;
  status: string;
  tutor_profile?: { full_name: string | null };
  tutor_subjects?: { subject: string; level: string };
}

const PaymentCancelled = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking");
  const [booking, setBooking] = useState<BookingDetails | null>(null);

  useEffect(() => {
    document.title = "Payment Cancelled | StudySync";
  }, []);

  // Fetch booking details for display
  useEffect(() => {
    if (!bookingId) return;

    const fetchBooking = async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `id, scheduled_at, duration_minutes, price, status,
           tutor_profile:profiles!bookings_tutor_id_fkey(full_name),
           tutor_subjects(subject, level)`
        )
        .eq("id", bookingId)
        .single();

      if (!error && data) {
        setBooking(data as unknown as BookingDetails);
      }
    };

    fetchBooking();
  }, [bookingId]);

  const handleRetryPayment = () => {
    // Go back to learner activity tab which shows pending payments
    navigate("/learner");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
            <XCircle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
          <CardDescription>
            Your payment was not completed. No charges were made to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Booking Details */}
          {booking && (
            <div className="rounded-lg bg-muted/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {booking.tutor_profile?.full_name || "Tutor"}
                </span>
              </div>
              {booking.tutor_subjects && (
                <div className="flex items-center gap-2 text-sm">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {booking.tutor_subjects.subject} - {booking.tutor_subjects.level}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{format(new Date(booking.scheduled_at), "EEE, MMM d 'at' h:mm a")}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{booking.duration_minutes} minutes</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Amount</span>
                <span className="font-semibold">R{Number(booking.price).toFixed(2)}</span>
              </div>
            </div>
          )}

          {bookingId && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Booking Reference</span>
              <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
                {bookingId.slice(0, 8).toUpperCase()}
              </code>
            </div>
          )}

          <div className="flex justify-center">
            <Badge variant="secondary">No Charges Made</Badge>
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-3">
            <p className="text-xs text-blue-800 dark:text-blue-300">
              <span className="font-medium">Your booking is still active.</span> You can complete
              payment at any time from your Activity tab. The tutor has already confirmed your
              session.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={handleRetryPayment} className="w-full">
              <CreditCard className="mr-2 h-4 w-4" />
              Try Payment Again
            </Button>
            <Button variant="outline" onClick={() => navigate("/learner")} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to My Sessions
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")} className="w-full">
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentCancelled;
