import { useState, useEffect } from "react";
import {
  CreditCard,
  Shield,
  Loader2,
  ChevronLeft,
  Clock,
  User,
  BookOpen,
  Plus,
  FlaskConical,
  Trash2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BookingRequest } from "@/hooks/useRealtimeBookings";
import { format } from "date-fns";
import { logger } from "@/utils/logger";

interface SavedMethod {
  id: string;
  card_last4: string | null;
  card_brand: string | null;
  is_default: boolean | null;
}

interface PaymentCheckoutProps {
  booking: BookingRequest;
  onBack: () => void;
  onPaymentInitiated: (booking: BookingRequest) => void;
}

const CARD_BRAND_COLORS: Record<string, string> = {
  visa: "bg-blue-600",
  mastercard: "bg-red-500",
  amex: "bg-blue-800",
  default: "bg-muted-foreground",
};

const getCardIcon = (brand: string | null) => {
  const b = (brand || "").toLowerCase();
  if (b.includes("visa")) return "VISA";
  if (b.includes("master")) return "MC";
  if (b.includes("amex")) return "AMEX";
  return "CARD";
};

const getCardColor = (brand: string | null) => {
  const b = (brand || "").toLowerCase();
  if (b.includes("visa")) return CARD_BRAND_COLORS.visa;
  if (b.includes("master")) return CARD_BRAND_COLORS.mastercard;
  if (b.includes("amex")) return CARD_BRAND_COLORS.amex;
  return CARD_BRAND_COLORS.default;
};

