import { useState, useEffect } from "react";
import {
  CreditCard, Plus, Trash2, Check, Shield, Loader2, FlaskConical, X, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/utils/logger";

interface SavedMethod {
  id: string;
  card_last4: string | null;
  card_brand: string | null;
  is_default: boolean | null;
  created_at: string | null;
  provider: string | null;
}

interface PaymentMethodsModalProps {
  open: boolean;
  onClose: () => void;
}

const getCardColor = (brand: string | null) => {
  const b = (brand || "").toLowerCase();
  if (b.includes("visa")) return "bg-blue-600";
  if (b.includes("master")) return "bg-red-500";
  if (b.includes("amex")) return "bg-blue-800";
  return "bg-muted-foreground";
};

const getCardLabel = (brand: string | null) => {
  const b = (brand || "").toLowerCase();
  if (b.includes("visa")) return "VISA";
  if (b.includes("master")) return "MC";
  if (b.includes("amex")) return "AMEX";
  return "CARD";
};

export function PaymentMethodsModal({ open, onClose }: PaymentMethodsModalProps) {
  const [methods, setMethods] = useState<SavedMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addingPaystack, setAddingPaystack] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) fetchMethods();
  }, [open]);

  const fetchMethods = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("saved_payment_methods")
        .select("id, card_last4, card_brand, is_default, created_at, provider")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMethods(data || []);
    } catch (err) {
      logger.error("Fetch methods failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMethod = async () => {
    setAdding(true);
    try {
      const returnUrl = `${window.location.origin}/payment-success?setup=1`;
      const cancelUrl = `${window.location.origin}/payment-cancelled?setup=1`;

      // Let supabase SDK auto-attach auth header; edge function validates JWT itself
      const response = await supabase.functions.invoke(
        "payfast-add-payment-method",
        { body: { returnUrl, cancelUrl } }
      );

      if (response.error) {
        // Surface real error from edge function (e.g. auth, secrets, payfast)
        const msg = response.error.message || "Could not start card setup";
        throw new Error(msg);
      }
      const data = response.data;
      if (!data?.success) throw new Error(data?.error || "Setup failed");

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
      form.submit();
    } catch (error) {
      logger.error("Add method error:", error);
      toast({
        title: "Could not add card",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      });
      setAdding(false);
    }
  };

  const handleAddPaystack = async () => {
    setAddingPaystack(true);
    try {
      const callbackUrl = `${window.location.origin}/payment-success?provider=paystack&setup=1`;
      const response = await supabase.functions.invoke("paystack-initialize", {
        body: { mode: "setup", callbackUrl, currency: "ZAR" },
      });
      if (response.error) {
        throw new Error(response.error.message || "Could not start Paystack setup");
      }
      const url = response.data?.authorization_url;
      if (!url) throw new Error("No authorization URL returned");
      window.location.href = url;
    } catch (error) {
      logger.error("Paystack add error:", error);
      toast({
        title: "Could not start Paystack",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      });
      setAddingPaystack(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error("Not signed in");

      await supabase
        .from("saved_payment_methods")
        .update({ is_default: false })
        .eq("user_id", userId);
      await supabase
        .from("saved_payment_methods")
        .update({ is_default: true })
        .eq("id", id);

      toast({ title: "Default card updated" });
      fetchMethods();
    } catch (err) {
      toast({
        title: "Could not update default",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("saved_payment_methods")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setMethods((prev) => prev.filter((m) => m.id !== id));
      toast({ title: "Card removed" });
    } catch {
      toast({ title: "Error removing card", variant: "destructive" });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-bold text-lg">Payment methods</h3>
            <p className="text-xs text-muted-foreground">Add or update how you pay for sessions</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Saved cards */}
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : methods.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-muted mx-auto flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No payment methods yet</p>
              <p className="text-xs text-muted-foreground">
                Add a card now for one-tap booking later.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Your cards
              </p>
              {methods.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-border"
                >
                  <div
                    className={`h-10 w-10 rounded-lg ${getCardColor(m.card_brand)} flex items-center justify-center shrink-0`}
                  >
                    <span className="text-white text-[10px] font-bold">
                      {getCardLabel(m.card_brand)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">
                        •••• {m.card_last4 || "****"}
                      </p>
                      {m.is_default && (
                        <Badge className="text-[10px] h-4 px-1.5 bg-primary/10 text-primary border-primary/20">
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.card_brand || "Card"}
                      <span className="ml-1.5 opacity-70">
                        · {m.provider === "paystack" ? "Paystack" : "PayFast"}
                      </span>
                    </p>
                  </div>
                  {!m.is_default && (
                    <button
                      onClick={() => handleSetDefault(m.id)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title="Set as default"
                    >
                      <Star className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new */}
          <button
            onClick={handleAddMethod}
            disabled={adding}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              {adding ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : (
                <Plus className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">
                {adding ? "Redirecting to PayFast…" : "Add payment method"}
              </p>
              <p className="text-xs text-muted-foreground">
                Card, EFT or Instant EFT — R1 verification (auto-reversed)
              </p>
            </div>
          </button>

          {/* Test card info */}
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3 flex gap-3">
            <FlaskConical className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                DevCard available at checkout
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Use the built-in test card to try bookings without adding a real card.
              </p>
            </div>
          </div>

          {/* Trust */}
          <div className="flex items-center gap-2 justify-center pt-2">
            <Shield className="h-3.5 w-3.5 text-green-600" />
            <p className="text-[11px] text-muted-foreground">
              Secured by PayFast · 256-bit SSL · PCI-DSS Level 1
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
