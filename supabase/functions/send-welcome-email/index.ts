/**
 * send-welcome-email — Sends the StudySync welcome email from Ashlie Potera.
 *
 * Called in three ways:
 *  1. DB trigger on `public.profiles` insert (pg_net, CRON_SECRET bearer) →
 *     { user_id }  — new signups get the email immediately.
 *  2. Backfill:  { mode: "backfill", limit? }  (CRON_SECRET bearer) — sends to
 *     every existing user that hasn't received it yet.
 *  3. Manually with a user JWT → sends to the caller only.
 *
 * Idempotent: `public.welcome_emails_sent` records each delivery.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
// Dedicated updates sender. Falls back to the reports sender, then sandbox.
const FROM =
  Deno.env.get("RESEND_UPDATES_FROM") ||
  "StudySync <updates@studysync.co.za>";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WHATSAPP_URL =
  "https://chat.whatsapp.com/E6vmLWM13LoCrMpc757QLF?s=cl&p=i&mlu=4";

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function welcomeHtml(name: string): string {
  const first = (name || "there").split(" ")[0];
  return `<!doctype html><html><body style="margin:0;background:#f6f7fb;">
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;padding:32px 28px;color:#1f2937;">
    <h1 style="color:#1a3fc4;font-size:22px;margin:0 0 4px;">Welcome to StudySync</h1>
    <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;margin:0 0 24px;">Education, in sync with your future</p>

    <p style="font-size:15px;line-height:1.6;">Hi ${esc(first)},</p>

    <p style="font-size:15px;line-height:1.6;">
      I'm Ashlie Potera, founder of StudySync. On behalf of the whole team — thank you for joining us.
      StudySync brings your syllabus, past papers, AI StudyMode, verified tutors and a full study library
      into one place so you always know exactly what to study next.
    </p>

    <div style="background:#f1f5ff;border-left:4px solid #1a3fc4;border-radius:8px;padding:18px 20px;margin:24px 0;">
      <h2 style="font-size:16px;margin:0 0 8px;color:#1a3fc4;">Join our WhatsApp study community</h2>
      <p style="font-size:14px;line-height:1.6;margin:0 0 12px;">
        We're building a WhatsApp community for students preparing for their exams — a place to share ideas,
        notes and study plans, and to encourage each other while studying towards finals, as we build StudySync
        into the best study platform for all students.
      </p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
        You'll also be able to talk directly to the StudySync team, report glitches in real time, and tell us
        which features you'd like added or improved — in real time.
      </p>
      <a href="${WHATSAPP_URL}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px;">Join the WhatsApp community</a>
      <p style="font-size:12px;color:#6b7280;margin:12px 0 0;word-break:break-all;">${WHATSAPP_URL}</p>
    </div>

    <p style="font-size:15px;line-height:1.6;">
      If you're preparing for your finals, we'd love to have you in there. See you inside.
    </p>

    <p style="font-size:15px;line-height:1.6;margin-top:24px;">
      Ashlie Potera<br>
      <span style="color:#6b7280;font-size:13px;">Founder — StudySync &amp; team</span>
    </p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 12px;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">You received this email because you created a StudySync account.</p>
  </div></body></html>`;
}

function welcomeText(name: string): string {
  const first = (name || "there").split(" ")[0];
  return `Hi ${first},

I'm Ashlie Potera, founder of StudySync. On behalf of the whole team - thank you for joining us.

We're creating a WhatsApp community for students preparing for their exams, to share ideas, notes and study plans and encourage each other while studying towards finals, as we build StudySync into the best study platform for all students. You'll also be able to talk directly to the StudySync team and report glitches in real time, or request features you'd like added or improved.

If you're interested, join here: ${WHATSAPP_URL}

Ashlie Potera
Founder - StudySync & team`;
}

async function sendTo(
  admin: ReturnType<typeof createClient>,
  user: { id: string; email: string | null; full_name: string | null },
): Promise<boolean> {
  if (!user.email) return false;

  // Idempotency guard — unique on user_id.
  const { error: claimErr } = await admin
    .from("welcome_emails_sent")
    .insert({ user_id: user.id, email: user.email });
  if (claimErr) return false; // already sent (unique violation) or write failed

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [user.email],
      subject: "Welcome to StudySync — join our WhatsApp study community",
      html: welcomeHtml(user.full_name || ""),
      text: welcomeText(user.full_name || ""),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend failed [${res.status}]: ${body}`);
    // Roll the claim back so a retry can send later.
    await admin.from("welcome_emails_sent").delete().eq("user_id", user.id);
    return false;
  }
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email service not configured (missing RESEND_API_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const isSystem = !!CRON_SECRET && token === CRON_SECRET;

    const body = await req.json().catch(() => ({}));

    // ── System paths (DB trigger / backfill) ─────────────────────────────
    if (isSystem) {
      if (body.mode === "backfill") {
        const limit = Math.min(Number(body.limit) || 200, 500);
        const { data: sent } = await admin
          .from("welcome_emails_sent")
          .select("user_id");
        const sentIds = new Set((sent ?? []).map((r: any) => r.user_id));
        const { data: users } = await admin
          .from("profiles")
          .select("id, email, full_name")
          .order("created_at", { ascending: true })
          .limit(1000);
        const pending = (users ?? [])
          .filter((u: any) => !sentIds.has(u.id))
          .slice(0, limit);

        let ok = 0;
        for (const u of pending) {
          if (await sendTo(admin, u as any)) ok++;
          await new Promise((r) => setTimeout(r, 120)); // stay under Resend rate limit
        }
        return new Response(
          JSON.stringify({ mode: "backfill", attempted: pending.length, sent: ok }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const userId = String(body.user_id || "");
      if (!userId) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await admin
        .from("profiles")
        .select("id, email, full_name")
        .eq("id", userId)
        .maybeSingle();
      if (!profile) {
        return new Response(JSON.stringify({ error: "profile not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ok = await sendTo(admin, profile as any);
      return new Response(JSON.stringify({ sent: ok }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Caller path (user JWT) — send to self only ───────────────────────
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", auth.user.id)
      .maybeSingle();
    const ok = await sendTo(
      admin,
      (profile as any) ?? {
        id: auth.user.id,
        email: auth.user.email ?? null,
        full_name: (auth.user.user_metadata as any)?.full_name ?? null,
      },
    );
    return new Response(JSON.stringify({ sent: ok }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-welcome-email error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
