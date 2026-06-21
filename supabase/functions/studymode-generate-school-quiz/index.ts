// studymode-generate-school-quiz — P10 (v2 with preview + per-type counts)
// Teacher creates a class quiz from a school_ai_documents row.
//
// Modes:
//   preview: true  -> generate and return questions ONLY (no DB writes besides usage log)
//   preview: false -> insert into public.quizzes + public.quiz_questions and return quiz_id
//                     (also supports a `questions` array to save user-edited questions
//                      without re-running AI)
//
// POST {
//   school_id, document_id, class_id, subject_id?,
//   title, topic,
//   count?, difficulty?, types?,                     // legacy mixed mode
//   type_counts?: { mcq?: n, tf?: n, short?: n },    // exact counts per type
//   preview?: boolean,                                // default false (back-compat)
//   status?: "draft" | "published",                  // when saving, default "published"
//   questions?: SavedQuestion[]                       // when saving user-edited questions
// }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/ai-config.ts";
import { enforceSchoolContract, logContractDenial } from "../_shared/school-contract.ts";
import { authenticateTeacher, loadDocumentChunks, callAIJson } from "../_shared/school-generators.ts";

type DbType = "mcq" | "tf" | "short";

interface AiQuestion {
  type: "multiple_choice" | "true_false" | "short_answer" | DbType;
  prompt: string;
  options?: string[];
  answer: string | number | boolean;
  marks?: number;
  difficulty?: string;
}

interface SavedQuestion {
  type: DbType;
  prompt: string;
  options?: string[] | null;
  answer: unknown;
  marks?: number;
}

const TYPE_TO_DB: Record<string, DbType> = {
  multiple_choice: "mcq",
  mcq: "mcq",
  true_false: "tf",
  tf: "tf",
  short_answer: "short",
  short: "short",
};

