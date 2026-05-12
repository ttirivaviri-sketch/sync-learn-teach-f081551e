/**
 * generateProgressReport — Comprehensive learner progress PDF.
 *
 * Includes: cover, executive summary, charts (mastery, mock trajectory,
 * daily minutes), per-subject breakdown, mock exam table, tasks-by-type,
 * strong / weak topics, and an AI-generated improvement plan.
 *
 * Two audiences: 'self' (learner) and 'tutor' (adds "areas to start with"
 * + recommended session plan + private learner notes excluded).
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { renderChartToDataUrl } from "./chartToImage";

const LOGO_URL = "/lovable-uploads/studysync-logo.png";

export interface MockTrajectoryPoint {
  id: string;
  subject: string;
  paperCode: string;
  percent: number;
  grade: string | null;
  marksAwarded: number;
  totalMarks: number;
  timeTakenSeconds: number;
  date: string;
}

export interface ProgressReportData {
  audience: "self" | "tutor";
  generatedAt: string;
  windowDays: number;
  learner: {
    name: string;
    email: string;
    curriculum: string | null;
    grade: string | null;
    targetGrade: string | null;
    examYear: number | null;
    schoolName: string | null;
    subjects: string[];
    examDates: Array<{ subject: string; date: string }>;
  };
  tutorName?: string;
  summary: {
    totalMinutes: number;
    tasksCompleted: number;
    totalXp: number;
    bestStreak: number;
    overallMastery: number;
    avgMockScore: number;
    mockCount: number;
  };
  subjectMastery: Array<{
    subject: string;
    mastery: number;
    minutes: number;
    topicsCovered: number;
  }>;
  dailyMinutes: Record<string, number>;
  mockTrajectory: MockTrajectoryPoint[];
  tasksByType: Record<string, { done: number; total: number }>;
  strongTopics: Array<{ topic: string; accuracy: number; attempts: number }>;
  weakTopics: Array<{ topic: string; accuracy: number; attempts: number }>;
  aiPlan?: {
    headline_assessment?: string;
    top_concerns?: Array<{
      topic: string;
      why: string;
      first_step: string;
      priority: "critical" | "high" | "medium" | "low";
    }>;
    seven_day_plan?: Array<{
      day: number;
      focus: string;
      actions: string[];
    }>;
    recommended_focus_areas?: string[];
    suggested_past_paper_questions?: string[];
    tutor_session_plan?: Array<{
      session: number;
      objective: string;
      activities: string[];
    }>;
    motivational_note?: string;
  } | null;
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const PRIORITY_COLORS: Record<string, [number, number, number]> = {
  critical: [220, 38, 38],
  high: [234, 88, 12],
  medium: [202, 138, 4],
  low: [37, 99, 235],
};

function safeFormat(value: unknown, fmt: string, fallback = "—"): string {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value as string);
  if (isNaN(d.getTime())) return fallback;
  try {
    return format(d, fmt);
  } catch {
    return fallback;
  }
}

function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function ensurePage(doc: jsPDF, currentY: number, needed: number): number {
  const ph = doc.internal.pageSize.getHeight();
  if (currentY + needed > ph - 50) {
    doc.addPage();
    return 60;
  }
  return currentY;
}

function sectionTitle(doc: jsPDF, title: string, y: number, margin: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text(title, margin, y);
  doc.setDrawColor(220);
  doc.line(margin, y + 4, doc.internal.pageSize.getWidth() - margin, y + 4);
  return y + 18;
}

export async function generateProgressReportPdf(
  data: ProgressReportData
): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;

  const logo = await loadLogoDataUrl();

  // ── COVER ──────────────────────────────────────────────────────────────────
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, 60, 130, 38, undefined, "FAST");
    } catch {
      /* ignore */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(15);
  doc.text(
    data.audience === "tutor"
      ? "Student Progress Report"
      : "My Progress Report",
    margin,
    180
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(110);
  doc.text(
    `Period: last ${data.windowDays} days · Generated ${safeFormat(
      data.generatedAt,
      "dd MMM yyyy, HH:mm"
    )}`,
    margin,
    202
  );

  // Learner info block
  doc.setTextColor(20);
  doc.setFontSize(11);
  let y = 250;
  const lines: string[] = [
    `Name:        ${data.learner.name}`,
    `Email:       ${data.learner.email}`,
    `Curriculum:  ${data.learner.curriculum || "—"}${
      data.learner.grade ? `  ·  Grade ${data.learner.grade}` : ""
    }`,
    `Target:      ${data.learner.targetGrade || "—"}${
      data.learner.examYear ? `  ·  Exam year ${data.learner.examYear}` : ""
    }`,
  ];
  if (data.learner.schoolName) lines.push(`School:      ${data.learner.schoolName}`);
  if (data.learner.subjects.length)
    lines.push(`Subjects:    ${data.learner.subjects.join(", ")}`);
  if (data.tutorName) lines.push(`Prepared for: ${data.tutorName}`);

  for (const line of lines) {
    doc.text(line, margin, y);
    y += 18;
  }

  // Exam dates
  if (data.learner.examDates.length) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Upcoming exam dates", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    for (const ed of data.learner.examDates.slice(0, 6)) {
      doc.text(
        `• ${ed.subject}: ${safeFormat(ed.date, "dd MMM yyyy")}`,
        margin,
        y
      );
      y += 14;
    }
  }

  // ── EXECUTIVE SUMMARY ────────────────────────────────────────────────────
  doc.addPage();
  let py = 70;
  py = sectionTitle(doc, "Executive Summary", py, margin);

  const cardW = (pageW - margin * 2 - 24) / 3;
  const cards = [
    { label: "Study Time", value: fmtMinutes(data.summary.totalMinutes) },
    { label: "Tasks Completed", value: String(data.summary.tasksCompleted) },
    { label: "Best Streak", value: `${data.summary.bestStreak} days` },
    { label: "Total XP", value: data.summary.totalXp.toLocaleString() },
    { label: "Overall Mastery", value: `${data.summary.overallMastery}%` },
    {
      label: "Avg Mock Score",
      value: data.summary.mockCount
        ? `${data.summary.avgMockScore}% (${data.summary.mockCount})`
        : "—",
    },
  ];
  for (let i = 0; i < cards.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = margin + col * (cardW + 12);
    const cy = py + row * 76;
    doc.setFillColor(247, 248, 252);
    doc.roundedRect(cx, cy, cardW, 64, 10, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(cards[i].label, cx + 12, cy + 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(20);
    doc.text(cards[i].value, cx + 12, cy + 46);
  }
  py += 76 * Math.ceil(cards.length / 3) + 14;

  // ── CHARTS ───────────────────────────────────────────────────────────────
  py = sectionTitle(doc, "Performance Charts", py, margin);

  // Subject mastery (horizontal bar)
  if (data.subjectMastery.length) {
    const masteryUrl = await renderChartToDataUrl(
      {
        type: "bar",
        data: {
          labels: data.subjectMastery.map((s) => s.subject),
          datasets: [
            {
              label: "Mastery %",
              data: data.subjectMastery.map((s) => s.mastery),
              backgroundColor: "rgba(59, 130, 246, 0.85)",
              borderRadius: 6,
            },
          ],
        },
        options: {
          indexAxis: "y" as const,
          plugins: {
            title: { display: true, text: "Mastery per subject" },
            legend: { display: false },
          },
          scales: {
            x: { beginAtZero: true, max: 100 },
          },
        },
      },
      { width: 1200, height: 480 }
    );
    py = ensurePage(doc, py, 240);
    if (masteryUrl) doc.addImage(masteryUrl, "PNG", margin, py, pageW - margin * 2, 220);
    py += 232;
  }

  // Mock score trajectory (line)
  if (data.mockTrajectory.length >= 2) {
    const trajUrl = await renderChartToDataUrl(
      {
        type: "line",
        data: {
          labels: data.mockTrajectory.map((m) =>
            safeFormat(m.date, "dd MMM")
          ),
          datasets: [
            {
              label: "Mock score %",
              data: data.mockTrajectory.map((m) => m.percent),
              borderColor: "rgba(16, 185, 129, 1)",
              backgroundColor: "rgba(16, 185, 129, 0.18)",
              fill: true,
              tension: 0.3,
              pointRadius: 4,
            },
          ],
        },
        options: {
          plugins: {
            title: { display: true, text: "Mock exam score trajectory" },
            legend: { display: false },
          },
          scales: { y: { beginAtZero: true, max: 100 } },
        },
      },
      { width: 1200, height: 480 }
    );
    py = ensurePage(doc, py, 240);
    if (trajUrl) doc.addImage(trajUrl, "PNG", margin, py, pageW - margin * 2, 220);
    py += 232;
  }

  // Daily study minutes (bar)
  const dailyEntries = Object.entries(data.dailyMinutes);
  if (dailyEntries.some(([, v]) => v > 0)) {
    const dailyUrl = await renderChartToDataUrl(
      {
        type: "bar",
        data: {
          labels: dailyEntries.map(([d]) => d.slice(5)),
          datasets: [
            {
              label: "Minutes",
              data: dailyEntries.map(([, v]) => v),
              backgroundColor: "rgba(168, 85, 247, 0.85)",
              borderRadius: 3,
            },
          ],
        },
        options: {
          plugins: {
            title: { display: true, text: "Study minutes — last 30 days" },
            legend: { display: false },
          },
          scales: { y: { beginAtZero: true } },
        },
      },
      { width: 1200, height: 420 }
    );
    py = ensurePage(doc, py, 220);
    if (dailyUrl) doc.addImage(dailyUrl, "PNG", margin, py, pageW - margin * 2, 200);
    py += 212;
  }

  // ── PER-SUBJECT BREAKDOWN ────────────────────────────────────────────────
  if (data.subjectMastery.length) {
    py = ensurePage(doc, py, 60);
    py = sectionTitle(doc, "Per-subject breakdown", py, margin);
    autoTable(doc, {
      startY: py,
      head: [["Subject", "Mastery", "Time spent", "Topics"]],
      body: data.subjectMastery.map((s) => [
        s.subject,
        `${s.mastery}%`,
        fmtMinutes(s.minutes),
        String(s.topicsCovered),
      ]),
      theme: "striped",
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 10 },
      bodyStyles: { fontSize: 10 },
      margin: { left: margin, right: margin },
    });
    py = (doc as any).lastAutoTable.finalY + 18;
  }

  // ── MOCK EXAM RESULTS TABLE ───────────────────────────────────────────────
  if (data.mockTrajectory.length) {
    py = ensurePage(doc, py, 80);
    py = sectionTitle(doc, "Mock exam results", py, margin);
    autoTable(doc, {
      startY: py,
      head: [["Date", "Subject", "Paper", "Marks", "Score", "Grade", "Time"]],
      body: data.mockTrajectory.map((m) => [
        safeFormat(m.date, "dd MMM"),
        m.subject,
        m.paperCode,
        `${m.marksAwarded}/${m.totalMarks}`,
        `${m.percent}%`,
        m.grade || "—",
        m.timeTakenSeconds
          ? `${Math.round(m.timeTakenSeconds / 60)} min`
          : "—",
      ]),
      theme: "grid",
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin },
    });
    py = (doc as any).lastAutoTable.finalY + 18;
  }

  // ── TASKS BY TYPE ────────────────────────────────────────────────────────
  const taskRows = Object.entries(data.tasksByType);
  if (taskRows.length) {
    py = ensurePage(doc, py, 80);
    py = sectionTitle(doc, "Tasks completed", py, margin);
    autoTable(doc, {
      startY: py,
      head: [["Task type", "Done", "Total", "Completion"]],
      body: taskRows.map(([type, s]) => [
        type.replace(/[-_]/g, " "),
        String(s.done),
        String(s.total),
        s.total ? `${Math.round((s.done * 100) / s.total)}%` : "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [100, 116, 139], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin },
    });
    py = (doc as any).lastAutoTable.finalY + 18;
  }

  // ── STRONG / WEAK TOPICS ─────────────────────────────────────────────────
  if (data.strongTopics.length || data.weakTopics.length) {
    py = ensurePage(doc, py, 80);
    py = sectionTitle(doc, "Strengths & areas to improve", py, margin);
    const colW = (pageW - margin * 2 - 16) / 2;

    if (data.strongTopics.length) {
      autoTable(doc, {
        startY: py,
        head: [["Strong topic", "Accuracy"]],
        body: data.strongTopics.map((t) => [t.topic, `${t.accuracy}%`]),
        theme: "plain",
        tableWidth: colW,
        margin: { left: margin },
        headStyles: { fillColor: [220, 252, 231], textColor: 21, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
      });
    }
    if (data.weakTopics.length) {
      autoTable(doc, {
        startY: py,
        head: [["Needs work", "Accuracy"]],
        body: data.weakTopics.map((t) => [t.topic, `${t.accuracy}%`]),
        theme: "plain",
        tableWidth: colW,
        margin: { left: margin + colW + 16 },
        headStyles: { fillColor: [254, 226, 226], textColor: 60, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
      });
    }
    const t1 = (doc as any).lastAutoTable.finalY;
    py = t1 + 18;
  }

  // ── AI IMPROVEMENT PLAN ──────────────────────────────────────────────────
  if (data.aiPlan) {
    doc.addPage();
    py = 70;
    py = sectionTitle(doc, "Your improvement plan", py, margin);

    if (data.aiPlan.headline_assessment) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(11);
      doc.setTextColor(60);
      const wrapped = doc.splitTextToSize(
        data.aiPlan.headline_assessment,
        pageW - margin * 2
      );
      doc.text(wrapped, margin, py);
      py += wrapped.length * 14 + 12;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(20);
    }

    // Top concerns
    if (data.aiPlan.top_concerns?.length) {
      py = ensurePage(doc, py, 60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(
        data.audience === "tutor"
          ? "Where to start with this student"
          : "Top concerns",
        margin,
        py
      );
      py += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const c of data.aiPlan.top_concerns) {
        py = ensurePage(doc, py, 60);
        const color = PRIORITY_COLORS[c.priority] || [100, 116, 139];
        doc.setFillColor(color[0], color[1], color[2]);
        doc.roundedRect(margin, py - 9, 50, 14, 4, 4, "F");
        doc.setTextColor(255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(c.priority.toUpperCase(), margin + 25, py + 1, {
          align: "center",
        });
        doc.setTextColor(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(c.topic, margin + 60, py);
        py += 14;
        doc.setFont("helvetica", "normal");
        const why = doc.splitTextToSize(`Why: ${c.why}`, pageW - margin * 2);
        doc.text(why, margin, py);
        py += why.length * 12;
        const step = doc.splitTextToSize(
          `First step: ${c.first_step}`,
          pageW - margin * 2
        );
        doc.text(step, margin, py);
        py += step.length * 12 + 6;
      }
      py += 6;
    }

    // 7-day plan
    if (data.aiPlan.seven_day_plan?.length) {
      py = ensurePage(doc, py, 60);
      py = sectionTitle(doc, "7-day action plan", py, margin);
      autoTable(doc, {
        startY: py,
        head: [["Day", "Focus", "Actions"]],
        body: data.aiPlan.seven_day_plan.map((d) => [
          `Day ${d.day}`,
          d.focus,
          d.actions.map((a) => `• ${a}`).join("\n"),
        ]),
        theme: "grid",
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9, valign: "top" },
        columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 110 } },
        margin: { left: margin, right: margin },
      });
      py = (doc as any).lastAutoTable.finalY + 18;
    }

    // Tutor-only: session plan
    if (
      data.audience === "tutor" &&
      data.aiPlan.tutor_session_plan?.length
    ) {
      py = ensurePage(doc, py, 60);
      py = sectionTitle(doc, "Recommended first 3 sessions", py, margin);
      autoTable(doc, {
        startY: py,
        head: [["Session", "Objective", "Activities"]],
        body: data.aiPlan.tutor_session_plan.map((s) => [
          `Session ${s.session}`,
          s.objective,
          s.activities.map((a) => `• ${a}`).join("\n"),
        ]),
        theme: "grid",
        headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9, valign: "top" },
        columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 130 } },
        margin: { left: margin, right: margin },
      });
      py = (doc as any).lastAutoTable.finalY + 18;
    }

    // Recommended focus areas + past papers
    if (data.aiPlan.recommended_focus_areas?.length) {
      py = ensurePage(doc, py, 60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Recommended Study Mode focus areas", margin, py);
      py += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const f of data.aiPlan.recommended_focus_areas) {
        const w = doc.splitTextToSize(`• ${f}`, pageW - margin * 2);
        py = ensurePage(doc, py, w.length * 12 + 6);
        doc.text(w, margin, py);
        py += w.length * 12 + 2;
      }
      py += 6;
    }

    if (data.aiPlan.suggested_past_paper_questions?.length) {
      py = ensurePage(doc, py, 60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Suggested past-paper questions", margin, py);
      py += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const q of data.aiPlan.suggested_past_paper_questions) {
        const w = doc.splitTextToSize(`• ${q}`, pageW - margin * 2);
        py = ensurePage(doc, py, w.length * 12 + 6);
        doc.text(w, margin, py);
        py += w.length * 12 + 2;
      }
      py += 6;
    }

    if (data.aiPlan.motivational_note) {
      py = ensurePage(doc, py, 60);
      doc.setFillColor(239, 246, 255);
      const note = doc.splitTextToSize(
        data.aiPlan.motivational_note,
        pageW - margin * 2 - 24
      );
      const h = note.length * 14 + 24;
      doc.roundedRect(margin, py, pageW - margin * 2, h, 8, 8, "F");
      doc.setFont("helvetica", "italic");
      doc.setTextColor(30, 64, 175);
      doc.text(note, margin + 12, py + 18);
      doc.setTextColor(20);
      doc.setFont("helvetica", "normal");
      py += h + 12;
    }
  }

  // Footer on every page
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `StudySync — studysync.co.za  ·  Page ${i} of ${totalPages}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 24,
      { align: "center" }
    );
  }

  return doc.output("blob");
}
