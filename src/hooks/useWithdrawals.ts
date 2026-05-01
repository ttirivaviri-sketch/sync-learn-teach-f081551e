/**
 * useWithdrawals — Tutor withdrawal request management.
 *
 * - Fetches own payout_requests with realtime updates.
 * - requestWithdrawal: calls request_tutor_withdrawal RPC (atomically debits wallet).
 * - cancelRequest: calls resolve_payout_request RPC with status 'cancelled'.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

export interface PayoutRequest {
  id: string;
  tutor_id: string;
  amount: number;
  currency: string;
  method: string;
  bank_account_holder: string;
  bank_name: string;
  bank_account_number: string;
  bank_branch_code: string | null;
  status: "pending" | "approved" | "paid" | "rejected" | "cancelled";
  admin_note: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface WithdrawalInput {
  amount: number;
  bank_account_holder: string;
  bank_name: string;
  bank_account_number: string;
  bank_branch_code?: string;
}

export function useWithdrawals(tutorId?: string) {
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tutorId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("payout_requests")
        .select("*")
        .eq("tutor_id", tutorId)
        .order("created_at", { ascending: false });
      if (error) {
        if (!error.message?.includes("does not exist")) logger.warn(error.message);
      } else if (data) {
        setRequests(data as PayoutRequest[]);
      }
    } finally {
      setLoading(false);
    }
  }, [tutorId]);

  useEffect(() => {
    if (tutorId) refresh();
  }, [tutorId, refresh]);

  // Realtime updates
  useEffect(() => {
    if (!tutorId) return;
    const channel = supabase
      .channel(`payout-requests-${tutorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payout_requests",
          filter: `tutor_id=eq.${tutorId}`,
        },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tutorId, refresh]);

  const requestWithdrawal = useCallback(
    async (input: WithdrawalInput): Promise<{ ok: boolean; error?: string; id?: string }> => {
      setSubmitting(true);
      setError(null);
      try {
        const { data, error } = await (supabase as any).rpc("request_tutor_withdrawal", {
          _amount: input.amount,
          _bank_account_holder: input.bank_account_holder,
          _bank_name: input.bank_name,
          _bank_account_number: input.bank_account_number,
          _bank_branch_code: input.bank_branch_code ?? null,
        });
        if (error) throw error;
        await refresh();
        return { ok: true, id: data as string };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Withdrawal failed";
        setError(msg);
        return { ok: false, error: msg };
      } finally {
        setSubmitting(false);
      }
    },
    [refresh]
  );

  const cancelRequest = useCallback(
    async (requestId: string): Promise<boolean> => {
      try {
        const { error } = await (supabase as any).rpc("resolve_payout_request", {
          _request_id: requestId,
          _new_status: "cancelled",
          _admin_note: null,
        });
        if (error) throw error;
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cancel failed");
        return false;
      }
    },
    [refresh]
  );

  return { requests, loading, submitting, error, requestWithdrawal, cancelRequest, refresh };
}
