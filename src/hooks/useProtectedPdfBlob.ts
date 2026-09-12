import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** What the edge function resolved the resource to. */
export type PdfKind = "external" | "signed" | "webpage";

interface State {
  /** Resolved URL (still exposed for "Open in browser" / webpage kinds). */
  url: string | null;
  /**
   * URL pdf.js should stream from (progressive / range requests, so page 1
   * paints before the whole file arrives). Null for webpage kinds or when
   * no readable PDF could be resolved.
   */
  streamUrl: string | null;
  /** Headers pdf.js must send (only set when streaming via the proxy). */
  streamHeaders: Record<string, string> | undefined;
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
    streamUrl: null,
    streamHeaders: undefined,
    loading: !!resourceId,
    error: null,
    kind: undefined,
  });

  useEffect(() => {
    let cancelled = false;
    const idle: State = {
      url: null,
      streamUrl: null,
      streamHeaders: undefined,
      loading: false,
      error: null,
      kind: undefined,
    };

    if (!resourceId || !source) {
      setState(idle);
      return;
    }

    // Seed/external resources have no DB row — stream the direct URL.
    const isDbBacked = UUID_RE.test(String(resourceId));
    if (!isDbBacked && !directUrl) {
      setState({ ...idle, error: "No file attached" });
      return;
    }

    setState({ ...idle, loading: true });

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Not signed in");

        const base = resolveBase();
        let url: string;
        let kind: PdfKind;
        let endpoint: string | null = null;

        if (isDbBacked) {
          endpoint = `${base}/functions/v1/library-stream?id=${encodeURIComponent(
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

          url = json.url as string;
          kind = (json.kind as PdfKind | undefined) ?? "external";
        } else {
          // Seed resource: stream the known external URL directly.
          url = directUrl!;
          kind = detectUrlKind(url) === "webpage" ? "webpage" : "external";
        }

        // Webpages can't be read in-app — surface URL only.
        if (kind === "webpage") {
          if (!cancelled) setState({ ...idle, url, kind });
          return;
        }

        // ── Pick a streamable source for pdf.js ───────────────────────────
        // pdf.js fetches the file itself with range requests, so the first
        // page paints without downloading the whole PDF. We only probe the
        // first bytes here to decide whether CORS allows a direct stream.
        let directOk = false;
        try {
          const probe = await fetch(url, {
            headers: { Range: "bytes=0-1023", Accept: "application/pdf,*/*" },
          });
          if (probe.ok || probe.status === 206) {
            const head = new Uint8Array(await probe.arrayBuffer()).subarray(0, 4);
            directOk =
              head.length < 4 ||
              String.fromCharCode(...head) === "%PDF" ||
              probe.status === 206;
          }
        } catch {
          /* CORS or network — stream through the proxy instead */
        }

        if (cancelled) return;

        if (directOk) {
          setState({ url, streamUrl: url, streamHeaders: undefined, loading: false, error: null, kind });
          return;
        }

        // Proxy through the edge function (adds CORS headers; allowlisted
        // hosts only for direct URLs).
        const proxyUrl = endpoint
          ? `${endpoint}&mode=proxy`
          : `${base}/functions/v1/library-stream?mode=proxy&url=${encodeURIComponent(url)}`;

        setState({
          url,
          streamUrl: proxyUrl,
          streamHeaders: { Authorization: `Bearer ${token}` },
          loading: false,
          error: null,
          kind,
        });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load";
        setState({ ...idle, error: msg });
      }
    })();

    return () => { cancelled = true; };
  }, [resourceId, source, directUrl]);

  return state;

}
