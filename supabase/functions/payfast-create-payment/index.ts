import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto as stdCrypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PaymentRequest {
  bookingId: string;
  amount?: number;
  itemName: string;
  returnUrl: string;
  cancelUrl: string;
  paymentMethod?: string; // card, eft, instant_eft, mobicred
}

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

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the user token
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Invalid authentication token");
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    if (profileError) {
      throw new Error("Could not fetch user profile");
    }

    const {
      bookingId,
      amount,
      itemName,
      returnUrl,
      cancelUrl,
      paymentMethod,
    }: PaymentRequest = await req.json();

    if (!bookingId || !itemName) {
      throw new Error("Missing required payment fields");
    }


    // Validate the booking exists and belongs to this user
    const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .select("id, learner_id, status, price")
      .eq("id", bookingId)
      .single();

    if (bookingError || !bookingData) {
      throw new Error("Booking not found");
    }

    if (bookingData.learner_id !== user.id) {
      throw new Error("Unauthorized: booking does not belong to you");
    }

    if (bookingData.status === "canceled") {
      throw new Error("Cannot pay for a cancelled booking");
    }

    // NEVER trust the client-supplied amount: the booking price is enforced
    // server-side (trg_enforce_booking_price) from the tutor's hourly rate.
    const chargeAmount = Number(bookingData.price);
    if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
      throw new Error("Invalid booking price");
    }
    if (typeof amount === "number" && Math.abs(amount - chargeAmount) > 0.01) {
      console.warn(
        `Client amount ${amount} != server price ${chargeAmount} for booking ${bookingId}`,
      );
    }


    // Check if there's already a succeeded payment for this booking
    const { data: existingPayments } = await supabase
      .from("payments")
      .select("id, status")
      .eq("booking_id", bookingId)
      .eq("status", "succeeded");

    if (existingPayments && existingPayments.length > 0) {
      throw new Error("This booking has already been paid for");
    }

    // Check for existing pending payment and cancel it before creating a new one
    const { data: pendingPayments } = await supabase
      .from("payments")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("status", "pending");

    if (pendingPayments && pendingPayments.length > 0) {
      // Mark old pending payments as failed (user retrying)
      for (const pp of pendingPayments) {
        await supabase
          .from("payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", pp.id);
      }
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        booking_id: bookingId,
        payer_id: user.id,
        amount: chargeAmount,
        currency: "ZAR",
        status: "pending",
        provider: "payfast",
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Payment creation error:", paymentError);
      throw new Error("Failed to create payment record");
    }

    // Build PayFast notify URL - points to our ITN handler
    const notifyUrl = `${SUPABASE_URL}/functions/v1/payfast-itn`;

    // PayFast payment data - order matters for signature
    const paymentData: Record<string, string> = {
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      name_first: (profile.full_name?.split(" ")[0] || "User").substring(0, 100),
      name_last: (profile.full_name?.split(" ").slice(1).join(" ") || "").substring(0, 100),
      email_address: (profile.email || user.email || "").substring(0, 100),
      m_payment_id: payment.id,
      amount: chargeAmount.toFixed(2),
      item_name: itemName.substring(0, 100),
      item_description: `StudySync tutoring session booking ${bookingId.slice(0, 8)}`.substring(0, 255),
      email_confirmation: "1",
      confirmation_address: (profile.email || user.email || "").substring(0, 100),
    };

    // Add payment method if specified (PayFast payment_method parameter)
    // cc = credit card, eft = EFT, dc = debit card, mp = Mobicred, mc = Mastercard
    if (paymentMethod) {
      const methodMap: Record<string, string> = {
        card: "cc",
        eft: "eft",
        instant_eft: "eft",
        mobicred: "mp",
      };
      const pfMethod = methodMap[paymentMethod];
      if (pfMethod) {
        paymentData.payment_method = pfMethod;
      }
    }

    // Generate signature - must follow PayFast's specific ordering
    const signatureString = Object.entries(paymentData)
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

    // Create MD5 hash using Deno std crypto (Web Crypto doesn't support MD5)
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureWithPassphrase);
    const hashBuffer = await stdCrypto.subtle.digest("MD5", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    paymentData.signature = signature;

    // PayFast sandbox or production URL
    const isSandbox = PAYFAST_MERCHANT_ID === "10000100";
    const payfastUrl = isSandbox
      ? "https://sandbox.payfast.co.za/eng/process"
      : "https://www.payfast.co.za/eng/process";

    console.log(
      `Payment created: ${payment.id} for booking ${bookingId}, amount R${chargeAmount.toFixed(
        2
      )}, sandbox: ${isSandbox}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        paymentId: payment.id,
        payfastUrl,
        paymentData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("PayFast payment error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
