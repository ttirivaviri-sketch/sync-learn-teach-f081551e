import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, CheckCircle, Clock, XCircle, RefreshCw, ChevronRight, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { logger } from "@/utils/logger";

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
  limit = 50, 
  showViewAll = true,
  onViewAll 
}: PaymentHistoryProps) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);

  // Collapsed sections - only show most recent by default
  const [showPending, setShowPending] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);

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
      logger.error("Error loading payments:", error);
    } finally {
      setLoading(false);
    }
  };

  // Categorize payments
  const { mostRecent, pendingPayments, completedPayments, upcomingPayments } = useMemo(() => {
    const pending = payments.filter(p => p.status === "pending");
    const completed = payments.filter(p => p.status === "succeeded");
    const upcoming = payments.filter(p => {
      if (!p.booking?.scheduled_at) return false;
      return new Date(p.booking.scheduled_at) > new Date();
    });
    return {
      mostRecent: payments.length > 0 ? payments[0] : null,
      pendingPayments: pending,
      completedPayments: completed,
      upcomingPayments: upcoming,
    };
  }, [payments]);

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

  const PaymentRow = ({ payment }: { payment: Payment }) => (
    <div
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
  );

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
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
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
            {/* Most recent transaction - always visible */}
            {mostRecent && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
                  Most Recent
                </p>
                <PaymentRow payment={mostRecent} />
              </div>
            )}

            {/* Pending sessions - collapsed behind button */}
            {pendingPayments.length > 0 && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-sm font-medium"
                  onClick={() => setShowPending(!showPending)}
                >
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    Pending ({pendingPayments.length})
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showPending ? 'rotate-180' : ''}`} />
                </Button>
                {showPending && (
                  <div className="space-y-2 mt-2">
                    {pendingPayments.map(p => (
                      <PaymentRow key={p.id} payment={p} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upcoming sessions - collapsed behind button */}
            {upcomingPayments.length > 0 && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-sm font-medium"
                  onClick={() => setShowUpcoming(!showUpcoming)}
                >
                  <span className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500" />
                    Upcoming ({upcomingPayments.length})
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showUpcoming ? 'rotate-180' : ''}`} />
                </Button>
                {showUpcoming && (
                  <div className="space-y-2 mt-2">
                    {upcomingPayments.map(p => (
                      <PaymentRow key={p.id} payment={p} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Completed sessions - collapsed behind button */}
            {completedPayments.length > 0 && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-sm font-medium"
                  onClick={() => setShowCompleted(!showCompleted)}
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Completed ({completedPayments.length})
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showCompleted ? 'rotate-180' : ''}`} />
                </Button>
                {showCompleted && (
                  <div className="space-y-2 mt-2">
                    {completedPayments.map(p => (
                      <PaymentRow key={p.id} payment={p} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {showViewAll && onViewAll && payments.length > 1 && (
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
