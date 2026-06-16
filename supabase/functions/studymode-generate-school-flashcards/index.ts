// studymode-generate-school-flashcards — P10
// Teacher generates flashcards from a school_ai_documents row.
// Cards are shared across the class (scope='class') so all enrolled
// students see them in StudyMode.
//
// POST { school_id, document_id, class_id?, subject?, topic, count? }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/ai-config.ts";
import { enforceSchoolContract, logContractDenial } from "../_shared/school-contract.ts";
import { authenticateTeacher, loadDocumentChunks, callAIJson } from "../_shared/school-generators.ts";

interface FlashcardOut { front: string; back: string; hint?: string; difficulty?: string; tags?: string[]; }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { school_id, document_id, class_id, subject, topic, count } = body;
    if (!school_id || !document_id || !topic) {
      return errorResponse("school_id, document_id, topic required", 400);
    }

    const auth = await authenticateTeacher(req, school_id);
    if (!auth.ok) {
      await logContractDenial(auth.svc, school_id,
        { ok: false, status: auth.status ?? 403, code: "ROLE_DENIED", reason: auth.reason ?? "Denied" },
        { userId: auth.userId, role: auth.role, feature: "studymode.flashcards" });
      return errorResponse(auth.reason ?? "Forbidden", auth.status ?? 403);
    }

    const gate = await enforceSchoolContract(auth.svc, school_id, {
      userId: auth.userId!, role: auth.role!, feature: "studymode.flashcards",
    });
    if ("response" in gate) return gate.response;

    const { doc, text } = await loadDocumentChunks(auth.svc, school_id, document_id);
    if (!doc || !text) return errorResponse("Document not ready or empty", 400);

    const n = Math.min(Math.max(Number(count) || 8, 4), 20);
    const system = "You generate accurate flashcards from teacher content. Math/science MUST use LaTeX. Reply ONLY with JSON.";
    const prompt = `Topic: ${topic}\nSubject: ${subject ?? "(unspecified)"}\n\nSource content:\n${text}\n\nGenerate ${n} flashcards covering definitions, formulas, and exam-style prompts. JSON shape: { "flashcards": [{ "front": string, "back": string, "hint": string, "difficulty": "easy"|"medium"|"hard", "tags": string[] }] }`;

    const result = await callAIJson<{ flashcards: FlashcardOut[] }>(prompt, system);
    const cards = (result?.flashcards ?? []).slice(0, n);
    if (cards.length === 0) return errorResponse("AI returned no flashcards", 502);

    const sharedId = crypto.randomUUID();
    const rows = cards.map((c) => ({
      user_id: auth.userId!,
      school_id,
      class_id: class_id ?? null,
      source_document_id: document_id,
      scope: class_id ? "class" : "school",
      shared_template_id: sharedId,
      subject: subject ?? null,
      topic,
      front: c.front,
      back: c.back,
      hint: c.hint ?? null,
      difficulty: c.difficulty ?? "medium",
      tags: c.tags ?? [],
      generation_meta: { source: "studymode-generate-school-flashcards", document_id, teacher_id: auth.userId },
    }));

    const { error } = await auth.svc.from("flashcards").insert(rows);
    if (error) return errorResponse(`Insert failed: ${error.message}`, 500);

    await auth.svc.rpc("increment_school_ai_usage", {
      _school_id: school_id, _bucket: "flashcards", _tokens_in: Math.ceil(text.length / 4), _tokens_out: cards.length * 50,
    });

    return jsonResponse({ ok: true, shared_template_id: sharedId, count: cards.length });
  } catch (e) {
    return errorResponse((e as Error).message || "Internal error", 500);
  }
});
