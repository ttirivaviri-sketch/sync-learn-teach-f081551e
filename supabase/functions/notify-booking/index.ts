/**
 * notify-booking — Emails the tutor and the StudySync admins when a new
 * booking request is created.
 *
 * Called right after a booking row is inserted. Best-effort: a failed send
 * never blocks the booking. Admin recipients come from ENQUIRY_NOTIFY_TO
 * (comma separated) or, failing that, every profile with the `admin` role.
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

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function adminRecipients(admin: ReturnType<typeof createClient>) {
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
    const bookingId =
      typeof body.booking_id === "string" && body.booking_id.length <= 64
        ? body.booking_id
        : null;
    if (!bookingId) {
      return new Response(JSON.stringify({ error: "booking_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ sent: false, reason: "email_not_configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: booking, error } = await admin
      .from("bookings")
      .select(
        `id, scheduled_at, duration_minutes, price, status, learner_note,
         learner_profile:profiles!bookings_learner_id_fkey(full_name, email, phone),
         tutor_profile:profiles!bookings_tutor_id_fkey(full_name, email),
         tutor_subjects(subject, level)`,
      )
      .eq("id", bookingId)
      .single();

    if (error || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const learner = booking.learner_profile as {
      full_name: string | null;
      email: string | null;
      phone: string | null;
    } | null;
    const tutor = booking.tutor_profile as {
      full_name: string | null;
      email: string | null;
    } | null;
    const subject = booking.tutor_subjects as {
      subject: string;
      level: string;
    } | null;

    const when = new Date(booking.scheduled_at).toLocaleString("en-ZA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Africa/Johannesburg",
    });

    const rows: [string, string][] = [
      ["Learner", learner?.full_name || "—"],
      ["Learner email", learner?.email || "—"],
      ["Learner phone", learner?.phone || "—"],
      ["Tutor", tutor?.full_name || "—"],
      ["Subject", subject ? `${subject.subject} (${subject.level})` : "—"],
      ["When", `${when} (SAST)`],
      ["Duration", `${booking.duration_minutes} minutes`],
      ["Price", `R${Number(booking.price).toFixed(0)}`],
      ["Status", booking.status],
    ];
    if (booking.learner_note) rows.push(["Learner note", booking.learner_note]);

    const subjectLine = `New booking request — ${
      subject?.subject ?? "session"
    } with ${tutor?.full_name ?? "tutor"}`;

    const html = `<!doctype html><html><body style="margin:0;background:#f6f7fb;">
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:28px 24px;color:#1f2937;">
    <h1 style="color:#1a3fc4;font-size:20px;margin:0 0 4px;">New booking request</h1>
    <p style="font-size:13px;color:#6b7280;margin:0 0 20px;">${esc(
      learner?.full_name || "A learner",
    )} requested a session with ${esc(tutor?.full_name || "you")}.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 0;color:#6b7280;width:40%;vertical-align:top;">${esc(
              k,
            )}</td><td style="padding:8px 0;font-weight:600;">${esc(v)}</td></tr>`,
        )
        .join("")}
    </table>
    <p style="font-size:13px;color:#6b7280;margin:24px 0 0;">
      Tutors: open your dashboard to accept or decline.
      Admins: see <a href="https://studysync.co.za/admin/bookings" style="color:#1a3fc4;">Bookings</a>.
    </p>
  </div>
</body></html>`;

    const to = new Set<string>();
    if (tutor?.email) to.add(tutor.email);
    for (const e of await adminRecipients(admin)) to.add(e);

    if (!to.size) {
      return new Response(
        JSON.stringify({ sent: false, reason: "no_recipients" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: Array.from(to),
        subject: subjectLine,
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

    return new Response(JSON.stringify({ sent: true, recipients: to.size }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-booking error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
