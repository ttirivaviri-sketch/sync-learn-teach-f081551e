import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto as stdCrypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Initiates a PayFast R1 verification charge whose sole purpose is to tokenize
 * the learner's card so it can be reused later via payfast-charge-token.
 * The R1 is reversed automatically by PayFast after tokenization.
 */
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid authentication token");

    const { returnUrl, cancelUrl } = await req.json();
    if (!returnUrl || !cancelUrl) throw new Error("Missing return/cancel URLs");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const notifyUrl = `${SUPABASE_URL}/functions/v1/payfast-itn`;
    const verifyAmount = "1.00"; // R1 verification charge — auto-reversed
    const setupRef = `setup_${user.id}_${Date.now()}`;

    const paymentData: Record<string, string> = {
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      name_first: (profile?.full_name?.split(" ")[0] || "User").substring(0, 100),
      name_last: (profile?.full_name?.split(" ").slice(1).join(" ") || "").substring(0, 100),
      email_address: (profile?.email || user.email || "").substring(0, 100),
      m_payment_id: setupRef,
      amount: verifyAmount,
      item_name: "Card verification",
      item_description: "Card verification — R1 will be reversed automatically",
      subscription_type: "2", // 2 = tokenization
    };

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

    const encoder = new TextEncoder();
    const hashBuffer = await stdCrypto.subtle.digest(
      "MD5",
      encoder.encode(signatureWithPassphrase)
    );
    const signature = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    paymentData.signature = signature;

    const isSandbox = PAYFAST_MERCHANT_ID === "10000100";
    const payfastUrl = isSandbox
      ? "https://sandbox.payfast.co.za/eng/process"
      : "https://www.payfast.co.za/eng/process";

    return new Response(
      JSON.stringify({ success: true, payfastUrl, paymentData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Add payment method error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
