// Paystack: Initialize Transaction (hosted checkout)
// Used for: adding a card (mode=setup) OR paying for a booking (mode=charge)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InitBody {
  mode: "setup" | "charge";
  bookingId?: string;
  amount?: number; // in major units (ZAR)
  callbackUrl: string;
  currency?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as InitBody;
    const { mode, bookingId, amount, callbackUrl, currency = "ZAR" } = body;

    if (!mode || !callbackUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For setup mode use 100 cents (1 ZAR) auth charge. For charge mode the
    // amount is ALWAYS derived from the booking row (price enforced server-side
    // by trg_enforce_booking_price) — never from the client request body.
    let chargeAmount = 0;
    if (mode === "charge") {
      if (!bookingId) {
        return new Response(JSON.stringify({ error: "bookingId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: booking, error: bookingErr } = await supabase
        .from("bookings")
        .select("id, learner_id, status, price")
        .eq("id", bookingId)
        .single();

      if (bookingErr || !booking) {
        return new Response(JSON.stringify({ error: "Booking not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (booking.learner_id !== userData.user.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (booking.status === "canceled") {
        return new Response(JSON.stringify({ error: "Cannot pay for a cancelled booking" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      chargeAmount = Number(booking.price);
      if (typeof amount === "number" && Math.abs(amount - chargeAmount) > 0.01) {
        console.warn(`Client amount ${amount} != server price ${chargeAmount} for ${bookingId}`);
      }
    }

    const amountMinor = mode === "setup" ? 100 : Math.round(chargeAmount * 100);

    if (mode === "charge" && amountMinor <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const reference = `ps_${mode}_${userData.user.id.slice(0, 8)}_${Date.now()}`;

    const payload = {
      email: userData.user.email,
      amount: amountMinor,
      currency,
      reference,
      callback_url: callbackUrl,
      metadata: {
        user_id: userData.user.id,
        booking_id: bookingId ?? null,
        mode,
      },
    };

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok || !json.status) {
      console.error("Paystack init failed:", json);
      return new Response(
        JSON.stringify({ error: json.message || "Paystack initialization failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // For charge mode, create a pending payment row
    if (mode === "charge" && bookingId) {
      const serviceClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await serviceClient.from("payments").insert({
        booking_id: bookingId,
        payer_id: userData.user.id,
        amount: amount,
        currency,
        provider: "paystack",
        provider_ref: reference,
        status: "pending",
      });
    }

    return new Response(
      JSON.stringify({
        authorization_url: json.data.authorization_url,
        reference: json.data.reference,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("paystack-initialize error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
