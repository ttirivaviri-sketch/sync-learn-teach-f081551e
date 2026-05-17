// Resolves a library PDF to a URL the client can render directly.
// Returns JSON { url, kind: "external" | "signed" } so the client can load
// the PDF via <iframe> or react-pdf without us trying to proxy hundreds of MB
// through the Edge runtime (which fails for large OpenStax/archive.org files).
//
// Request:  GET /library-stream?id=<resource_uuid>&source=system|tutorial
// Response: 200 application/json { url, kind } | 4xx/5xx { error }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "Missing auth token" });

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { error: "Invalid session" });

  // Params
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const source = (url.searchParams.get("source") ?? "").toLowerCase();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return json(400, { error: "Invalid id" });
  if (source !== "system" && source !== "tutorial") {
    return json(400, { error: "Invalid source" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let path: string | null = null;

  if (source === "system") {
    const { data, error } = await admin
      .from("library_system_resources")
      .select("pdf_url")
      .eq("id", id)
      .maybeSingle();
    if (error) return json(500, { error: error.message });
    path = (data?.pdf_url ?? null) as string | null;
  } else {
    const { data, error } = await admin
      .from("tutor_tutorials")
      .select("pdf_url, status")
      .eq("id", id)
      .maybeSingle();
    if (error) return json(500, { error: error.message });
    if (data && data.status !== "published") {
      return json(403, { error: "Resource not available" });
    }
    path = (data?.pdf_url ?? null) as string | null;
  }

  if (!path) return json(404, { error: "Resource not found" });

  // Best-effort access log (non-blocking)
  admin.from("library_access_log")
    .insert({ user_id: user.id, resource_id: id, source })
    .then(() => {});

  // External URL — return as-is. Browser/iframe renders it; no proxy needed.
  if (/^https?:\/\//i.test(path)) {
    return json(200, { url: path, kind: "external" });
  }

  // Storage path — issue a short-lived signed URL from the private bucket.
  const { data: signed, error: signErr } = await admin.storage
    .from("library-pdfs")
    .createSignedUrl(path, 60 * 60); // 1 hour
  if (signErr || !signed?.signedUrl) {
    return json(404, { error: signErr?.message ?? "File missing" });
  }
  return json(200, { url: signed.signedUrl, kind: "signed" });
});
