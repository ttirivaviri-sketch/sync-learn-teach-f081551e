import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto as stdCrypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYFAST_MERCHANT_ID = Deno.env.get("PAYFAST_MERCHANT_ID");
    const PAYFAST_MERCHANT_KEY = Deno.env.get("PAYFAST_MERCHANT_KEY");
    const PAYFAST_PASSPHRASE = Deno.env.get("PAYFAST_PASSPHRASE");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!PAYFAST_MERCHANT_ID || !PAYFAST_MERCHANT_KEY) {
      throw new Error("PayFast credentials not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization header required");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid authentication token");

    const { bookingId, savedMethodId } = await req.json();
    if (!bookingId || !savedMethodId) throw new Error("Missing bookingId or savedMethodId");

    // Fetch saved payment method
    const { data: savedMethod, error: methodError } = await supabase
      .from("saved_payment_methods")
      .select("*")
      .eq("id", savedMethodId)
      .eq("user_id", user.id)
      .single();

    if (methodError || !savedMethod) throw new Error("Saved payment method not found");

    // Validate booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, learner_id, status, price")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) throw new Error("Booking not found");
    if (booking.learner_id !== user.id) throw new Error("Unauthorized: booking does not belong to you");
    if (booking.status === "canceled") throw new Error("Cannot pay for a cancelled booking");

    // Check no existing successful payment
    const { data: existingPayments } = await supabase
      .from("payments")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("status", "succeeded");

    if (existingPayments && existingPayments.length > 0) {
      throw new Error("This booking has already been paid for");
    }

    const amount = booking.price;

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        booking_id: bookingId,
        payer_id: user.id,
        amount,
        currency: "ZAR",
        status: "pending",
        provider: "payfast",
      })
      .select()
      .single();

    if (paymentError) throw new Error("Failed to create payment record");

    // Call PayFast ad hoc charge API
    const isSandbox = PAYFAST_MERCHANT_ID === "10000100";
    const apiBase = isSandbox
      ? "https://sandbox.payfast.co.za"
      : "https://api.payfast.co.za";

    const chargeUrl = `${apiBase}/subscriptions/${savedMethod.token}/adhoc`;

    // Generate signature for API call
    const apiData: Record<string, string> = {
      amount: amount.toFixed(2).toString(),
      item_name: `StudySync session ${bookingId.slice(0, 8)}`,
    };

    const paramString = Object.entries(apiData)
      .map(([key, value]) => `${key}=${encodeURIComponent(value.trim()).replace(/%20/g, "+")}`)
      .join("&");

    const sigInput = PAYFAST_PASSPHRASE
      ? `${paramString}&passphrase=${encodeURIComponent(PAYFAST_PASSPHRASE.trim()).replace(/%20/g, "+")}`
      : paramString;

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("MD5", encoder.encode(sigInput));
    const signature = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const chargeResponse = await fetch(chargeUrl, {
      method: "POST",
      headers: {
        "merchant-id": PAYFAST_MERCHANT_ID,
        "version": "v1",
        "timestamp": new Date().toISOString(),
        "signature": signature,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(apiData),
    });

    const chargeResult = await chargeResponse.json();
    console.log("PayFast ad hoc charge result:", JSON.stringify(chargeResult));

    if (chargeResponse.ok && chargeResult.data?.response === true) {
      // Payment succeeded
      await supabase
        .from("payments")
        .update({
          status: "succeeded",
          provider_ref: chargeResult.data.pf_payment_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      // Update booking to confirmed if needed
      if (booking.status === "requested") {
        await supabase
          .from("bookings")
          .update({ status: "confirmed", updated_at: new Date().toISOString() })
          .eq("id", bookingId);
      }

      return new Response(
        JSON.stringify({ success: true, paymentId: payment.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Payment failed
      await supabase
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", payment.id);

      throw new Error(chargeResult.data?.response_reason || "Ad hoc charge failed");
    }
  } catch (error) {
    console.error("Charge token error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
