import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface State {
  url: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Resolves a library PDF to a directly-loadable URL by calling the
 * authenticated `library-stream` Edge Function. The function returns either
 * the upstream URL (for external resources like OpenStax) or a short-lived
 * signed URL (for files in the private `library-pdfs` bucket).
 *
 * The viewer renders the result via <iframe>, which sidesteps cross-origin
 * fetch restrictions and avoids streaming hundreds of MB through the Edge
 * runtime.
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
        setState({ url: json.url as string, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load";
        setState({ url: null, loading: false, error: msg });
      }
    })();

    return () => { cancelled = true; };
  }, [resourceId, source]);

  return state;
}