export const PaymentCheckout = ({
  booking,
  onBack,
  onPaymentInitiated,
}: PaymentCheckoutProps) => {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedMethods, setSavedMethods] = useState<SavedMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const { toast } = useToast();

  const amount = Number(booking.price);
  const itemName = `${booking.tutor_subjects?.subject || "Tutoring"} - ${booking.duration_minutes}min session`;
  const scheduledTime = new Date(booking.scheduled_at);

  useEffect(() => {
    fetchSavedMethods();
  }, []);

  const fetchSavedMethods = async () => {
    try {
      const { data, error } = await supabase
        .from("saved_payment_methods")
        .select("id, card_last4, card_brand, is_default")
        .order("is_default", { ascending: false });

      if (!error && data) {
        setSavedMethods(data);
        const defaultCard = data.find((m) => m.is_default);
        if (defaultCard) setSelectedMethod(defaultCard.id);
        else if (data.length > 0) setSelectedMethod(data[0].id);
      }
    } catch (err) {
      logger.error("Failed to fetch saved methods:", err);
    } finally {
      setLoadingMethods(false);
    }
  };

  const handleDevCardPayment = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) throw new Error("Please log in to make a payment");

      await new Promise((r) => setTimeout(r, 1500));

      const { error: paymentError } = await supabase.from("payments").insert({
        booking_id: booking.id,
        payer_id: sessionData.session.user.id,
        amount,
        status: "succeeded" as any,
        provider: "devcard",
        currency: "ZAR",
      });

      if (paymentError) throw paymentError;

      await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", booking.id);

      onPaymentInitiated(booking);
    } catch (error) {
      logger.error("DevCard payment error:", error);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to process test payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavedCardPayment = async (method: SavedMethod) => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) throw new Error("Please log in to make a payment");

      const response = await supabase.functions.invoke("payfast-charge-token", {
        body: { bookingId: booking.id, savedMethodId: method.id },
      });

      if (response.error) throw new Error(response.error.message);

      const result = response.data;
      if (result.success) {
        onPaymentInitiated(booking);
      } else {
        throw new Error(result.error || "Payment failed");
      }
    } catch (error) {
      logger.error("Saved card payment error:", error);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewCardPayment = async () => {
    setLoading(true);
    try {
      const returnUrl = `${window.location.origin}/payment-success?booking=${booking.id}`;
      const cancelUrl = `${window.location.origin}/payment-cancelled?booking=${booking.id}`;

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) throw new Error("Please log in to make a payment");

      const response = await supabase.functions.invoke("payfast-create-payment", {
        body: {
          bookingId: booking.id,
          amount,
          itemName,
          returnUrl,
          cancelUrl,
        },
      });

      if (response.error) throw new Error(response.error.message || "Payment initiation failed");

      const data = response.data;
      if (!data?.success) throw new Error(data?.error || "Failed to create payment");

      const { payfastUrl, paymentData } = data;

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
      onPaymentInitiated(booking);
      form.submit();
    } catch (error) {
      logger.error("Payment error:", error);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleDeleteMethod = async (methodId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from("saved_payment_methods")
        .delete()
        .eq("id", methodId);

      if (error) throw error;
      setSavedMethods((prev) => prev.filter((m) => m.id !== methodId));
      if (selectedMethod === methodId) setSelectedMethod(null);
      toast({ title: "Card removed" });
    } catch {
      toast({ title: "Error", description: "Failed to remove card", variant: "destructive" });
    }
  };

  const handlePay = () => {
    if (selectedMethod === "devcard") return handleDevCardPayment();
    if (selectedMethod === "new-card") return handleNewCardPayment();

    const saved = savedMethods.find((m) => m.id === selectedMethod);
    if (saved) return handleSavedCardPayment(saved);

    // Fallback to new card
    return handleNewCardPayment();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={onBack} disabled={loading}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Payment</h1>
          </div>
          <Shield className="h-5 w-5 text-green-600" />
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full p-4 space-y-5 pb-36">
        {/* Booking Summary — compact */}
        <div className="rounded-xl bg-muted/50 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {(booking.tutor_profile?.full_name || "T").charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">
                {booking.tutor_profile?.full_name || "Tutor"}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BookOpen className="h-3 w-3" />
                <span>{booking.tutor_subjects?.subject}</span>
                <span>·</span>
                <Clock className="h-3 w-3" />
                <span>{format(scheduledTime, "EEE, MMM d · h:mm a")}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">R{amount.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{booking.duration_minutes} min</p>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Payment Method
          </p>

          <div className="space-y-2">
            {/* DevCard — Test */}
            <button
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                selectedMethod === "devcard"
                  ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                  : "border-border hover:border-amber-300"
              }`}
              onClick={() => setSelectedMethod("devcard")}
              disabled={loading}
            >
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <FlaskConical className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">DevCard</span>
                  <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-amber-300">
                    Test
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">No real money charged</p>
              </div>
              <div
                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedMethod === "devcard" ? "border-amber-500 bg-amber-500" : "border-muted-foreground/30"
                }`}
              >
                {selectedMethod === "devcard" && <Check className="h-3 w-3 text-white" />}
              </div>
            </button>

            {/* Saved Cards */}
            {loadingMethods ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              savedMethods.map((method) => (
                <button
                  key={method.id}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                    selectedMethod === method.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                  onClick={() => setSelectedMethod(method.id)}
                  disabled={loading}
                >
                  <div
                    className={`h-10 w-10 rounded-lg ${getCardColor(method.card_brand)} flex items-center justify-center`}
                  >
                    <span className="text-white text-[10px] font-bold">
                      {getCardIcon(method.card_brand)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {method.card_brand || "Card"} •••• {method.card_last4 || "****"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {method.is_default ? "Default card" : "Saved card"}
                    </p>
                  </div>
                  <button
                    className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                    onClick={(e) => handleDeleteMethod(method.id, e)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedMethod === method.id ? "border-primary bg-primary" : "border-muted-foreground/30"
                    }`}
                  >
                    {selectedMethod === method.id && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                </button>
              ))
            )}

            {/* Add new card */}
            <button
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed transition-all text-left ${
                selectedMethod === "new-card"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
              onClick={() => setSelectedMethod("new-card")}
              disabled={loading}
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Add payment method</p>
                <p className="text-xs text-muted-foreground">
                  Card, EFT, or Instant EFT via PayFast
                </p>
              </div>
              <div
                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedMethod === "new-card" ? "border-primary bg-primary" : "border-muted-foreground/30"
                }`}
              >
                {selectedMethod === "new-card" && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
            </button>
          </div>
        </div>

        {/* Trust badge */}
        <div className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
          <Shield className="h-4 w-4 text-green-600" />
          <div>
            <p className="text-xs font-semibold text-green-800 dark:text-green-300">
              Secured by PayFast
            </p>
            <p className="text-[10px] text-green-700 dark:text-green-400">
              256-bit SSL encryption
            </p>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg">
        <div className="max-w-lg mx-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-xl font-bold">R{amount.toFixed(2)}</span>
          </div>
          <Button
            className="w-full h-12 text-base rounded-xl"
            onClick={handlePay}
            disabled={loading || !selectedMethod}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : selectedMethod === "devcard" ? (
              <>
                <FlaskConical className="mr-2 h-5 w-5" />
                Pay R{amount.toFixed(2)} (Test)
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-5 w-5" />
                Pay R{amount.toFixed(2)}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
