import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  const handlePayment = async () => {
    setLoading(true);
    try {
      const returnUrl = `${window.location.origin}/payment-success?booking=${bookingId}`;
      const cancelUrl = `${window.location.origin}/payment-cancelled?booking=${bookingId}`;

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        throw new Error("Please log in to make a payment");
      }

      const response = await supabase.functions.invoke("payfast-create-payment", {
        body: {
          bookingId,
          amount,
          itemName,
          returnUrl,
          cancelUrl,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { payfastUrl, paymentData } = response.data;

      // Create and submit form to PayFast
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
      console.error("Payment error:", error);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to initiate payment",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

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

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>Your payment is secured by PayFast</span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handlePayment}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Pay R{amount.toFixed(2)}
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Supports Credit/Debit Cards, EFT, and Instant EFT
        </p>
      </CardContent>
    </Card>
  );
};
