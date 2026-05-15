// Streams library PDFs through an authenticated, server-mediated endpoint
// so we never expose direct/public Storage URLs to the client.
//
// Request:  GET /library-stream?id=<resource_uuid>&source=system|tutorial
// Response: application/pdf bytes (inline), or JSON error.

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
  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  // 1. Auth: validate the caller's JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "Missing auth token" });

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { error: "Invalid session" });

  // 2. Parse params
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const source = (url.searchParams.get("source") ?? "").toLowerCase();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return json(400, { error: "Invalid id" });
  }
  if (source !== "system" && source !== "tutorial") {
    return json(400, { error: "Invalid source" });
  }

  // 3. Look up storage path with service role
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
  admin
    .from("library_access_log")
    .insert({ user_id: user.id, resource_id: id, source })
    .then(() => {});

  // External (non-Storage) URLs — proxy the bytes through so the client never
  // sees the origin URL and stays inside our app.
  if (/^https?:\/\//i.test(path)) {
    try {
      const upstream = await fetch(path, {
        headers: { "User-Agent": "StudySync-LibraryProxy/1.0" },
        redirect: "follow",
      });
      if (!upstream.ok || !upstream.body) {
        return json(upstream.status || 502, {
          error: `Upstream returned ${upstream.status}`,
        });
      }
      const ct = upstream.headers.get("Content-Type") ?? "application/pdf";
      // Only stream if it actually looks like a PDF; HTML landing pages are useless to a PDF viewer.
      if (!ct.toLowerCase().includes("pdf")) {
        return json(415, {
          error: "Source is not a direct PDF link",
          contentType: ct,
        });
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": "inline",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (e) {
      return json(502, { error: e instanceof Error ? e.message : "Proxy failed" });
    }
  }

  // 4. Pull bytes from the private bucket
  const { data: blob, error: dlErr } = await admin.storage
    .from("library-pdfs")
    .download(path);
  if (dlErr || !blob) {
    return json(404, { error: dlErr?.message ?? "File missing" });
  }

  const buf = await blob.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
