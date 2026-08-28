/**
 * send-guardian-report (also used as the weekly insights dispatcher)
 *
 * Cron-only endpoint (Bearer CRON_SECRET). Runs hourly. For each learner whose
 * `academic_profiles.weekly_report_dow` matches the current UTC day-of-week
 * AND who has no row in `scheduled_insight_runs` for the current week:
 *   1. Aggregate the last 7 days of study_activity per subject.
 *   2. Build branded HTML insights (shared template, audience-aware).
 *   3. Send to:
 *        - guardian (audience='guardian')
 *        - every BOOKED tutor (status confirmed/completed/in_progress, audience='tutor')
 *   4. Cache the summary in analytics_reports + record the run.
 *
 * Re-runnable: `scheduled_insight_runs` upsert prevents double-sending.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  buildInsightsHtml,
  buildInsightsSubject,
  type InsightsPayload,
  type SubjectInsight,
} from "../_shared/insights-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
// Verified sender address. Set the RESEND_FROM secret once your domain is
// verified in Resend (e.g. "reports@studysync.co.za"). Falls back to
// Resend's sandbox sender, which only delivers to the Resend account owner.
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "onboarding@resend.dev";

function calcRisk(daysToExam: number | null, avg: number, completion: number): SubjectInsight["risk_level"] {
  if (daysToExam === null) return "needs_attention";
  if (daysToExam <= 14 && (avg < 50 || completion < 0.3)) return "at_risk";
  if (daysToExam <= 30 && avg < 40) return "at_risk";
  if (completion < 0.2 && daysToExam <= 60) return "at_risk";
  if (daysToExam <= 30 && (avg < 60 || completion < 0.5)) return "needs_attention";
  if (daysToExam <= 60 && avg < 50) return "needs_attention";
  if (completion < 0.4) return "needs_attention";
  return "on_track";
}

async function sendOne(opts: {
  to: string;
  fromName: string;
  replyTo?: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY missing" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${opts.fromName} <${RESEND_FROM}>`,
        to: [opts.to],
        reply_to: opts.replyTo,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!r.ok) {
      const body = await r.text();
      console.error("[insights] resend_send_failed", JSON.stringify({ to: opts.to, from: RESEND_FROM, status: r.status, body }));
      return { ok: false, error: `resend ${r.status}: ${body}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[insights] resend_exception", String(e));
    return { ok: false, error: String(e) };
  }
}

/**
 * `academic_profiles.exam_dates` has been stored in three shapes over time:
 *   1. [{ subject, date }]            (current)
 *   2. { "Maths": "2026-11-02", ... } (legacy object map)
 *   3. null / garbage
 * Normalise to shape 1 so `.find()` never explodes.
 */
function normaliseExamDates(raw: unknown): Array<{ subject: string; date: string }> {
  if (Array.isArray(raw)) {
    return raw
      .filter((e): e is { subject: string; date: string } =>
        !!e && typeof e === "object" && typeof (e as any).subject === "string" && !!(e as any).date)
      .map((e) => ({ subject: String(e.subject), date: String(e.date) }));
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string" || v instanceof Date)
      .map(([subject, v]) => ({ subject, date: String(v) }));
  }
  return [];
}

