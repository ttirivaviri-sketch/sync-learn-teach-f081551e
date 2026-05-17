import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** What the edge function resolved the resource to. */
export type PdfKind = "external" | "signed" | "webpage";

interface State {
  url: string | null;
  loading: boolean;
  error: string | null;
  /** Undefined while loading. Set once the edge function responds. */
  kind: PdfKind | undefined;
}

/**
 * Resolves a library resource to a directly-usable URL by calling the
 * authenticated `library-stream` Edge Function.
 *
 * The edge function returns { url, kind } where kind is one of:
 *   "external"  — a direct, publicly-accessible PDF URL (OpenStax, archive.org)
 *   "signed"    — a time-limited Supabase Storage signed URL
 *   "webpage"   — the stored path is an HTML page (Siyavula, CK-12, Gutenberg)
 *                 that cannot be iframed — caller should open in new tab.
 *
 * The hook surfaces `kind` so the DocumentViewerOverlay can pick the right
 * rendering strategy.
 */
export function useProtectedPdfBlob(
  resourceId: string | null | undefined,
  source: "system" | "tutorial" | null | undefined,
): State {
  const [state, setState] = useState<State>({
    url: null,
    loading: !!resourceId,
    error: null,
    kind: undefined,
  });

  useEffect(() => {
    let cancelled = false;

    if (!resourceId || !source) {
      setState({ url: null, loading: false, error: null, kind: undefined });
      return;
    }

    setState({ url: null, loading: true, error: null, kind: undefined });

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Not signed in");

        const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
        const fallbackUrl = (supabase as unknown as { supabaseUrl?: string })?.supabaseUrl;
        const base =
          envUrl ||
          (projectId ? `https://${projectId}.supabase.co` : undefined) ||
          fallbackUrl?.replace(/\/$/, "") ||
          "https://uynoykcratwbcdzmsxfw.supabase.co";

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

        if (cancelled) return;
        setState({
          url: json.url as string,
          loading: false,
          error: null,
          kind: (json.kind as PdfKind | undefined) ?? "external",
        });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load";
        setState({ url: null, loading: false, error: msg, kind: undefined });
      }
    })();

    return () => { cancelled = true; };
  }, [resourceId, source]);

  return state;
}
