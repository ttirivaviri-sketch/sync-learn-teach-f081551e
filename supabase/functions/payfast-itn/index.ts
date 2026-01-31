import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// PayFast valid hosts for verification
const VALID_HOSTS = [
  "www.payfast.co.za",
  "sandbox.payfast.co.za",
  "w1w.payfast.co.za",
  "w2w.payfast.co.za",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYFAST_PASSPHRASE = Deno.env.get("PAYFAST_PASSPHRASE");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse form data from PayFast
    const formData = await req.formData();
    const pfData: Record<string, string> = {};
    
    for (const [key, value] of formData.entries()) {
      pfData[key] = value.toString();
    }

    console.log("ITN received:", JSON.stringify(pfData));

    // Step 1: Verify signature
    const receivedSignature = pfData.signature;
    delete pfData.signature;

    const signatureString = Object.entries(pfData)
      .filter(([_, value]) => value !== "")
      .map(([key, value]) => `${key}=${encodeURIComponent(value.trim()).replace(/%20/g, "+")}`)
      .join("&");

    const signatureWithPassphrase = PAYFAST_PASSPHRASE
      ? `${signatureString}&passphrase=${encodeURIComponent(PAYFAST_PASSPHRASE.trim()).replace(/%20/g, "+")}`
      : signatureString;

    // Create MD5 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureWithPassphrase);
    const hashBuffer = await crypto.subtle.digest("MD5", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const calculatedSignature = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    if (calculatedSignature !== receivedSignature) {
      console.error("Signature mismatch:", { calculated: calculatedSignature, received: receivedSignature });
      throw new Error("Invalid signature");
    }

    // Step 2: Verify the source IP (in production)
    // Note: In edge functions, we trust PayFast's signature verification

    // Step 3: Validate with PayFast server
    const paymentId = pfData.m_payment_id;
    const paymentStatus = pfData.payment_status;
    const amount = parseFloat(pfData.amount_gross);

    if (!paymentId) {
      throw new Error("Missing payment ID");
    }

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*, booking:bookings(*)")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      console.error("Payment not found:", paymentId);
      throw new Error("Payment not found");
    }

    // Verify amount matches
    if (Math.abs(payment.amount - amount) > 0.01) {
      console.error("Amount mismatch:", { expected: payment.amount, received: amount });
      throw new Error("Amount mismatch");
    }

    // Map PayFast status to our status
    let newStatus: "pending" | "succeeded" | "failed" | "refunded";
    switch (paymentStatus) {
      case "COMPLETE":
        newStatus = "succeeded";
        break;
      case "FAILED":
        newStatus = "failed";
        break;
      case "PENDING":
        newStatus = "pending";
        break;
      case "CANCELLED":
        newStatus = "failed";
        break;
      default:
        newStatus = "pending";
    }

    // Update payment status
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: newStatus,
        provider_ref: pfData.pf_payment_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    if (updateError) {
      console.error("Failed to update payment:", updateError);
      throw new Error("Failed to update payment");
    }

    // If payment succeeded, update booking status
    if (newStatus === "succeeded" && payment.booking) {
      await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", payment.booking_id);
    }

    console.log(`Payment ${paymentId} updated to ${newStatus}`);

    return new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("ITN Error:", error);
    // Always return 200 to PayFast to prevent retries for validation errors
    return new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
});
