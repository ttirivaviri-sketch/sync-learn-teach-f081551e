// studymode-generate-school-quiz — P10
// Teacher creates a class quiz from a school_ai_documents row.
// Writes into existing public.quizzes + public.quiz_questions.
//
// POST { school_id, document_id, class_id, subject_id?, title, topic,
//        count?, difficulty?, types? }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/ai-config.ts";
import { enforceSchoolContract, logContractDenial } from "../_shared/school-contract.ts";
import { authenticateTeacher, loadDocumentChunks, callAIJson } from "../_shared/school-generators.ts";

interface QuestionOut {
  type: "multiple_choice" | "true_false" | "short_answer";
  prompt: string;
  options?: string[];
  answer: string | number | boolean;
  marks?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { school_id, document_id, class_id, subject_id, title, topic, count, difficulty, types } = body;
    if (!school_id || !document_id || !class_id || !title || !topic) {
      return errorResponse("school_id, document_id, class_id, title, topic required", 400);
    }

    const auth = await authenticateTeacher(req, school_id);
    if (!auth.ok) {
      await logContractDenial(auth.svc, school_id,
        { ok: false, status: auth.status ?? 403, code: "ROLE_DENIED", reason: auth.reason ?? "Denied" },
        { userId: auth.userId, role: auth.role, feature: "studymode.quiz" });
      return errorResponse(auth.reason ?? "Forbidden", auth.status ?? 403);
    }

    const gate = await enforceSchoolContract(auth.svc, school_id, {
      userId: auth.userId!, role: auth.role!, feature: "studymode.quiz",
    });
    if ("response" in gate) return gate.response;

    const { doc, text } = await loadDocumentChunks(auth.svc, school_id, document_id);
    if (!doc || !text) return errorResponse("Document not ready or empty", 400);

    const n = Math.min(Math.max(Number(count) || 6, 3), 20);
    const allowedTypes = Array.isArray(types) && types.length > 0
      ? types.join(", ") : "multiple_choice, true_false, short_answer";
    const diff = difficulty ?? "medium";
    const system = "You write fair classroom quiz questions strictly grounded in the provided source. Use LaTeX for math. Reply ONLY with JSON.";
    const prompt = `Topic: ${topic}\nDifficulty: ${diff}\nAllowed types: ${allowedTypes}\n\nSource content:\n${text}\n\nWrite ${n} questions. JSON shape: { "questions": [{ "type": "multiple_choice"|"true_false"|"short_answer", "prompt": string, "options": string[]?, "answer": (string|boolean|number), "marks": number }] }. For multiple_choice, give 4 options and an answer that exactly matches one option.`;

    const result = await callAIJson<{ questions: QuestionOut[] }>(prompt, system);
    const questions = (result?.questions ?? []).slice(0, n);
    if (questions.length === 0) return errorResponse("AI returned no questions", 502);

    // Insert quiz
    const { data: quiz, error: qErr } = await auth.svc.from("quizzes").insert({
      school_id, class_id, subject_id: subject_id ?? null, teacher_id: auth.userId,
      title, instructions: `Auto-generated from ${doc.title ?? "uploaded resource"}`,
      ai_generated: true, source_resource_id: document_id, status: "published",
    }).select().single();
    if (qErr || !quiz) return errorResponse(`Quiz insert failed: ${qErr?.message}`, 500);

    const rows = questions.map((q, i) => ({
      school_id, quiz_id: quiz.id, ord: i, type: q.type,
      prompt: q.prompt, options: q.options ?? null,
      answer: { value: q.answer }, marks: q.marks ?? 1,
    }));
    const { error: qqErr } = await auth.svc.from("quiz_questions").insert(rows);
    if (qqErr) return errorResponse(`Question insert failed: ${qqErr.message}`, 500);

    await auth.svc.rpc("increment_school_ai_usage", {
      _school_id: school_id, _bucket: "quiz", _tokens_in: Math.ceil(text.length / 4), _tokens_out: questions.length * 80,
    });

    return jsonResponse({ ok: true, quiz_id: quiz.id, count: questions.length });
  } catch (e) {
    return errorResponse((e as Error).message || "Internal error", 500);
  }
});
