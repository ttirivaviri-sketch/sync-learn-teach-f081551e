import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard, Shield, Trash2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDevMode } from "@/contexts/DevModeContext";
import { logger } from "@/utils/logger";

interface SavedMethod {
  id: string;
  card_last4: string | null;
  card_brand: string | null;
  is_default: boolean;
}

interface PayFastPaymentProps {
  bookingId: string;
  amount: number;
  itemName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const PayFastPayment = ({
  bookingId,
  amount,
  itemName,
  onSuccess,
  onCancel,
}: PayFastPaymentProps) => {
  const [loading, setLoading] = useState(false);
  const [savedMethods, setSavedMethods] = useState<SavedMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const { toast } = useToast();
  const { isDevMode, config } = useDevMode();

  // ── Dev Mode: instant simulated success ──────────────────────────────
  const devBypass = isDevMode && config.bypassPayments;

  useEffect(() => {
    if (devBypass) {
      setLoadingMethods(false);
      return;
    }
    fetchSavedMethods();
  }, [devBypass]);

  const fetchSavedMethods = async () => {
    try {
      const { data, error } = await supabase
        .from("saved_payment_methods")
        .select("id, card_last4, card_brand, is_default")
        .order("is_default", { ascending: false });

      if (!error && data) setSavedMethods(data);
    } catch (err) {
      logger.error("Failed to fetch saved methods:", err);
    } finally {
      setLoadingMethods(false);
    }
  };

  const handleDevPay = () => {
    setLoading(true);
    // Simulate brief processing
    setTimeout(() => {
      toast({
        title: "✅ Dev Mode — Payment Simulated",
        description: `R${amount.toFixed(2)} marked as paid (no real charge).`,
      });
      setLoading(false);
      onSuccess?.();
    }, 600);
  };

  const handleSavedCardPayment = async (method: SavedMethod) => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) throw new Error("Please log in to make a payment");

      const response = await supabase.functions.invoke("payfast-charge-token", {
        body: { bookingId, savedMethodId: method.id },
      });

      if (response.error) throw new Error(response.error.message);

      const result = response.data;
      if (result.success) {
        toast({
          title: "Payment Successful",
          description: `Paid R${amount.toFixed(2)} with ${method.card_brand || "card"} ...${method.card_last4 || "****"}`,
        });
        onSuccess?.();
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
      const returnUrl = `${window.location.origin}/payment-success?booking=${bookingId}`;
      const cancelUrl = `${window.location.origin}/payment-cancelled?booking=${bookingId}`;

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) throw new Error("Please log in to make a payment");

      const response = await supabase.functions.invoke("payfast-create-payment", {
        body: { bookingId, amount, itemName, returnUrl, cancelUrl },
      });

      if (response.error) throw new Error(response.error.message);

      const { payfastUrl, paymentData } = response.data;

      const form = document.createElement("form");
      form.method = "POST";
      form.action = payfastUrl;

      Object.entries(paymentData).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value as string;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      logger.error("Payment error:", error);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to initiate payment",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleDeleteMethod = async (methodId: string) => {
    try {
      const { error } = await supabase
        .from("saved_payment_methods")
        .delete()
        .eq("id", methodId);

      if (error) throw error;
      setSavedMethods((prev) => prev.filter((m) => m.id !== methodId));
      toast({ title: "Card removed" });
    } catch {
      toast({ title: "Error", description: "Failed to remove card", variant: "destructive" });
    }
  };

  // ── Dev Mode UI ──────────────────────────────────────────────────────
  if (devBypass) {
    return (
      <Card className="w-full max-w-md border-2" style={{ borderColor: "hsl(48 96% 53% / 0.5)" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment (Dev Mode)
          </CardTitle>
          <CardDescription>Payments bypassed — instant confirmation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg p-4" style={{ backgroundColor: "hsl(48 100% 95%)" }}>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Session:</span>
              <span className="font-medium">{itemName}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-muted-foreground">Amount:</span>
              <span className="text-2xl font-bold">R{amount.toFixed(2)}</span>
            </div>
          </div>

          <Button
            className="w-full gap-2"
            style={{ backgroundColor: "hsl(48 96% 45%)", color: "hsl(40 80% 10%)" }}
            onClick={handleDevPay}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            {loading ? "Processing..." : "Simulate Payment Success"}
          </Button>

          {config.simulateFailures && (
            <Button
              variant="destructive"
              className="w-full gap-2 text-xs"
              onClick={() => {
                toast({ title: "❌ Dev Mode — Payment Failed", description: "Simulated failure for testing.", variant: "destructive" });
              }}
            >
              Simulate Payment Failure
            </Button>
          )}

          <Button variant="outline" className="w-full" onClick={onCancel}>
            Cancel
          </Button>

          <p className="text-[10px] text-center" style={{ color: "hsl(40 40% 50%)" }}>
            🧪 Dev Mode — no real payment will be processed
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Real Payment UI ──────────────────────────────────────────────────
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Secure Payment
        </CardTitle>
        <CardDescription>Pay securely with PayFast</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Session:</span>
            <span className="font-medium">{itemName}</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-muted-foreground">Amount:</span>
            <span className="text-2xl font-bold">R{amount.toFixed(2)}</span>
          </div>
        </div>

        {/* Saved cards */}
        {!loadingMethods && savedMethods.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Saved cards</p>
            {savedMethods.map((method) => (
              <div key={method.id} className="flex items-center gap-2">
                <Button
                  className="flex-1 justify-start"
                  variant="outline"
                  onClick={() => handleSavedCardPayment(method)}
                  disabled={loading}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {method.card_brand || "Card"} ...{method.card_last4 || "****"}
                  <span className="ml-auto text-muted-foreground">R{amount.toFixed(2)}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteMethod(method.id)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>Secured by PayFast</span>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleNewCardPayment} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                {savedMethods.length > 0 ? "New card" : `Pay R${amount.toFixed(2)}`}
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          {savedMethods.length > 0
            ? "Tap a saved card for instant payment, or use a new card"
            : "Supports Credit/Debit Cards, EFT, and Instant EFT. Your card will be saved for future payments."}
        </p>
      </CardContent>
    </Card>
  );
};
