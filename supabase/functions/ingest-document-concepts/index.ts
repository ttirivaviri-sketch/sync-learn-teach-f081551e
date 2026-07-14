// ingest-document-concepts — extract atomic learnable concepts from an
// uploaded document (syllabus / past paper / notes) and stage them for
// review in learning_concept_ingestion_staging.
//
// POST {
//   document_id: string           (public.documents.id — must belong to caller
//                                  or caller must be staff of workspace_id)
//   workspace_id?: string | null  (staging scope; staff-checked when present)
//   subject_id?: string | null
//   subject_name: string
//   topic_name?: string | null
//   curriculum?: string           (default "GENERAL")
//   source_kind?: "syllabus" | "past_paper" | "notes" | "manual"
//   max_concepts?: number         (default 40, capped at 60)
// }
//
// Returns { run_id, staged, rejected, concepts: [{concept_name, topic_name, ...}] }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  getAIConfig,
  safeJsonParse,
} from "../_shared/ai-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ExtractedConcept {
  concept_name: string;
  topic_name?: string;
  subtopic_name?: string | null;
  objective_type?: string;
  command_words?: string[];
  prerequisites?: string[];
  confidence?: number;
}

const VALID_OBJECTIVES = new Set(["knowledge", "application", "skill", "assessment"]);
const VALID_SOURCE_KINDS = new Set(["syllabus", "past_paper", "notes", "manual"]);

