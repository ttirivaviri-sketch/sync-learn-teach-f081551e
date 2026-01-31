import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

const PaymentCancelled = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking");

  useEffect(() => {
    document.title = "Payment Cancelled | StudySync";
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
            <XCircle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
          <CardDescription>
            Your payment was not completed. No charges were made.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bookingId && (
            <p className="text-sm text-muted-foreground">
              Booking Reference: <span className="font-mono">{bookingId.slice(0, 8)}</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Your booking is still pending. You can try again or choose a different payment method.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate(-1)}>
              Try Again
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentCancelled;
