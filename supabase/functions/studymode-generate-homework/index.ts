// studymode-generate-homework — P11
// Teacher generates a homework set from a school_ai_documents row.
// Creates ONE school_homework + N school_homework_questions (shared across class).
// Per-student answers/marks happen later in school_homework_responses.
//
// POST { school_id, document_id, class_id, subject_id?, title, topic?,
//        difficulty?, count?, due_at? }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, STUDYMODE_SYSTEM_IDENTITY } from "../_shared/ai-config.ts";
import { KATEX_RULES } from "../_shared/katex-rules.ts";
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
  visual?: Record<string, unknown> | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { school_id, document_id, class_id, subject_id, title, topic, difficulty, count, due_at, instructions, as_draft, is_remediation, remediation_topic, kernel_alert_id } = body;
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

    const { doc, text } = await loadDocumentChunks(auth.svc, school_id, document_id, 16000, topic);
    if (!doc || !text) return errorResponse("Document not ready or empty", 400);

    // Teacher AI defaults
    const { data: settings } = await auth.svc.from("teacher_ai_settings")
      .select("*").eq("teacher_id", auth.userId!).maybeSingle();
    const diff = difficulty ?? settings?.homework_difficulty_default ?? "medium";
    const autoFeedback = settings?.auto_release_feedback ?? true;
    const autoGrades = settings?.auto_release_grades ?? false;

    const n = Math.min(Math.max(Number(count) || 5, 3), 15);
    const system = `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Design fair school homework strictly grounded in the provided source material. Provide an examiner-quality rubric for each question. Reply ONLY with JSON — no markdown fences, no HTML/JSX/code.

${KATEX_RULES}

QUESTION TYPE RULES:
- multiple_choice: exactly 4 options as a string array WITHOUT "A)" prefixes; expected_answer is the full text of the correct option.
- true_false: options MUST be ["True", "False"]; expected_answer is "True" or "False".
- short_answer / long_answer / exam_style: no options field; expected_answer is a complete model answer.

VISUALS — include when the topic conventionally uses them in past papers (Maths function graphs & geometry, Physics circuits/forces/ray diagrams, Biology labelled diagrams, Chemistry apparatus, Geography climate graphs, Economics curves). If a question needs one, add a "visual" field with exactly ONE type:
1. "function-graph": { "type": "function-graph", "functions": [{"expression": "x^2 - 4*x + 3", "color": "#3b82f6"}], "xRange": [-2, 6], "gridlines": true } (mathjs syntax: *, /, ^, sin(x), sqrt(x))
2. "data-chart": { "type": "data-chart", "chartKind": "bar"|"line"|"scatter", "data": [{"x": "Jan", "y": 12}], "xLabel": "...", "yLabel": "..." }
3. "svg-diagram": { "type": "svg-diagram", "svg": "<svg viewBox='0 0 400 300' xmlns='http://www.w3.org/2000/svg'>...</svg>" } — basic shapes + <text> labels only, stroke='currentColor', no scripts/handlers/images.
4. "ai-image": { "type": "ai-image", "imagePrompt": "past-paper style labeled line-art description" } — for complex biological/geographical illustrations.
Always set "required": true when the visual is needed to answer, add a short "caption". OMIT the visual field entirely when not needed.

RUBRIC RULES:
- examiner_notes: what each mark is awarded for, mark-by-mark (e.g. "1 mark: correct substitution; 1 mark: simplification; 1 mark: final answer with units").
- common_mistakes: the specific wrong answers/methods students actually produce.
- Anchor every question to the source content; NEVER invent facts not present in it.
- Difficulty should progress from easier to harder across the set.`;
    const prompt = `Topic: ${topic ?? doc.title}\nDifficulty: ${diff}\n\nSource content:\n${text}\n\nWrite ${n} homework questions. For each include the model answer, examiner notes (what marks are awarded for), common mistakes, and the concepts tested. JSON shape: { "questions": [{ "prompt": string (LaTeX where mathematical), "question_type": "multiple_choice"|"true_false"|"short_answer"|"long_answer"|"exam_style", "options": string[]?, "expected_answer": string, "examiner_notes": string, "common_mistakes": string, "concepts": string[], "marks": number, "visual": object? }] }`;

    const result = await callAIJson<{ questions: HwQuestionOut[] }>(prompt, system, {
      userId: auth.userId ?? null,
      bucket: "homework_generated",
      schoolId: school_id,
    });
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
      is_remediation: is_remediation === true,
      remediation_topic: remediation_topic ?? (is_remediation ? topic ?? null : null),
    }).select().single();
    if (hwErr || !hw) return errorResponse(`Homework insert failed: ${hwErr?.message}`, 500);

    if (kernel_alert_id) {
      await auth.svc.from("kernel_alerts")
        .update({ status: "assigned", assigned_homework_id: hw.id, acknowledged_by: auth.userId, acknowledged_at: new Date().toISOString() })
        .eq("id", kernel_alert_id);
    }

    const qRows = questions.map((q, i) => ({
      homework_id: hw.id, school_id, ord: i,
      prompt: q.prompt, question_type: q.question_type,
      options: q.question_type === "true_false" ? (q.options ?? ["True", "False"]) : (q.options ?? null),
      expected_answer: q.expected_answer,
      examiner_notes: q.examiner_notes, common_mistakes: q.common_mistakes,
      concepts: q.concepts ?? [], marks: q.marks ?? 1,
      visual: q.visual && typeof q.visual === "object" ? q.visual : null,
    }));
    const { error: qErr } = await auth.svc.from("school_homework_questions").insert(qRows);
    if (qErr) return errorResponse(`Questions insert failed: ${qErr.message}`, 500);

    // Request count for quota; real tokens are recorded by callAIJson usage attribution.
    await auth.svc.rpc("increment_school_ai_usage", {
      _school_id: school_id, _bucket: "homework_generated",
      _tokens_in: 0, _tokens_out: 0,
    });

    return jsonResponse({ ok: true, homework_id: hw.id, count: questions.length, total_marks: totalMarks });
  } catch (e) {
    return errorResponse((e as Error).message || "Internal error", 500);
  }
});
