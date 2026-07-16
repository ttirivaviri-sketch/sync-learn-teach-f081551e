/**
 * companionTracking — outcome telemetry for the Study Companion.
 *
 * Fire-and-forget writes into `companion_interactions` so we can learn which
 * suggestions students actually engage with (shown → clicked/booked vs
 * dismissed). Failures are swallowed: tracking must never break the UI, and
 * the table may not exist yet in environments behind on migrations.
 *
 * Dedupe: 'shown' events are throttled to once per suggestion per day via
 * localStorage so paging back and forth doesn't spam rows.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CompanionSuggestion } from "@/hooks/useCompanionRecommendations";

export type CompanionEvent = "shown" | "clicked" | "dismissed" | "booked";

function shownKey() {
  return `companion-shown:${new Date().toISOString().slice(0, 10)}`;
}

function readShown(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(shownKey()) ?? "[]"));
  } catch {
    return new Set();
  }
}

function writeShown(ids: Set<string>) {
  try {
    localStorage.setItem(shownKey(), JSON.stringify(Array.from(ids)));
  } catch {
    /* storage unavailable — skip dedupe */
  }
}

export function trackCompanionEvent(
  userId: string,
  suggestion: CompanionSuggestion,
  event: CompanionEvent,
): void {
  if (!userId || !suggestion) return;

  if (event === "shown") {
    const shown = readShown();
    if (shown.has(suggestion.id)) return;
    shown.add(suggestion.id);
    writeShown(shown);
  }

  void supabase
    .from("companion_interactions" as never)
    .insert({
      user_id: userId,
      suggestion_id: suggestion.id,
      suggestion_kind: suggestion.kind,
      event,
      topic: suggestion.topic || null,
      subject: suggestion.subject || null,
      resource_id: suggestion.resource?.id ?? null,
      tutor_id: suggestion.tutor?.id ?? null,
      metadata: { reason: suggestion.reason },
    } as never)
    .then(({ error }) => {
      if (error && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
        // eslint-disable-next-line no-console
        console.debug("[companionTracking] insert failed", error.message);
      }
    });
}
