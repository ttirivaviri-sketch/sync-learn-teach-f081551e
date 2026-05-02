/**
 * landingAnalytics — Lightweight, anonymous landing-page event tracking.
 *
 * Persists events to the `landing_events` table so we can diagnose bounce
 * rate and CTA performance without bringing in a 3rd-party analytics SDK.
 */
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "ss_landing_session";

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "anon-" + Date.now().toString(36);
  }
}

export type LandingEvent =
  | "page_view"
  | "cta_click"
  | "scroll_50"
  | "scroll_90"
  | "section_view"
  | "exit_intent";

const fired = new Set<string>();

export async function track(
  event: LandingEvent,
  metadata: Record<string, unknown> = {}
) {
  // Only fire each "once per session" event a single time
  const onceEvents: LandingEvent[] = [
    "page_view",
    "scroll_50",
    "scroll_90",
    "exit_intent",
  ];
  if (onceEvents.includes(event)) {
    if (fired.has(event)) return;
    fired.add(event);
  }

  try {
    await supabase.from("landing_events").insert({
      session_id: getSessionId(),
      event,
      path: typeof window !== "undefined" ? window.location.pathname : null,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      metadata,
    });
  } catch {
    // Best-effort — never block the UI on analytics
  }
}

/**
 * Set up scroll-depth + exit-intent tracking. Returns a cleanup function.
 * Safe to call once per landing-page mount.
 */
export function installScrollDepthTracking(): () => void {
  if (typeof window === "undefined") return () => {};

  const onScroll = () => {
    const doc = document.documentElement;
    const scrollPct =
      ((doc.scrollTop + window.innerHeight) / doc.scrollHeight) * 100;
    if (scrollPct >= 50) track("scroll_50", { pct: Math.round(scrollPct) });
    if (scrollPct >= 90) track("scroll_90", { pct: Math.round(scrollPct) });
  };

  const onMouseLeave = (e: MouseEvent) => {
    if (e.clientY <= 0) track("exit_intent");
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("mouseleave", onMouseLeave);
  return () => {
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("mouseleave", onMouseLeave);
  };
}
