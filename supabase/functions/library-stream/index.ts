// Resolves a library resource to a URL the client can render.
//
// Returns JSON { url, kind: "external" | "signed" | "webpage" }
//   external  — direct, publicly-accessible PDF URL (OpenStax, archive.org …)
//   signed    — short-lived Supabase Storage signed URL (private bucket)
//   webpage   — the stored path is an HTML page (Siyavula, CK-12, Gutenberg …)
//               The client should open it in a new tab instead of iframing it.
//
// Request:  GET /library-stream?id=<resource_uuid>&source=system|tutorial
// Response: 200 application/json { url, kind } | 4xx/5xx { error }
//
// PROXY MODE (`&mode=proxy`): streams the resolved PDF bytes back through
// this function with CORS headers. Needed by the in-app pdf.js reader —
// most external paper hosts (e.g. pastpapers.papacambridge.com) don't send
// Access-Control-Allow-Origin, so the browser cannot fetch their bytes
// directly. Only PDFs are proxied; webpages still return JSON.

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

/** Refuse to proxy documents larger than this (bytes). */
const MAX_PROXY_BYTES = 40 * 1024 * 1024; // 40 MB

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Heuristic: decide whether a URL points to a direct PDF file or an HTML page.
 *
 * Returns "pdf" when the URL strongly suggests a downloadable PDF:
 *  - path ends in .pdf (optionally followed by query string)
 *  - URL is from a known PDF-CDN (OpenStax assets.openstax.org)
 *
 * Returns "webpage" for everything else (Siyavula reader, CK-12, Gutenberg
 * HTML, Project Gutenberg ebooks page, etc.)
 */
function detectUrlKind(url: string): "pdf" | "webpage" {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();

    // Explicit .pdf extension
    if (path.endsWith(".pdf")) return "pdf";

    // OpenStax assets CDN always serves PDFs
    if (u.hostname === "assets.openstax.org") return "pdf";

    // archive.org /download/ paths are almost always direct file downloads
    if (u.hostname.includes("archive.org") && path.startsWith("/download/")) return "pdf";

    // Everything else is treated as a webpage
    return "webpage";
  } catch {
    return "webpage";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "Missing auth token" });

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { error: "Invalid session" });

  // ── Params ────────────────────────────────────────────────────────────────
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const source = (url.searchParams.get("source") ?? "").toLowerCase();
  const mode = (url.searchParams.get("mode") ?? "").toLowerCase();
  const directUrl = url.searchParams.get("url");

  // Direct-URL proxy mode: for seed resources with no DB row. Auth is still
  // required, and the host must be allowlisted so this can't be abused as an
  // open proxy.
  if (!id && mode === "proxy" && directUrl) {
    if (!isAllowedDirectUrl(directUrl)) {
      return json(403, { error: "URL host not allowed" });
    }
    return proxyPdf(directUrl);
  }

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

  // ── Best-effort access log (non-blocking) ─────────────────────────────────
  admin.from("library_access_log")
    .insert({ user_id: user.id, resource_id: id, source })
    .then(() => {});

  // ── Resolve the path/URL to the correct kind ──────────────────────────────

  // Case 1: External URL (OpenStax CDN, archive.org, Siyavula, Gutenberg …)
  if (/^https?:\/\//i.test(path)) {
    const kind = detectUrlKind(path);
    if (mode === "proxy" && kind === "pdf") {
      return proxyPdf(path);
    }
    return json(200, { url: path, kind });
  }

  // Case 2: Storage object path — issue a short-lived signed URL
  const { data: signed, error: signErr } = await admin.storage
    .from("library-pdfs")
    .createSignedUrl(path, 60 * 60); // 1 hour
  if (signErr || !signed?.signedUrl) {
    return json(404, { error: signErr?.message ?? "File missing" });
  }
  if (mode === "proxy") {
    return proxyPdf(signed.signedUrl);
  }
  return json(200, { url: signed.signedUrl, kind: "signed" });
});

/**
 * Fetch a remote PDF server-side and stream its bytes back with CORS
 * headers so the browser's pdf.js reader can consume them.
 */
async function proxyPdf(remoteUrl: string): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(remoteUrl, {
      redirect: "follow",
      headers: {
        // Some paper hosts block requests without a browser-like UA.
        "User-Agent":
          "Mozilla/5.0 (compatible; StudySyncReader/1.0; +https://studysync.app)",
        Accept: "application/pdf,*/*",
      },
    });
  } catch (err) {
    return json(502, {
      error: `Upstream fetch failed: ${err instanceof Error ? err.message : "network error"}`,
    });
  }

  if (!upstream.ok || !upstream.body) {
    return json(502, { error: `Upstream returned ${upstream.status}` });
  }

  const len = Number(upstream.headers.get("content-length") || 0);
  if (len > MAX_PROXY_BYTES) {
    return json(413, { error: "Document too large to stream" });
  }

  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", "application/pdf");
  if (len > 0) headers.set("Content-Length", String(len));
  // Papers are immutable — let the browser/CDN cache aggressively.
  headers.set("Cache-Control", "public, max-age=86400");

  return new Response(upstream.body, { status: 200, headers });
}
