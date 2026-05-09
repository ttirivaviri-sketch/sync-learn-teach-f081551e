/**
 * send-progress-report — Emails a learner's progress report PDF to a tutor
 * and/or guardian, appearing to come on behalf of the student (Reply-To set
 * to the student's email).
 *
 * Body:
 *   { learnerId, pdfBase64, fileName, recipients: [{ email, role }],
 *     studentName, studentEmail, subjectLine?, message? }
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email service not configured (missing RESEND_API_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      pdfBase64,
      fileName = "StudySync-Progress-Report.pdf",
      recipients = [],
      studentName = "Student",
      studentEmail,
      subjectLine,
      message,
    } = body || {};

    if (!pdfBase64 || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing pdfBase64 or recipients" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subject =
      subjectLine || `${studentName}'s StudySync Progress Report`;

    const results: Array<{ email: string; ok: boolean; error?: string }> = [];

    for (const r of recipients) {
      const to = (r.email || "").trim();
      if (!to) continue;
      const isGuardian = r.role === "guardian";

      const html = `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937;">
          <h2 style="color:#1a3fc4;margin:0 0 8px;">StudySync Progress Report</h2>
          <p style="font-size:14px;color:#6b7280;margin:0 0 20px;">Sent on behalf of <strong>${escapeHtml(studentName)}</strong>${studentEmail ? ` (${escapeHtml(studentEmail)})` : ""}</p>
          <p style="font-size:14px;line-height:1.55;">${
            message
              ? escapeHtml(message).replace(/\n/g, "<br>")
              : isGuardian
              ? `Hi, please find attached ${escapeHtml(studentName)}'s latest progress report from StudySync. It covers recent study time, mock-exam scores, strengths, and areas to focus on.`
              : `Hi, please find attached ${escapeHtml(studentName)}'s latest StudySync progress report ahead of our session. It highlights strong topics, weaker areas, and an AI-generated study plan.`
          }</p>
          <p style="font-size:13px;color:#6b7280;margin-top:24px;">You can reply directly to this email to reach ${escapeHtml(studentName)}.</p>
        </div>
      `;

      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${studentName} via StudySync <onboarding@resend.dev>`,
            to: [to],
            reply_to: studentEmail || undefined,
            subject,
            html,
            attachments: [{ filename: fileName, content: pdfBase64 }],
          }),
        });

        if (resp.ok) {
          results.push({ email: to, ok: true });
        } else {
          const text = await resp.text();
          results.push({ email: to, ok: false, error: text });
        }
      } catch (err) {
        results.push({ email: to, ok: false, error: String(err) });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    return new Response(
      JSON.stringify({ sent, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