const DB_TO_LABEL: Record<DbType, string> = {
  mcq: "multiple_choice",
  tf: "true_false",
  short: "short_answer",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const {
      school_id, document_id, class_id, subject_id,
      title, topic,
      count, difficulty, types, type_counts,
      preview, status, questions: savedQuestions,
      avoid_prompts,
    } = body;

    if (!school_id || !class_id) {
      return errorResponse("school_id and class_id required", 400);
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

    // ── SAVE path: user has approved a (possibly edited) preview ─────────────
    if (Array.isArray(savedQuestions) && savedQuestions.length > 0) {
      if (!title || !document_id) return errorResponse("title and document_id required to save", 400);
      const finalStatus = status === "draft" ? "draft" : "published";

      const { data: quiz, error: qErr } = await auth.svc.from("quizzes").insert({
        school_id, class_id, subject_id: subject_id ?? null, teacher_id: auth.userId,
        title, instructions: `Auto-generated quiz`,
        ai_generated: true, source_resource_id: document_id, status: finalStatus,
      }).select().single();
      if (qErr || !quiz) return errorResponse(`Quiz insert failed: ${qErr?.message}`, 500);

      const rows = savedQuestions.map((q, i) => {
        const dbType = TYPE_TO_DB[q.type] ?? "short";
        return {
          school_id, quiz_id: quiz.id, ord: i,
          type: dbType,
          prompt: q.prompt,
          options: q.options ?? null,
          answer: { value: q.answer },
          marks: q.marks ?? 1,
        };
      });
      const { error: qqErr } = await auth.svc.from("quiz_questions").insert(rows);
      if (qqErr) {
        await auth.svc.from("quizzes").delete().eq("id", quiz.id);
        return errorResponse(`Question insert failed: ${qqErr.message}`, 500);
      }
      return jsonResponse({ ok: true, quiz_id: quiz.id, count: rows.length, status: finalStatus });
    }

    // ── GENERATE path (preview or legacy publish) ────────────────────────────
    if (!document_id || !topic) return errorResponse("document_id and topic required for generation", 400);

    const { doc, text } = await loadDocumentChunks(auth.svc, school_id, document_id);
    if (!doc || !text) return errorResponse("Document not ready or empty", 400);

    // Build per-type plan
    let plan: Array<{ db: DbType; label: string; n: number }> = [];
    if (type_counts && typeof type_counts === "object") {
      const tc = type_counts as Record<string, number>;
      for (const k of ["mcq", "tf", "short"] as DbType[]) {
        const n = Math.max(0, Math.min(20, Number(tc[k]) || 0));
        if (n > 0) plan.push({ db: k, label: DB_TO_LABEL[k], n });
      }
    }
    if (plan.length === 0) {
      // legacy mixed mode
      const n = Math.min(Math.max(Number(count) || 6, 3), 20);
      const tlist: DbType[] = Array.isArray(types) && types.length > 0
        ? (types.map((t: string) => TYPE_TO_DB[t]).filter(Boolean) as DbType[])
        : ["mcq", "tf", "short"];
      // distribute roughly evenly
      const each = Math.floor(n / tlist.length);
      let remainder = n - each * tlist.length;
      plan = tlist.map((t) => {
        const extra = remainder > 0 ? 1 : 0; remainder -= extra;
        return { db: t, label: DB_TO_LABEL[t], n: each + extra };
      }).filter((p) => p.n > 0);
    }

    const totalN = plan.reduce((s, p) => s + p.n, 0);
    if (totalN === 0) return errorResponse("Choose at least one question type and count", 400);
    if (totalN > 30) return errorResponse("Maximum 30 questions per quiz", 400);

    const diff = difficulty ?? "medium";
    const planText = plan.map((p) => `${p.n} ${p.label}`).join(", ");
    const system = "You write fair classroom quiz questions strictly grounded in the provided source. Use LaTeX for math. Reply ONLY with JSON.";
    const prompt = `Topic: ${topic}\nDifficulty: ${diff}\n\nProduce EXACTLY this mix: ${planText}.\n\nSource content:\n${text}\n\nJSON shape: { "questions": [{ "type": "multiple_choice"|"true_false"|"short_answer", "prompt": string, "options": string[]?, "answer": (string|boolean|number), "marks": number, "difficulty": "easy"|"medium"|"hard" }] }.\n\nRules:\n- For multiple_choice: provide EXACTLY 4 options and an answer that exactly matches one option string.\n- For true_false: omit options; answer must be the boolean true or false.\n- For short_answer: omit options; answer is a concise reference answer (1–2 sentences).\n- Return the questions grouped in this order: ${plan.map((p) => `${p.n}×${p.label}`).join(", ")}.\n- Do NOT exceed the requested totals.`;

    const result = await callAIJson<{ questions: AiQuestion[] }>(prompt, system);
    let aiQs = (result?.questions ?? []) as AiQuestion[];
    if (aiQs.length === 0) return errorResponse("AI returned no questions", 502);

    // Enforce counts per type by trimming/regrouping
    const grouped: Record<DbType, AiQuestion[]> = { mcq: [], tf: [], short: [] };
    for (const q of aiQs) {
      const db = TYPE_TO_DB[q.type] ?? "short";
      grouped[db].push(q);
    }
    const trimmed: AiQuestion[] = [];
    for (const p of plan) {
      trimmed.push(...grouped[p.db].slice(0, p.n));
    }
    if (trimmed.length === 0) return errorResponse("AI returned no usable questions", 502);

    // Normalize for client (use db type strings for round-trip)
    const normalized = trimmed.map((q) => {
      const db = TYPE_TO_DB[q.type] ?? "short";
      let answer: unknown = q.answer;
      if (db === "tf") {
        if (typeof answer === "string") answer = answer.toLowerCase().trim() === "true";
        answer = Boolean(answer);
      }
      const options = db === "mcq" ? (q.options ?? []).slice(0, 4) : null;
      // For MCQ, if answer doesn't match an option, default to first option
      if (db === "mcq" && options && options.length > 0 && !options.includes(String(answer))) {
        answer = options[0];
      }
      return {
        type: db,
        prompt: q.prompt,
        options,
        answer,
        marks: Number(q.marks) || 1,
        difficulty: q.difficulty ?? diff,
      };
    });

    await auth.svc.rpc("increment_school_ai_usage", {
      _school_id: school_id, _bucket: "quiz",
      _tokens_in: Math.ceil(text.length / 4),
      _tokens_out: normalized.length * 80,
    });

    // Preview-only: return without writing
    if (preview === true) {
      return jsonResponse({ ok: true, preview: true, questions: normalized, count: normalized.length });
    }

    // Legacy publish path (no preview): insert now
    if (!title) return errorResponse("title required to publish", 400);
    const finalStatus = status === "draft" ? "draft" : "published";
    const { data: quiz, error: qErr } = await auth.svc.from("quizzes").insert({
      school_id, class_id, subject_id: subject_id ?? null, teacher_id: auth.userId,
      title, instructions: `Auto-generated from ${doc.title ?? "uploaded resource"}`,
      ai_generated: true, source_resource_id: document_id, status: finalStatus,
    }).select().single();
    if (qErr || !quiz) return errorResponse(`Quiz insert failed: ${qErr?.message}`, 500);

    const rows = normalized.map((q, i) => ({
      school_id, quiz_id: quiz.id, ord: i, type: q.type,
      prompt: q.prompt, options: q.options ?? null,
      answer: { value: q.answer }, marks: q.marks,
    }));
    const { error: qqErr } = await auth.svc.from("quiz_questions").insert(rows);
    if (qqErr) {
      await auth.svc.from("quizzes").delete().eq("id", quiz.id);
      return errorResponse(`Question insert failed: ${qqErr.message}`, 500);
    }

    return jsonResponse({ ok: true, quiz_id: quiz.id, count: rows.length, status: finalStatus });
  } catch (e) {
    return errorResponse((e as Error).message || "Internal error", 500);
  }
});
