/**
 * notify-enquiry — Emails the StudySync admins whenever a visitor taps a
 * tutor-enquiry action (WhatsApp, email, phone, Instagram, booking, signup).
 *
 * Public endpoint (visitors are not signed in). Best-effort: never blocks the
 * visitor's click. Recipients come from ENQUIRY_NOTIFY_TO (comma separated) or,
 * failing that, every profile with the `admin` role.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM =
  Deno.env.get("RESEND_UPDATES_FROM") || "StudySync <updates@studysync.co.za>";
const NOTIFY_TO = (Deno.env.get("ENQUIRY_NOTIFY_TO") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  instagram: "Instagram",
  phone: "Phone call",
  booking: "Booking button",
  signup: "Free trial signup",
};

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const clean = (v: unknown, max = 160): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t.length ? t : null;
};

async function recipients(admin: ReturnType<typeof createClient>) {
  if (NOTIFY_TO.length) return NOTIFY_TO;
  const { data: roles } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
  if (!ids.length) return [];
  const { data: profiles } = await admin
    .from("profiles")
    .select("email")
    .in("id", ids);
  return (profiles ?? [])
    .map((p: { email: string | null }) => p.email)
    .filter((e): e is string => Boolean(e));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const channel = clean(body.channel, 32);
    if (!channel || !(channel in CHANNEL_LABELS)) {
      return new Response(JSON.stringify({ error: "Invalid channel" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = clean(body.subject) ?? "general";
    const sessionType = clean(body.sessionType) ?? "unspecified";
    const path = clean(body.path, 300) ?? "—";
    const label = clean(body.label) ?? "—";
    const referrer = clean(body.referrer, 300) ?? "—";

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ sent: false, reason: "email_not_configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const to = await recipients(admin);
    if (!to.length) {
      return new Response(
        JSON.stringify({ sent: false, reason: "no_recipients" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const channelLabel = CHANNEL_LABELS[channel];
    const rows: [string, string][] = [
      ["How they reached out", channelLabel],
      ["Subject", subject],
      ["Session type", sessionType],
      ["Page", path],
      ["Button", label],
      ["Came from", referrer],
      ["When", new Date().toISOString()],
    ];

    const html = `<!doctype html><html><body style="margin:0;background:#f6f7fb;">
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:28px 24px;color:#1f2937;">
    <h1 style="color:#1a3fc4;font-size:20px;margin:0 0 4px;">New tutor enquiry</h1>
    <p style="font-size:13px;color:#6b7280;margin:0 0 20px;">A visitor just tried to get in touch about ${esc(subject)}.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 0;color:#6b7280;width:45%;">${esc(k)}</td><td style="padding:8px 0;font-weight:600;">${esc(v)}</td></tr>`,
        )
        .join("")}
    </table>
    <p style="font-size:13px;color:#6b7280;margin:24px 0 0;">
      See all enquiries and mark this one answered:
      <a href="https://studysync.co.za/admin/enquiries" style="color:#1a3fc4;">Tutor Enquiries</a>
    </p>
  </div>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to,
        subject: `New tutor enquiry — ${subject} (${channelLabel})`,
        html,
      }),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error(`Resend failed [${res.status}]: ${details}`);
      return new Response(
        JSON.stringify({ error: "Email send failed", status: res.status, details }),
        {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ sent: true, recipients: to.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-enquiry error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
