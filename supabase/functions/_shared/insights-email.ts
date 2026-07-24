/**
 * Shared branded HTML builder for StudySync Insights emails.
 * One template, two audiences: "guardian" | "tutor".
 *
 * Used by:
 *   - send-guardian-report (weekly auto)
 *   - send-progress-report (manual/learner-triggered)
 *   - dispatch-weekly-insights (cron)
 */

export type InsightsAudience = "guardian" | "tutor";

export interface SubjectInsight {
  name: string;
  progress_pct: number;
  tasks_completed: number;
  tasks_missed: number;
  avg_score: number;
  risk_level: "on_track" | "needs_attention" | "at_risk";
  exam_date?: string | null;
  days_until_exam?: number | null;
  topics_covered?: string[];
}

export interface InsightsPayload {
  audience: InsightsAudience;
  studentName: string;
  studentEmail?: string | null;
  curriculum?: string | null;
  grade?: string | null;
  examYear?: number | null;
  weekLabel: string; // e.g. "Week of 10 May 2026"
  subjects: SubjectInsight[];
  overall: {
    avg_score: number;
    completed: number;
    missed: number;
    trend: "improving" | "stable" | "declining";
    streak_days?: number;
    study_minutes?: number;
  };
  strengths: string[];
  weakAreas: string[];
  upcomingExams: string[]; // ["Maths (12d)", ...]
  recommendations: string[];
  ctaUrl?: string;
  /**
   * Independence & Focus signals (disclosed in-app monitoring during quizzes
   * / AI question sessions). Only populated when the weekly reporting
   * threshold is met (≥2 flagged sessions), so occasional distractions never
   * reach guardians. Framed supportively — these are focus signals, not
   * proof of misconduct.
   */
  focus?: {
    sessions_total: number;
    sessions_flagged: number;
    avg_focus_score: number; // 0-100
    tab_switches: number;
    paste_events: number;
  } | null;
}

const BRAND = {
  primary: "#1a3fc4",
  primaryDark: "#102a8a",
  bg: "#ffffff",
  surface: "#f6f8fc",
  border: "#e5e9f2",
  text: "#0f172a",
  muted: "#64748b",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
};

const RISK_LABEL = {
  on_track: "On track",
  needs_attention: "Needs attention",
  at_risk: "At risk",
} as const;

const RISK_COLOR = {
  on_track: BRAND.green,
  needs_attention: BRAND.amber,
  at_risk: BRAND.red,
} as const;

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function trendArrow(t: string): string {
  if (t === "improving") return "▲";
  if (t === "declining") return "▼";
  return "→";
}

export function buildInsightsSubject(p: InsightsPayload): string {
  const who = p.audience === "tutor" ? "session prep" : "weekly insights";
  return `${p.studentName}'s StudySync ${who} — ${p.weekLabel}`;
}

