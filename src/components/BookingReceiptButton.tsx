/**
 * BookingReceiptButton — Looks up the succeeded payment for a booking and
 * downloads a PDF receipt. Renders nothing if no paid payment is found.
 */
import { useEffect, useState } from "react";
import { Download, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useReceipt } from "@/hooks/useReceipt";

interface Props {
  bookingId: string;
  variant?: "ghost" | "outline" | "default";
  size?: "sm" | "default";
  label?: string;
  className?: string;
}

export function BookingReceiptButton({
  bookingId,
  variant = "outline",
  size = "sm",
  label = "Receipt",
  className,
}: Props) {
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const { downloadReceipt, downloading } = useReceipt();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("payments")
        .select("id")
        .eq("booking_id", bookingId)
        .eq("status", "succeeded")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setPaymentId(data?.id ?? null);
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (checking || !paymentId) return null;

  const isLoading = downloading === paymentId;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => downloadReceipt(paymentId)}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <FileText className="h-4 w-4 mr-1" />
      )}
      {label}
    </Button>
  );
}
