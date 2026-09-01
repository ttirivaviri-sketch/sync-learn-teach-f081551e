import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// PayFast sandbox merchant id — selects which host to confirm the ITN against
const SANDBOX_MERCHANT_ID = "10000100";

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
    const pfDataForSignature = { ...pfData };
    delete pfDataForSignature.signature;

    const signatureString = Object.entries(pfDataForSignature)
      .filter(([_, value]) => value !== "")
      .map(
        ([key, value]) =>
          `${key}=${encodeURIComponent(value.trim()).replace(/%20/g, "+")}`
      )
      .join("&");

    const signatureWithPassphrase = PAYFAST_PASSPHRASE
      ? `${signatureString}&passphrase=${encodeURIComponent(
          PAYFAST_PASSPHRASE.trim()
        ).replace(/%20/g, "+")}`
      : signatureString;

    // Create MD5 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureWithPassphrase);
    const hashBuffer = await crypto.subtle.digest("MD5", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const calculatedSignature = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (calculatedSignature !== receivedSignature) {
      console.error("Signature mismatch:", {
        calculated: calculatedSignature,
        received: receivedSignature,
      });
      throw new Error("Invalid signature");
    }

    // Step 1b: Verify the notification is for OUR merchant account.
    // Without this (and especially with no passphrase set), the MD5
    // signature is computable from public data and an ITN can be forged.
    const PAYFAST_MERCHANT_ID = Deno.env.get("PAYFAST_MERCHANT_ID");
    if (PAYFAST_MERCHANT_ID && pfData.merchant_id !== PAYFAST_MERCHANT_ID) {
      console.error("Merchant ID mismatch:", pfData.merchant_id);
      throw new Error("Merchant ID mismatch");
    }

    // Step 1c: Confirm the ITN with PayFast's servers (required by PayFast
    // docs). This defeats forged notifications even if the signature
    // scheme is compromised: PayFast only answers VALID for notifications
    // it actually sent.
    const pfHost =
      pfData.merchant_id === SANDBOX_MERCHANT_ID
        ? "sandbox.payfast.co.za"
        : "www.payfast.co.za";
    try {
      const validateRes = await fetch(`https://${pfHost}/eng/query/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: signatureString,
      });
      const validateText = (await validateRes.text()).trim();
      if (validateText !== "VALID") {
        console.error("PayFast server validation failed:", validateText);
        throw new Error("PayFast server validation failed");
      }
    } catch (validateError) {
      // A network failure here must NOT let the payment through unverified.
      console.error("PayFast validate call failed:", validateError);
      throw new Error("PayFast server validation unavailable");
    }

    // Step 2: Validate payment data
    const paymentId = pfData.m_payment_id;
    const paymentStatus = pfData.payment_status;
    const amountGross = parseFloat(pfData.amount_gross);
    const pfPaymentId = pfData.pf_payment_id;

    if (!paymentId) {
      throw new Error("Missing payment ID");
    }

    // Card-setup flow: m_payment_id is `setup_<user-uuid>_<ts>`, not a
    // payments row. Previously this fell through to the payment lookup,
    // threw "Payment not found", and the card token was silently dropped.
    if (paymentId.startsWith("setup_")) {
      const setupUserId = paymentId.slice("setup_".length).replace(/_\d+$/, "");
      if (paymentStatus === "COMPLETE" && pfData.token && setupUserId) {
        await supabase.from("saved_payment_methods").upsert(
          {
            user_id: setupUserId,
            provider: "payfast",
            token: pfData.token,
            card_last4: pfData.card_last4 || null,
            card_brand: pfData.card_type || null,
            is_default: true,
          },
          { onConflict: "user_id,token" }
        );
        console.log(`Card token saved for user ${setupUserId} via setup flow`);
      } else {
        console.log(
          `Setup ITN ignored: status=${paymentStatus}, token=${pfData.token ? "present" : "absent"}`
        );
      }
      return new Response("OK", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    console.log(
      `Processing ITN: payment=${paymentId}, status=${paymentStatus}, amount=${amountGross}, pf_id=${pfPaymentId}`
    );

    // Get payment record with booking
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*, booking:bookings(*)")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      console.error("Payment not found:", paymentId, paymentError);
      throw new Error("Payment not found");
    }

    // Don't process if payment is already in a final state
    if (payment.status === "succeeded" || payment.status === "refunded") {
      console.log(
        `Payment ${paymentId} already in final state: ${payment.status}. Skipping.`
      );
      return new Response("OK", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Verify amount matches (allow small rounding differences)
    if (Math.abs(payment.amount - amountGross) > 0.01) {
      console.error("Amount mismatch:", {
        expected: payment.amount,
        received: amountGross,
      });
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
        console.warn(`Unknown PayFast status: ${paymentStatus}`);
        newStatus = "pending";
    }

    // Update payment record
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: newStatus,
        provider_ref: pfPaymentId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    if (updateError) {
      console.error("Failed to update payment:", updateError);
      throw new Error("Failed to update payment");
    }

    console.log(`Payment ${paymentId} updated to ${newStatus}`);

    // If payment succeeded, ensure booking is in confirmed state
    // (it should already be confirmed by tutor, but this is a safety net)
    if (newStatus === "succeeded" && payment.booking_id) {
      const { data: currentBooking, error: bookingFetchError } = await supabase
        .from("bookings")
        .select("id, status")
        .eq("id", payment.booking_id)
        .single();

      if (!bookingFetchError && currentBooking) {
        // If booking is in requested state, move to confirmed (payment confirms it)
        if (currentBooking.status === "requested") {
          const { error: bookingUpdateError } = await supabase
            .from("bookings")
            .update({
              status: "confirmed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.booking_id);

          if (bookingUpdateError) {
            console.error("Failed to update booking status:", bookingUpdateError);
          } else {
            console.log(
              `Booking ${payment.booking_id} auto-confirmed via payment`
            );
          }
        }
        // If already confirmed, that's fine - the session is paid and ready
        console.log(
          `Booking ${payment.booking_id} status: ${currentBooking.status}. Payment succeeded.`
        );
      }

      // Save tokenization token if returned
      if (pfData.token) {
        try {
          await supabase
            .from("saved_payment_methods")
            .upsert(
              {
                user_id: payment.payer_id,
                provider: "payfast",
                token: pfData.token,
                card_last4: pfData.card_last4 || null,
                card_brand: pfData.card_type || null,
                is_default: true,
              },
              { onConflict: "user_id,token" }
            );
          console.log(`Saved payment token for user ${payment.payer_id}`);
        } catch (tokenError) {
          console.warn("Failed to save payment token:", tokenError);
        }
      }

      // Create a notification for the learner
      try {
        const { data: paymentRecord } = await supabase
          .from("payments")
          .select("payer_id")
          .eq("id", paymentId)
          .single();

        if (paymentRecord?.payer_id) {
          await supabase.from("notifications").insert({
            user_id: paymentRecord.payer_id,
            title: "Payment Confirmed",
            body: `Your payment of R${amountGross.toFixed(
              2
            )} has been confirmed. Your session is secured!`,
            type: "payment",
            related_booking_id: payment.booking_id,
          });
        }
      } catch (notifError) {
        // Non-critical, just log
        console.warn("Failed to create payment notification:", notifError);
      }
    }

    // If payment failed, create notification
    if (newStatus === "failed" && payment.booking_id) {
      try {
        const { data: paymentRecord } = await supabase
          .from("payments")
          .select("payer_id")
          .eq("id", paymentId)
          .single();

        if (paymentRecord?.payer_id) {
          await supabase.from("notifications").insert({
            user_id: paymentRecord.payer_id,
            title: "Payment Failed",
            body: `Your payment of R${amountGross.toFixed(
              2
            )} was not successful. Please try again.`,
            type: "payment",
            related_booking_id: payment.booking_id,
          });
        }
      } catch (notifError) {
        console.warn("Failed to create payment failure notification:", notifError);
      }
    }

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
