// school-search — RAG retrieval scoped to a school tenant
// POST { school_id, query, class_id?, k? }
// Returns top-k chunks. Always validates JWT membership server-side.

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
  if (!r.ok) throw new Error(`Embed failed ${r.status}`);
  const j = await r.json();
  return j.data[0].embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const { school_id, query, class_id, k } = await req.json();
    if (!school_id || !query) return errorResponse("school_id and query required", 400);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return errorResponse("Unauthorized", 401);

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: memberships } = await svc
      .from("school_memberships")
      .select("role")
      .eq("school_id", school_id)
      .eq("user_id", userId)
      .eq("status", "active");
    if (!memberships || memberships.length === 0) {
      return errorResponse("Forbidden — not a school member", 403);
    }

    const embedding = await embedOne(query);
    const { data, error } = await svc.rpc("match_school_chunks", {
      _school_id: school_id,
      _query_embedding: embedding as unknown as string,
      _match_count: Math.max(1, Math.min(k ?? 8, 20)),
      _class_id: class_id ?? null,
    });
    if (error) throw error;

    await svc.rpc("increment_school_ai_usage", {
      _school_id: school_id, _bucket: "search", _tokens_in: Math.ceil(query.length / 4), _tokens_out: 0,
    });

    return jsonResponse({ chunks: data ?? [] });
  } catch (e) {
    return errorResponse((e as Error).message || "Internal error", 500);
  }
});
