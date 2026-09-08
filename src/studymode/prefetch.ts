/**
 * Warm the Study Mode chunk during idle time so the module graph is already in
 * cache by the time the user activates it — avoiding "stale chunk" import
 * failures after a redeploy. Safe to call multiple times.
 *
 * Only warmed on in-app routes: marketing/landing visitors must not pay for
 * ~230 KB (and ~100 extra module requests) they will never use.
 *
 * Lives in its own tiny module so importing it from App.tsx does not pull the
 * StudyModeWrapper (and its CSS/hooks) into the main bundle.
 */
import { logger } from '@/utils/logger';

let prefetchStarted = false;

/** Routes where Study Mode can actually be opened. */
const APP_ROUTE_PREFIXES = ['/learner', '/school', '/teacher', '/app'];

function shouldPrefetch(pathname: string) {
  if (!APP_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  // Respect data-saver / very slow connections.
  const conn = (navigator as unknown as {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return false;
  return true;
}

export function prefetchStudyMode(pathname = typeof window !== 'undefined' ? window.location.pathname : '') {
  if (prefetchStarted || typeof window === 'undefined') return;
  if (!shouldPrefetch(pathname)) return;
  prefetchStarted = true;

  const run = () => {
    import('./components/StudyMode').catch((err) => {
      // Silent: the on-demand load path (retry + single reload) handles failures.
      prefetchStarted = false;
      logger.warn('[StudyMode] Prefetch failed (will retry on demand)', err);
    });
  };

  const schedule = () => {
    const idle = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (idle) idle(run, { timeout: 6000 });
    else window.setTimeout(run, 3000);
  };

  // Never compete with the first paint / first data fetches of the page.
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
}
