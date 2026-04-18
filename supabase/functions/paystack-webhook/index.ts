// Paystack webhook: verifies signature, persists tokens & payment status
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

Deno.serve(async (req) => {
  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      return new Response("Server misconfigured", { status: 500 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") ?? "";

    const expected = createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    if (signature !== expected) {
      console.error("Invalid Paystack signature");
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(rawBody);
    console.log("Paystack event:", event.event, event.data?.reference);

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (event.event === "charge.success") {
      const data = event.data;
      const meta = data.metadata || {};
      const userId = meta.user_id;
      const bookingId = meta.booking_id;
      const mode = meta.mode || "charge";
      const auth = data.authorization;

      // Save card if reusable & we don't already have it
      if (userId && auth?.reusable && auth?.authorization_code) {
        const { data: existing } = await service
          .from("saved_payment_methods")
          .select("id")
          .eq("user_id", userId)
          .eq("paystack_signature", auth.signature)
          .maybeSingle();

        if (!existing) {
          // Unset other defaults if this becomes default
          await service
            .from("saved_payment_methods")
            .update({ is_default: false })
            .eq("user_id", userId);

          await service.from("saved_payment_methods").insert({
            user_id: userId,
            provider: "paystack",
            token: auth.authorization_code,
            paystack_authorization_code: auth.authorization_code,
            paystack_signature: auth.signature,
            card_brand: auth.brand,
            card_last4: auth.last4,
            card_bank: auth.bank,
            card_exp_month: auth.exp_month,
            card_exp_year: auth.exp_year,
            is_default: true,
          });
        }
      }

      // Update payment + booking
      if (data.reference) {
        const { data: payment } = await service
          .from("payments")
          .select("id, booking_id")
          .eq("provider_ref", data.reference)
          .maybeSingle();

        if (payment) {
          await service
            .from("payments")
            .update({ status: "succeeded" })
            .eq("id", payment.id);

          if (mode === "charge" && (bookingId || payment.booking_id)) {
            await service
              .from("bookings")
              .update({ status: "confirmed" })
              .eq("id", bookingId || payment.booking_id);
          }
        }
      }
    }

    if (event.event === "charge.failed" && event.data?.reference) {
      await service
        .from("payments")
        .update({ status: "failed" })
        .eq("provider_ref", event.data.reference);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("paystack-webhook error:", err);
    return new Response("Webhook error", { status: 500 });
  }
});
