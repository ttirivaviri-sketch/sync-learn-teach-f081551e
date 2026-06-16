// school-ingest-retry — deletes a failed ingest document so it can be re-uploaded,
// OR re-ingests a provided content payload against the same doc title.
// POST { school_id, document_id, content? }
// Auth: teacher/admin in school.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/ai-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return errorResponse("Unauthorized", 401);
    const { school_id, document_id } = await req.json();
    if (!school_id || !document_id) return errorResponse("school_id and document_id required", 400);

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
    const ok = (memberships ?? []).some((m: { role: string }) =>
      m.role === "school_teacher" || m.role === "school_admin"
    );
    if (!ok) return errorResponse("Forbidden", 403);

    // Reset doc state to queued + clear chunks; user is expected to re-run ingest with content.
    await svc.from("school_ai_chunks").delete().eq("document_id", document_id).eq("school_id", school_id);
    const { error } = await svc.from("school_ai_documents")
      .update({ status: "queued", error: null, total_tokens: 0, page_count: 0 })
      .eq("id", document_id)
      .eq("school_id", school_id);
    if (error) throw error;

    return jsonResponse({ ok: true, document_id, status: "queued" });
  } catch (e) {
    return errorResponse((e as Error).message || "Internal error", 500);
  }
});
