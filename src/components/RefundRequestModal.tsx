import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/utils/logger";

interface RefundRequestModalProps {
  open: boolean;
  onClose: () => void;
  paymentId: string;
  bookingId: string;
  amount: number;
}

export const RefundRequestModal = ({ open, onClose, paymentId, bookingId, amount }: RefundRequestModalProps) => {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason for your refund request.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from('refund_requests').insert({
        payment_id: paymentId,
        booking_id: bookingId,
        requester_id: user.id,
        reason: reason.trim(),
      });

      if (error) throw error;

      toast({ title: "Refund Requested", description: "Your refund request has been submitted for review." });
      onClose();
    } catch (error) {
      logger.error("Refund request error:", error);
      toast({ title: "Error", description: "Failed to submit refund request.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Refund</DialogTitle>
          <DialogDescription>Request a refund for R{amount.toFixed(2)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="Please explain why you'd like a refund..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit Request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
