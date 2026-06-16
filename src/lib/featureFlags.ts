/**
 * Production feature flags for StudySync. Defaults to "on" so existing
 * behaviour is preserved unless an operator explicitly disables a surface.
 *
 * Per the P8 rollout plan, `FEATURE_SCHOOLS` gates the entire School
 * workspace (routes, navigation hooks, and edge-function-driven AI
 * surfaces). Flip to "off" via `VITE_FEATURE_SCHOOLS=off` to hide the
 * school portal everywhere without removing data.
 */
function readFlag(name: string, fallback: boolean): boolean {
  const raw = (import.meta as { env?: Record<string, string | undefined> }).env?.[name];
  if (raw == null) return fallback;
  const v = String(raw).trim().toLowerCase();
  if (["off", "false", "0", "no"].includes(v)) return false;
  if (["on", "true", "1", "yes"].includes(v)) return true;
  return fallback;
}

export const FEATURE_SCHOOLS = readFlag("VITE_FEATURE_SCHOOLS", true);
