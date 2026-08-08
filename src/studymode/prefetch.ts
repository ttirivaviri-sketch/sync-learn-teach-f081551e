/**
 * Warm the Study Mode chunk during idle time so the module graph is already in
 * cache by the time the user activates it — avoiding "stale chunk" import
 * failures after a redeploy. Safe to call multiple times.
 *
 * Lives in its own tiny module so importing it from App.tsx does not pull the
 * StudyModeWrapper (and its CSS/hooks) into the main bundle.
 */
import { logger } from '@/utils/logger';

let prefetchStarted = false;

export function prefetchStudyMode() {
  if (prefetchStarted || typeof window === 'undefined') return;
  prefetchStarted = true;

  const run = () => {
    import('./components/StudyMode').catch((err) => {
      // Silent: the on-demand load path (retry + single reload) handles failures.
      prefetchStarted = false;
      logger.warn('[StudyMode] Prefetch failed (will retry on demand)', err);
    });
  };

  const idle = (window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;

  if (idle) idle(run, { timeout: 4000 });
  else window.setTimeout(run, 2000);
}
