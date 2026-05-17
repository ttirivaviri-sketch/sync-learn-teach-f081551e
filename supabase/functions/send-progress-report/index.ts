/**
 * send-progress-report — Emails a learner's progress report PDF to:
 *   - the learner's guardian, AND
 *   - tutors the learner has actually booked (status confirmed/completed).
 *
 * Tutor recipients are server-validated against the bookings table —
 * arbitrary emails are silently dropped. Auth required (learner JWT).
 *
 * Body:
 *   { recipients: [{ email, role: 'tutor'|'guardian', tutorId? }],
 *     pdfBase64, fileName?, studentName?, studentEmail?,
 *     subjectLine?, message?, insights? (InsightsPayload-shaped) }
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  buildInsightsHtml,
  buildInsightsSubject,
  type InsightsPayload,
} from "../_shared/insights-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function fallbackHtml(studentName: string, studentEmail: string | undefined, isGuardian: boolean, message?: string): string {
  const safe = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = message
    ? safe(message).replace(/\n/g, "<br>")
    : isGuardian
    ? `Hi, please find attached ${safe(studentName)}'s latest progress report from StudySync.`
    : `Hi, please find attached ${safe(studentName)}'s latest StudySync progress report ahead of our session.`;
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937;">
    <h2 style="color:#1a3fc4;margin:0 0 8px;">StudySync Progress Report</h2>
    <p style="font-size:14px;color:#6b7280;margin:0 0 20px;">Sent on behalf of <strong>${safe(studentName)}</strong>${studentEmail ? ` (${safe(studentEmail)})` : ""}</p>
    <p style="font-size:14px;line-height:1.55;">${body}</p>
  </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email service not configured (missing RESEND_API_KEY). Verify a sender domain to enable sending." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth — only the learner themselves can trigger.
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const learnerId = userData.user.id;

    const body = await req.json();
    const {
      pdfBase64,
      fileName = "StudySync-Progress-Report.pdf",
      recipients = [],
      studentName = "Student",
      studentEmail,
      subjectLine,
      message,
      insights, // optional InsightsPayload
    } = body || {};

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "Missing recipients" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the learner's booked-tutor email allowlist + guardian email.
    const [{ data: bookings }, { data: profile }] = await Promise.all([
      admin
        .from("bookings")
        .select("tutor_id, status, profiles:tutor_id(email)")
        .eq("learner_id", learnerId)
        .in("status", ["confirmed", "completed", "in_progress"]),
      admin
        .from("academic_profiles")
        .select("guardian_email")
        .eq("user_id", learnerId)
        .maybeSingle(),
    ]);

    const bookedTutorEmails = new Set<string>(
      (bookings || [])
        .map((b: any) => (b.profiles?.email || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const guardianEmail = (profile?.guardian_email || "").trim().toLowerCase();

    const filtered: Array<{ email: string; role: string }> = [];
    const dropped: Array<{ email: string; reason: string }> = [];
    for (const r of recipients) {
      const email = (r.email || "").trim().toLowerCase();
      if (!email) continue;
      if (r.role === "guardian") {
        if (!guardianEmail) { dropped.push({ email, reason: "no guardian on file" }); continue; }
        if (email !== guardianEmail) { dropped.push({ email, reason: "not the registered guardian" }); continue; }
        filtered.push({ email, role: "guardian" });
      } else {
        // Default to tutor: must be a booked tutor.
        if (!bookedTutorEmails.has(email)) { dropped.push({ email, reason: "not a booked tutor" }); continue; }
        filtered.push({ email, role: "tutor" });
      }
    }

    if (filtered.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid recipients", dropped }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ email: string; ok: boolean; error?: string }> = [];

    for (const r of filtered) {
      const isGuardian = r.role === "guardian";
      const audience = isGuardian ? "guardian" : "tutor";
      const html = insights
        ? buildInsightsHtml({ ...(insights as InsightsPayload), audience, studentName, studentEmail })
        : fallbackHtml(studentName, studentEmail, isGuardian, message);
      const subject = subjectLine
        || (insights ? buildInsightsSubject({ ...(insights as InsightsPayload), audience, studentName, studentEmail })
                     : `${studentName}'s StudySync Progress Report`);

      try {
        const payload: any = {
          from: `${studentName} via StudySync <onboarding@resend.dev>`,
          to: [r.email],
          reply_to: studentEmail || undefined,
          subject,
          html,
        };
        if (pdfBase64) payload.attachments = [{ filename: fileName, content: pdfBase64 }];

        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (resp.ok) results.push({ email: r.email, ok: true });
        else results.push({ email: r.email, ok: false, error: await resp.text() });
      } catch (err) {
        results.push({ email: r.email, ok: false, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ sent: results.filter(r => r.ok).length, results, dropped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
