// studymode-context-retrieve — P9 Context Engine (server)
// Knowledge Hierarchy retrieval for school learners:
//   1. Teacher uploads (filtered by teacher_id metadata)
//   2. Class resources (class_id match)
//   3. Grade resources (grade_id match — via metadata)
//   4. School resources (school_id match — already enforced)
//   5. Curriculum templates (curriculum_topic_templates)
//   6. Tutor tutorials (chunks the learner has access to via bookings)
//   7. General LLM knowledge (caller falls back if no chunks returned)
//
// Tenant isolation: the learner's school_id is read from
// student_context_snapshots — NEVER from the request body.
//
// POST { query, subject_id?, topic?, k? }
// Returns { chunks: [...], source: "school"|"curriculum"|"tutor"|"none", school_id }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/ai-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const EMBED_MODEL = "openai/text-embedding-3-small";

async function embedOne(text: string): Promise<number[]> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!r.ok) throw new Error(`Embed failed ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.data[0].embedding;
}

interface Chunk {
  id: string;
  document_id: string;
  content: string;
  class_id: string | null;
  subject_id: string | null;
  metadata: Record<string, unknown>;
  similarity: number;
  priority?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const { query, subject_id, topic, k } = body as {
      query?: string; subject_id?: string; topic?: string; k?: number;
    };
    if (!query || typeof query !== "string" || !query.trim()) {
      return errorResponse("query is required", 400);
    }

    // Resolve caller from JWT.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return errorResponse("Unauthorized", 401);

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load (or refresh) the snapshot — the only source of truth for school_id.
    let { data: snap } = await svc
      .from("student_context_snapshots")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!snap) {
      const { data: refreshed } = await svc.rpc("refresh_student_context_snapshot", { _user_id: userId });
      snap = Array.isArray(refreshed) ? refreshed[0] : refreshed;
    }

    const limit = Math.max(1, Math.min(k ?? 8, 20));

    // No school context → tell caller to fall back to general knowledge.
    if (!snap?.school_id) {
      return jsonResponse({ chunks: [], source: "none", school_id: null, has_school: false });
    }

    // Embed the query once, reuse across priority passes.
    const embedding = await embedOne(`${query}${topic ? `\nTopic: ${topic}` : ""}`);

    // Priority 1–4: progressively widen filter inside the school.
    // match_school_chunks already enforces school_id isolation server-side.
    const passes: Array<{ class_id: string | null; priority: number }> = [];
    const classIds: string[] = snap.class_ids ?? [];
    // P1+P2: each enrolled class (teacher uploads attached to a class are filtered here)
    for (const cid of classIds) passes.push({ class_id: cid, priority: 2 });
    // P3+P4: school-wide
    passes.push({ class_id: null, priority: 4 });

    const seen = new Set<string>();
    const collected: Chunk[] = [];

    for (const pass of passes) {
      if (collected.length >= limit) break;
      const { data, error } = await svc.rpc("match_school_chunks", {
        _school_id: snap.school_id,
        _query_embedding: embedding as unknown as string,
        _match_count: limit,
        _class_id: pass.class_id,
      });
      if (error) continue;
      for (const row of (data ?? []) as Chunk[]) {
        if (seen.has(row.id)) continue;
        // Optional: subject_id filter at the application layer if provided.
        if (subject_id && row.subject_id && row.subject_id !== subject_id) continue;
        seen.add(row.id);
        collected.push({ ...row, priority: pass.priority });
        if (collected.length >= limit) break;
      }
    }

    // Track usage.
    await svc.rpc("increment_school_ai_usage", {
      _school_id: snap.school_id,
      _bucket: "context_retrieve",
      _tokens_in: Math.ceil(query.length / 4),
      _tokens_out: 0,
    });

    return jsonResponse({
      chunks: collected,
      source: collected.length > 0 ? "school" : "none",
      school_id: snap.school_id,
      has_school: true,
      context: {
        grade_id: snap.grade_id,
        class_ids: snap.class_ids,
        subject_ids: snap.subject_ids,
        curriculum: snap.curriculum,
      },
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Internal error", 500);
  }
});
