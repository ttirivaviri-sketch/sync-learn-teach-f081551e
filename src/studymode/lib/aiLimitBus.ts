/**
 * Tiny event bus used to surface AI quota problems (credits exhausted /
 * daily free limit reached) anywhere in the app, so a single global
 * upgrade dialog can react instead of every call site building its own UI.
 */

export type AiLimitReason = "credits_exhausted" | "daily_limit_reached";

export interface AiLimitEvent {
  reason: AiLimitReason;
  message: string;
  /** Optional usage context for the daily free-tier limit. */
  used?: number;
  limit?: number;
  bucket?: string;
}

type Listener = (event: AiLimitEvent) => void;

const listeners = new Set<Listener>();

export function onAiLimit(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitAiLimit(event: AiLimitEvent): void {
  listeners.forEach((l) => {
    try {
      l(event);
    } catch {
      /* listener errors must never break an AI call */
    }
  });
}
