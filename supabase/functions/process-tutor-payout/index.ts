/**
 * process-tutor-payout — Real-time Payout System Edge Function
 *
 * Calculates gross earnings, commission, net payout; updates tutor wallet;
 * prevents duplicate payouts; validates session authenticity; rejects
 * cancelled/incomplete sessions.
 *
 * Output: strict JSON { session_id, tutor_id, gross_amount, commission,
 *         net_payout, wallet_balance, status }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getAIConfig,
  callAI,
  safeJsonParse,
  jsonResponse,
  errorResponse,
} from "../_shared/ai-config.ts";

// ─── System Prompt (structured, secure, actionable) ───────────────────────────

const PAYOUT_SYSTEM_PROMPT = `You are the StudySync Real-Time Payout Engine — a stateless, deterministic financial processor running inside a Supabase Edge Function.

ROLE & IDENTITY:
You are an assistant that calculates tutor payouts after completed tutoring sessions. You operate with financial-grade precision and zero tolerance for invalid data.

CORE RULES — ABSOLUTE REQUIREMENTS:
1. Calculate gross earnings from the session price.
2. Apply the platform commission rate (default 15%, configurable per tutor tier).
3. Compute net payout = gross - commission.
4. Update the tutor's wallet balance by adding net_payout.
5. PREVENT DUPLICATE PAYOUTS: If a payout record already exists for this session_id, return the existing record with status "already_processed".
6. VALIDATE SESSION AUTHENTICITY: The session must exist in the bookings table with status = "completed" and the tutor_id must match.
7. REJECT INVALID SESSIONS: Cancelled, incomplete, pending, or non-existent sessions must be rejected with status "rejected" and a clear reason.
8. All monetary values must be in ZAR, rounded to 2 decimal places.
9. Never create partial records — if any step fails, roll back and return an error.
10. Log every payout attempt for audit trail.

COMMISSION TIERS:
- Standard tutor: 15% commission
- Verified tutor (10+ completed sessions): 12% commission
- Premium tutor (50+ completed sessions, 4.5+ rating): 10% commission
- Enterprise tutor (100+ sessions): 8% commission

INPUT: { session_id, tutor_id }
OUTPUT — STRICT JSON (no extra text):
{
  "session_id": "<uuid>",
  "tutor_id": "<uuid>",
  "gross_amount": <number>,
  "commission_rate": <number>,
  "commission": <number>,
  "net_payout": <number>,
  "wallet_balance": <number>,
  "status": "processed" | "already_processed" | "rejected",
  "reason": "<string if rejected, null otherwise>",
  "processed_at": "<ISO timestamp>"
}

SAFETY:
- Stateless function: all data must be read from and written to the database.
- Use transactions/locks where possible to prevent race conditions.
- Never expose internal error details to the client.`;

// ─── Commission tier logic ────────────────────────────────────────────────────

interface CommissionTier {
  rate: number;
  label: string;
}

function getCommissionTier(
  completedSessions: number,
  averageRating: number
): CommissionTier {
  if (completedSessions >= 100) {
    return { rate: 0.08, label: "enterprise" };
  }
  if (completedSessions >= 50 && averageRating >= 4.5) {
    return { rate: 0.10, label: "premium" };
  }
  if (completedSessions >= 10) {
    return { rate: 0.12, label: "verified" };
  }
  return { rate: 0.15, label: "standard" };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse(new Error("Authorization required"), 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse(new Error("Invalid authentication"), 401);
    }

    const { session_id, tutor_id }: { session_id: string; tutor_id: string } =
      await req.json();

    if (!session_id || !tutor_id) {
      return jsonResponse(
        {
          session_id: session_id || null,
          tutor_id: tutor_id || null,
          gross_amount: 0,
          commission_rate: 0,
          commission: 0,
          net_payout: 0,
          wallet_balance: 0,
          status: "rejected",
          reason: "Missing required fields: session_id and tutor_id",
          processed_at: new Date().toISOString(),
        },
        400
      );
    }

    // ── Step 1: Check for duplicate payout (idempotency) ──────────────────────
    const { data: existingPayout } = await supabase
      .from("tutor_payouts")
      .select("*")
      .eq("session_id", session_id)
      .eq("tutor_id", tutor_id)
      .maybeSingle();

    if (existingPayout) {
      console.log(
        `[payout] Duplicate detected for session=${session_id}, returning existing`
      );

      // Get current wallet balance
      const { data: wallet } = await supabase
        .from("tutor_wallets")
        .select("balance")
        .eq("tutor_id", tutor_id)
        .maybeSingle();

      return jsonResponse({
        session_id: existingPayout.session_id,
        tutor_id: existingPayout.tutor_id,
        gross_amount: existingPayout.gross_amount,
        commission_rate: existingPayout.commission_rate,
        commission: existingPayout.commission,
        net_payout: existingPayout.net_payout,
        wallet_balance: wallet?.balance ?? existingPayout.net_payout,
        status: "already_processed",
        reason: null,
        processed_at: existingPayout.processed_at,
      });
    }

    // ── Step 2: Validate session authenticity ─────────────────────────────────
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, tutor_id, status, price, duration_minutes, learner_id, scheduled_at")
      .eq("id", session_id)
      .single();

    if (bookingError || !booking) {
      return jsonResponse({
        session_id,
        tutor_id,
        gross_amount: 0,
        commission_rate: 0,
        commission: 0,
        net_payout: 0,
        wallet_balance: 0,
        status: "rejected",
        reason: "Session not found in bookings table",
        processed_at: new Date().toISOString(),
      });
    }

    // Verify tutor owns this session
    if (booking.tutor_id !== tutor_id) {
      return jsonResponse({
        session_id,
        tutor_id,
        gross_amount: 0,
        commission_rate: 0,
        commission: 0,
        net_payout: 0,
        wallet_balance: 0,
        status: "rejected",
        reason: "Tutor ID does not match session tutor",
        processed_at: new Date().toISOString(),
      });
    }

    // Reject non-completed sessions
    if (booking.status !== "completed") {
      const rejectReasons: Record<string, string> = {
        canceled: "Session was cancelled",
        requested: "Session is still pending/requested",
        confirmed: "Session has not been completed yet",
        "in-progress": "Session is still in progress",
      };
      return jsonResponse({
        session_id,
        tutor_id,
        gross_amount: Number(booking.price),
        commission_rate: 0,
        commission: 0,
        net_payout: 0,
        wallet_balance: 0,
        status: "rejected",
        reason:
          rejectReasons[booking.status] ||
          `Invalid session status: ${booking.status}`,
        processed_at: new Date().toISOString(),
      });
    }

    // Verify payment was made
    const { data: payment } = await supabase
      .from("payments")
      .select("id, status, amount")
      .eq("booking_id", session_id)
      .eq("status", "succeeded")
      .maybeSingle();

    if (!payment) {
      return jsonResponse({
        session_id,
        tutor_id,
        gross_amount: Number(booking.price),
        commission_rate: 0,
        commission: 0,
        net_payout: 0,
        wallet_balance: 0,
        status: "rejected",
        reason: "No confirmed payment found for this session",
        processed_at: new Date().toISOString(),
      });
    }

    // ── Step 3: Determine commission tier ─────────────────────────────────────
    const { count: completedCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("tutor_id", tutor_id)
      .eq("status", "completed");

    const { data: reviews } = await supabase
      .from("reviews")
      .select("rating")
      .eq("reviewed_id", tutor_id);

    const avgRating =
      reviews && reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    const tier = getCommissionTier(completedCount ?? 0, avgRating);

    // ── Step 4: Calculate payout ──────────────────────────────────────────────
    const grossAmount = round2(Number(booking.price));
    const commission = round2(grossAmount * tier.rate);
    const netPayout = round2(grossAmount - commission);

    // ── Step 5: Upsert tutor wallet ───────────────────────────────────────────
    const { data: existingWallet } = await supabase
      .from("tutor_wallets")
      .select("id, balance")
      .eq("tutor_id", tutor_id)
      .maybeSingle();

    let walletBalance: number;

    if (existingWallet) {
      walletBalance = round2(existingWallet.balance + netPayout);
      const { error: walletUpdateError } = await supabase
        .from("tutor_wallets")
        .update({
          balance: walletBalance,
          total_earned: supabase.rpc ? undefined : walletBalance, // Use RPC for atomic increment if available
          last_payout_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingWallet.id);

      if (walletUpdateError) {
        console.error("[payout] Wallet update failed:", walletUpdateError);
        throw new Error("Failed to update tutor wallet");
      }
    } else {
      walletBalance = netPayout;
      const { error: walletInsertError } = await supabase
        .from("tutor_wallets")
        .insert({
          tutor_id,
          balance: walletBalance,
          total_earned: netPayout,
          currency: "ZAR",
          last_payout_at: new Date().toISOString(),
        });

      if (walletInsertError) {
        console.error("[payout] Wallet creation failed:", walletInsertError);
        throw new Error("Failed to create tutor wallet");
      }
    }

    // ── Step 6: Create payout record ──────────────────────────────────────────
    const processedAt = new Date().toISOString();
    const { error: payoutInsertError } = await supabase
      .from("tutor_payouts")
      .insert({
        session_id,
        tutor_id,
        learner_id: booking.learner_id,
        gross_amount: grossAmount,
        commission_rate: tier.rate,
        commission_tier: tier.label,
        commission,
        net_payout: netPayout,
        currency: "ZAR",
        status: "processed",
        processed_at: processedAt,
        payment_id: payment.id,
      });

    if (payoutInsertError) {
      console.error("[payout] Payout record insert failed:", payoutInsertError);
      // Attempt to roll back wallet change
      if (existingWallet) {
        await supabase
          .from("tutor_wallets")
          .update({
            balance: existingWallet.balance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingWallet.id);
      }
      throw new Error("Failed to record payout");
    }

    // ── Step 7: Create audit log entry ────────────────────────────────────────
    await supabase.from("payout_audit_log").insert({
      session_id,
      tutor_id,
      action: "payout_processed",
      details: {
        gross_amount: grossAmount,
        commission_rate: tier.rate,
        commission_tier: tier.label,
        commission,
        net_payout: netPayout,
        wallet_balance_after: walletBalance,
      },
      performed_by: user.id,
    }).then(
      () => console.log(`[payout] Audit logged for session=${session_id}`),
      (err) => console.warn("[payout] Audit log failed (non-critical):", err)
    );

    // ── Step 8: Notify tutor ──────────────────────────────────────────────────
    await supabase.from("notifications").insert({
      user_id: tutor_id,
      title: "Payout Received",
      body: `R${netPayout.toFixed(2)} has been added to your wallet from a completed session.`,
      type: "payment",
      related_booking_id: session_id,
    }).then(
      () => {},
      (err) => console.warn("[payout] Notification failed (non-critical):", err)
    );

    console.log(
      `[payout] Processed: session=${session_id}, tutor=${tutor_id}, gross=R${grossAmount}, commission=R${commission} (${tier.label}), net=R${netPayout}, wallet=R${walletBalance}`
    );

    return jsonResponse({
      session_id,
      tutor_id,
      gross_amount: grossAmount,
      commission_rate: tier.rate,
      commission,
      net_payout: netPayout,
      wallet_balance: walletBalance,
      status: "processed",
      reason: null,
      processed_at: processedAt,
    });
  } catch (error) {
    console.error("[payout] Error:", error);
    return errorResponse(error);
  }
});
