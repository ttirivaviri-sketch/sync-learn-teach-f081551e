// gsc-search-queries — admin-only Google Search Console query tracker.
// POST { days?: 7|28|90, dimension?: "query"|"page", refresh?: boolean }
// Reads the cached snapshot unless `refresh` is true, in which case it queries
// Search Console through the Lovable connector gateway and re-caches the rows.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/ai-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GSC_KEY = Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY");

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const TARGET_URL = "https://studysync.co.za/";

const gatewayHeaders = () => ({
  Authorization: `Bearer ${LOVABLE_API_KEY}`,
  "X-Connection-Api-Key": GSC_KEY!,
});

const day = (d: Date) => d.toISOString().slice(0, 10);

function coversTarget(siteUrl: string, target: URL) {
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = target.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  try {
    return target.href.startsWith(new URL(siteUrl).href);
  } catch {
    return false;
  }
}

/** Lists verified properties at runtime and picks the one covering the site. */
async function resolveSiteUrl(selected?: string) {
  const res = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers: gatewayHeaders() });
  if (!res.ok) {
    throw new Error(`Could not list Search Console properties [${res.status}]: ${await res.text()}`);
  }
  const { siteEntry = [] } = (await res.json()) as {
    siteEntry?: { siteUrl: string; permissionLevel?: string }[];
  };
  const target = new URL(TARGET_URL);
  const matches = siteEntry.filter(
    (e) => e.permissionLevel !== "siteUnverifiedUser" && coversTarget(e.siteUrl, target),
  );
  if (selected) {
    const hit = matches.find((m) => m.siteUrl === selected);
    if (!hit) throw new Error("The selected Search Console property is not verified for this site");
    return { status: "selected" as const, siteUrl: hit.siteUrl };
  }
  if (matches.length === 0) throw new Error("No verified Search Console property covers studysync.co.za");
  if (matches.length === 1) return { status: "selected" as const, siteUrl: matches[0].siteUrl };
  return { status: "selection_required" as const, candidates: matches.map((m) => m.siteUrl) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth: admin only ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return errorResponse("Unauthorized", 401);

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await svc.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return errorResponse("Forbidden — admin access required", 403);

    const body = await req.json().catch(() => ({}));
    const days = [7, 28, 90].includes(Number(body?.days)) ? Number(body.days) : 28;
    const dimension: "query" | "page" = body?.dimension === "page" ? "page" : "query";
    const refresh = body?.refresh === true;
    const selectedSiteUrl: string | undefined = body?.site_url;

    // ── Cached read ─────────────────────────────────────────────────────
    if (!refresh) {
      const { data: snap } = await svc
        .from("gsc_query_snapshots")
        .select("*")
        .eq("range_days", days)
        .eq("dimension", dimension)
        .order("refreshed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (snap) {
        return jsonResponse({
          status: "ok",
          cached: true,
          site_url: snap.site_url,
          days,
          dimension,
          rows: snap.rows,
          totals: snap.totals,
          refreshed_at: snap.refreshed_at,
        });
      }
    }

    if (!LOVABLE_API_KEY || !GSC_KEY) {
      return errorResponse("Search Console connector is not configured", 503);
    }

    // ── Live fetch ──────────────────────────────────────────────────────
    const resolution = await resolveSiteUrl(selectedSiteUrl);
    if (resolution.status === "selection_required") {
      return jsonResponse({ status: "selection_required", candidates: resolution.candidates });
    }

    // GSC data lags ~2 days; end the window yesterday.
    const end = new Date();
    end.setDate(end.getDate() - 2);
    const start = new Date(end);
    start.setDate(start.getDate() - days);

    const query = {
      startDate: day(start),
      endDate: day(end),
      dimensions: dimension === "page" ? ["page"] : ["query"],
      rowLimit: 250,
    };

    const res = await fetch(
      `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(resolution.siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { ...gatewayHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(query),
      },
    );
    if (!res.ok) {
      const details = await res.text();
      console.error(`Search Console query failed [${res.status}]: ${details}`);
      return jsonResponse(
        { error: "Search Console request failed", status: res.status, details },
        res.status,
      );
    }

    const payload = (await res.json()) as {
      rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
    };
    const rows = (payload.rows ?? []).map((r) => ({
      key: r.keys?.[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }));
    const totals = {
      clicks: rows.reduce((s, r) => s + r.clicks, 0),
      impressions: rows.reduce((s, r) => s + r.impressions, 0),
      terms: rows.length,
    };

    const refreshedAt = new Date().toISOString();
    await svc.from("gsc_query_snapshots").upsert(
      {
        site_url: resolution.siteUrl,
        range_days: days,
        dimension,
        start_date: query.startDate,
        end_date: query.endDate,
        rows,
        totals,
        refreshed_at: refreshedAt,
      },
      { onConflict: "site_url,range_days,dimension" },
    );

    return jsonResponse({
      status: "ok",
      cached: false,
      site_url: resolution.siteUrl,
      days,
      dimension,
      rows,
      totals,
      refreshed_at: refreshedAt,
    });
  } catch (e) {
    console.error("gsc-search-queries error", e);
    return errorResponse(e instanceof Error ? e.message : "Unexpected error", 500);
  }
});
