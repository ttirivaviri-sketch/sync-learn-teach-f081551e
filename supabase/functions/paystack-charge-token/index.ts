// Paystack: One-tap charge using a saved authorization_code
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ChargeBody {
  bookingId: string;
  paymentMethodId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bookingId, paymentMethodId } = (await req.json()) as ChargeBody;
    if (!bookingId || !paymentMethodId) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(supabaseUrl, serviceKey);

    const { data: method, error: methodErr } = await service
      .from("saved_payment_methods")
      .select("paystack_authorization_code, user_id, provider")
      .eq("id", paymentMethodId)
      .single();

    if (methodErr || !method || method.user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Payment method not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (method.provider !== "paystack" || !method.paystack_authorization_code) {
      return new Response(JSON.stringify({ error: "Not a Paystack card" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: booking, error: bookingErr } = await service
      .from("bookings")
      .select("id, price, learner_id")
      .eq("id", bookingId)
      .single();

    if (bookingErr || !booking || booking.learner_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = `ps_tap_${bookingId.slice(0, 8)}_${Date.now()}`;

    // Create pending payment row first
    await service.from("payments").insert({
      booking_id: bookingId,
      payer_id: userData.user.id,
      amount: booking.price,
      currency: "ZAR",
      provider: "paystack",
      provider_ref: reference,
      status: "pending",
    });

    const res = await fetch("https://api.paystack.co/transaction/charge_authorization", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: userData.user.email,
        amount: Math.round(Number(booking.price) * 100),
        currency: "ZAR",
        authorization_code: method.paystack_authorization_code,
        reference,
        metadata: { user_id: userData.user.id, booking_id: bookingId, mode: "charge" },
      }),
    });

    const json = await res.json();
    const success = res.ok && json.status && json.data?.status === "success";

    await service
      .from("payments")
      .update({
        status: success ? "succeeded" : "failed",
        provider_ref: json.data?.reference || reference,
      })
      .eq("provider_ref", reference);

    if (success) {
      await service.from("bookings").update({ status: "confirmed" }).eq("id", bookingId);
    }

    return new Response(
      JSON.stringify({ success, message: json.message, reference }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("paystack-charge-token error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
