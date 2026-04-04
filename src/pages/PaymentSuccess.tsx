import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, AlertCircle, Calendar, Clock, User, BookOpen } from "lucide-react";
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

type VerificationStatus = "verifying" | "confirmed" | "pending" | "failed";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking");
  const [status, setStatus] = useState<VerificationStatus>("verifying");
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>("pending");

  useEffect(() => {
    document.title = "Payment Successful | StudySync";
  }, []);

  // Poll for payment verification
  useEffect(() => {
    if (!bookingId) {
      setStatus("failed");
      return;
    }

    let attempts = 0;
    const maxAttempts = 20; // 20 attempts x 3s = 60s max
    let timeoutId: ReturnType<typeof setTimeout>;

    const checkPayment = async () => {
      try {
        // Fetch booking details
        const { data: bookingData, error: bookingError } = await supabase
          .from("bookings")
          .select(
            `id, scheduled_at, duration_minutes, price, status,
             tutor_profile:profiles!bookings_tutor_id_fkey(full_name),
             tutor_subjects(subject, level)`
          )
          .eq("id", bookingId)
          .single();

        if (bookingError) {
          console.error("Booking fetch error:", bookingError);
        } else if (bookingData) {
          setBooking(bookingData as unknown as BookingDetails);
        }

        // Fetch payment status
        const { data: payments, error: paymentError } = await supabase
          .from("payments")
          .select("status")
          .eq("booking_id", bookingId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (paymentError) {
          console.error("Payment fetch error:", paymentError);
        }

        const latestPayment = payments?.[0];

        if (latestPayment?.status === "succeeded") {
          setPaymentStatus("succeeded");
          setStatus("confirmed");
          return; // Stop polling
        }

        if (latestPayment?.status === "failed") {
          setPaymentStatus("failed");
          setStatus("failed");
          return;
        }

        // Still pending - continue polling
        setPaymentStatus(latestPayment?.status || "pending");
        attempts++;

        if (attempts >= maxAttempts) {
          // PayFast return URL was hit but ITN hasn't arrived yet
          // This is normal - show success anyway since PayFast confirmed
          setStatus("pending");
          return;
        }

        timeoutId = setTimeout(checkPayment, 3000);
      } catch (error) {
        console.error("Verification error:", error);
        attempts++;
        if (attempts >= maxAttempts) {
          setStatus("pending");
          return;
        }
        timeoutId = setTimeout(checkPayment, 3000);
      }
    };

    checkPayment();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [bookingId]);

  const renderContent = () => {
    if (status === "verifying") {
      return (
        <>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <CardTitle className="text-2xl">Verifying Payment...</CardTitle>
          <CardDescription>
            Please wait while we confirm your payment with PayFast.
          </CardDescription>
        </>
      );
    }

    if (status === "confirmed") {
      return (
        <>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Payment Confirmed!</CardTitle>
          <CardDescription>
            Your payment has been verified and your tutoring session is secured.
          </CardDescription>
        </>
      );
    }

    if (status === "pending") {
      return (
        <>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Payment Submitted!</CardTitle>
          <CardDescription>
            Your payment has been submitted to PayFast. Confirmation may take a few moments.
          </CardDescription>
        </>
      );
    }

    // Failed
    return (
      <>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
          <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <CardTitle className="text-2xl">Payment Issue</CardTitle>
        <CardDescription>
          There was a problem verifying your payment. If you were charged, it will be automatically refunded.
        </CardDescription>
      </>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">{renderContent()}</CardHeader>
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
                <span className="text-sm font-medium">Amount Paid</span>
                <span className="font-semibold text-primary">R{Number(booking.price).toFixed(2)}</span>
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

          {/* Payment Status Badge */}
          {status !== "verifying" && (
            <div className="flex justify-center">
              <Badge
                variant={
                  paymentStatus === "succeeded"
                    ? "default"
                    : paymentStatus === "failed"
                    ? "destructive"
                    : "secondary"
                }
                className={
                  paymentStatus === "succeeded"
                    ? "bg-green-500"
                    : ""
                }
              >
                {paymentStatus === "succeeded"
                  ? "Payment Confirmed"
                  : paymentStatus === "failed"
                  ? "Payment Failed"
                  : "Processing..."}
              </Badge>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            {status === "confirmed" || status === "pending"
              ? "You'll receive a confirmation notification with session details."
              : "If you continue to experience issues, please contact support."}
          </p>

          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate("/learner")} className="w-full">
              Go to My Sessions
            </Button>
            {status === "failed" && (
              <Button variant="outline" onClick={() => navigate(-1)} className="w-full">
                Try Again
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate("/")} className="w-full">
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
