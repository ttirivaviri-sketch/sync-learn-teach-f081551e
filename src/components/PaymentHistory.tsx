import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, CheckCircle, Clock, XCircle, RefreshCw, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  provider: string | null;
  created_at: string;
  booking: {
    id: string;
    scheduled_at: string;
    tutor_subjects: {
      subject: string;
    } | null;
    tutor_profile: {
      full_name: string | null;
    } | null;
  } | null;
}

interface PaymentHistoryProps {
  userId: string;
  limit?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
}

export const PaymentHistory = ({ 
  userId, 
  limit = 5, 
  showViewAll = true,
  onViewAll 
}: PaymentHistoryProps) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    if (userId) {
      loadPayments();
    }
  }, [userId]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          currency,
          status,
          provider,
          created_at,
          booking:bookings(
            id,
            scheduled_at,
            tutor_subjects(subject),
            tutor_profile:profiles!bookings_tutor_id_fkey(full_name)
          )
        `)
        .eq("payer_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      setPayments((data as unknown as Payment[]) || []);

      // Calculate total spent from succeeded payments
      const { data: allPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("payer_id", userId)
        .eq("status", "succeeded");

      const total = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      setTotalSpent(total);
    } catch (error) {
      console.error("Error loading payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: Payment["status"]) => {
    switch (status) {
      case "succeeded":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "refunded":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: Payment["status"]) => {
    switch (status) {
      case "succeeded":
        return <Badge variant="default" className="bg-green-500">Paid</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "refunded":
        return <Badge variant="outline">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-5 w-5" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-5 w-5" />
            Payment History
          </CardTitle>
          {totalSpent > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total Spent</p>
              <p className="font-semibold text-primary">R{totalSpent.toFixed(2)}</p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {payments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No payments yet</p>
            <p className="text-xs">Your payment history will appear here</p>
          </div>
        ) : (
          <>
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(payment.status)}
                  <div>
                    <p className="font-medium text-sm">
                      {payment.booking?.tutor_subjects?.subject || "Tutoring Session"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payment.booking?.tutor_profile?.full_name || "Tutor"} •{" "}
                      {format(new Date(payment.created_at), "MMM dd, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      R{Number(payment.amount).toFixed(2)}
                    </p>
                    {getStatusBadge(payment.status)}
                  </div>
                </div>
              </div>
            ))}

            {showViewAll && payments.length >= limit && onViewAll && (
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={onViewAll}
              >
                View All Transactions
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
