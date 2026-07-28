/**
 * Data Saver mode — reduce bandwidth for students on expensive mobile data
 * (the #1 access barrier in ZA/ZW per regional edtech surveys).
 *
 * When enabled (explicitly by the user, or auto-detected via the browser's
 * Save-Data hint / 2g connection):
 *  - photo-solve uploads compress harder (1024px / q0.6 vs 1600px / q0.82)
 *  - decorative images can be skipped by consumers that ask
 *  - AI responses prefer non-streaming (fewer connection round-trips)
 *
 * Stored in localStorage; `subscribeDataSaver` lets React components follow
 * changes via useSyncExternalStore.
 */

const KEY = "ss-data-saver";
type Mode = "on" | "off" | "auto";

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

function connection(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

/** Browser hints that the user is on a constrained connection. */
export function networkSuggestsSaving(): boolean {
  const c = connection();
  if (!c) return false;
  if (c.saveData) return true;
  return c.effectiveType === "2g" || c.effectiveType === "slow-2g";
}

export function getDataSaverMode(): Mode {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "on" || raw === "off") return raw;
    return "auto";
  } catch {
    return "auto";
  }
}

/** Effective state: explicit setting wins; auto follows network hints. */
export function isDataSaverActive(): boolean {
  const mode = getDataSaverMode();
  if (mode === "on") return true;
  if (mode === "off") return false;
  return networkSuggestsSaving();
}

const listeners = new Set<() => void>();

export function setDataSaverMode(mode: Mode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function subscribeDataSaver(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Image compression parameters for uploads (photo solve etc). */
export function imageCompressionParams(): { maxDim: number; quality: number } {
  return isDataSaverActive()
    ? { maxDim: 1024, quality: 0.6 }
    : { maxDim: 1600, quality: 0.82 };
}