export function buildInsightsHtml(p: InsightsPayload): string {
  const isTutor = p.audience === "tutor";

  const greeting = isTutor
    ? `Session prep for <strong>${esc(p.studentName)}</strong>`
    : `Here's how <strong>${esc(p.studentName)}</strong> did this week`;

  const intro = isTutor
    ? `A snapshot of recent study activity, weak topics, and recommended focus areas to bring into your next session.`
    : `A friendly summary of progress, focus areas, and how you can support at home. No jargon — just what matters.`;

  const subjectRows = p.subjects.map((s) => `
    <tr>
      <td style="padding:12px 10px;border-bottom:1px solid ${BRAND.border};">
        <div style="font-weight:600;color:${BRAND.text};font-size:14px;">${esc(s.name)}</div>
        ${s.topics_covered?.length ? `<div style="color:${BRAND.muted};font-size:12px;margin-top:2px;">${esc(s.topics_covered.slice(0, 3).join(" · "))}</div>` : ""}
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid ${BRAND.border};text-align:center;white-space:nowrap;">
        <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${RISK_COLOR[s.risk_level]}1a;color:${RISK_COLOR[s.risk_level]};font-size:11px;font-weight:600;">
          ${RISK_LABEL[s.risk_level]}
        </span>
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid ${BRAND.border};text-align:center;color:${BRAND.text};font-size:13px;">
        ${s.tasks_completed}<span style="color:${BRAND.muted}">/${s.tasks_completed + s.tasks_missed}</span>
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid ${BRAND.border};text-align:center;font-weight:600;color:${BRAND.text};font-size:13px;">
        ${s.avg_score}%
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid ${BRAND.border};text-align:center;color:${BRAND.muted};font-size:12px;white-space:nowrap;">
        ${s.days_until_exam != null ? `${s.days_until_exam}d` : "—"}
      </td>
    </tr>`).join("");

  const audienceTipsTitle = isTutor ? "Suggested next session" : "How you can support";
  const tips = p.recommendations.length
    ? p.recommendations
    : isTutor
    ? ["Continue current pacing — no urgent intervention needed."]
    : ["Keep encouraging consistent short daily study sessions."];

  const studyMin = p.overall.study_minutes ?? 0;
  const studyHrs = Math.round((studyMin / 60) * 10) / 10;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.surface};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:${BRAND.text};">
  <div style="max-width:640px;margin:0 auto;background:${BRAND.bg};">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.primaryDark} 100%);padding:28px 28px 22px;color:#fff;">
      <div style="font-size:13px;opacity:.85;letter-spacing:.5px;text-transform:uppercase;font-weight:600;">StudySync · ${isTutor ? "Tutor brief" : "Weekly insights"}</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px;line-height:1.3;">${greeting}</div>
      <div style="font-size:13px;opacity:.9;margin-top:8px;">
        ${esc(p.curriculum || "")} ${p.grade ? `· ${esc(p.grade)}` : ""} ${p.examYear ? `· Exam ${p.examYear}` : ""} · ${esc(p.weekLabel)}
      </div>
    </div>

    <!-- Intro -->
    <div style="padding:22px 28px 6px;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:${BRAND.muted};">${intro}</p>
    </div>

    <!-- Snapshot cards -->
    <div style="padding:18px 18px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:10px;">
        <tr>
          ${snapshotCard("Avg score", `${p.overall.avg_score}%`, `${trendArrow(p.overall.trend)} ${p.overall.trend}`)}
          ${snapshotCard("Tasks done", `${p.overall.completed}`, `${p.overall.missed} missed`)}
          ${snapshotCard("Study time", `${studyHrs}h`, p.overall.streak_days ? `${p.overall.streak_days}-day streak` : "this week")}
        </tr>
      </table>
    </div>

    <!-- Subjects -->
    <div style="padding:14px 28px 6px;">
      <h3 style="margin:0 0 10px;font-size:15px;color:${BRAND.text};">Subjects</h3>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${BRAND.border};border-radius:10px;overflow:hidden;">
        <thead>
          <tr style="background:${BRAND.surface};">
            <th style="text-align:left;padding:10px;font-size:11px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Subject</th>
            <th style="text-align:center;padding:10px;font-size:11px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Status</th>
            <th style="text-align:center;padding:10px;font-size:11px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Tasks</th>
            <th style="text-align:center;padding:10px;font-size:11px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Avg</th>
            <th style="text-align:center;padding:10px;font-size:11px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Exam</th>
          </tr>
        </thead>
        <tbody>${subjectRows || `<tr><td colspan="5" style="padding:18px;text-align:center;color:${BRAND.muted};font-size:13px;">No activity recorded this week.</td></tr>`}</tbody>
      </table>
    </div>

    <!-- Strengths / weak areas -->
    ${(p.strengths.length || p.weakAreas.length) ? `
    <div style="padding:18px 28px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td valign="top" style="width:50%;padding-right:8px;">
            <div style="background:${BRAND.green}10;border:1px solid ${BRAND.green}33;border-radius:10px;padding:14px;">
              <div style="font-size:11px;color:${BRAND.green};font-weight:700;letter-spacing:.5px;text-transform:uppercase;">Strengths</div>
              <ul style="margin:8px 0 0;padding-left:18px;color:${BRAND.text};font-size:13px;line-height:1.6;">
                ${p.strengths.length ? p.strengths.map(s => `<li>${esc(s)}</li>`).join("") : `<li style="color:${BRAND.muted};list-style:none;margin-left:-18px;">Building up — check back next week.</li>`}
              </ul>
            </div>
          </td>
          <td valign="top" style="width:50%;padding-left:8px;">
            <div style="background:${BRAND.amber}12;border:1px solid ${BRAND.amber}40;border-radius:10px;padding:14px;">
              <div style="font-size:11px;color:#b45309;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">Focus areas</div>
              <ul style="margin:8px 0 0;padding-left:18px;color:${BRAND.text};font-size:13px;line-height:1.6;">
                ${p.weakAreas.length ? p.weakAreas.map(s => `<li>${esc(s)}</li>`).join("") : `<li style="color:${BRAND.muted};list-style:none;margin-left:-18px;">Nothing flagged this week.</li>`}
              </ul>
            </div>
          </td>
        </tr>
      </table>
    </div>` : ""}

    <!-- Upcoming exams -->
    ${p.upcomingExams.length ? `
    <div style="padding:14px 28px 0;">
      <div style="background:${BRAND.primary}0d;border-left:3px solid ${BRAND.primary};padding:12px 14px;border-radius:6px;">
        <div style="font-size:11px;color:${BRAND.primary};font-weight:700;letter-spacing:.5px;text-transform:uppercase;">Upcoming exams</div>
        <div style="margin-top:6px;color:${BRAND.text};font-size:13px;">${esc(p.upcomingExams.join(" · "))}</div>
      </div>
    </div>` : ""}

    <!-- Independence & Focus (threshold-gated) -->
    ${p.focus ? `
    <div style="padding:18px 28px 0;">
      <div style="background:${BRAND.amber}12;border:1px solid ${BRAND.amber}40;border-radius:10px;padding:14px;">
        <div style="font-size:11px;color:#b45309;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">Independence &amp; Focus</div>
        <p style="margin:8px 0 0;color:${BRAND.text};font-size:13px;line-height:1.6;">
          During quiz and practice sessions this week, ${esc(p.studentName)} showed signs of distraction or outside help in
          <strong>${p.focus.sessions_flagged} of ${p.focus.sessions_total} sessions</strong>
          (average focus score <strong>${p.focus.avg_focus_score}%</strong>${p.focus.tab_switches ? `, ${p.focus.tab_switches} switch${p.focus.tab_switches === 1 ? "" : "es"} away from the app` : ""}${p.focus.paste_events ? `, ${p.focus.paste_events} pasted answer${p.focus.paste_events === 1 ? "" : "s"}` : ""}).
        </p>
        <p style="margin:8px 0 0;color:${BRAND.muted};font-size:12px;line-height:1.6;">
          These are focus signals, not proof of anything — a gentle conversation about working independently in a
          distraction-free space usually helps. Students can always see their own focus score, so this is a shared, transparent measure.
        </p>
      </div>
    </div>` : ""}

    <!-- Recommendations -->
    <div style="padding:18px 28px 0;">
      <h3 style="margin:0 0 10px;font-size:15px;color:${BRAND.text};">${audienceTipsTitle}</h3>
      <ul style="margin:0;padding-left:20px;color:${BRAND.text};font-size:14px;line-height:1.7;">
        ${tips.map(t => `<li>${esc(t)}</li>`).join("")}
      </ul>
    </div>

    <!-- CTA -->
    ${p.ctaUrl ? `
    <div style="padding:24px 28px 8px;text-align:center;">
      <a href="${esc(p.ctaUrl)}" style="display:inline-block;background:${BRAND.primary};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 26px;border-radius:8px;">
        ${isTutor ? "Open student briefing" : "View full report"}
      </a>
    </div>` : ""}

    <!-- Footer -->
    <div style="padding:28px;text-align:center;color:${BRAND.muted};font-size:12px;line-height:1.6;border-top:1px solid ${BRAND.border};margin-top:18px;">
      Sent by StudySync${p.studentEmail ? ` on behalf of ${esc(p.studentName)} (${esc(p.studentEmail)})` : ""}.<br>
      Reply to this email to reach ${isTutor ? "the student" : "the StudySync team"}.
    </div>
  </div>
</body></html>`;
}

function snapshotCard(label: string, value: string, sub: string): string {
  return `
    <td style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;padding:14px;text-align:center;">
      <div style="font-size:11px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:.5px;font-weight:600;">${esc(label)}</div>
      <div style="font-size:22px;font-weight:700;color:${BRAND.text};margin-top:4px;line-height:1.1;">${esc(value)}</div>
      <div style="font-size:11px;color:${BRAND.muted};margin-top:4px;">${esc(sub)}</div>
    </td>`;
}
