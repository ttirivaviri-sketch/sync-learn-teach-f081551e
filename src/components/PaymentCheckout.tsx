import { useState, useEffect } from "react";
import {
  CreditCard,
  Building2,
  Smartphone,
  Shield,
  Loader2,
  ChevronLeft,
  Clock,
  User,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BookingRequest } from "@/hooks/useRealtimeBookings";
import { format } from "date-fns";

type PaymentMethod = "card" | "eft" | "instant_eft" | "mobicred";

interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
}

interface PaymentCheckoutProps {
  booking: BookingRequest;
  onBack: () => void;
  onPaymentInitiated: () => void;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: "card",
    name: "Credit / Debit Card",
    description: "Visa, Mastercard, Amex, Diners Club",
    icon: <CreditCard className="h-5 w-5" />,
    badge: "Recommended",
  },
  {
    id: "eft",
    name: "EFT (Bank Transfer)",
    description: "Pay via your bank's online portal",
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    id: "instant_eft",
    name: "Instant EFT",
    description: "Secure instant bank payment via Ozow",
    icon: <Banknote className="h-5 w-5" />,
    badge: "Fast",
  },
  {
    id: "mobicred",
    name: "Mobicred",
    description: "Buy now, pay later in instalments",
    icon: <Smartphone className="h-5 w-5" />,
  },
];

export const PaymentCheckout = ({
  booking,
  onBack,
  onPaymentInitiated,
}: PaymentCheckoutProps) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("card");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"method" | "confirm">("method");
  const { toast } = useToast();

  const amount = Number(booking.price);
  const itemName = `${booking.tutor_subjects?.subject || "Tutoring"} - ${booking.duration_minutes}min session`;
  const scheduledTime = new Date(booking.scheduled_at);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const returnUrl = `${window.location.origin}/payment-success?booking=${booking.id}`;
      const cancelUrl = `${window.location.origin}/payment-cancelled?booking=${booking.id}`;

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        throw new Error("Please log in to make a payment");
      }

      const response = await supabase.functions.invoke("payfast-create-payment", {
        body: {
          bookingId: booking.id,
          amount,
          itemName,
          returnUrl,
          cancelUrl,
          paymentMethod: selectedMethod,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Payment initiation failed");
      }

      const data = response.data;
      if (!data?.success) {
        throw new Error(data?.error || "Failed to create payment");
      }

      const { payfastUrl, paymentData } = data;

      // Create and submit form to PayFast
      const form = document.createElement("form");
      form.method = "POST";
      form.action = payfastUrl;
      form.style.display = "none";

      Object.entries(paymentData).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value as string;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      onPaymentInitiated();
      form.submit();
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Payment Error",
        description:
          error instanceof Error ? error.message : "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const getMethodLabel = () => {
    return PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.name || "Selected method";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={onBack} disabled={loading}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">
              {step === "method" ? "Payment" : "Confirm Payment"}
            </h1>
            <p className="text-sm text-muted-foreground">Secure checkout via PayFast</p>
          </div>
          <Shield className="h-5 w-5 text-green-600" />
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4 pb-32">
        {/* Order Summary Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tutor & Session Info */}
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-medium">
                  {booking.tutor_profile?.full_name || "Tutor"}
                </h3>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>
                    {booking.tutor_subjects?.subject} - {booking.tutor_subjects?.level}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Session Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Date & Time
                </span>
                <span className="font-medium">
                  {format(scheduledTime, "EEE, MMM d 'at' h:mm a")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{booking.duration_minutes} minutes</span>
              </div>
            </div>

            <Separator />

            {/* Price Breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Session Fee</span>
                <span>R{amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform Fee</span>
                <span className="text-green-600">Free</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="text-primary">R{amount.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {step === "method" && (
          <>
            {/* Payment Method Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
                  Select Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.id}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all text-left ${
                      selectedMethod === method.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedMethod(method.id)}
                    disabled={loading}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        selectedMethod === method.id
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {method.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{method.name}</span>
                        {method.badge && (
                          <Badge
                            variant="secondary"
                            className="text-xs px-1.5 py-0 h-5"
                          >
                            {method.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{method.description}</p>
                    </div>
                    <div
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        selectedMethod === method.id ? "border-primary" : "border-muted-foreground/30"
                      }`}
                    >
                      {selectedMethod === method.id && (
                        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Security Notice */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
              <Shield className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div className="text-xs text-green-800 dark:text-green-300">
                <p className="font-medium">Secure Payment</p>
                <p className="mt-0.5 text-green-700 dark:text-green-400">
                  Your payment is processed securely by PayFast, South Africa's trusted payment
                  gateway. We never store your card details.
                </p>
              </div>
            </div>
          </>
        )}

        {step === "confirm" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Confirm Payment
              </CardTitle>
              <CardDescription>
                You'll be redirected to PayFast to complete your {getMethodLabel()} payment of{" "}
                <span className="font-semibold text-foreground">R{amount.toFixed(2)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className="font-medium">{getMethodLabel()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold text-primary">R{amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>
                  After payment, you'll be redirected back to StudySync. Your session will be
                  automatically confirmed once payment is verified.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 shadow-lg">
        <div className="max-w-lg mx-auto">
          {step === "method" ? (
            <Button className="w-full h-12 text-base" onClick={() => setStep("confirm")} disabled={loading}>
              Continue to Payment
              <CreditCard className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <div className="space-y-2">
              <Button
                className="w-full h-12 text-base"
                onClick={handlePayment}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Redirecting to PayFast...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-5 w-5" />
                    Pay R{amount.toFixed(2)} Securely
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setStep("method")}
                disabled={loading}
              >
                Change payment method
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
