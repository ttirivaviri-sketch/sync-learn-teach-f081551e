// _shared/school-generators.ts
// Common helpers for studymode-generate-school-* edge functions:
//   - assertTeacher: verify caller is school_admin or school_teacher in the school
//   - loadDocumentChunks: pull all chunks for a school_ai_documents row
//   - callAIJson: call Lovable AI Gateway and parse structured JSON
//
// Tenant isolation: every helper requires school_id and verifies it against
// the caller's membership. school_id from the request body is treated as
// untrusted input.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { safeJsonParse, reportTokenUsage, type UsageAttribution } from "./ai-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY")!;

export interface AuthResult {
  ok: boolean;
  userId?: string;
  role?: string;
  svc: SupabaseClient;
  status?: number;
  reason?: string;
}

export async function authenticateTeacher(req: Request, schoolId: string): Promise<AuthResult> {
  const svc = createClient(SUPABASE_URL, SERVICE_KEY);
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return { ok: false, svc, status: 401, reason: "Unauthorized" };

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { ok: false, svc, status: 401, reason: "Unauthorized" };

  const { data: memberships } = await svc
    .from("school_memberships")
    .select("role")
    .eq("school_id", schoolId)
    .eq("user_id", userId)
    .eq("status", "active");

  const roles = (memberships ?? []).map((m: { role: string }) => m.role);
  const role = roles.includes("school_admin") ? "school_admin"
    : roles.includes("school_teacher") ? "school_teacher" : null;
  if (!role) return { ok: false, svc, userId, status: 403, reason: "Not a school teacher/admin" };

  return { ok: true, svc, userId, role };
}

export async function loadDocumentChunks(
  svc: SupabaseClient,
  schoolId: string,
  documentId: string,
  maxChars = 16000,
  topic?: string,
): Promise<{ doc: { id: string; title: string | null; status: string } | null; text: string }> {
  const { data: doc } = await svc
    .from("school_ai_documents")
    .select("id, title, status")
    .eq("id", documentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!doc) return { doc: null, text: "" };

  const { data: chunks } = await svc
    .from("school_ai_chunks")
    .select("content, ord")
    .eq("document_id", documentId)
    .eq("school_id", schoolId)
    .order("ord", { ascending: true });

  let ordered = chunks ?? [];

  // Topic-aware retrieval: when a topic is given, rank chunks by keyword
  // overlap so material relevant to the requested topic wins the budget
  // instead of whatever happens to appear first in the document.
  const terms = (topic ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  if (terms.length > 0 && ordered.length > 1) {
    const scored = ordered.map((c) => {
      const lc = c.content.toLowerCase();
      let score = 0;
      for (const t of terms) {
        let idx = lc.indexOf(t);
        while (idx !== -1) { score++; idx = lc.indexOf(t, idx + t.length); }
      }
      return { ...c, score };
    });
    const anyHit = scored.some((c) => c.score > 0);
    if (anyHit) {
      // Relevant chunks first (by score desc, ord asc for stability),
      // then the remaining chunks in document order as filler context.
      scored.sort((a, b) => (b.score - a.score) || (a.ord - b.ord));
      ordered = scored;
    }
  }

  const picked: Array<{ content: string; ord: number }> = [];
  let total = 0;
  for (const c of ordered) {
    if (total + c.content.length > maxChars) continue;
    picked.push(c);
    total += c.content.length;
    if (total >= maxChars) break;
  }
  // Present picked chunks in reading order regardless of relevance ranking.
  picked.sort((a, b) => a.ord - b.ord);
  return { doc, text: picked.map((c) => c.content).join("\n\n").trim() };
}

export async function callAIJson<T>(
  prompt: string,
  system: string,
  usage?: UsageAttribution
): Promise<T | null> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`AI call failed ${r.status}: ${await r.text()}`);
  const j = await r.json();

  // Record real token usage (fire-and-forget) when attribution is supplied.
  if (usage && j?.usage) {
    reportTokenUsage({
      userId: usage.userId,
      bucket: usage.bucket,
      schoolId: usage.schoolId ?? null,
      tokensIn: Number(j.usage.prompt_tokens ?? 0),
      tokensOut: Number(j.usage.completion_tokens ?? 0),
    });
  }

  const text = j.choices?.[0]?.message?.content ?? "";
  return safeJsonParse<T>(text);
}

/**
 * loadCurriculumTopicText — build grounding material from the seeded
 * curriculum topic trees (curriculum_topic_templates) instead of an
 * uploaded document. Used when a teacher generates homework straight
 * from the syllabus with no ingested material.
 */
export async function loadCurriculumTopicText(
  svc: SupabaseClient,
  args: { curriculum: string; grade: string; subject: string; topic?: string | null },
  maxChars = 12000,
): Promise<{ title: string; text: string } | null> {
  const { data } = await svc
    .from("curriculum_topic_templates")
    .select("curriculum, grade, subject, topics")
    .eq("curriculum", args.curriculum)
    .eq("grade", args.grade)
    .eq("subject", args.subject)
    .maybeSingle();

  const topics = Array.isArray(data?.topics) ? (data!.topics as Array<Record<string, unknown>>) : [];
  if (topics.length === 0) return null;

  const wanted = (args.topic ?? "").trim().toLowerCase();
  const selected = wanted
    ? topics.filter((t) => String(t.name ?? "").toLowerCase().includes(wanted))
    : topics;
  const use = selected.length > 0 ? selected : topics;

  const blocks: string[] = [];
  for (const t of use) {
    const name = String(t.name ?? "").trim();
    if (!name) continue;
    const subs = Array.isArray(t.subtopics) ? (t.subtopics as unknown[]).map(String) : [];
    const keys = Array.isArray(t.key_concepts) ? (t.key_concepts as unknown[]).map(String) : [];
    const weight = t.exam_weight != null ? ` (exam weight: ${t.exam_weight}%)` : "";
    const block = [
      `TOPIC: ${name}${weight}`,
      subs.length ? `Subtopics:\n- ${subs.join("\n- ")}` : "",
      keys.length ? `Key concepts: ${keys.join(", ")}` : "",
    ].filter(Boolean).join("\n");
    if (blocks.join("\n\n").length + block.length > maxChars) break;
    blocks.push(block);
  }
  if (blocks.length === 0) return null;

  const title = wanted && selected.length > 0
    ? use[0].name as string
    : `${args.subject} — ${args.grade} (${args.curriculum})`;

  return {
    title: String(title),
    text: `Curriculum: ${args.curriculum}\nGrade/Level: ${args.grade}\nSubject: ${args.subject}\n\n${blocks.join("\n\n")}`,
  };
}
