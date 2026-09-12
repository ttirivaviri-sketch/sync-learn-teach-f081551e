import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** What the edge function resolved the resource to. */
export type PdfKind = "external" | "signed" | "webpage";

interface State {
  /** Resolved URL (still exposed for "Open in browser" / webpage kinds). */
  url: string | null;
  /**
   * Raw PDF bytes for the in-app pdf.js reader. Null while loading, for
   * webpage kinds, or if both direct and proxied fetches failed (the
   * viewer then falls back to the iframe/open-in-browser path).
   */
  data: ArrayBuffer | null;
  loading: boolean;
  error: string | null;
  /** Undefined while loading. Set once the edge function responds. */
  kind: PdfKind | undefined;
}

function resolveBase(): string {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
  const fallbackUrl = (supabase as unknown as { supabaseUrl?: string })?.supabaseUrl;
  return (
    envUrl ||
    (projectId ? `https://${projectId}.supabase.co` : undefined) ||
    fallbackUrl?.replace(/\/$/, "") ||
    "https://uynoykcratwbcdzmsxfw.supabase.co"
  );
}

/**
 * Resolves a library resource to something the in-app reader can render by
 * calling the authenticated `library-stream` Edge Function.
 *
 * Step 1 — resolve: GET /library-stream?id&source → { url, kind }
 *   "external"  — direct, publicly-accessible PDF URL (OpenStax, archive.org)
 *   "signed"    — a time-limited Supabase Storage signed URL
 *   "webpage"   — HTML page (Siyavula, CK-12, Gutenberg) — open in new tab.
 *
 * Step 2 — for PDF kinds, fetch the actual bytes so pdf.js can render a
 * real scrollable document (iframes show only page 1 on iOS Safari):
 *   a) direct fetch of the resolved URL (works when the host sends CORS
 *      headers — Supabase signed URLs always do);
 *   b) fall back to `&mode=proxy`, which streams the bytes through the
 *      edge function with CORS headers (papacambridge etc. block CORS).
 */
const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Client-side mirror of the edge function's URL kind detection. */
function detectUrlKind(url: string): "pdf" | "webpage" {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (path.endsWith(".pdf")) return "pdf";
    if (u.hostname === "assets.openstax.org") return "pdf";
    if (u.hostname.includes("archive.org") && path.startsWith("/download/")) return "pdf";
    return "webpage";
  } catch {
    return "webpage";
  }
}

/**
 * @param directUrl For seed resources without a DB id: the external PDF URL
 * itself. When the id isn't a UUID, the hook skips the DB resolve step and
 * streams this URL instead (direct fetch first, then the allowlisted
 * `mode=proxy&url=` fallback on the edge function).
 */
export function useProtectedPdfBlob(
  resourceId: string | null | undefined,
  source: "system" | "tutorial" | null | undefined,
  directUrl?: string | null,
): State {
  const [state, setState] = useState<State>({
    url: null,
    data: null,
    loading: !!resourceId,
    error: null,
    kind: undefined,
  });

  useEffect(() => {
    let cancelled = false;

    if (!resourceId || !source) {
      setState({ url: null, data: null, loading: false, error: null, kind: undefined });
      return;
    }

    setState({ url: null, data: null, loading: true, error: null, kind: undefined });

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Not signed in");

        const base = resolveBase();
        const endpoint = `${base}/functions/v1/library-stream?id=${encodeURIComponent(
          resourceId,
        )}&source=${source}`;

        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error ?? `Request failed (${res.status})`);
        }
        if (!json?.url) throw new Error("No URL returned");

        const url = json.url as string;
        const kind = (json.kind as PdfKind | undefined) ?? "external";

        // Webpages can't be read in-app — surface URL only.
        if (kind === "webpage") {
          if (!cancelled) setState({ url, data: null, loading: false, error: null, kind });
          return;
        }

        // ── Fetch PDF bytes for the in-app reader ──────────────────────────
        let bytes: ArrayBuffer | null = null;

        // (a) Direct fetch — free, works for CORS-enabled hosts.
        try {
          const direct = await fetch(url, { headers: { Accept: "application/pdf,*/*" } });
          if (direct.ok) bytes = await direct.arrayBuffer();
        } catch {
          /* CORS or network — try proxy */
        }

        // (b) Proxy through the edge function.
        if (!bytes && !cancelled) {
          try {
            const proxied = await fetch(`${endpoint}&mode=proxy`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (proxied.ok && (proxied.headers.get("content-type") || "").includes("pdf")) {
              bytes = await proxied.arrayBuffer();
            }
          } catch {
            /* fall through — viewer will use iframe fallback */
          }
        }

        // Sanity: PDF files start with "%PDF".
        if (bytes && bytes.byteLength >= 4) {
          const head = new Uint8Array(bytes, 0, 4);
          const sig = String.fromCharCode(...head);
          if (sig !== "%PDF") bytes = null;
        } else {
          bytes = null;
        }

        if (cancelled) return;
        setState({ url, data: bytes, loading: false, error: null, kind });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load";
        setState({ url: null, data: null, loading: false, error: msg, kind: undefined });
      }
    })();

    return () => { cancelled = true; };
  }, [resourceId, source]);

  return state;
}