serve(async (req) => {
  try {
    // Accept the cron secret (pg_cron tick) OR the service key
    // (internal call from run-learning-ops-automation's guardian_digest job).
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const viaCron = Boolean(CRON_SECRET) && token === CRON_SECRET;
    const viaService = Boolean(SERVICE_KEY) && token === SERVICE_KEY;
    let authorized = viaCron || viaService;
    if (!authorized && token) {
      // Fallback: verify against the Vault copy of CRON_SECRET used by pg_cron.
      const { data: cronOk } = await supabase.rpc("verify_cron_token", { _token: token });
      authorized = cronOk === true;
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }


    const todayDow = new Date().getUTCDay(); // 0=Sun..6=Sat
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekLabel = `Week of ${weekStart.toUTCString().split(" ").slice(1, 4).join(" ")}`;

    // Pull learners whose preferred dispatch day == today.
    const { data: profiles, error: profileError } = await supabase
      .from("academic_profiles")
      .select("user_id, curriculum, grade, subjects, exam_year, exam_dates, guardian_email, student_email, weekly_report_dow");

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), { status: 500 });
    }

    const eligible = (profiles || []).filter((p: any) => (p.weekly_report_dow ?? 0) === todayDow);
    let sentGuardian = 0;
    let sentTutor = 0;

    for (const profile of eligible) {
      try {
        // Skip if a run already exists for this week.
        const { data: existing } = await supabase
          .from("scheduled_insight_runs")
          .select("id, sent_to_guardian, sent_to_tutors, status")
          .eq("user_id", profile.user_id)
          .eq("week_start", weekStartStr)
          .maybeSingle();
        if (existing && existing.status === "completed") continue;

        // Pull activity + booked tutors + integrity signals in parallel.
        const [{ data: activities }, { data: bookings }, { data: studentProfile }, { data: integrityRows }] = await Promise.all([
          supabase.from("study_activity").select("*").eq("user_id", profile.user_id).gte("date", weekStartStr),
          supabase
            .from("bookings")
            .select("tutor_id, status, profiles:tutor_id(email, full_name)")
            .eq("learner_id", profile.user_id)
            .in("status", ["confirmed", "completed", "in_progress"]),
          supabase.from("profiles").select("full_name, email").eq("id", profile.user_id).maybeSingle(),
          supabase
            .from("session_integrity_reports")
            .select("is_flagged, focus_score, tab_switches, paste_events")
            .eq("user_id", profile.user_id)
            .gte("created_at", weekStart.toISOString()),
        ]);

        const studentName = studentProfile?.full_name || "Student";

        // Build per-subject summary.
        const subjMap: Record<string, { completed: number; missed: number; scores: number[]; topics: Set<string> }> = {};
        for (const s of (profile.subjects || [])) subjMap[s] = { completed: 0, missed: 0, scores: [], topics: new Set() };
        for (const a of (activities || [])) {
          if (!subjMap[a.subject]) subjMap[a.subject] = { completed: 0, missed: 0, scores: [], topics: new Set() };
          const slot = subjMap[a.subject];
          if (a.task_completed) slot.completed++; else slot.missed++;
          if (a.score != null) slot.scores.push(Number(a.score));
          if (a.topic) slot.topics.add(a.topic);
        }
        const examDates = normaliseExamDates(profile.exam_dates);
        const subjects: SubjectInsight[] = Object.entries(subjMap).map(([name, s]) => {
          const total = s.completed + s.missed;
          const completion = total ? s.completed / total : 0;
          const avg = s.scores.length ? Math.round(s.scores.reduce((a,b)=>a+b,0)/s.scores.length) : 0;
          const examEntry = examDates.find(e => e.subject === name);
          const daysToExam = examEntry
            ? Math.ceil((new Date(examEntry.date).getTime() - now.getTime()) / 86400000)
            : null;
          return {
            name,
            progress_pct: Math.round(completion * 100),
            tasks_completed: s.completed,
            tasks_missed: s.missed,
            avg_score: avg,
            risk_level: calcRisk(daysToExam, avg, completion),
            exam_date: examEntry?.date || null,
            days_until_exam: daysToExam,
            topics_covered: Array.from(s.topics),
          };
        });

        const totalCompleted = subjects.reduce((a,s)=>a+s.tasks_completed,0);
        const totalMissed = subjects.reduce((a,s)=>a+s.tasks_missed,0);
        const overallAvg = subjects.length ? Math.round(subjects.reduce((a,s)=>a+s.avg_score,0)/subjects.length) : 0;
        const trend: "improving"|"stable"|"declining" = overallAvg >= 60 ? "improving" : overallAvg >= 40 ? "stable" : "declining";
        const weak = subjects.filter(s => s.risk_level !== "on_track").map(s => s.name);
        const strong = subjects.filter(s => s.risk_level === "on_track" && s.avg_score >= 65).map(s => s.name);
        const upcoming = subjects
          .filter(s => s.days_until_exam != null && s.days_until_exam > 0 && s.days_until_exam <= 30)
          .sort((a,b) => (a.days_until_exam!) - (b.days_until_exam!))
          .map(s => `${s.name} (${s.days_until_exam}d)`);

        const studyMinutes = (activities || []).reduce((acc: number, a: any) => acc + (Number(a.duration_minutes) || 0), 0);

        // Independence & Focus signals — only surfaced when the weekly
        // reliability threshold is met (≥2 flagged sessions). One distracted
        // session never reaches guardians; students always see their own data.
        const WEEKLY_REPORT_MIN_FLAGGED_SESSIONS = 2;
        const iRows = integrityRows || [];
        const flaggedSessions = iRows.filter((r: any) => r.is_flagged).length;
        const focus = flaggedSessions >= WEEKLY_REPORT_MIN_FLAGGED_SESSIONS
          ? {
              sessions_total: iRows.length,
              sessions_flagged: flaggedSessions,
              avg_focus_score: iRows.length
                ? Math.round(iRows.reduce((a: number, r: any) => a + Number(r.focus_score ?? 100), 0) / iRows.length)
                : 100,
              tab_switches: iRows.reduce((a: number, r: any) => a + (Number(r.tab_switches) || 0), 0),
              paste_events: iRows.reduce((a: number, r: any) => a + (Number(r.paste_events) || 0), 0),
            }
          : null;

        const baseInsights: Omit<InsightsPayload, "audience"> = {
          studentName,
          studentEmail: profile.student_email || studentProfile?.email || null,
          curriculum: profile.curriculum,
          grade: profile.grade,
          examYear: profile.exam_year,
          weekLabel,
          subjects,
          overall: {
            avg_score: overallAvg,
            completed: totalCompleted,
            missed: totalMissed,
            trend,
            study_minutes: studyMinutes,
          },
          strengths: strong,
          weakAreas: weak,
          upcomingExams: upcoming,
          recommendations: weak.length
            ? [`Focus on: ${weak.join(", ")}`, "Schedule a short daily session per weak area."]
            : ["Great progress this week — keep momentum with consistent short sessions."],
          focus,
        };

        // Cache summary
        await supabase.from("analytics_reports").upsert({
          user_id: profile.user_id,
          week_start: weekStartStr,
          report_type: "guardian_weekly",
          summary_json: baseInsights as any,
          email_sent: false,
        }, { onConflict: "user_id,week_start,report_type" });

        const sentTutorIds: string[] = existing?.sent_to_tutors || [];
        let sentGuardianFlag = existing?.sent_to_guardian || false;
        const deliveryErrors: string[] = [];

        // 1) Guardian
        if (!profile.guardian_email) {
          deliveryErrors.push("no guardian_email on academic_profile");
        } else if (!sentGuardianFlag) {
          const payload: InsightsPayload = { ...baseInsights, audience: "guardian" };
          const res = await sendOne({
            to: profile.guardian_email,
            fromName: "StudySync",
            replyTo: profile.student_email || studentProfile?.email || undefined,
            subject: buildInsightsSubject(payload),
            html: buildInsightsHtml(payload),
          });
          if (res.ok) { sentGuardian++; sentGuardianFlag = true; }
          else deliveryErrors.push(`guardian: ${res.error}`);
        }

        // 2) Booked tutors (deduped, exclude already-sent)
        const tutorMap = new Map<string, { email: string }>();
        for (const b of (bookings || [])) {
          const tid = b.tutor_id;
          const email = (b.profiles as any)?.email;
          if (tid && email && !tutorMap.has(tid)) tutorMap.set(tid, { email });
        }
        for (const [tid, t] of tutorMap.entries()) {
          if (sentTutorIds.includes(tid)) continue;
          const payload: InsightsPayload = { ...baseInsights, audience: "tutor" };
          const res = await sendOne({
            to: t.email,
            fromName: `${studentName} via StudySync`,
            replyTo: profile.student_email || studentProfile?.email || undefined,
            subject: buildInsightsSubject(payload),
            html: buildInsightsHtml(payload),
          });
          if (res.ok) { sentTutor++; sentTutorIds.push(tid); }
          else deliveryErrors.push(`tutor ${tid}: ${res.error}`);
        }

        if (deliveryErrors.length) {
          console.error("[insights] delivery_errors", JSON.stringify({ user_id: profile.user_id, errors: deliveryErrors }));
        }

        // Record the run — surface delivery failures instead of always
        // reporting "completed" with sent_to_guardian:false and no reason.
        await supabase.from("scheduled_insight_runs").upsert({
          user_id: profile.user_id,
          week_start: weekStartStr,
          sent_to_guardian: sentGuardianFlag,
          sent_to_tutors: sentTutorIds,
          status: deliveryErrors.length ? "partial" : "completed",
          error_message: deliveryErrors.length ? deliveryErrors.join(" | ").slice(0, 2000) : null,
        }, { onConflict: "user_id,week_start" });

        if (sentGuardianFlag) {
          await supabase.from("analytics_reports")
            .update({ email_sent: true, email_sent_at: new Date().toISOString() })
            .eq("user_id", profile.user_id).eq("week_start", weekStartStr).eq("report_type", "guardian_weekly");
        }
      } catch (e) {
        console.error("[insights] learner failed", profile.user_id, e);
        await supabase.from("scheduled_insight_runs").upsert({
          user_id: profile.user_id, week_start: weekStartStr,
          status: "failed", error_message: String(e),
        }, { onConflict: "user_id,week_start" });
      }
    }

    return new Response(JSON.stringify({
      ok: true, eligible: eligible.length, sentGuardian, sentTutor, weekStart: weekStartStr, dow: todayDow,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
