// studymode-generate-homework — P11
// Teacher generates a homework set from a school_ai_documents row.
// Creates ONE school_homework + N school_homework_questions (shared across class).
// Per-student answers/marks happen later in school_homework_responses.
//
// POST { school_id, document_id, class_id, subject_id?, title, topic?,
//        difficulty?, count?, due_at? }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/ai-config.ts";
import { enforceSchoolContract, logContractDenial } from "../_shared/school-contract.ts";
import { authenticateTeacher, loadDocumentChunks, callAIJson } from "../_shared/school-generators.ts";

interface HwQuestionOut {
  prompt: string;
  question_type: "multiple_choice" | "true_false" | "short_answer" | "long_answer" | "exam_style";
  options?: string[];
  expected_answer: string;
  examiner_notes: string;
  common_mistakes: string;
  concepts: string[];
  marks: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { school_id, document_id, class_id, subject_id, title, topic, difficulty, count, due_at, instructions, as_draft } = body;
    if (!school_id || !document_id || !class_id || !title) {
      return errorResponse("school_id, document_id, class_id, title required", 400);
    }
    const startStatus = as_draft === true ? "draft" : "published";

    const auth = await authenticateTeacher(req, school_id);
    if (!auth.ok) {
      await logContractDenial(auth.svc, school_id,
        { ok: false, status: auth.status ?? 403, code: "ROLE_DENIED", reason: auth.reason ?? "Denied" },
        { userId: auth.userId, role: auth.role, feature: "studymode.homework.generate" });
      return errorResponse(auth.reason ?? "Forbidden", auth.status ?? 403);
    }

    const gate = await enforceSchoolContract(auth.svc, school_id, {
      userId: auth.userId!, role: auth.role!, feature: "studymode.homework.generate",
    });
    if ("response" in gate) return gate.response;

    const { doc, text } = await loadDocumentChunks(auth.svc, school_id, document_id);
    if (!doc || !text) return errorResponse("Document not ready or empty", 400);

    // Teacher AI defaults
    const { data: settings } = await auth.svc.from("teacher_ai_settings")
      .select("*").eq("teacher_id", auth.userId!).maybeSingle();
    const diff = difficulty ?? settings?.homework_difficulty_default ?? "medium";
    const autoFeedback = settings?.auto_release_feedback ?? true;
    const autoGrades = settings?.auto_release_grades ?? false;

    const n = Math.min(Math.max(Number(count) || 5, 3), 15);
    const system = "You design fair school homework strictly grounded in the source material. Provide an examiner-quality rubric for each question. Reply ONLY with JSON.";
    const prompt = `Topic: ${topic ?? doc.title}\nDifficulty: ${diff}\n\nSource content:\n${text}\n\nWrite ${n} homework questions. For each include the model answer, examiner notes (what marks are awarded for), common mistakes, and the concepts tested. JSON shape: { "questions": [{ "prompt": string, "question_type": "multiple_choice"|"true_false"|"short_answer"|"long_answer"|"exam_style", "options": string[]?, "expected_answer": string, "examiner_notes": string, "common_mistakes": string, "concepts": string[], "marks": number }] }`;

    const result = await callAIJson<{ questions: HwQuestionOut[] }>(prompt, system);
    const questions = (result?.questions ?? []).slice(0, n);
    if (questions.length === 0) return errorResponse("AI returned no questions", 502);

    const totalMarks = questions.reduce((s, q) => s + (q.marks ?? 1), 0);

    const { data: hw, error: hwErr } = await auth.svc.from("school_homework").insert({
      school_id, class_id, subject_id: subject_id ?? null, teacher_id: auth.userId,
      source_document_id: document_id, title, topic: topic ?? doc.title,
      difficulty: diff, instructions: instructions ?? null,
      due_at: due_at ?? null, total_marks: totalMarks,
      auto_release_grades: autoGrades, auto_release_feedback: autoFeedback,
      status: startStatus,
    }).select().single();
    if (hwErr || !hw) return errorResponse(`Homework insert failed: ${hwErr?.message}`, 500);

    const qRows = questions.map((q, i) => ({
      homework_id: hw.id, school_id, ord: i,
      prompt: q.prompt, question_type: q.question_type,
      options: q.options ?? null, expected_answer: q.expected_answer,
      examiner_notes: q.examiner_notes, common_mistakes: q.common_mistakes,
      concepts: q.concepts ?? [], marks: q.marks ?? 1,
    }));
    const { error: qErr } = await auth.svc.from("school_homework_questions").insert(qRows);
    if (qErr) return errorResponse(`Questions insert failed: ${qErr.message}`, 500);

    await auth.svc.rpc("increment_school_ai_usage", {
      _school_id: school_id, _bucket: "homework_generated",
      _tokens_in: Math.ceil(text.length / 4), _tokens_out: questions.length * 200,
    });

    return jsonResponse({ ok: true, homework_id: hw.id, count: questions.length, total_marks: totalMarks });
  } catch (e) {
    return errorResponse((e as Error).message || "Internal error", 500);
  }
});
