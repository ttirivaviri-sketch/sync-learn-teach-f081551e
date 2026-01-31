import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking");

  useEffect(() => {
    document.title = "Payment Successful | StudySync";
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Your tutoring session has been booked and paid for successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bookingId && (
            <p className="text-sm text-muted-foreground">
              Booking Reference: <span className="font-mono">{bookingId.slice(0, 8)}</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            You will receive a confirmation email shortly with your session details.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate("/learner")}>
              Go to My Sessions
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

export default PaymentSuccess;
