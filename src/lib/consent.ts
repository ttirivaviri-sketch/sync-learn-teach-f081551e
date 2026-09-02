/**
 * Cookie/analytics consent state — single source of truth.
 *
 * The CookieConsent banner writes `cookie-consent` to localStorage
 * ("accepted" | "declined"). Anything that does OPTIONAL tracking
 * (e.g. attaching the user's email to Sentry error reports) must check
 * `hasAnalyticsConsent()` first. Strictly-necessary cookies (auth session,
 * preferences) are exempt and never gated.
 */

const KEY = "cookie-consent";

export type ConsentValue = "accepted" | "declined" | null;

export function getConsent(): ConsentValue {
  try {
    const v = localStorage.getItem(KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null; // storage unavailable (private mode) — treat as undecided
  }
}

/** True only when the user has explicitly accepted. Undecided = no consent. */
export function hasAnalyticsConsent(): boolean {
  return getConsent() === "accepted";
}

export function setConsent(value: "accepted" | "declined"): void {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* storage unavailable — banner will just reappear */
  }
  // Let already-initialised services react (e.g. Sentry drops user email).
  try {
    window.dispatchEvent(new CustomEvent("cookie-consent-changed", { detail: value }));
  } catch {
    /* non-browser env */
  }
}
