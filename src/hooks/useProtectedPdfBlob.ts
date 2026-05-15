import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface State {
  url: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches a library PDF through the authenticated `library-stream` edge
 * function and returns an in-memory blob: URL. The URL is revoked on unmount
 * so the bytes are not retained beyond the viewer's lifetime.
 */
export function useProtectedPdfBlob(
  resourceId: string | null | undefined,
  source: "system" | "tutorial" | null | undefined,
): State {
  const [state, setState] = useState<State>({
    url: null,
    loading: !!resourceId,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;

    if (!resourceId || !source) {
      setState({ url: null, loading: false, error: null });
      return;
    }

    setState({ url: null, loading: true, error: null });

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Not signed in");

        // Derive the function base from the configured Supabase URL so we
        // don't depend on a separate VITE_SUPABASE_PROJECT_ID env var (which
        // can be missing in some preview/runtime builds and produced
        // `https://undefined.supabase.co/...` requests).
        const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
        const fallbackUrl = (supabase as any)?.supabaseUrl as string | undefined;
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

        if (!res.ok) {
          let msg = `Request failed (${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch {/* ignore */}
          throw new Error(msg);
        }

        const blob = await res.blob();
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setState({ url: blobUrl, loading: false, error: null });
      } catch (err: any) {
        if (cancelled) return;
        setState({ url: null, loading: false, error: err?.message ?? "Failed to load" });
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [resourceId, source]);

  return state;
}