/** Flatten a documents.parsed_content payload into plain text for the model. */
function contentToText(parsed: unknown, docName: string): string {
  if (!parsed) return "";
  if (typeof parsed === "string") return parsed.slice(0, 24_000);
  const pc = parsed as Record<string, unknown>;
  const parts: string[] = [`Document: ${docName}`];

  if (typeof pc.subject_name === "string") parts.push(`Subject: ${pc.subject_name}`);
  if (typeof pc.exam_board === "string") parts.push(`Exam board: ${pc.exam_board}`);

  // Syllabus topics tree.
  const topics = Array.isArray(pc.topics) ? pc.topics : [];
  for (const t of topics as Array<Record<string, unknown>>) {
    const name = typeof t.name === "string" ? t.name : "";
    if (!name) continue;
    parts.push(`\nTopic: ${name}`);
    const subs = Array.isArray(t.subtopics) ? t.subtopics : [];
    if (subs.length) parts.push(`  Subtopics: ${(subs as string[]).join("; ")}`);
    const objectives = Array.isArray(t.learningObjectives) ? t.learningObjectives : [];
    if (objectives.length) parts.push(`  Objectives: ${(objectives as string[]).join("; ")}`);
  }

  // Past-paper extracts.
  const covered = Array.isArray(pc.topics_covered) ? pc.topics_covered : [];
  if (covered.length) parts.push(`\nTopics covered: ${(covered as string[]).join("; ")}`);
  const concepts = Array.isArray(pc.key_concepts) ? pc.key_concepts : [];
  if (concepts.length) parts.push(`Key concepts: ${(concepts as string[]).join("; ")}`);

  // Generic raw text fallbacks.
  for (const key of ["raw_text", "text", "content", "summary"]) {
    if (typeof pc[key] === "string" && (pc[key] as string).length > 40) {
      parts.push(`\n${pc[key] as string}`);
      break;
    }
  }

  return parts.join("\n").slice(0, 24_000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth ─────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return errorResponse("Unauthorized", 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return errorResponse("Unauthorized", 401);

    // ── Input ────────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const documentId = String(body.document_id ?? "");
    const workspaceId = body.workspace_id ? String(body.workspace_id) : null;
    const subjectName = String(body.subject_name ?? "").trim();
    const topicHint = body.topic_name ? String(body.topic_name).trim() : null;
    const curriculum = String(body.curriculum ?? "GENERAL").trim() || "GENERAL";
    const subjectId = body.subject_id ? String(body.subject_id) : null;
    const sourceKind = VALID_SOURCE_KINDS.has(String(body.source_kind))
      ? String(body.source_kind)
      : "syllabus";
    const maxConcepts = Math.min(Math.max(Number(body.max_concepts ?? 40) || 40, 5), 60);

    if (!documentId) return errorResponse("document_id is required", 400);
    if (!subjectName) return errorResponse("subject_name is required", 400);

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── Authorization: doc owner, or staff of the target workspace ───────
    const { data: doc } = await svc
      .from("documents")
      .select("id, name, user_id, parsed_content, is_processed")
      .eq("id", documentId)
      .maybeSingle();
    if (!doc) return errorResponse("Document not found", 404);

    let authorized = doc.user_id === userId;
    if (workspaceId) {
      const { data: staffOk } = await svc.rpc("is_los_workspace_staff", {
        _workspace_id: workspaceId,
        _user_id: userId,
      });
      if (staffOk === true) authorized = true;
      else if (!authorized) return errorResponse("Not authorized for this workspace", 403);
    }
    if (!authorized) return errorResponse("Not authorized for this document", 403);

    const sourceText = contentToText(doc.parsed_content, doc.name ?? "Document");
    if (sourceText.length < 40) {
      return errorResponse(
        "Document has no parsed content yet — run parse-document first",
        422,
      );
    }

    // ── AI extraction ────────────────────────────────────────────────────
    const ai = getAIConfig("standard");
    const prompt = [
      `Extract atomic, testable learning concepts for the subject "${subjectName}"`,
      `(curriculum: ${curriculum}${topicHint ? `, focus topic: ${topicHint}` : ""})`,
      `from the document content below.`,
      ``,
      `Rules:`,
      `- Each concept must be a single teachable idea (e.g. "Balancing chemical equations", not "Chemistry").`,
      `- topic_name groups related concepts; reuse the document's own topic headings where possible.`,
      `- objective_type is one of: knowledge, application, skill, assessment.`,
      `- prerequisites are names of OTHER concepts in your list (or well-known earlier concepts) the learner needs first.`,
      `- confidence is 0..1 for how clearly the document supports the concept.`,
      `- Return at most ${maxConcepts} concepts.`,
      ``,
      `Respond with STRICT JSON: {"concepts":[{"concept_name":string,"topic_name":string,"subtopic_name":string|null,"objective_type":string,"command_words":string[],"prerequisites":string[],"confidence":number}]}`,
      ``,
      `DOCUMENT CONTENT:`,
      sourceText,
    ].join("\n");

    const aiRes = await fetch(ai.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ai.key}` },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: "You are a curriculum analyst. Output strict JSON only — no markdown fences, no commentary." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });
    if (!aiRes.ok) {
      const errTxt = await aiRes.text().catch(() => "");
      return errorResponse(`AI extraction failed (${aiRes.status}): ${errTxt.slice(0, 200)}`, 502);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "";
    let extracted: ExtractedConcept[] = [];
    try {
      const parsed = safeJsonParse<{ concepts?: ExtractedConcept[] }>(raw);
      extracted = Array.isArray(parsed.concepts) ? parsed.concepts : [];
    } catch (_e) {
      return errorResponse("AI returned unparseable JSON", 502);
    }

    // ── Validate + stage ─────────────────────────────────────────────────
    const runId = crypto.randomUUID();
    let rejected = 0;
    const rows = [];
    const seen = new Set<string>();
    for (const c of extracted.slice(0, maxConcepts)) {
      const conceptName = String(c.concept_name ?? "").trim();
      const topicName = String(c.topic_name ?? topicHint ?? "General").trim() || "General";
      if (conceptName.length < 3 || conceptName.length > 160) { rejected++; continue; }
      const dedupeKey = `${topicName.toLowerCase()}::${conceptName.toLowerCase()}`;
      if (seen.has(dedupeKey)) { rejected++; continue; }
      seen.add(dedupeKey);

      rows.push({
        workspace_id: workspaceId,
        submitted_by_user_id: userId,
        source_document_id: documentId,
        source_kind: sourceKind,
        curriculum,
        subject_id: subjectId,
        subject_name: subjectName,
        topic_name: topicName,
        concept_name: conceptName,
        subtopic_name: c.subtopic_name ? String(c.subtopic_name).slice(0, 160) : null,
        objective_type: VALID_OBJECTIVES.has(String(c.objective_type)) ? String(c.objective_type) : "knowledge",
        command_words: Array.isArray(c.command_words) ? c.command_words.map(String).slice(0, 12) : [],
        prerequisites: Array.isArray(c.prerequisites) ? c.prerequisites.map(String).slice(0, 12) : [],
        confidence: Math.max(0, Math.min(1, Number(c.confidence ?? 0.6) || 0.6)),
        status: "pending",
        metadata: { run_id: runId, model: ai.model },
      });
    }

    if (rows.length === 0) {
      return jsonResponse({ run_id: runId, staged: 0, rejected, concepts: [] });
    }

    const { error: insertError } = await svc
      .from("learning_concept_ingestion_staging")
      .insert(rows);
    if (insertError) {
      console.error("[ingest-document-concepts] insert failed", insertError);
      return errorResponse(`Failed to stage concepts: ${insertError.message}`, 500);
    }

    return jsonResponse({
      run_id: runId,
      staged: rows.length,
      rejected,
      concepts: rows.map((r) => ({
        concept_name: r.concept_name,
        topic_name: r.topic_name,
        subtopic_name: r.subtopic_name,
        objective_type: r.objective_type,
        confidence: r.confidence,
      })),
    });
  } catch (err) {
    console.error("[ingest-document-concepts] fatal", err);
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500);
  }
});
