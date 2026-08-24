/**
 * explain-diagram Edge Function
 *
 * Curriculum-depth AI chat grounded in a library diagram's stored spec.
 * The student opens a diagram in the Library and asks anything about it —
 * the AI answers using ONLY the elements/relationships defined in the
 * diagram_spec, pitched at the learner's exam level via the spec's
 * depth_notes (JC / O-Level / A-Level).
 *
 * POST body:
 * {
 *   resourceId: string,                 // library_system_resources id (kind='diagram')
 *   messages: [{ role, content }],      // chat history (user/assistant)
 *   curriculum?: string,                // e.g. "ZIMSEC", "Cambridge", "CAPS"
 *   gradeLevel?: string                 // e.g. "Form 4", "Grade 11", "A-Level"
 * }
 *
 * Streams the assistant reply (SSE, same shape as ai-tutor).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getAIConfig,
  corsHeaders,
  errorResponse,
  streamResponse,
  enforceQuota,
  requireCaller,
  quotaExceededResponse,
  callAIStream,
} from "../_shared/ai-config.ts";
import { KATEX_RULES } from "../_shared/katex-rules.ts";

interface SpecElement { label: string; role: string }
interface DiagramSpec {
  title: string;
  caption?: string;
  subject?: string;
  elements?: SpecElement[];
  relationships?: string[];
  depth_notes?: Record<string, string>;
}

/** Pick the depth note that best matches the learner's level. */
function pickDepthNote(
  notes: Record<string, string> | undefined,
  gradeLevel?: string,
): { level: string; note: string } | null {
  if (!notes) return null;
  const g = (gradeLevel || "").toLowerCase();

  const isJC =
    /form\s*[12]\b/.test(g) || /grade\s*[89]\b/.test(g) || g.includes("jc");
  const isALevel =
    g.includes("a-level") || g.includes("a level") ||
    /form\s*[56]\b/.test(g) || /grade\s*12\b/.test(g) || g.includes("as/a");

  const order = isJC
    ? ["JC", "O-Level", "A-Level"]
    : isALevel
      ? ["A-Level", "O-Level", "JC"]
      : ["O-Level", "A-Level", "JC"]; // default: O-Level band

  for (const key of order) {
    if (notes[key]) return { level: key, note: notes[key] };
  }
  const first = Object.entries(notes)[0];
  return first ? { level: first[0], note: first[1] } : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requireCaller(req, "explain-diagram");
    if (gate.response) return gate.response;

    const quota = await enforceQuota(req, "tutor", { userId: gate.caller.userId });
    if (!quota.allowed) return quotaExceededResponse("tutor", quota.used, quota.limit);
    const ai = getAIConfig("standard");

    const { resourceId, messages, curriculum, gradeLevel } = await req.json();

    if (!resourceId || typeof resourceId !== "string") {
      return new Response(JSON.stringify({ error: "resourceId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load the diagram spec (service role — spec is system content) ────
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: row, error: rowErr } = await supabase
      .from("library_system_resources")
      .select("id, title, subject, topic, description, diagram_spec")
      .eq("id", resourceId)
      .eq("kind", "diagram")
      .single();

    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: "Diagram not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const spec = (row.diagram_spec ?? {}) as DiagramSpec;
    const elements = (spec.elements ?? [])
      .map((e) => `- **${e.label}** — ${e.role}`)
      .join("\n");
    const relationships = (spec.relationships ?? [])
      .map((r) => `- ${r}`)
      .join("\n");
    const depth = pickDepthNote(spec.depth_notes, gradeLevel);

    // ── System prompt grounded in the spec ───────────────────────────────
    const systemPrompt = `You are StudySync's diagram tutor — a friendly, exam-focused AI teacher helping a student understand a specific study diagram they are looking at right now.

THE DIAGRAM THE STUDENT IS VIEWING:
Title: ${spec.title || row.title}
Subject: ${row.subject || spec.subject || "General"}${row.topic ? `\nTopic: ${row.topic}` : ""}
${spec.caption ? `Caption: ${spec.caption}` : ""}

LABELLED ELEMENTS IN THE DIAGRAM (this is exactly what is shown):
${elements || "(no labelled elements)"}

RELATIONSHIPS / ARROWS SHOWN:
${relationships || "(none)"}

STUDENT PROFILE:
${curriculum ? `Curriculum: ${curriculum}` : "Curriculum: not specified"}
${gradeLevel ? `Level: ${gradeLevel}` : "Level: not specified (assume O-Level / IGCSE band)"}

${depth ? `DEPTH GUIDANCE FOR THIS LEVEL (${depth.level}):\n${depth.note}` : ""}

${KATEX_RULES}

RULES (critical):
1. **Ground every answer in the diagram.** When the student asks "what is this?" or points at a part, explain the labelled elements and relationships above — never invent parts that are not in the diagram.
2. **Match the depth guidance.** Pitch explanations at the student's level using the depth guidance. A JC student gets simple observation-level answers; an A-Level student gets full mechanisms, equations and exam-grade terminology.
3. **You MAY extend beyond the diagram when asked.** If the student asks a follow-up that goes past what is drawn (e.g. "why does this happen?" or "how is this examined?"), answer with accurate syllabus knowledge for their curriculum and level — but make clear which parts are shown in the diagram and which are extra context.
4. **Teach like an examiner.** Use the exact terminology mark schemes reward. Where useful, end with a short "🎯 How this is examined" note: typical command words, mark allocations, and one common mistake.
5. **Be concise and structured.** Use markdown (bold labels, short lists). No HTML, no code.
6. If the student's question is completely unrelated to this diagram or its subject, gently redirect them back to studying the diagram.`;

    const response = await callAIStream(ai, systemPrompt, "", {
      messages,
      maxTokens: 700,
      usage: { userId: quota.userId, bucket: "tutor" },
    });

    return streamResponse(response.body);
  } catch (e) {
    console.error("explain-diagram error:", e);
    return errorResponse(e);
  }
});
