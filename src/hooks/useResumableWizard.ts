import { useEffect, useState } from "react";

/**
 * Persists wizard state (text fields + step index) to localStorage per-user
 * so a refresh mid-flow does not lose progress. File inputs are NOT persisted
 * — those still need to be re-picked.
 */
export function useResumableWizard<T extends Record<string, any>>(key: string, initial: T) {
  const storageKey = `wizard:${key}`;
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return initial;
      return { ...initial, ...JSON.parse(raw) };
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* quota — ignore */
    }
  }, [storageKey, state]);

  const clear = () => {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  };

  return { state, setState, clear };
}
