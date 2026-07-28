// studymode-release-homework — P11
// Teacher releases grades (and optionally edits scores/comments) for a
// homework. Sets matching school_homework_responses.status = 'released'.
//
// POST { school_id, homework_id, student_id?, overrides?: [{ question_id, teacher_score, teacher_comment }] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/ai-config.ts";
import { enforceSchoolContract, logContractDenial } from "../_shared/school-contract.ts";
import { authenticateTeacher } from "../_shared/school-generators.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { school_id, homework_id, student_id, overrides } = await req.json();
    if (!school_id || !homework_id) return errorResponse("school_id, homework_id required", 400);

    const auth = await authenticateTeacher(req, school_id);
    if (!auth.ok) {
      await logContractDenial(auth.svc, school_id,
        { ok: false, status: auth.status ?? 403, code: "ROLE_DENIED", reason: auth.reason ?? "Denied" },
        { userId: auth.userId, role: auth.role, feature: "studymode.homework.release" });
      return errorResponse(auth.reason ?? "Forbidden", auth.status ?? 403);
    }

    const gate = await enforceSchoolContract(auth.svc, school_id, {
      userId: auth.userId!, role: auth.role!, feature: "studymode.homework.release",
    });
    if ("response" in gate) return gate.response;

    // Apply teacher overrides first.
    if (Array.isArray(overrides) && overrides.length > 0) {
      for (const o of overrides) {
        if (!o?.question_id) continue;
        const upd: Record<string, unknown> = { status: "teacher_reviewed" };
        if (o.teacher_score != null) upd.teacher_score = Number(o.teacher_score);
        if (o.teacher_comment != null) upd.teacher_comment = String(o.teacher_comment);
        let q = auth.svc.from("school_homework_responses").update(upd)
          .eq("homework_id", homework_id).eq("school_id", school_id).eq("question_id", o.question_id);
        if (student_id) q = q.eq("student_id", student_id);
        await q;
      }
    }

    // Release rows — but never release unmarked ('submitted'/'pending')
    // responses that have no score at all: those failed AI marking and are
    // waiting for a teacher score (an override above moves them to
    // 'teacher_reviewed', which makes them releasable).
    const now = new Date().toISOString();
    let rel = auth.svc.from("school_homework_responses")
      .update({ status: "released", released_at: now })
      .eq("homework_id", homework_id).eq("school_id", school_id)
      .in("status", ["ai_marked", "teacher_reviewed", "released"]);
    if (student_id) rel = rel.eq("student_id", student_id);
    const { count, error } = await rel.select("id", { count: "exact" });
    if (error) return errorResponse(error.message, 500);

    // Count what was left behind so the UI can tell the teacher.
    let skippedQ = auth.svc.from("school_homework_responses")
      .select("id", { count: "exact", head: true })
      .eq("homework_id", homework_id).eq("school_id", school_id)
      .in("status", ["submitted", "pending"]);
    if (student_id) skippedQ = skippedQ.eq("student_id", student_id);
    const { count: skipped } = await skippedQ;

    // Audit
    await auth.svc.from("school_audit_logs").insert({
      school_id, actor_id: auth.userId, action: "homework_released",
      entity_type: "school_homework", entity_id: homework_id,
      diff: { student_id: student_id ?? null, count: count ?? 0 },
    });

    await auth.svc.rpc("increment_school_ai_usage", {
      _school_id: school_id, _bucket: "feedback_released", _tokens_in: 0, _tokens_out: 0,
    });

    return jsonResponse({ ok: true, released: count ?? 0, skipped_unmarked: skipped ?? 0 });
  } catch (e) {
    return errorResponse((e as Error).message || "Internal error", 500);
  }
});
