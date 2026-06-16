// school-ingest-document — parse + chunk + embed a school resource
// POST { school_id, resource_id, content, title? }
// Auth: caller must be school_teacher or school_admin in the school.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/ai-config.ts";
import { assertSchoolContractLive } from "../_shared/school-contract.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;

function chunk(text: string): string[] {
  const clean = text.replace(/\r/g, "").trim();
  if (!clean) return [];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + CHUNK_SIZE, clean.length);
    out.push(clean.slice(i, end));
    if (end === clean.length) break;
    i = end - CHUNK_OVERLAP;
  }
  return out;
}

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });
  if (!r.ok) throw new Error(`Embed failed ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.data.map((d: { embedding: number[] }) => d.embedding);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const { school_id, resource_id, content, title, class_id, subject_id } = await req.json();
    if (!school_id || !content) return errorResponse("school_id and content required", 400);

    // User-scoped client to enforce RLS for membership check
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return errorResponse("Unauthorized", 401);

    // Service client for writes
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify membership (teacher or admin)
    const { data: memberships } = await svc
      .from("school_memberships")
      .select("role,status")
      .eq("school_id", school_id)
      .eq("user_id", userId)
      .eq("status", "active");
    const ok = (memberships ?? []).some((m: { role: string }) =>
      m.role === "school_teacher" || m.role === "school_admin"
    );
    if (!ok) return errorResponse("Forbidden — not a school teacher/admin", 403);

    // Create document row
    const { data: doc, error: docErr } = await svc
      .from("school_ai_documents")
      .insert({ school_id, resource_id, title, status: "parsed", created_by: userId })
      .select()
      .single();
    if (docErr) throw docErr;

    const pieces = chunk(content);
    if (pieces.length === 0) {
      await svc.from("school_ai_documents").update({ status: "failed", error: "Empty content" }).eq("id", doc.id);
      return errorResponse("Empty content", 400);
    }

    // Embed in batches of 20
    const BATCH = 20;
    let totalTokens = 0;
    for (let b = 0; b < pieces.length; b += BATCH) {
      const slice = pieces.slice(b, b + BATCH);
      let vectors: number[][];
      try {
        vectors = await embedBatch(slice);
      } catch (e) {
        await svc.from("school_ai_documents")
          .update({ status: "failed", error: (e as Error).message })
          .eq("id", doc.id);
        return errorResponse(`Embedding failed: ${(e as Error).message}`, 502);
      }
      const rows = slice.map((c, i) => ({
        school_id,
        document_id: doc.id,
        class_id: class_id ?? null,
        subject_id: subject_id ?? null,
        ord: b + i,
        content: c,
        embedding: vectors[i] as unknown as string, // pgvector accepts JSON array
        metadata: { title: title ?? null },
      }));
      const { error: insErr } = await svc.from("school_ai_chunks").insert(rows);
      if (insErr) {
        await svc.from("school_ai_documents")
          .update({ status: "failed", error: insErr.message }).eq("id", doc.id);
        return errorResponse(`Insert failed: ${insErr.message}`, 500);
      }
      totalTokens += slice.reduce((s, t) => s + Math.ceil(t.length / 4), 0);
    }

    await svc.from("school_ai_documents")
      .update({ status: "embedded", page_count: pieces.length, total_tokens: totalTokens })
      .eq("id", doc.id);

    // Track usage
    await svc.rpc("increment_school_ai_usage", {
      _school_id: school_id, _bucket: "ingest", _tokens_in: totalTokens, _tokens_out: 0,
    });

    return jsonResponse({ ok: true, document_id: doc.id, chunks: pieces.length, tokens: totalTokens });
  } catch (e) {
    return errorResponse((e as Error).message || "Internal error", 500);
  }
});
