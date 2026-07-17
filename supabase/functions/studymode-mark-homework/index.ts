// studymode-mark-homework — P11
// Student submits answers for one homework. We AI-mark every question
// against the stored rubric and write per-question rows in
// school_homework_responses.
//
// Behavior:
//   - status='ai_marked' (AI feedback always written)
//   - if homework.auto_release_grades → status='released' and grade visible
//   - if homework.auto_release_feedback=false → ai_feedback held until teacher releases
//     (we still store it, but only return scores=null and feedback=null to client)
//
// POST { school_id, homework_id, answers: { question_id, answer }[] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/ai-config.ts";
import { enforceSchoolContract } from "../_shared/school-contract.ts";
import { callAIJson } from "../_shared/school-generators.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface AIMark {
  correct: boolean;
  awarded: number;
  examiner_expects: string;
  what_you_missed: string;
  concept_fix: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { school_id, homework_id, answers } = await req.json();
    if (!school_id || !homework_id || !Array.isArray(answers)) {
      return errorResponse("school_id, homework_id, answers required", 400);
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return errorResponse("Unauthorized", 401);

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify the student is enrolled and homework is published.
    const { data: hw } = await svc.from("school_homework")
      .select("*").eq("id", homework_id).eq("school_id", school_id).maybeSingle();
    if (!hw || hw.status !== "published") return errorResponse("Homework not available", 404);

    const { data: enrolment } = await svc.from("enrollments")
      .select("id").eq("class_id", hw.class_id).eq("student_id", userId)
      .eq("status", "active").maybeSingle();
    if (!enrolment) return errorResponse("Not enrolled in this class", 403);

    const gate = await enforceSchoolContract(svc, school_id, {
      userId, role: "school_learner", feature: "studymode.homework.mark",
    });
    if ("response" in gate) return gate.response;

    // Load rubric
    const { data: questions } = await svc.from("school_homework_questions")
      .select("*").eq("homework_id", homework_id).order("ord");
    if (!questions || questions.length === 0) return errorResponse("No questions", 400);

    const byId = new Map(questions.map((q: any) => [q.id, q]));
    const now = new Date().toISOString();
    const heldFeedback = !hw.auto_release_feedback;
    const released = !!hw.auto_release_grades;

    const responsesOut: Array<{ question_id: string; ai_score: number | null; ai_feedback: AIMark | null; status: string }> = [];

    for (const a of answers) {
      const q = byId.get(a.question_id);
      if (!q) continue;
      const studentAnswer = String(a.answer ?? "").trim();

      // AI mark
      const system = "You are an exam marker. Mark fairly using the rubric. Output JSON.";
      const prompt = `Question: ${q.prompt}\nExpected answer: ${q.expected_answer}\nExaminer notes: ${q.examiner_notes}\nCommon mistakes: ${q.common_mistakes}\nMarks available: ${q.marks}\n\nStudent answer: ${studentAnswer || "(blank)"}\n\nReturn JSON: { "correct": bool, "awarded": number, "examiner_expects": string, "what_you_missed": string, "concept_fix": string }`;

      let mark: AIMark | null = null;
      try {
        mark = await callAIJson<AIMark>(prompt, system, {
          userId,
          bucket: "homework_marked",
          schoolId: school_id,
        });
      } catch { /* leave null */ }
      const awarded = mark ? Math.max(0, Math.min(Number(mark.awarded) || 0, Number(q.marks))) : 0;

      const status = released ? "released" : "ai_marked";
      await svc.from("school_homework_responses").upsert({
        homework_id, question_id: q.id, school_id, student_id: userId,
        student_answer: studentAnswer, ai_score: awarded, ai_feedback: mark,
        status, submitted_at: now, marked_at: now,
        released_at: released ? now : null,
      }, { onConflict: "question_id,student_id" });

      // Decide what to return to the student NOW.
      responsesOut.push({
        question_id: q.id,
        ai_score: released ? awarded : null,
        ai_feedback: !heldFeedback ? mark : null,
        status,
      });
    }

    // Request count for quota; real tokens are recorded by callAIJson usage attribution.
    await svc.rpc("increment_school_ai_usage", {
      _school_id: school_id, _bucket: "homework_marked",
      _tokens_in: 0, _tokens_out: 0,
    });

    return jsonResponse({
      ok: true, homework_id, responses: responsesOut,
      grades_released: released, feedback_visible: !heldFeedback,
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Internal error", 500);
  }
});
